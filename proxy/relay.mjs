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

  const headers = { 'User-Agent': UA, Accept: '*/*' };
  if (req.headers.range) headers.Range = req.headers.range;
  const ac = new AbortController();
  res.on('close', () => ac.abort());

  try {
    const up = await fetch(target, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers, redirect: 'follow', signal: ac.signal });
    console.log(new Date().toISOString(), 'upstream', up.status, 'range=' + (req.headers.range || '-'), 'type=' + up.headers.get('content-type'), 'len=' + up.headers.get('content-length'));
    const out = { ...CORS };
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = up.headers.get(h);
      if (v) out[h] = v;
    }
    if (!out['accept-ranges']) out['accept-ranges'] = 'bytes';
    res.writeHead(up.status, out);
    if (!up.body || req.method === 'HEAD') return res.end();
    Readable.fromWeb(up.body).on('error', () => res.destroy()).pipe(res);
  } catch (e) {
    if (ac.signal.aborted) return;
    console.log(new Date().toISOString(), 'upstream error', e.cause?.code || e.message);
    if (!res.headersSent) res.writeHead(502, CORS);
    res.end('proxy error: ' + (e.cause?.code || e.message));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`relay on 127.0.0.1:${PORT} allowed=${ALLOWED_HOSTS.join(',')}`));
