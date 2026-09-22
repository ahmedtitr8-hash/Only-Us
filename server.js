/*
 * mpd-to-hls transmux server (Termux) — نسخة مبسطة، بث واحد نشط بنفس اللحظة
 * -------------------------------------------------------------------------
 * نفس فكرة السيرفر السابق، بس بدون تعدد جلسات — مصمم يشتغل مع نفق
 * cloudflared المجاني (trycloudflare.com) بنفس أسلوبك الحالي، فيطلع
 * رابط عام واحد ثابت المسار: https://<عشوائي>.trycloudflare.com/master.m3u8
 *
 * التثبيت (مرة وحدة):
 *   pkg install ffmpeg nodejs cloudflared -y
 *   npm install express
 *
 * التشغيل (مرتين، بنافذتين/تبويبين Termux منفصلين):
 *   Terminal 1:  node server.js
 *   Terminal 2:  cloudflared tunnel --url http://localhost:8090
 *
 * cloudflared يطلع لك رابط trycloudflare.com عشوائي — هذا هو الرابط اللي
 * تحطه بالمشغّل بدل رابط الـmpd الأصلي، بس تضيف /master.m3u8 آخره.
 *
 * تبديل المصدر (بث جديد أو مباراة جديدة):
 *   GET /switch?url=<encoded MPD URL>&key=<kid:key>[,<kid:key>...]
 *   يوقف ffmpeg القديم (لو موجود) ويبدأ وحد جديد على المصدر الجديد.
 *   نفس رابط /master.m3u8 يضل ثابت، بس محتواه يتغيّر.
 */

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8090;
const OUT_DIR = path.join(__dirname, 'out');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const OUT_PATH = path.join(OUT_DIR, 'master.m3u8');

let current = { proc: null, url: null };

function buildDecryptArgs(drmKey) {
  if (!drmKey) return [];
  const keysOnly = drmKey.split(',').map(p => p.trim().split(':')[1]).filter(Boolean);
  if (!keysOnly.length) return [];
  return ['-cenc_decryption_key', keysOnly.join(',')];
}

function clearOldSegments() {
  for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));
}

function startTransmux(mpdUrl, drmKey) {
  if (current.proc) {
    try { current.proc.kill('SIGKILL'); } catch (e) {}
    current.proc = null;
  }
  clearOldSegments();

  const args = [
    ...buildDecryptArgs(drmKey),
    '-fflags', '+genpts',
    '-i', mpdUrl,
    '-c', 'copy',
    '-f', 'hls',
    '-hls_time', '4',
    '-hls_list_size', '8',
    '-hls_flags', 'delete_segments+append_list+independent_segments',
    '-hls_segment_filename', path.join(OUT_DIR, 'seg_%05d.ts'),
    OUT_PATH,
  ];

  console.log('[ffmpeg] بدء التحويل:', mpdUrl);
  const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stderr.on('data', () => {}); // شغّل console.log هنا وقت التطوير لو تبي تشوف تفاصيل ffmpeg
  proc.on('exit', (code) => {
    console.log('[ffmpeg] توقف، code=', code);
    if (current.proc === proc) current.proc = null;
  });

  current = { proc, url: mpdUrl };
}

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

app.get('/switch', (req, res) => {
  const mpdUrl = req.query.url;
  const drmKey = req.query.key || null;
  if (!mpdUrl) return res.status(400).json({ error: 'missing url' });
  startTransmux(mpdUrl, drmKey);
  res.json({ ok: true, playlist: '/master.m3u8' });
});

app.use(express.static(OUT_DIR, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

app.listen(PORT, () => console.log(`mpd-to-hls شغال على المنفذ :${PORT}`));
