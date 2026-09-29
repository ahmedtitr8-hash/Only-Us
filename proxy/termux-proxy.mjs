// بروكسي محلي صغير لتشغيل روابط اكستريم http من موقعك (https).
// يشتغل على جوالك بـTermux ويجلب الفيديو باسم VLC، ويرجعه للمتصفح مع CORS ودعم التقديم (Range).
//
// التشغيل:   node termux-proxy.mjs          (يحتاج Node 18 أو أحدث: pkg install nodejs)
// المنفذ:    PORT=8787 node termux-proxy.mjs
// المصادر:   يسمح فقط بالسيرفرات المكتوبة تحت (أضف أي سيرفر جديد هنا)
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
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Max-Age': '86400',
};

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/ping') { res.writeHead(200, CORS); return res.end('ok'); }
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
  res.on('close', () => ac.abort()); // المتصفح قطع الاتصال → نوقف الجلب من السيرفر

  try {
    const up = await fetch(target, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers, redirect: 'follow', signal: ac.signal });
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
    if (!res.headersSent) res.writeHead(502, CORS);
    res.end('proxy error: ' + (e.cause?.code || e.message));
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`proxy شغال على http://127.0.0.1:${PORT}  (المسموح: ${ALLOWED_HOSTS.join(', ')})`);
});
