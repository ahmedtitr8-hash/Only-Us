// Worker صغير (Cloudflare) يمسك توكن GitHub كسيكرت ويشغّل/يوقف أكشن stream-relay.
// الموقع يكلّم هذا الـWorker بدل ما يتحط التوكن بكوده، فالتوكن ما يظهر لأي أحد.
//
// الإعداد (مرة وحدة) بلوحة Cloudflare -> الـWorker -> Settings -> Variables and Secrets:
//   GH_TOKEN       (نوع Secret)  توكن GitHub محصور على ريبو Only-Us وصلاحية Actions: Read and write فقط
//   GH_REPO        (اختياري)     مثل ahmedtitr8-hash/Only-Us
//   ALLOWED_ORIGIN (اختياري)     مثل https://ahmedtitr8-hash.github.io  (دومين موقعك بدون / بالآخر)
//
// المسارات (POST فقط):
//   /start  يشغّل stream-relay لو ما فيه تشغيل شغال (ما يكرر التشغيل لو فيه واحد)
//   /stop   يلغي أي تشغيل شغال لـstream-relay
const DEFAULTS = {
  repo: 'ahmedtitr8-hash/Only-Us',
  workflow: 'stream-relay.yml',
  ref: 'main',
  origin: 'https://ahmedtitr8-hash.github.io',
};
const ACTIVE = ['queued', 'in_progress', 'waiting', 'requested', 'pending'];

export default {
  async fetch(request, env) {
    const cfg = {
      repo: env.GH_REPO || DEFAULTS.repo,
      workflow: DEFAULTS.workflow,
      ref: DEFAULTS.ref,
      origin: env.ALLOWED_ORIGIN || DEFAULTS.origin,
    };
    const cors = {
      'Access-Control-Allow-Origin': cfg.origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
      status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);
    // الطلبات لازم تجي من موقعك بس (المتصفح يرسل Origin تلقائيًا)
    if ((request.headers.get('Origin') || '') !== cfg.origin) return json({ ok: false, error: 'origin not allowed' }, 403);
    if (!env.GH_TOKEN) return json({ ok: false, error: 'GH_TOKEN secret is not set' }, 500);

    const gh = (path, opts = {}) => fetch(`https://api.github.com/repos/${cfg.repo}${path}`, {
      ...opts,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GH_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'only-us-relay-start',
        ...(opts.headers || {}),
      },
    });
    const activeRuns = async () => {
      const r = await gh(`/actions/workflows/${cfg.workflow}/runs?per_page=10`);
      if (!r.ok) throw new Error(`github runs ${r.status}`);
      const j = await r.json();
      return (j.workflow_runs || []).filter((x) => ACTIVE.includes(x.status));
    };

    const path = new URL(request.url).pathname;
    try {
      if (path === '/start') {
        if ((await activeRuns()).length) return json({ ok: true, started: false, reason: 'already-running' });
        const r = await gh(`/actions/workflows/${cfg.workflow}/dispatches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: cfg.ref, inputs: { minutes: '340' } }),
        });
        if (r.status !== 204) return json({ ok: false, error: 'dispatch failed', status: r.status }, 502);
        return json({ ok: true, started: true });
      }
      if (path === '/stop') {
        let stopped = 0;
        for (const run of await activeRuns()) {
          const r = await gh(`/actions/runs/${run.id}/cancel`, { method: 'POST' });
          if (r.status === 202) stopped++;
        }
        return json({ ok: true, stopped });
      }
      return json({ ok: false, error: 'not found' }, 404);
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 502);
    }
  },
};
