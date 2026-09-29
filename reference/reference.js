// ================= مرجع: تصفح أفلام ومسلسلات (TMDB) =================
// ملاحظة: هذي الفئة ما تحفظ أي بيانات — كل شي يعيد نفسه من جديد كل ما تفتح الصفحة.

const TMDB_API_KEY = '47ebf86358afd388ae6e06f19a127bec';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/';
const LANG = 'ar-SA';

// ================= حساب: مفضلة/شاهدتها (Firebase Firestore) =================
// ملاحظة أمان: زي باقي المفاتيح بهذا الملف، هذي القيم تصير ظاهرة لأي شخص يفتح كود
// الموقع — وهذا طبيعي ومتوقع مع Firebase (المفاتيح هذي مصممة للاستخدام بالمتصفح).
// الحماية الفعلية تكون بقواعد Firestore (Rules) مو بإخفاء هذي القيم.
// هذا الملف صار يندمج داخل صفحة الغرفة (core.js يهيّئ فايربيس هناك أصلًا لنفس
// المشروع) لكن يضل يشتغل لحاله لو انفتح مباشرة، فنتحقق قبل التهيئة عشان ما يصير
// تعارض "already exists" بالحالتين.
const refFirebaseConfig = {
  apiKey: 'AIzaSyDG8hrBDfBRFAEZETJQvTxV5XozBF-wDaU',
  authDomain: 'onlyus-863cf.firebaseapp.com',
  projectId: 'onlyus-863cf',
  storageBucket: 'onlyus-863cf.firebasestorage.app',
  messagingSenderId: '84204575362',
  appId: '1:84204575362:web:bb29e0be31b8295df6329b',
};
if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(refFirebaseConfig);
const db = firebase.firestore();

let accountCode = localStorage.getItem('only_us_account_code') || null;
// watchedEpisodes: تتبّع مستقل لكل حلقة لحالها (id المسلسل + الموسم + رقم الحلقة)،
// منفصل تمامًا عن watched اللي هو علم "شفت المسلسل/الفيلم كامل"
let accountData = { favorites: [], watched: [], watchedEpisodes: [] }; // تتحمّل بعد تسجيل الدخول

// ================= مصادر مشاهدة: اكستريم (Xtream Codes) =================
// ملاحظة أمان: زي مفتاح TMDB بالأعلى، هذي البيانات تصير ظاهرة لأي شخص يفتح
// كود الموقع (الموقع ثابت بدون سيرفر). مناسب لاستخدام شخصي بين شخصين بس،
// ما ننصح تحطه بمكان عام تشاركه مع ناس ما تثق فيهم.
// تقدر تضيف أكثر من حساب هنا — البحث يدور بكل الحسابات مع بعض ويرجع أفضل تطابق.
// المصادر تنقرأ من data/sources.json (نفس الملف اللي يستخدمه الأكشن xtream-sync)
let XTREAM_SOURCES = [];
let xtreamSourcesPromise = null;
// نسخة احتياطية تشتغل حتى لو تعذّر قراءة data/sources.json (لازم تطابقه)
const DEFAULT_XTREAM_SOURCES = [
  { name: 'qimyclient', base: 'https://qimyclient.store', username: 'star5089', password: '123456' },
  { name: 'dana8kone', base: 'http://dana8kone.com:8080', username: 'Sbhanmansor', password: '01g2f8070' },
  { name: 'norzro', base: 'http://a.norzro.cfd', username: '8667593288', password: '2505245402' },
];
const catalogDiag = []; // أسباب فشل قراءة الملفات الجاهزة، تظهر بالرسالة عشان نعرف السبب
function ensureXtreamSources() {
  if (!xtreamSourcesPromise) {
    xtreamSourcesPromise = (async () => {
      let list = null;
      try {
        const r = await fetch('../data/sources.json', { cache: 'no-cache' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (Array.isArray(j) && j.length) list = j;
      } catch (e) {
        catalogDiag.push('data/sources.json: ' + (e.message || e));
      }
      XTREAM_SOURCES = list || DEFAULT_XTREAM_SOURCES;
      buildSourceMenu();
      return XTREAM_SOURCES;
    })();
  }
  return xtreamSourcesPromise;
}
// رقم المصدر المختار من القائمة (null = كل المصادر)
let selectedSourceIndex = null;

let xtreamMoviesCache = null; // array مجمّعة من كل المصادر (تتحمل مرة وحدة وتنكاش)
let xtreamSeriesCache = null;
let xtreamToken = 0; // يمنع نتيجة بحث قديمة من تظهر فوق نتيجة أحدث
const xtreamWorkingStrategyBySource = {}; // نحفظ لكل مصدر أول طريقة اتصال نجحت معه

// طرق وصول محتملة لسيرفر اكستريم (http://) من صفحة https بدون ما يحجبها المتصفح:
// 1) اتصال مباشر (يشتغل لو صفحتك نفسها http، مثلًا وقت التجربة المحلية)
// 2) بروكسيات https عامة كل وحدة تفتح المصدر من عندها وتعيده لنا (نجرب أكثر من وحدة
//    لأن هذي الخدمات المجانية كثير تتعطل أو تتغير بدون سابق إنذار)
function xtreamStrategies(targetUrl) {
  const enc = encodeURIComponent(targetUrl);
  return [
    { name: 'direct', url: targetUrl },
    { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${enc}` },
    { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${enc}` },
    { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${enc}` },
  ];
}

async function fetchJsonResilient(targetUrl, sourceKey) {
  let strategies = xtreamStrategies(targetUrl);
  const preferred = xtreamWorkingStrategyBySource[sourceKey];
  if (preferred) {
    strategies = [
      strategies.find((s) => s.name === preferred),
      ...strategies.filter((s) => s.name !== preferred),
    ];
  }

  let lastErr = null;
  for (const strat of strategies) {
    try {
      const res = await fetch(strat.url);
      if (!res.ok) throw new Error('bad-status-' + res.status);
      const data = await res.json();
      xtreamWorkingStrategyBySource[sourceKey] = strat.name;
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  const err = new Error((lastErr && lastErr.message) || 'فشل الاتصال');
  err.allFailed = true;
  throw err;
}

async function xtreamApiFor(source, params = {}) {
  const url = new URL(source.base.replace(/\/$/, '') + '/player_api.php');
  url.searchParams.set('username', source.username);
  url.searchParams.set('password', source.password);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetchJsonResilient(url.toString(), source.base);
}

// القوائم الجاهزة اللي يجلبها الأكشن (https من نفس الدومين، ما تنحجب)
const STATIC_FILE_BY_ACTION = { get_vod_streams: 'vod', get_series: 'series' };
async function loadCatalogFor(source, params) {
  const kind = STATIC_FILE_BY_ACTION[params.action];
  if (kind) {
    const file = `data/xtream/${source.name}-${kind}.json`;
    try {
      const res = await fetch('../' + file.split('/').map(encodeURIComponent).join('/'), { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length) return arr;
      throw new Error('الملف فاضي');
    } catch (e) {
      catalogDiag.push(`${file}: ${e.message || e}`);
    }
  }
  return xtreamApiFor(source, params); // احتياط: الطرق القديمة (بروكسيات)
}

// يدور بكل المصادر بالتوازي، ويتجاهل أي مصدر يفشل (بدون ما يوقف البقية)
async function fetchFromAllSources(params) {
  await ensureXtreamSources();
  const results = await Promise.allSettled(
    XTREAM_SOURCES.map((source) => loadCatalogFor(source, params))
  );
  const items = [];
  const failedSources = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      r.value.forEach((item) => items.push({ ...item, __sourceIndex: i }));
    } else if (r.status === 'rejected') {
      failedSources.push(XTREAM_SOURCES[i].name);
    }
  });
  markFailedSources(failedSources);
  return { items, failedSources, totalSources: XTREAM_SOURCES.length };
}

function filterBySelectedSource(items) {
  return selectedSourceIndex == null ? items : items.filter((i) => i.__sourceIndex === selectedSourceIndex);
}

// حلقات المسلسل: نقرأها من الملفات الجاهزة اللي جلبها الأكشن (shards)، وإذا ما لقيناها نجلب مباشرة
const EP_SHARDS = 64;
const epShardCache = {};
async function loadSeriesInfo(source, seriesId) {
  try {
    const key = `${source.name}-${Number(seriesId) % EP_SHARDS}`;
    if (!epShardCache[key]) {
      epShardCache[key] = fetch(`../data/xtream/${encodeURIComponent(source.name)}-eps-${Number(seriesId) % EP_SHARDS}.json`, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    }
    const shard = await epShardCache[key];
    const entry = shard[String(seriesId)];
    if (entry && entry.episodes && Object.keys(entry.episodes).length) return { episodes: entry.episodes };
  } catch (e) { /* نكمّل للجلب المباشر */ }
  return xtreamApiFor(source, { action: 'get_series_info', series_id: seriesId });
}

async function getXtreamMovies() {
  if (xtreamMoviesCache) return xtreamMoviesCache;
  const result = await fetchFromAllSources({ action: 'get_vod_streams' });
  if (result.items.length === 0 && result.failedSources.length === result.totalSources) {
    const err = new Error('تعذر الوصول لأي مصدر اكستريم مضاف (' + result.totalSources + ' مصدر)' + (catalogDiag.length ? ' | ' + catalogDiag.slice(-3).join(' ، ') : ''));
    err.allFailed = true;
    throw err;
  }
  xtreamMoviesCache = result;
  return xtreamMoviesCache;
}

async function getXtreamSeriesList() {
  if (xtreamSeriesCache) return xtreamSeriesCache;
  const result = await fetchFromAllSources({ action: 'get_series' });
  if (result.items.length === 0 && result.failedSources.length === result.totalSources) {
    const err = new Error('تعذر الوصول لأي مصدر اكستريم مضاف (' + result.totalSources + ' مصدر)' + (catalogDiag.length ? ' | ' + catalogDiag.slice(-3).join(' ، ') : ''));
    err.allFailed = true;
    throw err;
  }
  xtreamSeriesCache = result;
  return xtreamSeriesCache;
}

// يشيل التشكيل/الرموز ويوحّد الأحرف عشان المطابقة ما تتأثر بفروقات بسيطة بالكتابة
function normalizeXtreamTitle(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\(?\b(19|20)\d{2}\b\)?/g, ' ') // نشيل السنة إذا كانت جزء من الاسم
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// تطابق اسم واحد بس (100 لو مطابق تمامًا، 65 لو أحدهم بادئة الثاني، -1 لو ما فيه علاقة)
function xtreamNameScore(candidateName, targetName) {
  const cand = normalizeXtreamTitle(candidateName);
  const target = normalizeXtreamTitle(targetName);
  if (!cand || !target) return -1;
  if (cand === target) return 100;
  if (cand.startsWith(target + ' ') || target.startsWith(cand + ' ')) return 65;
  return -1;
}

// تعديل حسب السنة: تطابق = مكافأة، تعارض صريح = رفض كامل، وما فيه سنة بالاسم = بدون تأثير
function xtreamYearAdjust(candidateName, targetYear) {
  if (!targetYear) return 0;
  const yearMatch = (candidateName || '').match(/(19|20)\d{2}/);
  if (!yearMatch) return 0;
  return yearMatch[0] === String(targetYear) ? 20 : -1000;
}

function xtreamQualityAdjust(candidateName) {
  const q = (candidateName || '').toLowerCase();
  let adj = 0;
  if (/\b(4k|2160p)\b/.test(q)) adj += 3;
  else if (/\b(1080p|fhd)\b/.test(q)) adj += 2;
  else if (/\b(720p|hd)\b/.test(q)) adj += 1;
  if (/\b(cam|hdcam|ts|tc)\b/.test(q)) adj -= 5;
  return adj;
}

// الاستراتيجية: نبحث أولًا بالاسم "الأصلي" (الإنجليزي/الأجنبي لو العمل أجنبي، أو العربي لو العمل
// عربي أصلًا) لأنه أدق وأقل عرضة لتشابه الأسماء من الترجمة العربية العامة. لو ما لقينا تطابق
// معقول فيه، نرجع نجرب الاسم الثانوي (الترجمة) — بس بشرط تأكيد السنة، لأن الترجمات العربية
// كثير تتكرر بين أعمال مختلفة تمامًا.
function findBestXtreamMatch(list, nameField, primaryName, secondaryName, targetYear) {
  let best = null;
  let bestScore = -1;
  list.forEach((item) => {
    const base = xtreamNameScore(item[nameField], primaryName);
    if (base < 0) return;
    const score = base + xtreamYearAdjust(item[nameField], targetYear) + xtreamQualityAdjust(item[nameField]);
    if (score > bestScore) { bestScore = score; best = item; }
  });
  if (best && bestScore >= 60) return { item: best, score: bestScore };

  if (secondaryName && normalizeXtreamTitle(secondaryName) !== normalizeXtreamTitle(primaryName)) {
    best = null; bestScore = -1;
    list.forEach((item) => {
      const base = xtreamNameScore(item[nameField], secondaryName);
      if (base < 0) return;
      const yearAdj = xtreamYearAdjust(item[nameField], targetYear);
      if (targetYear && yearAdj <= 0) return; // بالاسم الثانوي، لازم تأكيد سنة صريح
      const score = base + yearAdj + xtreamQualityAdjust(item[nameField]);
      if (score > bestScore) { bestScore = score; best = item; }
    });
    if (best && bestScore >= 60) return { item: best, score: bestScore };
  }

  return null;
}

function xtreamMovieUrl(item) {
  const src = XTREAM_SOURCES[item.__sourceIndex];
  const ext = item.container_extension || 'mp4';
  return `${src.base.replace(/\/$/, '')}/movie/${src.username}/${src.password}/${item.stream_id}.${ext}`;
}

function xtreamEpisodeUrl(episode, sourceIndex) {
  const src = XTREAM_SOURCES[sourceIndex];
  const ext = episode.container_extension || 'mp4';
  return `${src.base.replace(/\/$/, '')}/series/${src.username}/${src.password}/${episode.id}.${ext}`;
}

// أنواع/تصنيفات لتسهيل التصفح (أيدي التصنيفات ثابتة عند TMDB)
const GENRES = {
  movie: [
    { id: 28, name: 'أكشن' },
    { id: 27, name: 'رعب' },
    { id: 35, name: 'كوميديا' },
    { id: 18, name: 'دراما' },
    { id: 10749, name: 'رومانسي' },
    { id: 878, name: 'خيال علمي' },
    { id: 53, name: 'إثارة' },
    { id: 16, name: 'رسوم متحركة' },
    { id: 80, name: 'جريمة' },
    { id: 14, name: 'فانتازيا' },
    { id: 9648, name: 'غموض' },
    { id: 10751, name: 'عائلي' },
    { id: 99, name: 'وثائقي' },
    { id: 12, name: 'مغامرة' },
    { id: 10752, name: 'حرب' },
  ],
  tv: [
    { id: 10759, name: 'أكشن ومغامرة' },
    { id: 35, name: 'كوميديا' },
    { id: 18, name: 'دراما' },
    { id: 10765, name: 'خيال علمي وفانتازيا' },
    { id: 9648, name: 'غموض' },
    { id: 80, name: 'جريمة' },
    { id: 16, name: 'رسوم متحركة' },
    { id: 10751, name: 'عائلي' },
    { id: 99, name: 'وثائقي' },
    { id: 10764, name: 'واقعي' },
  ],
};

const grid = document.getElementById('ref-grid');
const loadingState = document.getElementById('ref-loading');
const loadingMore = document.getElementById('ref-loading-more');
const sentinel = document.getElementById('ref-sentinel');
const emptyState = document.getElementById('ref-empty');
const errorState = document.getElementById('ref-error');
const errorText = document.getElementById('ref-error-text');
const searchInput = document.getElementById('ref-search-input');
initEditableField(searchInput);
const searchClear = document.getElementById('ref-search-clear');
const filterButtons = document.querySelectorAll('.ref-filter');
const genreFiltersNav = document.getElementById('ref-genre-filters');

const detailScreen = document.getElementById('ref-detail');
const detailClose = document.getElementById('ref-detail-close');
const detailHero = document.getElementById('ref-detail-hero');
const detailPoster = document.getElementById('ref-detail-poster');
const detailTitle = document.getElementById('ref-detail-title');
const detailMeta = document.getElementById('ref-detail-meta');
const detailGenres = document.getElementById('ref-detail-genres');
const detailOverview = document.getElementById('ref-detail-overview');
const favBtn = document.getElementById('ref-fav-btn');
const watchedBtn = document.getElementById('ref-watched-btn');

// زر الرجوع: لو الصفحة مندمجة داخل صفحة الغرفة نقفل الطبقة بس (نرجع لعرض الغرفة
// بدون أي تنقّل، الاتصال يضل شغال)، غير كذا (الصفحة لحالها) نرجع تنقّل عادي
const backBtn = document.getElementById('ref-back-btn');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    if (typeof closeReferenceView === 'function') closeReferenceView();
    else window.location.href = '../index.html';
  });
}

const accountBtn = document.getElementById('ref-account-btn');
const accountModal = document.getElementById('ref-account-modal');
const accountModalTitle = document.getElementById('ref-account-modal-title');
const accountCodeInput = document.getElementById('ref-account-code-input');
initEditableField(accountCodeInput, { numeric: true, maxLength: 4 });
const accountModalError = document.getElementById('ref-account-modal-error');
const accountModalCancel = document.getElementById('ref-account-modal-cancel');
const accountModalConfirm = document.getElementById('ref-account-modal-confirm');
const accountModalLogout = document.getElementById('ref-account-modal-logout');
const accountFilterButtons = document.querySelectorAll('.ref-account-filter');

const xtreamStatus = document.getElementById('ref-xtream-status');
const xtreamResults = document.getElementById('ref-xtream-results');
const sourceDropdown = document.getElementById('ref-source-dropdown');
const sourceBtn = document.getElementById('ref-source-btn');
const sourceBtnLabel = document.getElementById('ref-source-btn-label');
const sourceMenu = document.getElementById('ref-source-menu');
const panelXtream = document.getElementById('ref-panel-xtream');

// آلية اختيار مصدر عامة (تبقى حتى لو مصدر وحيد متاح الحين) - عشان أي مصدر جديد
// ينضاف بعدين (بطريقة عرض مختلفة عن xtream، زي ما كان "مصدر إضافي" قبل) يصير له
// خيار بنفس القائمة مباشرة بدون تعديل الهيكل من جديد كل مرة.
function setSourcePanel(which) {
  // which: 'all' أو رقم المصدر (نص)
  selectedSourceIndex = (which === 'all' || which == null) ? null : Number(which);
  sourceMenu.querySelectorAll('.ref-xtream-season-option').forEach((o) => {
    o.classList.toggle('active', o.dataset.source === String(which ?? 'all'));
  });
  const opt = sourceMenu.querySelector(`[data-source="${which ?? 'all'}"]`);
  sourceBtnLabel.textContent = opt ? opt.dataset.label : 'كل المصادر';
}

const failedSourceNames = new Set();
function buildSourceMenu() {
  const opts = [{ v: 'all', label: 'كل المصادر' }].concat(
    XTREAM_SOURCES.map((s, i) => ({ v: String(i), label: s.name, name: s.name }))
  );
  sourceMenu.innerHTML = opts.map((o) =>
    `<button type="button" class="ref-xtream-season-option" data-source="${escapeHtml(o.v)}" data-label="${escapeHtml(o.label)}">${escapeHtml(o.label)}</button>`
  ).join('');
  sourceMenu.querySelectorAll('.ref-xtream-season-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      const changed = opt.dataset.source !== String(selectedSourceIndex ?? 'all');
      setSourcePanel(opt.dataset.source);
      sourceDropdown.classList.remove('open');
      sourceMenu.classList.add('hidden');
      if (changed) searchXtreamForCurrentItem();
    });
  });
  setSourcePanel(selectedSourceIndex == null ? 'all' : String(selectedSourceIndex));
  markFailedSources([]);
}
function markFailedSources(names) {
  names.forEach((n) => failedSourceNames.add(n));
  sourceMenu.querySelectorAll('.ref-xtream-season-option').forEach((o) => {
    const failed = failedSourceNames.has(o.dataset.label);
    o.textContent = (failed ? '⚠ ' : '') + o.dataset.label;
  });
}
ensureXtreamSources().catch(() => { sourceBtnLabel.textContent = 'كل المصادر'; });

sourceBtn.addEventListener('click', () => {
  sourceDropdown.classList.toggle('open');
  sourceMenu.classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  if (!sourceDropdown.contains(e.target)) { sourceDropdown.classList.remove('open'); sourceMenu.classList.add('hidden'); }
});

let activeFilter = 'trending';
let activeGenre = null; // null = بدون تصنيف فرعي محدد
let searchQuery = '';
let searchDebounce = null;
let requestToken = 0; // يمنع نتائج قديمة من تظهر فوق نتائج أحدث

// ================= منطق الحساب =================

async function loadAccount(code) {
  const ref = db.collection('users').doc(code);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ favorites: [], watched: [], watchedEpisodes: [], createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    return { favorites: [], watched: [], watchedEpisodes: [] };
  }
  const data = snap.data();
  return { favorites: data.favorites || [], watched: data.watched || [], watchedEpisodes: data.watchedEpisodes || [] };
}

async function saveAccountField(field, arr) {
  if (!accountCode) return;
  await db.collection('users').doc(accountCode).set(
    { [field]: arr, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

function updateAccountUi() {
  const loggedIn = !!accountCode;
  accountBtn.classList.toggle('logged-in', loggedIn);
  accountFilterButtons.forEach((b) => b.classList.toggle('hidden', !loggedIn));
  if (!loggedIn && (activeFilter === 'myfav' || activeFilter === 'mywatched')) {
    activeFilter = 'trending';
    filterButtons.forEach((b) => b.classList.toggle('active', b.dataset.filter === 'trending'));
    loadFirstPage();
  }
}

async function loginWithCode(code) {
  accountModalError.classList.add('hidden');
  accountModalConfirm.disabled = true;
  accountModalConfirm.textContent = 'جاري الدخول...';
  try {
    accountData = await loadAccount(code);
    accountCode = code;
    localStorage.setItem('only_us_account_code', code);
    updateAccountUi();
    closeAccountModal();
    refreshAccountButtonsForCurrentDetail();
  } catch (err) {
    accountModalError.textContent = 'تعذر الاتصال بقاعدة البيانات، تأكد من اتصالك بالنت';
    accountModalError.classList.remove('hidden');
  } finally {
    accountModalConfirm.disabled = false;
    accountModalConfirm.textContent = 'دخول';
  }
}

function logoutAccount() {
  accountCode = null;
  accountData = { favorites: [], watched: [], watchedEpisodes: [] };
  localStorage.removeItem('only_us_account_code');
  updateAccountUi();
  closeAccountModal();
  refreshAccountButtonsForCurrentDetail();
}

function openAccountModal() {
  setFieldValue(accountCodeInput, '');
  accountModalError.classList.add('hidden');
  if (accountCode) {
    accountModalTitle.textContent = `أنت مسجّل برمز ${accountCode}`;
    accountCodeInput.setAttribute('data-placeholder', 'رمز جديد؟ اكتبه هنا');
    accountModalLogout.classList.remove('hidden');
  } else {
    accountModalTitle.textContent = 'ادخل رمزك المكوّن من 4 أرقام';
    accountCodeInput.setAttribute('data-placeholder', '----');
    accountModalLogout.classList.add('hidden');
  }
  accountModal.classList.remove('hidden');
  setTimeout(() => accountCodeInput.focus(), 50);
}

function closeAccountModal() {
  accountModal.classList.add('hidden');
}

accountBtn.addEventListener('click', openAccountModal);
accountModalCancel.addEventListener('click', closeAccountModal);
accountModal.addEventListener('click', (e) => { if (e.target === accountModal) closeAccountModal(); });
accountModalLogout.addEventListener('click', logoutAccount);

// فلترة الأرقام والحد الأقصى (4) صارت تلقائية عبر initEditableField (numeric/maxLength)
accountCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') accountModalConfirm.click(); });

accountModalConfirm.addEventListener('click', () => {
  const code = getFieldValue(accountCodeInput).trim();
  if (code.length !== 4) {
    accountModalError.textContent = 'لازم يكون الرمز 4 أرقام بالضبط';
    accountModalError.classList.remove('hidden');
    return;
  }
  loginWithCode(code);
});

// دخول تلقائي صامت لو فيه رمز محفوظ بهذا الجهاز من قبل
if (accountCode) {
  loadAccount(accountCode)
    .then((data) => { accountData = data; updateAccountUi(); refreshAccountButtonsForCurrentDetail(); })
    .catch(() => { /* تجاهل فشل الدخول التلقائي، المستخدم يقدر يعيد المحاولة يدويًا */ });
}

function isInAccountList(list, id, mediaType) {
  return list.some((x) => x.id === id && x.media_type === mediaType);
}

// تتبّع الحلقة لحالها: id المسلسل + الموسم + رقم الحلقة (مو علم المسلسل كامل)
function isEpisodeWatched(id, mediaType, season, episodeNum) {
  return accountData.watchedEpisodes.some((x) =>
    x.id === id && x.media_type === mediaType && String(x.season) === String(season) && String(x.episode_num) === String(episodeNum));
}

function toggleEpisodeWatched(season, episodeNum, btn) {
  if (!accountCode) { openAccountModal(); return; }
  if (!currentDetailItem) return;
  const { id, mediaType } = currentDetailItem;
  const list = accountData.watchedEpisodes;
  const exists = isEpisodeWatched(id, mediaType, season, episodeNum);
  if (exists) {
    accountData.watchedEpisodes = list.filter((x) =>
      !(x.id === id && x.media_type === mediaType && String(x.season) === String(season) && String(x.episode_num) === String(episodeNum)));
  } else {
    accountData.watchedEpisodes = [...list, { id, media_type: mediaType, season: String(season), episode_num: String(episodeNum), addedAt: Date.now() }];
  }
  saveAccountField('watchedEpisodes', accountData.watchedEpisodes).catch(() => { /* فشل الحفظ، بيحاول تلقائيًا المرة الجاية */ });
  const nowWatched = !exists;
  if (btn) {
    btn.classList.toggle('active', nowWatched);
    btn.title = nowWatched ? 'شفت هذي الحلقة ✓ (اضغط لإلغاء)' : 'أكّد إنك شفت هذي الحلقة';
  }
}

function toggleAccountItem(field) {
  if (!accountCode) { openAccountModal(); return; }
  if (!currentDetailItem) return;
  const { id, mediaType, title, posterPath, year, voteAverage, originalTitle, originalLanguage } = currentDetailItem;
  const list = accountData[field];
  const exists = isInAccountList(list, id, mediaType);
  if (exists) {
    accountData[field] = list.filter((x) => !(x.id === id && x.media_type === mediaType));
  } else {
    accountData[field] = [...list, {
      id, media_type: mediaType, title,
      poster_path: posterPath || null,
      release_date: year ? String(year) : '',
      first_air_date: year ? String(year) : '',
      vote_average: voteAverage || null,
      // نخزن الاسم الأصلي واللغة الأصلية كمان (نفس أسماء حقول TMDB) عشان mainTitleOf
      // تقدر تعرض العنوان بلغته الأصلية بالمفضلة/شاهدتها زي ما تسوي بنتائج البحث تمامًا
      // — بدونها كانت الدالة ترجع دايمًا للعنوان المترجم لأن الحقل الأصلي ما كان محفوظ.
      original_title: originalTitle || '',
      original_name: originalTitle || '',
      original_language: originalLanguage || '',
      addedAt: Date.now(),
    }];
  }
  saveAccountField(field, accountData[field]).catch(() => { /* فشل الحفظ، بيحاول تلقائيًا المرة الجاية */ });
  refreshAccountButtonsForCurrentDetail();
}

function refreshAccountButtonsForCurrentDetail() {
  if (!currentDetailItem) return;
  const { id, mediaType } = currentDetailItem;
  const isFav = isInAccountList(accountData.favorites, id, mediaType);
  const isWatched = isInAccountList(accountData.watched, id, mediaType);
  favBtn.classList.toggle('active', isFav);
  favBtn.querySelector('span:last-child').textContent = isFav ? 'مضافة للمفضلة' : 'أضف للمفضلة';
  watchedBtn.classList.toggle('active', isWatched);
  watchedBtn.querySelector('span:last-child').textContent = isWatched ? 'شاهدتها ✓' : 'شاهدتها';
  // كل زر "شاهدتها" جنب حلقة يعكس حالة تلك الحلقة بس (season + episode_num
  // المخزّنة على الزر نفسه)، مو علم المسلسل كامل — كل حلقة تتبعها لحالها
  document.querySelectorAll('.ref-ep-watched-btn').forEach((btn) => {
    const season = btn.dataset.season;
    const episodeNum = btn.dataset.episodeNum;
    const epWatched = isEpisodeWatched(id, mediaType, season, episodeNum);
    btn.classList.toggle('active', epWatched);
    btn.title = epWatched ? 'شفت هذي الحلقة ✓ (اضغط لإلغاء)' : 'أكّد إنك شفت هذي الحلقة';
  });
}

favBtn.addEventListener('click', () => toggleAccountItem('favorites'));
watchedBtn.addEventListener('click', () => toggleAccountItem('watched'));

let currentPage = 0;
let totalPages = 1;
let isFetchingPage = false;
let seenIds = new Set(); // يمنع تكرار نفس العمل لو TMDB رجّعه بأكثر من صفحة

// ================= أدوات مساعدة =================

function posterUrl(path, size = 'w342') {
  return path ? `${IMG_BASE}${size}${path}` : null;
}

function yearOf(item) {
  const date = item.release_date || item.first_air_date || '';
  return date ? date.slice(0, 4) : '';
}

function titleOf(item) {
  return item.title || item.name || item.original_title || item.original_name || 'بدون عنوان';
}

function originalTitleOf(item) {
  return item.original_title || item.original_name || '';
}

// يرجع الاسم الأصلي بس إذا كان مختلف فعليًا عن الاسم المعروض (يعني مو نفس الشي بس بلغة العرض)
function secondaryTitleOf(item) {
  const main = titleOf(item);
  const original = originalTitleOf(item);
  if (!original || original.trim() === main.trim()) return '';
  return original;
}

// العنوان الأساسي بلغة العمل الأصلية (إنجليزي/كوري/إلخ لو أجنبي، عربي لو عربي أصلًا)،
// والعنوان الفرعي هو الترجمة العربية (لو فيه ترجمة مختلفة فعلًا). يستخدمها كل من
// كروت الشبكة وشاشة التفاصيل عشان يكونون متطابقين.
function mainTitleOf(item) {
  const original = originalTitleOf(item);
  const translated = titleOf(item);
  const isArabicOrigin = item.original_language === 'ar';
  return (!isArabicOrigin && original) ? original : translated;
}

function subTitleOf(item) {
  const original = originalTitleOf(item);
  const translated = titleOf(item);
  const main = mainTitleOf(item);
  const other = main === original ? translated : original;
  return (other && other.trim() !== main.trim()) ? other : '';
}

function mediaTypeOf(item) {
  if (item.media_type === 'movie' || item.media_type === 'tv') return item.media_type;
  return item.title ? 'movie' : 'tv';
}

function setState(state) {
  loadingState.classList.toggle('hidden', state !== 'loading');
  emptyState.classList.toggle('hidden', state !== 'empty');
  errorState.classList.toggle('hidden', state !== 'error');
  grid.classList.toggle('hidden', state !== 'ok');
}

// ================= جلب البيانات =================

async function tmdbFetch(path, params = {}) {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', LANG);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) {
    if (res.status === 401) throw new Error('مفتاح TMDB غير صحيح، تأكد منه بملف reference.js');
    throw new Error('تعذر الوصول لخدمة الأفلام حاليًا');
  }
  return res.json();
}

async function fetchPage(page) {
  if (searchQuery) {
    if (activeFilter === 'movie') return tmdbFetch('/search/movie', { query: searchQuery, page }).then(tagResults('movie'));
    if (activeFilter === 'tv') return tmdbFetch('/search/tv', { query: searchQuery, page }).then(tagResults('tv'));
    return tmdbFetch('/search/multi', { query: searchQuery, page }).then((d) => ({
      ...d,
      results: (d.results || []).filter((r) => r.media_type === 'movie' || r.media_type === 'tv'),
    }));
  }
  if (activeGenre && activeFilter === 'movie') {
    return tmdbFetch('/discover/movie', { with_genres: activeGenre, sort_by: 'popularity.desc', page }).then(tagResults('movie'));
  }
  if (activeGenre && activeFilter === 'tv') {
    return tmdbFetch('/discover/tv', { with_genres: activeGenre, sort_by: 'popularity.desc', page }).then(tagResults('tv'));
  }
  if (activeFilter === 'movie') return tmdbFetch('/movie/popular', { page }).then(tagResults('movie'));
  if (activeFilter === 'tv') return tmdbFetch('/tv/popular', { page }).then(tagResults('tv'));
  return tmdbFetch('/trending/all/week', { page });
}

function tagResults(type) {
  return (data) => ({ ...data, results: (data.results || []).map((r) => ({ ...r, media_type: type })) });
}

// ================= الرسم =================

function buildCard(item) {
  const card = document.createElement('div');
  card.className = 'ref-card';

  const poster = posterUrl(item.poster_path);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const secondary = subTitleOf(item);

  card.innerHTML = `
    <div class="ref-card-poster-wrap">
      ${poster
        ? `<img src="${poster}" alt="" loading="lazy" />`
        : `<div class="ref-card-no-poster"><svg viewBox="0 0 24 24" fill="none"><path d="M4 6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3.2l4.1-2.8a.9.9 0 0 1 1.4.75v9.7a.9.9 0 0 1-1.4.75L17 14.8V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></div>`
      }
      ${rating ? `<div class="ref-card-rating"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17l-5.9 3.4 1.3-6.6-4.9-4.5 6.6-.7L12 2.5Z"/></svg><span>${rating}</span></div>` : ''}
    </div>
    <div class="ref-card-body">
      <div class="ref-card-title">${escapeHtml(mainTitleOf(item))}</div>
      ${secondary ? `<div class="ref-card-original">${escapeHtml(secondary)}</div>` : ''}
      <div class="ref-card-year">${yearOf(item) || '—'}</div>
    </div>
  `;
  card.addEventListener('click', () => openDetail(item.id, mediaTypeOf(item)));
  return card;
}

function appendResults(items) {
  const frag = document.createDocumentFragment();
  items.forEach((item) => {
    if (!item.poster_path && !item.overview) return; // نتيجة ضعيفة الفائدة
    if (seenIds.has(item.id)) return; // تكرار
    seenIds.add(item.id);
    frag.appendChild(buildCard(item));
  });
  grid.appendChild(frag);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadFirstPage() {
  const token = ++requestToken;
  currentPage = 0;
  totalPages = 1;
  seenIds = new Set();
  grid.innerHTML = '';
  loadingMore.classList.add('hidden');
  setState('loading');

  if (activeFilter === 'myfav' || activeFilter === 'mywatched') {
    const list = activeFilter === 'myfav' ? accountData.favorites : accountData.watched;
    currentPage = 1; totalPages = 1; // ما فيه صفحات إضافية، القوائم هذي محلية
    if (!list.length) { setState('empty'); return; }
    appendResults(list);
    setState('ok');
    return;
  }

  try {
    const data = await fetchPage(1);
    if (token !== requestToken) return;
    currentPage = 1;
    totalPages = data.total_pages || 1;
    const results = (data.results || []).filter((r) => r.poster_path || r.overview);
    if (!results.length) {
      setState('empty');
      return;
    }
    appendResults(results);
    setState('ok');
  } catch (err) {
    if (token !== requestToken) return;
    errorText.textContent = err.message || 'صار خطأ بجلب البيانات';
    setState('error');
  }
}

async function loadNextPage() {
  if (isFetchingPage || currentPage >= totalPages) return;
  const token = requestToken;
  isFetchingPage = true;
  loadingMore.classList.remove('hidden');
  try {
    const nextPage = currentPage + 1;
    const data = await fetchPage(nextPage);
    if (token !== requestToken) return; // تغيّر الفلتر/البحث أثناء الجلب
    currentPage = nextPage;
    totalPages = data.total_pages || totalPages;
    const results = (data.results || []).filter((r) => r.poster_path || r.overview);
    appendResults(results);
  } catch (err) {
    // فشل تحميل صفحة إضافية: نتجاهل بصمت، المستخدم يقدر يكمل يمرر ونعيد المحاولة لاحقًا
  } finally {
    if (token === requestToken) loadingMore.classList.add('hidden');
    isFetchingPage = false;
  }
}

// نراقب عنصر "sentinel" آخر الصفحة: كل ما يظهر بالشاشة نجيب صفحة جديدة تلقائيًا
const infiniteScrollObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) loadNextPage();
}, { rootMargin: '600px 0px' });
infiniteScrollObserver.observe(sentinel);

// ================= التفاعل: بحث وفلاتر =================

function renderGenreChips(type) {
  const list = GENRES[type];
  if (!list) {
    genreFiltersNav.classList.add('hidden');
    genreFiltersNav.innerHTML = '';
    return;
  }
  genreFiltersNav.innerHTML = `<button class="ref-filter active" data-genre="">الكل</button>` +
    list.map((g) => `<button class="ref-filter" data-genre="${g.id}">${escapeHtml(g.name)}</button>`).join('');
  genreFiltersNav.classList.remove('hidden');
}

genreFiltersNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.ref-filter');
  if (!btn) return;
  const genreId = btn.dataset.genre || null;
  if (genreId === activeGenre) return;
  activeGenre = genreId;
  genreFiltersNav.querySelectorAll('.ref-filter').forEach((b) => b.classList.toggle('active', b === btn));
  loadFirstPage();
});

searchInput.addEventListener('input', () => {
  searchQuery = getFieldValue(searchInput).trim();
  searchClear.classList.toggle('hidden', !searchQuery);
  genreFiltersNav.classList.toggle('hidden', !!searchQuery || !GENRES[activeFilter]);
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadFirstPage, 400);
});

searchClear.addEventListener('click', () => {
  setFieldValue(searchInput, '');
  searchQuery = '';
  searchClear.classList.add('hidden');
  if (GENRES[activeFilter]) genreFiltersNav.classList.remove('hidden');
  loadFirstPage();
});

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.filter === activeFilter) return;
    activeFilter = btn.dataset.filter;
    activeGenre = null;
    filterButtons.forEach((b) => b.classList.toggle('active', b === btn));
    renderGenreChips(activeFilter);
    if (searchQuery) genreFiltersNav.classList.add('hidden');
    loadFirstPage();
  });
});

// ================= شاشة التفاصيل =================

let currentDetailItem = null; // { id, mediaType, title }

async function openDetail(id, mediaType) {
  detailScreen.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  detailTitle.textContent = 'جارِ التحميل...';
  const existingSub = document.querySelector('.ref-detail-original');
  if (existingSub) existingSub.remove();
  detailOverview.textContent = '';
  detailGenres.innerHTML = '';
  detailMeta.innerHTML = '';
  detailPoster.removeAttribute('src');
  detailHero.style.backgroundImage = '';
  currentDetailItem = null;
  favBtn.classList.remove('active');
  watchedBtn.classList.remove('active');
  resetXtreamBox();

  try {
    const data = await tmdbFetch(`/${mediaType}/${id}`);
    currentDetailItem = {
      id,
      mediaType,
      title: titleOf(data),
      originalTitle: originalTitleOf(data),
      originalLanguage: data.original_language || '',
      year: Number(yearOf(data)) || null,
      posterPath: data.poster_path || null,
      voteAverage: data.vote_average || null,
      numberOfSeasons: data.number_of_seasons || 1,
    };
    // قائمة الحلقات تُبنى من TMDB فورًا (دايمًا ظاهرة، تقدر تعلّم "شاهدتها" عليها
    // حتى بدون مصدر مشاهدة)، وبحث اكستريم يشتغل بالخلفية ويلحق أزرار المشاهدة
    // بالحلقات المطابقة أول ما يلقاها - يشوف renderSeasonsFromTMDB وrevealXtreamForCurrentSeason
    if (mediaType === 'tv') renderSeasonsFromTMDB(data.seasons);
    searchXtreamForCurrentItem(); // يبدأ الجلب التلقائي فورًا، بدون أي ضغطة من المستخدم
    refreshAccountButtonsForCurrentDetail();

    // العنوان الأساسي بلغة العمل الأصلية (إنجليزي/كوري/إلخ لو أجنبي، عربي لو عربي أصلًا)،
    // والعنوان الفرعي هو الترجمة العربية (لو فيه ترجمة مختلفة فعلًا)
    const mainTitle = mainTitleOf(data);
    const secondary = subTitleOf(data);

    detailTitle.textContent = mainTitle;
    if (secondary) {
      const sub = document.createElement('div');
      sub.className = 'ref-detail-original';
      sub.textContent = secondary;
      detailTitle.insertAdjacentElement('afterend', sub);
    }
    detailPoster.src = posterUrl(data.poster_path, 'w300') || '';
    if (data.backdrop_path) {
      detailHero.style.backgroundImage = `url(${posterUrl(data.backdrop_path, 'w780')})`;
    }

    const metaParts = [];
    const year = yearOf(data);
    if (year) metaParts.push(`<span>${year}</span>`);
    metaParts.push(`<span class="dot">${mediaType === 'movie' ? 'فيلم' : 'مسلسل'}</span>`);
    if (mediaType === 'tv' && data.number_of_seasons) {
      metaParts.push(`<span class="dot">${data.number_of_seasons} موسم</span>`);
    }
    if (mediaType === 'tv' && data.number_of_episodes) {
      metaParts.push(`<span class="dot">${data.number_of_episodes} حلقة</span>`);
    }
    if (mediaType === 'movie' && data.runtime) {
      metaParts.push(`<span class="dot">${data.runtime} دقيقة</span>`);
    }
    if (data.vote_average) {
      metaParts.push(`<span class="dot star"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17l-5.9 3.4 1.3-6.6-4.9-4.5 6.6-.7L12 2.5Z"/></svg>${data.vote_average.toFixed(1)}</span>`);
    }
    detailMeta.innerHTML = metaParts.join('');

    detailGenres.innerHTML = (data.genres || [])
      .map((g) => `<span class="ref-genre-chip">${escapeHtml(g.name)}</span>`)
      .join('');

    detailOverview.textContent = data.overview || 'ما فيه وصف متوفر لهذا العمل.';
  } catch (err) {
    detailTitle.textContent = 'تعذر تحميل التفاصيل';
    detailOverview.textContent = err.message || '';
  }
}

function closeDetail() {
  detailScreen.classList.add('hidden');
  document.body.style.overflow = '';
}

// ================= بحث اكستريم لعنصر التفاصيل الحالي =================

function resetXtreamBox() {
  xtreamToken += 1;
  xtreamStatus.className = 'ref-xtream-status hidden';
  xtreamStatus.textContent = '';
  xtreamResults.className = 'ref-xtream-results hidden';
  xtreamResults.innerHTML = '';
  currentXtreamSeasonsMap = null;
  currentXtreamSourceIndex = null;
  currentSeasonNum = null;
  setSourcePanel(selectedSourceIndex == null ? 'all' : String(selectedSourceIndex));
}

function setXtreamStatus(text, kind) {
  xtreamStatus.classList.remove('hidden');
  xtreamStatus.className = `ref-xtream-status ${kind || ''}`.trim();
  xtreamStatus.innerHTML = kind === 'loading'
    ? `<span class="ref-spinner"></span><span>${escapeHtml(text)}</span>`
    : escapeHtml(text);
}

// زي setXtreamStatus بس تضيف زر "إعادة البحث" داخل شريط الحالة نفسه - نستخدمها
// للمسلسلات بدل renderRetry القديمة، عشان ما نمسح قائمة حلقات TMDB الظاهرة
function setXtreamStatusRetryable(text) {
  xtreamStatus.classList.remove('hidden');
  xtreamStatus.className = 'ref-xtream-status err';
  xtreamStatus.innerHTML = `${escapeHtml(text)} <button type="button" class="ref-xtream-status-retry">↻ إعادة البحث</button>`;
  xtreamStatus.querySelector('.ref-xtream-status-retry').addEventListener('click', searchXtreamForCurrentItem);
}

function xtreamPartialWarning(failedSources) {
  if (!failedSources || !failedSources.length) return '';
  return ` (تنبيه: ${failedSources.length} مصدر ما وصلنا له: ${failedSources.join('، ')})`;
}

const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="none"><path d="M7 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>';
const ICON_COPY = '<svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.6"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5 10 17l9-10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// يودّي الفيديو لفئة "نتابع". لو الصفحة مندمجة داخل صفحة الغرفة (index.html) وفيه
// غرفة "نتابع" شغالة فعلًا، نسلّم الفيديو مباشرة بدون أي تنقّل أو حتى تحديث صفحة —
// صفر انقطاع بالاتصال. غير كذا (الصفحة لحالها، أو ما فيه غرفة نتابع شغالة) نرجع
// للتنقّل العادي عشان ينشئ/يدخل غرفة ويتم تمرير الفيديو له تلقائيًا بعدها.
function goWatch(url, subUrl) {
  const embedded = typeof activateRoomMode === 'function';
  if (embedded && typeof submitVideoUrl === 'function' && typeof currentRoomCode !== 'undefined'
    && currentRoomCode && typeof roomMode !== 'undefined' && roomMode === 'watch') {
    submitVideoUrl(url, subUrl);
    if (typeof closeReferenceView === 'function') closeReferenceView();
    return;
  }
  let target = (embedded ? 'index.html' : '../index.html') + `?video=${encodeURIComponent(url)}`;
  if (subUrl) target += `&subUrl=${encodeURIComponent(subUrl)}`;
  // لو فتحنا "مرجع" من قائمة فئات غرفتنا الدائمة (قبل ما ندخل أي غرفة)، نعلّم
  // الرابط عشان watch.js يروح لفئة "نتابع" بنفس رمزنا الدائم، مو غرفة مؤقتة
  // عشوائية جديدة (شوف permanent.js وwatch.js initFromReference)
  if (embedded && window.referenceEntryIsPermanent) target += '&permanentVideo=1';
  window.location.href = target;
}

async function copyLink(url, btn) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    btn.classList.add('copied');
    btn.innerHTML = ICON_CHECK;
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = ICON_COPY; }, 1500);
  } catch (e) { /* تجاهل فشل النسخ */ }
}

// withWatchedBtn: يضيف زر "شاهدتها" الخاص بالحلقة - كل حلقة تتبعها لحالها
// (season + episode_num)، مستقلة عن accountData.watched (علم المسلسل/الفيلم
// كامل) - للمسلسلات بس (renderSeason)، مو للأفلام (renderMovieResult) اللي
// عندها زر التأكيد الرئيسي بأعلى الصفحة أصلًا
function actionButtonsHtml(withWatchedBtn, season, episodeNum) {
  const epBtnAttrs = withWatchedBtn
    ? `data-season="${escapeHtml(String(season ?? ''))}" data-episode-num="${escapeHtml(String(episodeNum ?? ''))}"`
    : '';
  return `
    <div class="ref-xtream-actions">
      ${withWatchedBtn ? `<button type="button" class="ref-xtream-action-btn ref-ep-watched-btn" ${epBtnAttrs} title="أكّد إنك شفت هذي الحلقة">${ICON_CHECK}</button>` : ''}
      <button type="button" class="ref-xtream-action-btn watch" title="مشاهدة مباشرة">${ICON_PLAY}</button>
      <button type="button" class="ref-xtream-action-btn copy" title="نسخ الرابط">${ICON_COPY}</button>
    </div>`;
}

function wireActionButtons(row, url) {
  wireWatchCopyButtons(row, url);
  const epWatchedBtn = row.querySelector('.ref-ep-watched-btn');
  if (epWatchedBtn) {
    epWatchedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleEpisodeWatched(epWatchedBtn.dataset.season, epWatchedBtn.dataset.episodeNum, epWatchedBtn);
    });
  }
}

// يوصل بس أزرار المشاهدة/النسخ برابط جاهز - يُستخدم لإلحاق حلقة كانت "بانتظار
// مصدر" (شوف revealXtreamForCurrentSeason) بدون ما يعيد ربط زر "شاهدتها" اللي
// انربط أصلًا وقت بناء القائمة من TMDB
function wireWatchCopyButtons(row, url) {
  row.querySelector('.watch').addEventListener('click', () => goWatch(url));
  row.querySelector('.copy').addEventListener('click', (e) => copyLink(url, e.currentTarget));
}

function renderMovieResult(item) {
  xtreamResults.classList.remove('hidden');
  xtreamResults.innerHTML = `
    <div class="ref-xtream-movie-row">
      <span class="ref-xtream-movie-name">${escapeHtml(item.name)}</span>
      ${actionButtonsHtml(false)}
    </div>`;
  wireActionButtons(xtreamResults.querySelector('.ref-xtream-movie-row'), xtreamMovieUrl(item));
}

// قائمة المواسم/الحلقات مبنية من TMDB (دايمًا متوفرة، مستقلة عن اكستريم) -
// عشان تقدر تعلّم "شاهدتها" على أي حلقة حتى قبل/بدون ما يلقى البحث مصدر لها.
// currentXtreamSeasonsMap/currentXtreamSourceIndex تتعبّى لو/لما اكستريم يلقى
// تطابق (شوف searchXtreamForCurrentItem)، وrevealXtreamForCurrentSeason تلحق
// أزرار المشاهدة/النسخ بالحلقات المطابقة بمجرد توفرها.
let currentXtreamSeasonsMap = null;
let currentXtreamSourceIndex = null;
let currentSeasonNum = null;

function renderSeasonsFromTMDB(seasons) {
  const seasonList = (seasons || [])
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);
  if (!seasonList.length) return;

  xtreamResults.classList.remove('hidden');
  xtreamResults.innerHTML = `
    <div class="ref-xtream-season-dropdown" id="ref-xtream-season-dropdown">
      <button type="button" class="ref-xtream-season-btn" id="ref-xtream-season-btn">
        <span id="ref-xtream-season-btn-label">الموسم ${escapeHtml(String(seasonList[0].season_number))}</span>
        <svg viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="ref-xtream-season-menu hidden" id="ref-xtream-season-menu">
        ${seasonList.map((s) => `<button type="button" class="ref-xtream-season-option" data-season="${s.season_number}">الموسم ${escapeHtml(String(s.season_number))}</button>`).join('')}
      </div>
    </div>
    <div id="ref-xtream-episodes-list"></div>`;

  const dropdown = xtreamResults.querySelector('#ref-xtream-season-dropdown');
  const btn = xtreamResults.querySelector('#ref-xtream-season-btn');
  const btnLabel = xtreamResults.querySelector('#ref-xtream-season-btn-label');
  const menu = xtreamResults.querySelector('#ref-xtream-season-menu');

  btn.addEventListener('click', () => {
    dropdown.classList.toggle('open');
    menu.classList.toggle('hidden');
  });
  menu.querySelectorAll('.ref-xtream-season-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      const s = Number(opt.dataset.season);
      btnLabel.textContent = `الموسم ${s}`;
      menu.querySelectorAll('.ref-xtream-season-option').forEach((o) => o.classList.toggle('active', o === opt));
      dropdown.classList.remove('open');
      menu.classList.add('hidden');
      renderSeasonEpisodesFromTMDB(s);
    });
  });
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) { dropdown.classList.remove('open'); menu.classList.add('hidden'); }
  });

  menu.querySelector('.ref-xtream-season-option')?.classList.add('active');
  renderSeasonEpisodesFromTMDB(seasonList[0].season_number);
}

async function renderSeasonEpisodesFromTMDB(seasonNum) {
  currentSeasonNum = seasonNum;
  const list = xtreamResults.querySelector('#ref-xtream-episodes-list');
  if (!list) return;
  list.innerHTML = '<p class="ref-xtream-episodes-loading">جارِ تحميل الحلقات...</p>';

  let episodes = [];
  try {
    const { id, mediaType } = currentDetailItem;
    const seasonData = await tmdbFetch(`/${mediaType}/${id}/season/${seasonNum}`);
    episodes = seasonData.episodes || [];
  } catch (err) { /* نعرض قائمة فاضية، البحث بالخلفية مستمر برضو */ }
  if (currentSeasonNum !== seasonNum) return; // تبدّل الموسم أثناء التحميل

  list.innerHTML = episodes.map((ep) => `
    <div class="ref-xtream-episode-row" data-episode-num="${escapeHtml(String(ep.episode_number))}">
      <span class="ref-xtream-episode-name">الحلقة ${escapeHtml(String(ep.episode_number))}${ep.name ? ' — ' + escapeHtml(ep.name) : ''}</span>
      ${actionButtonsHtml(true, seasonNum, ep.episode_number)}
    </div>`).join('');

  episodes.forEach((ep) => {
    const row = list.querySelector(`[data-episode-num="${CSS.escape(String(ep.episode_number))}"]`);
    if (!row) return;
    row.querySelector('.ref-xtream-actions').classList.add('pending');
    const epWatchedBtn = row.querySelector('.ref-ep-watched-btn');
    if (epWatchedBtn) {
      epWatchedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEpisodeWatched(seasonNum, ep.episode_number, epWatchedBtn);
      });
    }
  });
  refreshAccountButtonsForCurrentDetail();
  revealXtreamForCurrentSeason(); // لو اكستريم أصلًا لقى مصدر من قبل ما نبدّل الموسم
}

// تلحق أزرار المشاهدة/النسخ بالحلقات المعروضة حاليًا (من TMDB) أول ما اكستريم
// يلقى مصدر مطابق - تتنادى فور ما يلقاها البحث، وبرضو كل ما تتبدّل قائمة
// الحلقات (تبديل موسم) عشان توصل النتيجة الجاهزة مباشرة بدون إعادة بحث
function revealXtreamForCurrentSeason() {
  if (!currentXtreamSeasonsMap || currentSeasonNum == null) return;
  const episodes = currentXtreamSeasonsMap[String(currentSeasonNum)];
  if (!episodes) return;
  const list = xtreamResults.querySelector('#ref-xtream-episodes-list');
  if (!list) return;
  episodes.forEach((ep) => {
    const row = list.querySelector(`[data-episode-num="${CSS.escape(String(ep.episode_num))}"]`);
    if (!row) return;
    const actions = row.querySelector('.ref-xtream-actions');
    if (!actions || !actions.classList.contains('pending')) return; // إما ما فيه أزرار أصلًا أو انلحقت قبل كذا
    actions.classList.remove('pending');
    wireWatchCopyButtons(row, xtreamEpisodeUrl(ep, currentXtreamSourceIndex));
  });
}

async function searchXtreamForCurrentItem() {
  if (!currentDetailItem) return;
  const token = ++xtreamToken;
  const { mediaType, title, originalTitle, originalLanguage, year } = currentDetailItem;
  // لو العمل أصلًا عربي، الاسم العربي هو "الأصلي" ونعتبره الأساسي. غير كذا (أجنبي)
  // الأساسي هو originalTitle (الإنجليزي غالبًا أو لغته الأصلية)، والعربي احتياطي بس.
  const isArabicOrigin = originalLanguage === 'ar';
  const primaryName = isArabicOrigin ? (title || originalTitle) : (originalTitle || title);
  const secondaryName = isArabicOrigin ? originalTitle : title;
  currentXtreamSeasonsMap = null;
  currentXtreamSourceIndex = null;
  // الأفلام ما عندها قائمة تُعرض قبل ما يلقى اكستريم تطابق، فنصفّرها زي القديم.
  // المسلسلات قائمتها من TMDB وتبقى ظاهرة دايمًا (شوف renderSeasonsFromTMDB)،
  // فما نلمس xtreamResults لها هنا إطلاقًا.
  if (mediaType === 'movie') {
    xtreamResults.classList.add('hidden');
    xtreamResults.innerHTML = '';
  }
  setXtreamStatus('جارِ البحث...', 'loading');

  try {
    if (mediaType === 'movie') {
      const { items: movies, failedSources } = await getXtreamMovies();
      if (token !== xtreamToken) return;
      const match = findBestXtreamMatch(filterBySelectedSource(movies), 'name', primaryName, secondaryName, year);
      if (!match) {
        setXtreamStatus('مافي مطابقة' + xtreamPartialWarning(failedSources), 'err');
        renderRetry();
      } else {
        const srcName = XTREAM_SOURCES[match.item.__sourceIndex].name;
        setXtreamStatus(`تم: "${match.item.name}" (${srcName})` + xtreamPartialWarning(failedSources), 'ok');
        renderMovieResult(match.item);
      }
    } else {
      const { items: seriesList, failedSources } = await getXtreamSeriesList();
      if (token !== xtreamToken) return;
      const match = findBestXtreamMatch(filterBySelectedSource(seriesList), 'name', primaryName, secondaryName, year);
      if (!match) {
        setXtreamStatusRetryable('ما لقينا مصدر مشاهدة، بس قائمة الحلقات فوق جاهزة تعلّم عليها' + xtreamPartialWarning(failedSources));
      } else {
        const source = XTREAM_SOURCES[match.item.__sourceIndex];
        const info = await loadSeriesInfo(source, match.item.series_id);
        if (token !== xtreamToken) return;
        const seasonsMap = (info && info.episodes) || {};
        if (!Object.keys(seasonsMap).length) {
          setXtreamStatusRetryable(`لقينا "${match.item.name}" بس ما فيه حلقات متوفرة بالحساب`);
        } else {
          setXtreamStatus(`تم: "${match.item.name}" (${source.name})` + xtreamPartialWarning(failedSources), 'ok');
          currentXtreamSeasonsMap = seasonsMap;
          currentXtreamSourceIndex = match.item.__sourceIndex;
          revealXtreamForCurrentSeason();
        }
      }
    }
  } catch (err) {
    if (token !== xtreamToken) return;
    // للمسلسلات: قائمة الحلقات من TMDB تبقى زي ما هي، ما نمسحها بسبب خطأ اكستريم -
    // بس نعطي زر إعادة بحث بدل renderRetry القديمة اللي كانت تمسح الصندوق كامل
    if (mediaType === 'movie') {
      setXtreamStatus(err.message || 'صار خطأ بالجلب من اكستريم', 'err');
      renderRetry();
    } else {
      setXtreamStatusRetryable(err.message || 'صار خطأ بالجلب من اكستريم');
    }
  }
}

function renderRetry() {
  xtreamResults.classList.remove('hidden');
  xtreamResults.innerHTML = `<button type="button" class="ref-xtream-retry">↻ إعادة المحاولة</button>`;
  xtreamResults.querySelector('.ref-xtream-retry').addEventListener('click', searchXtreamForCurrentItem);
}

detailClose.addEventListener('click', closeDetail);

// ================= البداية =================
loadFirstPage();
