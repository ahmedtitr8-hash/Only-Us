export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/debug') {
      return new Response(JSON.stringify({
        hasBase: typeof env.XTREAM_BASE,
        baseValue: env.XTREAM_BASE || 'EMPTY',
        baseLength: (env.XTREAM_BASE || '').length,
        hasUser: typeof env.XTREAM_USER,
        userValue: env.XTREAM_USER || 'EMPTY',
        hasPass: typeof env.XTREAM_PASS,
        passValue: env.XTREAM_PASS || 'EMPTY',
      }), { headers: { 'Content-Type': 'application/json' } });
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
