// يجلب من كل مصدر اكستريم (من سيرفر GitHub Actions مو من المتصفح):
//  1) قوائم الأفلام والمسلسلات
//  2) حلقات كل مسلسل (get_series_info) مع معرّفات الحلقات لبناء روابط التشغيل
// ويحفظها كملفات JSON ثابتة داخل الريبو، فالموقع (https) يقرأها من نفس الدومين بدون حظر.
// الحلقات تنجلب تدريجيًا: أي مسلسل ما تغيّر (last_modified) ما نعيد جلبه.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const UA = 'VLC/3.0.20 LibVLC/3.0.20';
const OUT = 'data/xtream';
const SHARDS = 64;                       // لازم يطابق EP_SHARDS بـreference.js
const CONCURRENCY = 6;
const TIME_BUDGET_MS = 150 * 60 * 1000;  // نوقف جلب الحلقات بعد 150 دقيقة ونحفظ اللي خلص، والتشغيل الجاي يكمل
const started = Date.now();

const sources = JSON.parse(await readFile('data/sources.json', 'utf8'));
await mkdir(OUT, { recursive: true });

async function api(src, params, timeout = 90_000) {
  const url = new URL(src.base.replace(/\/$/, '') + '/player_api.php');
  url.searchParams.set('username', src.username);
  url.searchParams.set('password', src.password);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(timeout) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  try { return JSON.parse(text); } catch { throw new Error('ليس JSON: ' + text.slice(0, 80)); }
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

// يجلب الحلقات لكل المسلسلات بشكل تدريجي ويكتب الـshards
async function syncEpisodes(src, seriesList, st) {
  const shards = Array.from({ length: SHARDS }, () => ({}));
  const old = await Promise.all(
    shards.map((_, i) => readJson(`${OUT}/${src.name}-eps-${i}.json`, {}))
  );
  const todo = [];
  let reused = 0;
  for (const s of seriesList) {
    const id = String(s.series_id);
    const idx = Number(s.series_id) % SHARDS;
    const prev = old[idx][id];
    const lm = String(s.last_modified || '');
    if (prev && lm && prev.lm === lm) { shards[idx][id] = prev; reused++; }
    else todo.push({ id, idx, lm, prev });
  }

  let done = 0, failed = 0, stopped = false;
  let cursor = 0;
  async function worker() {
    while (!stopped) {
      const job = todo[cursor++];
      if (!job) return;
      if (Date.now() - started > TIME_BUDGET_MS) { stopped = true; return; }
      try {
        const info = await api(src, { action: 'get_series_info', series_id: job.id }, 45_000);
        const episodes = {};
        for (const [season, list] of Object.entries(info?.episodes || {})) {
          episodes[season] = (list || []).map((e) => ({
            id: e.id, episode_num: e.episode_num, title: e.title || '',
            container_extension: e.container_extension || 'mp4',
          }));
        }
        shards[job.idx][job.id] = { lm: job.lm, episodes };
        done++;
      } catch {
        failed++;
        if (job.prev) shards[job.idx][job.id] = job.prev; // نحتفظ بالقديم بدل ما نخسره
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // اللي ما وصلنا له بسبب الوقت: نحتفظ بنسخته القديمة لو موجودة
  for (let i = cursor - 1; i < todo.length; i++) {
    const job = todo[i];
    if (job && job.prev && !shards[job.idx][job.id]) shards[job.idx][job.id] = job.prev;
  }
  for (let i = 0; i < SHARDS; i++) {
    await writeFile(`${OUT}/${src.name}-eps-${i}.json`, JSON.stringify(shards[i]));
  }
  st.episodes = { reused, fetched: done, failed, pending: stopped ? todo.length - cursor + 1 : 0 };
}

const status = { updatedAt: new Date().toISOString(), sources: {} };
let anyOk = false;

for (const src of sources) {
  const st = { ok: false };
  try {
    const info = await api(src, {});
    st.account = info?.user_info?.status ?? null;
    st.expires = info?.user_info?.exp_date ?? null;
    st.maxConnections = info?.user_info?.max_connections ?? null;

    const vod = await api(src, { action: 'get_vod_streams' });
    const series = await api(src, { action: 'get_series' });
    if (!Array.isArray(vod) || !Array.isArray(series)) throw new Error('رد غير متوقع (الحساب ممكن منتهي)');

    const slimVod = vod.map((v) => ({ name: v.name, stream_id: v.stream_id, container_extension: v.container_extension }));
    const slimSeries = series.map((s) => ({ name: s.name, series_id: s.series_id, year: s.year || s.releaseDate || '' }));
    await writeFile(`${OUT}/${src.name}-vod.json`, JSON.stringify(slimVod));
    await writeFile(`${OUT}/${src.name}-series.json`, JSON.stringify(slimSeries));
    st.ok = true; st.movies = slimVod.length; st.series = slimSeries.length;
    anyOk = true;

    try { await syncEpisodes(src, series, st); }
    catch (e) { st.episodesError = String(e.message || e); }
  } catch (e) {
    st.error = String(e.cause?.code || e.message || e);
  }
  status.sources[src.name] = st;
  console.log(src.name, JSON.stringify(st));
}

await writeFile(`${OUT}/status.json`, JSON.stringify(status, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = Object.entries(status.sources).map(([n, s]) => {
    const e = s.episodes ? `جديد ${s.episodes.fetched} / محفوظ ${s.episodes.reused} / فشل ${s.episodes.failed} / متبقي ${s.episodes.pending}` : (s.episodesError || '-');
    return `| ${n} | ${s.ok ? '✅' : '❌'} | ${s.movies ?? '-'} | ${s.series ?? '-'} | ${e} | ${s.account ?? ''} ${s.error ?? ''} |`;
  });
  const md = `| المصدر | الحالة | أفلام | مسلسلات | الحلقات | ملاحظة |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
  await writeFile(process.env.GITHUB_STEP_SUMMARY, md, { flag: 'a' });
}
if (!anyOk) process.exit(1);
