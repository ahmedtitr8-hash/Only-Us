// زر تشغيل/إيقاف الوسيط (أكشن stream-relay) بالشاشة الرئيسية + عرض حالته.
// الوسيط هو اللي يشغّل روابط الاكستريم http عبر GitHub Actions (شوف watch/watch.js وproxy/relay.mjs).
//
// كيف يشتغل الزر:
//  - لو حطيت رابط الـWorker تحت (RELAY_START_ENDPOINT): الزر يكلّمه، والتوكن محفوظ عنده
//    كسيكرت (worker/relay-start.js)، فما تدخل ولا تشوف أي توكن.
//  - لو تركته فاضي: الزر يستخدم توكن GitHub تدخله مرة وحدة بالجهاز (يتخزن ولا يسألك ثاني).
// الحالة تنقرأ من data/relay.json (اللي ينشره الأكشن) وتتأكد إن القناة ترد.
window.RELAY_START_ENDPOINT = window.RELAY_START_ENDPOINT || ''; // مثال: 'https://only-us-relay.ahmedtitr8.workers.dev'

(function () {
  const WORKFLOW = 'stream-relay.yml';
  const TOKEN_KEY = 'onlyus_gh_token';

  const root = document.getElementById('relay-control');
  const dot = document.getElementById('relay-dot');
  const text = document.getElementById('relay-text');
  const btn = document.getElementById('relay-toggle-btn');
  if (!root || !dot || !text || !btn) return;

  // تنسيق الزر (نحقنه من هنا عشان ما نلمس ملفات الستايل)
  const style = document.createElement('style');
  style.id = 'relay-control-style';
  style.textContent = `
    .relay-control { display:flex; align-items:center; gap:10px; margin-top:14px; padding:10px 12px;
      border:1px solid var(--border); border-radius:var(--radius-md); font-size:13px; color:var(--text-dim); }
    .relay-dot { width:9px; height:9px; border-radius:50%; background:var(--text-faint); flex-shrink:0; }
    .relay-dot.up { background:var(--success); box-shadow:0 0 0 3px rgba(80,200,120,.18); }
    .relay-dot.busy { background:var(--warning); animation:relay-pulse 1s infinite ease-in-out; }
    @keyframes relay-pulse { 50% { opacity:.35; } }
    .relay-text { flex:1; min-width:0; }
    .relay-btn { padding:7px 16px; border-radius:var(--radius-sm); border:1px solid var(--border);
      background:var(--panel-2); color:var(--text); font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer; }
    .relay-btn:hover { background:var(--panel-3); }
    .relay-btn:disabled { opacity:.55; cursor:default; }
    .relay-btn.stop { color:var(--danger); }
  `;
  document.head.appendChild(style);

  const state = { up: false, expiresAt: null, busy: false, note: '' };
  let sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function repoInfo() {
    const onPages = location.hostname.endsWith('.github.io');
    return {
      owner: onPages ? location.hostname.split('.')[0] : 'ahmedtitr8-hash',
      repo: onPages ? (location.pathname.split('/')[1] || 'Only-Us') : 'Only-Us',
    };
  }
  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } }
  function endpoint() { return String(window.RELAY_START_ENDPOINT || '').replace(/\/$/, ''); }

  async function fetchT(url, opts, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 6000);
    try { return await fetch(url, { ...(opts || {}), signal: ctl.signal }); }
    finally { clearTimeout(t); }
  }

  // آخر حالة نشرها الأكشن (raw مع رقم عشوائي عشان ما ننقرأ نسخة قديمة من الكاش)
  async function readRelay() {
    const { owner, repo } = repoInfo();
    const t = Date.now();
    for (const src of [`https://raw.githubusercontent.com/${owner}/${repo}/main/data/relay.json?t=${t}`, `data/relay.json?t=${t}`]) {
      try {
        const r = await fetchT(src, { cache: 'no-store' }, 6000);
        if (!r.ok) continue;
        const j = await r.json();
        if (j && typeof j.url === 'string' && /^https:\/\//.test(j.url)) return { url: j.url.replace(/\/$/, ''), expiresAt: j.expiresAt || null };
        return { url: null, expiresAt: null };
      } catch (e) { /* نجرب المصدر الثاني */ }
    }
    return { url: null, expiresAt: null };
  }
  async function alive(url) {
    try { const r = await fetchT(`${url}/ping`, {}, 4000); return r.ok; } catch (e) { return false; }
  }

  function remainingText(expiresAt) {
    if (!expiresAt) return '';
    const mins = Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000);
    if (!Number.isFinite(mins) || mins <= 0) return '';
    if (mins >= 90) return ` · باقي ${Math.round(mins / 60)} ساعة`;
    return ` · باقي ${mins} دقيقة`;
  }

  function render() {
    dot.className = 'relay-dot' + (state.busy ? ' busy' : state.up ? ' up' : '');
    if (state.note) text.textContent = state.note;
    else text.textContent = state.up ? 'الوسيط: شغال' + remainingText(state.expiresAt) : 'الوسيط: مطفي';
    btn.textContent = state.busy ? '...' : state.up ? 'إيقاف' : 'تشغيل';
    btn.classList.toggle('stop', state.up && !state.busy);
    btn.disabled = state.busy;
  }

  async function refresh() {
    if (state.busy) return;
    const r = await readRelay();
    state.up = !!(r.url && (await alive(r.url)));
    state.expiresAt = state.up ? r.expiresAt : null;
    state.note = '';
    render();
    return state.up;
  }

  // ---- تشغيل/إيقاف: عبر الـWorker (توكن سيكرت) أو عبر التوكن المخزّن بالجهاز ----
  async function callEndpoint(path) {
    try {
      const r = await fetchT(`${endpoint()}${path}`, { method: 'POST' }, 15000);
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok && j.ok !== false, json: j, status: r.status };
    } catch (e) { return { ok: false, json: {}, status: 0 }; }
  }
  async function ghApi(path, opts, token) {
    const { owner, repo } = repoInfo();
    return fetchT(`https://api.github.com/repos/${owner}/${repo}${path}`, {
      ...(opts || {}),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }, 15000);
  }
  async function askToken() {
    let token = getToken();
    if (!token && typeof prompt === 'function') {
      token = (prompt('الصق توكن GitHub (صلاحية Actions فقط لهذا الريبو). يتخزن بجهازك ولا يسألك ثاني:') || '').trim();
      if (token) setToken(token);
    }
    return token;
  }
  async function activeRunsViaToken(token) {
    const r = await ghApi(`/actions/workflows/${WORKFLOW}/runs?per_page=10`, {}, token);
    if (!r.ok) return { error: r.status };
    const j = await r.json();
    return { runs: (j.workflow_runs || []).filter((x) => ['queued', 'in_progress', 'waiting', 'requested', 'pending'].includes(x.status)) };
  }

  async function start() {
    state.busy = true; state.note = 'جارٍ تشغيل الوسيط (حوالي دقيقة)…'; render();
    try {
      if (endpoint()) {
        const r = await callEndpoint('/start');
        if (!r.ok) { state.note = `تعذر التشغيل (${r.json.error || r.status || 'ما فيه اتصال'})`; state.busy = false; render(); return false; }
      } else {
        const token = await askToken();
        if (!token) { state.note = 'ما دخلت توكن'; state.busy = false; render(); return false; }
        const a = await activeRunsViaToken(token);
        if (a.error) {
          if (a.error === 401 || a.error === 403 || a.error === 404) setToken('');
          state.note = `تعذر التشغيل (رمز ${a.error}) — تأكد من التوكن`; state.busy = false; render(); return false;
        }
        if (!a.runs.length) {
          const r = await ghApi(`/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { minutes: '340' } }) }, token);
          if (r.status !== 204) {
            if (r.status === 401 || r.status === 403 || r.status === 404) setToken('');
            state.note = `تعذر التشغيل (رمز ${r.status}) — تأكد من التوكن`; state.busy = false; render(); return false;
          }
        }
      }
      // ننتظر لين الوسيط يجهز (حتى 4 دقايق)
      for (let i = 0; i < 48; i++) {
        await sleep(5000);
        const r = await readRelay();
        if (r.url && (await alive(r.url))) { state.up = true; state.expiresAt = r.expiresAt; state.note = ''; state.busy = false; render(); return true; }
      }
      state.note = 'الوسيط ما جهز بعد — جرّب تحدّث بعد شوي'; state.busy = false; render(); return false;
    } catch (e) {
      state.note = 'صار خطأ بالتشغيل'; state.busy = false; render(); return false;
    }
  }

  async function stop() {
    const okToStop = typeof showConfirm === 'function'
      ? await showConfirm('توقف الوسيط؟ أي فيلم يشتغل الحين بيوقف.')
      : true;
    if (!okToStop) return false;
    state.busy = true; state.note = 'جارٍ الإيقاف…'; render();
    try {
      let stopped = 0;
      if (endpoint()) {
        const r = await callEndpoint('/stop');
        if (!r.ok) { state.note = `تعذر الإيقاف (${r.json.error || r.status || 'ما فيه اتصال'})`; state.busy = false; render(); return false; }
        stopped = r.json.stopped || 0;
      } else {
        const token = await askToken();
        if (!token) { state.note = 'ما دخلت توكن'; state.busy = false; render(); return false; }
        const a = await activeRunsViaToken(token);
        if (a.error) { if (a.error === 401 || a.error === 403 || a.error === 404) setToken(''); state.note = `تعذر الإيقاف (رمز ${a.error})`; state.busy = false; render(); return false; }
        for (const run of a.runs) { const r = await ghApi(`/actions/runs/${run.id}/cancel`, { method: 'POST' }, token); if (r.status === 202) stopped++; }
      }
      state.up = false; state.expiresAt = null; state.note = ''; state.busy = false; render();
      return true;
    } catch (e) {
      state.note = 'صار خطأ بالإيقاف'; state.busy = false; render(); return false;
    }
  }

  btn.addEventListener('click', () => { if (state.busy) return; if (state.up) stop(); else start(); });

  // نحدّث الحالة عند الفتح وكل نص دقيقة والشاشة الرئيسية ظاهرة
  const entryScreen = document.getElementById('entry-screen');
  const tick = () => {
    if (document.hidden || state.busy) return;
    if (entryScreen && entryScreen.classList.contains('hidden')) return;
    refresh();
  };
  render();
  refresh();
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', tick);

  window.RelayControl = { refresh, start, stop, state, _setSleep: (f) => { sleep = f; } };
})();
