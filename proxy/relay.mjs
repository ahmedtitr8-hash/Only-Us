// وسيط تجريبي يشتغل داخل GitHub Actions: يجلب فيديو اكستريم http باسم VLC ويقدّمه https عبر القناة.
//   /p?u=<رابط>      الفيديو نفسه (يدعم التقديم Range)
//   /watch?u=<رابط>  صفحة فيها مشغل جاهز يعرض الفيديو مباشرة
//   /ping            فحص أنه شغال
import http from 'node:http';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PORT) || 8787;
const UA = 'VLC/3.0.20 LibVLC/3.0.20';
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || 'dana8kone.com,a.norzro.cfd,33.tvdragon.com')
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
  'Access-Control-Max-Age': '86400',
};

const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>relay test</title><body style="margin:0;background:#000;color:#ddd;font:14px sans-serif">
<video id="v" controls playsinline autoplay style="width:100%;max-height:90vh;background:#000"></video>
<p id="m" style="padding:8px"></p>
<script>
const u = new URLSearchParams(location.search).get('u') || '';
const v = document.getElementById('v'), m = document.getElementById('m');
v.src = '/p?u=' + encodeURIComponent(u);
v.addEventListener('error', () => { m.textContent = 'خطأ بالتشغيل: ' + (v.error && v.error.message || v.error && v.error.code); });
v.addEventListener('loadedmetadata', () => { m.textContent = 'المدة: ' + Math.round(v.duration) + ' ثانية'; });
</script>`;

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/ping') { res.writeHead(200, CORS); return res.end('ok'); }
  if (u.pathname === '/watch') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
  if (u.pathname !== '/p') { res.writeHead(404, CORS); return res.end('not found'); }

  let target;
  try { target = new URL(u.searchParams.get('u') || ''); }
  catch { res.writeHead(400, CORS); return res.end('bad url'); }
  if (!/^https?:$/.test(target.protocol) || !ALLOWED_HOSTS.includes(target.hostname.toLowerCase())) {
    res.writeHead(403, CORS); return res.end('host not allowed: ' + target.hostname);
  }

  const clientRange = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  const ac = new AbortController();
  res.on('close', () => ac.abort());

  const open = (range) => {
    const h = { 'User-Agent': UA, Accept: '*/*' };
    if (range) h.Range = range;
    return fetch(target, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers: h, redirect: 'follow', signal: ac.signal });
  };

  const drained = () => new Promise((r) => {
    const done = () => { res.off('drain', done); res.off('close', done); r(); };
    res.once('drain', done); res.once('close', done);
  });

  try {
    const up = await open(req.headers.range);
    console.log(new Date().toISOString(), 'upstream', up.status, 'range=' + (req.headers.range || '-'), 'type=' + up.headers.get('content-type'), 'len=' + up.headers.get('content-length'));
    const out = { ...CORS };
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = up.headers.get(h);
      if (v) out[h] = v;
    }
    if (!out['accept-ranges']) out['accept-ranges'] = 'bytes';
    res.writeHead(up.status, out);
    if (!up.body || req.method === 'HEAD') return res.end();

    // بداية ونهاية البايتات المتوقعة، عشان نكمّل لو السيرفر قطع الاتصال بنص الطريق
    let start = 0, end = null;
    const cr = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(up.headers.get('content-range') || '');
    if (up.status === 206 && cr) { start = Number(cr[1]); end = Number(cr[2]); }
    else if (up.status === 200 && up.headers.get('content-length')) { end = Number(up.headers.get('content-length')) - 1; }
    else if (clientRange && up.status === 206) { start = Number(clientRange[1]); }

    const t0 = Date.now(); let sent = 0, resumes = 0, stalls = 0;
    let body = up.body;
    for (;;) {
      const before = sent;
      try {
        for await (const chunk of body) {
          if (res.destroyed) break;
          sent += chunk.length;
          if (!res.write(chunk)) await drained();
        }
      } catch (e) {
        if (ac.signal.aborted) break;
        console.log(new Date().toISOString(), 'upstream cut', e.cause?.code || e.message, 'sent=' + (sent / 1048576).toFixed(1) + 'MB');
      }
      if (res.destroyed || ac.signal.aborted) break;
      if (end === null || start + sent > end) break;                 // خلص الملف (أو ما نقدر نكمّل)
      stalls = sent === before ? stalls + 1 : 0;
      if (stalls >= 6 || resumes >= 300) { console.log('resume giving up'); break; }
      // السيرفر قطع قبل الوقت: نفتح طلب جديد من نفس النقطة ونكمّل بنفس الاستجابة
      // (لو رفض أو فشل الاتصال، نعيد المحاولة بعد انتظار يزيد شوي كل مرة)
      resumes++;
      const from = start + sent;
      await new Promise((r) => setTimeout(r, Math.min(300 * (stalls + 1), 2000)));
      try {
        const r2 = await open(`bytes=${from}-${end}`);
        const cr2 = /^bytes (\d+)-/.exec(r2.headers.get('content-range') || '');
        const good = r2.status === 206 && cr2 && Number(cr2[1]) === from && r2.body;
        console.log(new Date().toISOString(), 'resume', r2.status, 'from=' + from, 'ok=' + !!good);
        body = good ? r2.body : [];
        if (!good && r2.body) r2.body.cancel().catch(() => {});
      } catch (e) {
        if (ac.signal.aborted) break;
        console.log(new Date().toISOString(), 'resume failed', e.cause?.code || e.message);
        body = [];
      }
    }
    const secs = (Date.now() - t0) / 1000;
    console.log(new Date().toISOString(), 'done range=' + (req.headers.range || '-'), 'sent=' + (sent / 1048576).toFixed(1) + 'MB',
      'secs=' + secs.toFixed(1), 'MBps=' + (sent / 1048576 / Math.max(secs, 0.1)).toFixed(2), 'resumes=' + resumes, 'complete=' + (end !== null && start + sent > end));
    res.end();
  } catch (e) {
    if (ac.signal.aborted) return;
    console.log(new Date().toISOString(), 'upstream error', e.cause?.code || e.message);
    if (!res.headersSent) res.writeHead(502, CORS);
    res.end('proxy error: ' + (e.cause?.code || e.message));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`relay on 127.0.0.1:${PORT} allowed=${ALLOWED_HOSTS.join(',')}`));
