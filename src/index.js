export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/debug') {
      // بدون قيم: بس هل المتغيرات موجودة وكم طولها (قبل كان يطبع الاسم والباسورد كاملين لأي أحد)
      return new Response(JSON.stringify({
        base: (env.XTREAM_BASE || '').length,
        user: (env.XTREAM_USER || '').length,
        pass: (env.XTREAM_PASS || '').length,
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ---- بروكسي عام لمصادر اكستريم (يشتغل مع أي حساب، مو بس اللي بالمتغيرات) ----
    // الاستخدام: /proxy?url=<رابط مشفّر>. يحل مشكلة المتصفح اللي يحجب روابط http:// من صفحة https،
    // ويمرّر Range عشان التقديم/الترجيع بالفيديو يشتغل. مقيّد بقائمة نطاقات مسموحة.
    if (url.pathname === '/proxy') {
      const ALLOWED_HOSTS = ['33.tvdragon.com', 'qimyclient.store', 'dana8kone.com', 'a.norzro.cfd']; // أضف هنا أي مصدر جديد
      const corsAll = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
      };
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsAll });
      let target;
      try { target = new URL(url.searchParams.get('url') || ''); } catch (e) {
        return new Response('bad url', { status: 400, headers: corsAll });
      }
      if (!['http:', 'https:'].includes(target.protocol) || !ALLOWED_HOSTS.includes(target.hostname)) {
        return new Response('host not allowed', { status: 403, headers: corsAll });
      }
      const fwd = new Headers();
      fwd.set('User-Agent', 'VLC/3.0.20 LibVLC/3.0.20'); // بعض السيرفرات ترفض غير VLC
      fwd.set('Accept', '*/*');
      const range = request.headers.get('Range');
      if (range) fwd.set('Range', range);
      let upstream;
      try {
        upstream = await fetch(target.toString(), { method: 'GET', headers: fwd, redirect: 'follow' });
      } catch (e) {
        return new Response('upstream error: ' + (e && e.message || e), { status: 502, headers: corsAll });
      }
      const out = new Headers(upstream.headers);
      Object.entries(corsAll).forEach(([k, v]) => out.set(k, v));
      out.set('X-Upstream-Status', String(upstream.status)); // للتشخيص: رد السيرفر الأصلي
      return new Response(upstream.body, { status: upstream.status, headers: out });
    }

    const BASE = env.XTREAM_BASE;
    const USER = env.XTREAM_USER;
    const PASS = env.XTREAM_PASS;
    const cors = { 'Access-Control-Allow-Origin': '*' };

    if (url.pathname === '/player_api.php') {
      const target = new URL(BASE + '/player_api.php');
      for (const [k, v] of url.searchParams) target.searchParams.set(k, v);
      target.searchParams.set('username', USER);
      target.searchParams.set('password', PASS);
      const res = await fetch(target.toString());
      return new Response(res.body, { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    let m = url.pathname.match(/^\/movie\/(\d+)\.(\w+)$/);
    if (m) return fetch(`${BASE}/movie/${USER}/${PASS}/${m[1]}.${m[2]}`);

    m = url.pathname.match(/^\/series\/(\d+)\.(\w+)$/);
    if (m) return fetch(`${BASE}/series/${USER}/${PASS}/${m[1]}.${m[2]}`);

    return new Response('Not found', { status: 404, headers: cors });
  },
};
