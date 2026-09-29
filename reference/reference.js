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
// رابط الـWorker (Cloudflare) اللي بمجلد src/ — يمرّر الطلبات والفيديو لمصادر http:// عشان
// المتصفح ما يحجبها من صفحة https. مثال: 'https://onlyus-xtream-proxy.YOURNAME.workers.dev'
// لو تركته فاضي، مصادر http:// (مثل tvdragon) تعتمد على بروكسيات عامة للبحث بس، والتشغيل غالبًا يتحجب.
const XTREAM_PROXY = '';

const XTREAM_SOURCES = [
  { name: 'qimyclient', base: 'https://qimyclient.store', username: 'star5089', password: '123456' },
  { name: 'tvdragon', base: 'http://33.tvdragon.com', username: '523c37ad', password: '73f6a97b' },
];

// قوائم الأفلام/المسلسلات تتحمّل لكل مصدر لحاله (وتنكاش) — عشان أي مصدر بطيء أو معطّل
// ما يعطّل البقية، ونعرض نتيجة كل مصدر أول ما توصل.
const xtreamListPromises = { movie: {}, series: {} };
let xtreamToken = 0; // يمنع نتيجة بحث قديمة من تظهر فوق نتيجة أحدث
const xtreamWorkingStrategyBySource = {}; // نحفظ لكل مصدر أول طريقة اتصال نجحت معه

// طرق وصول محتملة لسيرفر اكستريم (http://) من صفحة https بدون ما يحجبها المتصفح:
// 1) اتصال مباشر (يشتغل لو صفحتك نفسها http، مثلًا وقت التجربة المحلية)
// 2) بروكسيات https عامة كل وحدة تفتح المصدر من عندها وتعيده لنا (نجرب أكثر من وحدة
//    لأن هذي الخدمات المجانية كثير تتعطل أو تتغير بدون سابق إنذار)
function xtreamStrategies(targetUrl) {
  const enc = encodeURIComponent(targetUrl);
  const strategies = [
    { name: 'direct', url: targetUrl },
    { name: 'codetabs', url: `https://api.codetabs.com/v1/proxy?quest=${enc}` },
    { name: 'corsproxy.io', url: `https://corsproxy.io/?url=${enc}` },
    { name: 'allorigins', url: `https://api.allorigins.win/raw?url=${enc}` },
  ];
  if (XTREAM_PROXY) strategies.unshift({ name: 'worker', url: `${XTREAM_PROXY.replace(/\/$/, '')}/proxy?url=${enc}` });
  return strategies;
}

async function fetchJsonResilient(targetUrl, sourceKey, timeoutMs = 15000) {
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
    // مهلة لكل محاولة: بدونها أي بروكسي عالق يخلي البحث يدور للأبد
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(strat.url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('bad-status-' + res.status);
      const data = await res.json();
      xtreamWorkingStrategyBySource[sourceKey] = strat.name;
      return data;
    } catch (e) {
      lastErr = e && e.name === 'AbortError' ? new Error('انتهت مهلة الاتصال') : e;
    } finally {
      clearTimeout(timer);
    }
  }
  const err = new Error((lastErr && lastErr.message) || 'فشل الاتصال');
  err.allFailed = true;
  throw err;
}

async function xtreamApiFor(source, params = {}, timeoutMs) {
  const url = new URL(source.base.replace(/\/$/, '') + '/player_api.php');
  url.searchParams.set('username', source.username);
  url.searchParams.set('password', source.password);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetchJsonResilient(url.toString(), source.base, timeoutMs);
}

// يحمّل قائمة الأفلام (movie) أو المسلسلات (series) لمصدر واحد. لو فشل نشيله من الكاش
// عشان "إعادة المحاولة" تجرب من جديد.
function getSourceList(sourceIndex, kind) {
  if (!xtreamListPromises[kind][sourceIndex]) {
    const action = kind === 'movie' ? 'get_vod_streams' : 'get_series';
    const p = xtreamApiFor(XTREAM_SOURCES[sourceIndex], { action }, 30000).then((data) => {
      if (!Array.isArray(data)) throw new Error('رد غير متوقع من المصدر');
      return data;
    });
    p.catch(() => { delete xtreamListPromises[kind][sourceIndex]; });
    xtreamListPromises[kind][sourceIndex] = p;
  }
  return xtreamListPromises[kind][sourceIndex];
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

// مصدر http:// ينحجب من صفحة https، فنمرّره من الـWorker لو مضبوط
function viaProxyIfNeeded(url) {
  if (XTREAM_PROXY && /^http:\/\//i.test(url)) return `${XTREAM_PROXY.replace(/\/$/, '')}/proxy?url=${encodeURIComponent(url)}`;
  return url;
}

function xtreamMovieUrl(item) {
  const src = XTREAM_SOURCES[item.__sourceIndex];
  const ext = item.container_extension || 'mp4';
  return viaProxyIfNeeded(`${src.base.replace(/\/$/, '')}/movie/${src.username}/${src.password}/${item.stream_id}.${ext}`);
}

function xtreamEpisodeUrl(episode, sourceIndex) {
  const src = XTREAM_SOURCES[sourceIndex];
  const ext = episode.container_extension || 'mp4';
  return viaProxyIfNeeded(`${src.base.replace(/\/$/, '')}/series/${src.username}/${src.password}/${episode.id}.${ext}`);
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

// قائمة المصادر: تتبنى من XTREAM_SOURCES (مصدر جديد ينضاف بالقائمة فوق يطلع هنا تلقائيًا).
// كل مصدر يبحث لحاله بالتوازي، والقائمة تعرض حالة كل واحد (… جارِ البحث / ✓ لقيناه / ✗ ما لقيناه)،
// واختيار مصدر يعرض نتيجته هو بالذات.
sourceBtn.addEventListener('click', () => {
  sourceDropdown.classList.toggle('open');
  sourceMenu.classList.toggle('hidden');
});
sourceMenu.addEventListener('click', (e) => {
  const opt = e.target.closest('.ref-xtream-season-option');
  if (!opt) return;
  selectXtreamSource(Number(opt.dataset.source), true);
  sourceDropdown.classList.remove('open');
  sourceMenu.classList.add('hidden');
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
    if (mediaType === 'tv') setupEpisodes(data); // الحلقات تظهر دايمًا من TMDB، مستقلة عن مصادر المشاهدة
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

let xtreamState = null; // { perSource: [{status, item, epLookup, error}], selected, userPicked }

function resetXtreamBox() {
  xtreamToken += 1;
  xtreamState = null;
  xtreamStatus.className = 'ref-xtream-status hidden';
  xtreamStatus.textContent = '';
  xtreamResults.className = 'ref-xtream-results hidden';
  xtreamResults.innerHTML = '';
  sourceBtnLabel.textContent = '...';
  sourceMenu.innerHTML = '';
  resetEpisodesBox();
}

function setXtreamStatus(text, kind) {
  xtreamStatus.classList.remove('hidden');
  xtreamStatus.className = `ref-xtream-status ${kind || ''}`.trim();
  xtreamStatus.innerHTML = kind === 'loading'
    ? `<span class="ref-spinner"></span><span>${escapeHtml(text)}</span>`
    : escapeHtml(text);
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
  row.querySelector('.watch').addEventListener('click', () => goWatch(url));
  row.querySelector('.copy').addEventListener('click', (e) => copyLink(url, e.currentTarget));
  const epWatchedBtn = row.querySelector('.ref-ep-watched-btn');
  if (epWatchedBtn) {
    epWatchedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleEpisodeWatched(epWatchedBtn.dataset.season, epWatchedBtn.dataset.episodeNum, epWatchedBtn);
    });
  }
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

// ================= الحلقات (دايمًا ظاهرة للمسلسلات، من TMDB) =================
// القائمة تنبني من TMDB مباشرة (موسم + رقم حلقة) بدون ما تنتظر أي مصدر، عشان نقدر نعلّم
// الحلقات اللي شفناها (تنحفظ بالحساب بنفس watchedEpisodes: id + الموسم + رقم الحلقة).
// البحث بمصادر المشاهدة يكمل بالخلفية، وأول ما يلقى مصدر للحلقة يظهر لها زر المشاهدة ونسخ الرابط.

const episodesBox = document.getElementById('ref-episodes-box');
const seasonDropdown = document.getElementById('ref-season-dropdown');
const seasonBtn = document.getElementById('ref-season-btn');
const seasonBtnLabel = document.getElementById('ref-season-btn-label');
const seasonMenu = document.getElementById('ref-season-menu');
const episodesList = document.getElementById('ref-xtream-episodes-list');

let episodesState = null; // { seasons: [{number, count}], current }
let episodesToken = 0; // يمنع تحميل موسم قديم من يظهر فوق موسم أحدث
const tmdbSeasonCache = {}; // `${tvId}:${season}` -> [{num, title}]

function resetEpisodesBox() {
  episodesToken += 1;
  episodesState = null;
  episodesBox.classList.add('hidden');
  seasonMenu.innerHTML = '';
  seasonBtnLabel.textContent = '';
  episodesList.innerHTML = '';
}

function setupEpisodes(tvData) {
  let seasons = (tvData.seasons || [])
    .filter((s) => s.season_number > 0)
    .map((s) => ({ number: s.season_number, count: s.episode_count || 0 }));
  if (!seasons.length) {
    const n = tvData.number_of_seasons || 1;
    seasons = Array.from({ length: n }, (_, i) => ({ number: i + 1, count: 0 }));
  }
  seasons.sort((a, b) => a.number - b.number);
  episodesState = { seasons, current: seasons[0].number };
  seasonMenu.innerHTML = seasons
    .map((s) => `<button type="button" class="ref-xtream-season-option${s.number === episodesState.current ? ' active' : ''}" data-season="${s.number}">الموسم ${s.number}</button>`)
    .join('');
  seasonBtnLabel.textContent = `الموسم ${episodesState.current}`;
  episodesBox.classList.remove('hidden');
  renderEpisodesSeason(episodesState.current);
}

seasonBtn.addEventListener('click', () => {
  seasonDropdown.classList.toggle('open');
  seasonMenu.classList.toggle('hidden');
});
seasonMenu.addEventListener('click', (e) => {
  const opt = e.target.closest('.ref-xtream-season-option');
  if (!opt || !episodesState) return;
  const s = Number(opt.dataset.season);
  episodesState.current = s;
  seasonBtnLabel.textContent = `الموسم ${s}`;
  seasonMenu.querySelectorAll('.ref-xtream-season-option').forEach((o) => o.classList.toggle('active', o === opt));
  seasonDropdown.classList.remove('open');
  seasonMenu.classList.add('hidden');
  renderEpisodesSeason(s);
});
document.addEventListener('click', (e) => {
  if (!seasonDropdown.contains(e.target)) { seasonDropdown.classList.remove('open'); seasonMenu.classList.add('hidden'); }
});

// TMDB بلغة العرض العربية يرجّع أحيانًا "الحلقة 1" كاسم عام — ما نكرره جنب الرقم
function episodeTitleOrEmpty(title, num) {
  const t = (title || '').trim();
  if (!t) return '';
  if (/^(episode|الحلقة|حلقة)\s*\d+$/i.test(t)) return '';
  return t;
}

async function loadSeasonEpisodes(tvId, seasonNum) {
  const key = `${tvId}:${seasonNum}`;
  if (tmdbSeasonCache[key]) return tmdbSeasonCache[key];
  const d = await tmdbFetch(`/tv/${tvId}/season/${seasonNum}`);
  const eps = (d.episodes || []).map((e) => ({ num: e.episode_number, title: e.name || '' }));
  if (eps.length) tmdbSeasonCache[key] = eps;
  return eps;
}

async function renderEpisodesSeason(seasonNum) {
  if (!currentDetailItem || currentDetailItem.mediaType !== 'tv') return;
  const token = ++episodesToken;
  const tvId = currentDetailItem.id;
  episodesList.innerHTML = `<div class="ref-xtream-status loading"><span class="ref-spinner"></span><span>جارِ تحميل الحلقات...</span></div>`;

  let eps = [];
  try { eps = await loadSeasonEpisodes(tvId, seasonNum); } catch (e) { /* نطلع للاحتياط تحت */ }
  if (token !== episodesToken) return;

  if (!eps.length) {
    // احتياط: نبني الأرقام من عدد الحلقات المعروف، أو من حلقات المصدر لو ما عندنا عدد
    const meta = episodesState && episodesState.seasons.find((s) => s.number === seasonNum);
    let count = (meta && meta.count) || 0;
    if (!count) {
      const st = currentEpisodeSource();
      const lookup = st && st.epLookup && st.epLookup[String(seasonNum)];
      count = lookup ? Math.max(0, ...Object.keys(lookup).map(Number)) : 0;
    }
    eps = Array.from({ length: count }, (_, i) => ({ num: i + 1, title: '' }));
  }
  if (!eps.length) {
    episodesList.innerHTML = `<div class="ref-xtream-status">ما فيه معلومات حلقات لهذا الموسم</div>`;
    return;
  }

  episodesList.innerHTML = eps.map((ep) => {
    const t = episodeTitleOrEmpty(ep.title, ep.num);
    return `
      <div class="ref-xtream-episode-row" data-season="${seasonNum}" data-ep-num="${ep.num}">
        <span class="ref-xtream-episode-name">الحلقة ${ep.num}${t ? ' — ' + escapeHtml(t) : ''}</span>
        <div class="ref-xtream-actions">
          <button type="button" class="ref-xtream-action-btn ref-ep-watched-btn" data-season="${seasonNum}" data-episode-num="${ep.num}" title="أكّد إنك شفت هذي الحلقة">${ICON_CHECK}</button>
          <button type="button" class="ref-xtream-action-btn watch hidden" title="مشاهدة مباشرة">${ICON_PLAY}</button>
          <button type="button" class="ref-xtream-action-btn copy hidden" title="نسخ الرابط">${ICON_COPY}</button>
        </div>
      </div>`;
  }).join('');

  refreshAccountButtonsForCurrentDetail(); // يعلّم الحلقات المشاهَدة المحفوظة
  updateEpisodeSourceButtons();            // يظهر زر المشاهدة للحلقات اللي لها مصدر
}

// نربط الأزرار مرة وحدة بالتفويض (delegation): الرابط يتحسب وقت الضغطة من المصدر المختار حاليًا
episodesList.addEventListener('click', (e) => {
  const btn = e.target.closest('.ref-xtream-action-btn');
  const row = e.target.closest('.ref-xtream-episode-row');
  if (!btn || !row) return;
  const season = row.dataset.season;
  const epNum = row.dataset.epNum;
  if (btn.classList.contains('ref-ep-watched-btn')) {
    toggleEpisodeWatched(season, epNum, btn);
    return;
  }
  const url = episodeUrlFor(season, epNum);
  if (!url) return;
  if (btn.classList.contains('watch')) goWatch(url);
  else if (btn.classList.contains('copy')) copyLink(url, btn);
});

// ================= ربط الحلقات بمصدر المشاهدة المختار =================

function currentEpisodeSource() {
  if (!xtreamState || xtreamState.selected == null) return null;
  const st = xtreamState.perSource[xtreamState.selected];
  return st && st.status === 'found' && st.epLookup ? st : null;
}

function episodeUrlFor(season, epNum) {
  const st = currentEpisodeSource();
  if (!st) return null;
  const ep = st.epLookup[String(season)] && st.epLookup[String(season)][String(epNum)];
  return ep ? xtreamEpisodeUrl(ep, st.item.__sourceIndex) : null;
}

// يظهر/يخفي زر المشاهدة ونسخ الرابط لكل حلقة حسب وجود مصدر لها
function updateEpisodeSourceButtons() {
  episodesList.querySelectorAll('.ref-xtream-episode-row').forEach((row) => {
    const has = !!episodeUrlFor(row.dataset.season, row.dataset.epNum);
    row.querySelectorAll('.watch, .copy').forEach((b) => b.classList.toggle('hidden', !has));
  });
}

// Xtream يرجّع الحلقات كـ {رقم_الموسم: [حلقات]}، وكل حلقة فيها season/episode_num.
// نبني منها جدول بحث سريع: epLookup[الموسم][رقم الحلقة] = الحلقة
function buildEpisodeLookup(episodesObj) {
  const lookup = {};
  Object.keys(episodesObj || {}).forEach((key) => {
    const arr = episodesObj[key];
    if (!Array.isArray(arr)) return;
    arr.forEach((ep) => {
      const season = String(ep.season != null && ep.season !== '' ? ep.season : key);
      const num = String(ep.episode_num);
      if (!lookup[season]) lookup[season] = {};
      lookup[season][num] = ep;
    });
  });
  return lookup;
}

// ================= بحث اكستريم لعنصر التفاصيل الحالي (كل مصدر لحاله) =================

const SOURCE_STATUS_MARK = { loading: '…', found: '✓', none: '✗', error: '✗' };

function renderSourceMenu() {
  if (!xtreamState) return;
  sourceMenu.innerHTML = XTREAM_SOURCES.map((src, i) => {
    const st = xtreamState.perSource[i];
    return `<button type="button" class="ref-xtream-season-option${i === xtreamState.selected ? ' active' : ''}" data-source="${i}">${escapeHtml(src.name)} ${SOURCE_STATUS_MARK[st.status] || ''}</button>`;
  }).join('');
  const sel = xtreamState.selected;
  const selSt = xtreamState.perSource[sel];
  sourceBtnLabel.textContent = `${XTREAM_SOURCES[sel].name} ${SOURCE_STATUS_MARK[selSt.status] || ''}`;
}

// يعرض حالة/نتيجة المصدر المختار
function renderSourcePanel() {
  if (!xtreamState) return;
  const i = xtreamState.selected;
  const st = xtreamState.perSource[i];
  const srcName = XTREAM_SOURCES[i].name;
  xtreamResults.classList.add('hidden');
  xtreamResults.innerHTML = '';

  if (st.status === 'loading') {
    setXtreamStatus(`جارِ البحث بـ${srcName}... (لو طوّل، القوائم الكبيرة تاخذ وقت)`, 'loading');
  } else if (st.status === 'found') {
    setXtreamStatus(`تم: "${st.item.name}" (${srcName})`, 'ok');
    if (currentDetailItem && currentDetailItem.mediaType === 'movie') renderMovieResult(st.item);
  } else if (st.status === 'none') {
    setXtreamStatus(st.note || `مافي مطابقة بـ${srcName}`, 'err');
    renderRetry();
  } else {
    setXtreamStatus(st.error || `صار خطأ بالجلب من ${srcName}`, 'err');
    renderRetry();
  }
  updateEpisodeSourceButtons();
}

function selectXtreamSource(i, byUser) {
  if (!xtreamState) return;
  xtreamState.selected = i;
  if (byUser) xtreamState.userPicked = true;
  renderSourceMenu();
  renderSourcePanel();
}

// أول ما مصدر يخلص: لو لقى نتيجة والمستخدم ما اختار مصدر بنفسه ولا فيه مصدر ناجح معروض،
// ننتقل له تلقائيًا (وقتها يظهر زر المشاهدة). وإلا نحدّث القائمة/اللوحة بس.
function onXtreamSourceResolved(i) {
  if (!xtreamState) return;
  const st = xtreamState.perSource[i];
  const selSt = xtreamState.perSource[xtreamState.selected];
  if (st.status === 'found' && !xtreamState.userPicked && selSt.status !== 'found') {
    selectXtreamSource(i, false);
  } else {
    renderSourceMenu();
    if (i === xtreamState.selected) renderSourcePanel();
  }
}

async function searchOneXtreamSource(i, token, ctx) {
  const st = xtreamState.perSource[i];
  const source = XTREAM_SOURCES[i];
  try {
    const list = await getSourceList(i, ctx.mediaType === 'movie' ? 'movie' : 'series');
    if (token !== xtreamToken) return;
    const match = findBestXtreamMatch(list, 'name', ctx.primaryName, ctx.secondaryName, ctx.year);
    if (!match) {
      st.status = 'none';
    } else if (ctx.mediaType === 'movie') {
      st.status = 'found';
      st.item = { ...match.item, __sourceIndex: i };
    } else {
      const info = await xtreamApiFor(source, { action: 'get_series_info', series_id: match.item.series_id });
      if (token !== xtreamToken) return;
      const epLookup = buildEpisodeLookup(info && info.episodes);
      if (!Object.keys(epLookup).length) {
        st.status = 'none';
        st.note = `لقينا "${match.item.name}" بـ${source.name} بس ما فيه حلقات متوفرة`;
      } else {
        st.status = 'found';
        st.item = { ...match.item, __sourceIndex: i };
        st.epLookup = epLookup;
      }
    }
  } catch (err) {
    if (token !== xtreamToken) return;
    st.status = 'error';
    st.error = `تعذر الوصول لـ${source.name}` + (err && err.message ? ` (${err.message})` : '');
  }
  onXtreamSourceResolved(i);
}

async function searchXtreamForCurrentItem() {
  if (!currentDetailItem) return;
  const token = ++xtreamToken;
  const { mediaType, title, originalTitle, originalLanguage, year } = currentDetailItem;
  // لو العمل أصلًا عربي، الاسم العربي هو "الأصلي" ونعتبره الأساسي. غير كذا (أجنبي)
  // الأساسي هو originalTitle (الإنجليزي غالبًا أو لغته الأصلية)، والعربي احتياطي بس.
  const isArabicOrigin = originalLanguage === 'ar';
  const ctx = {
    mediaType,
    year,
    primaryName: isArabicOrigin ? (title || originalTitle) : (originalTitle || title),
    secondaryName: isArabicOrigin ? originalTitle : title,
  };

  const prevSelected = xtreamState ? xtreamState.selected : 0;
  const prevPicked = xtreamState ? xtreamState.userPicked : false;
  xtreamState = {
    perSource: XTREAM_SOURCES.map(() => ({ status: 'loading' })),
    selected: prevSelected,
    userPicked: prevPicked,
  };
  renderSourceMenu();
  renderSourcePanel();

  // كل المصادر تبحث بالتوازي، وكل واحد يعرض نتيجته أول ما يخلص
  XTREAM_SOURCES.forEach((_, i) => { searchOneXtreamSource(i, token, ctx); });
}

function renderRetry() {
  xtreamResults.classList.remove('hidden');
  xtreamResults.innerHTML = `<button type="button" class="ref-xtream-retry">↻ إعادة المحاولة</button>`;
  xtreamResults.querySelector('.ref-xtream-retry').addEventListener('click', searchXtreamForCurrentItem);
}

detailClose.addEventListener('click', closeDetail);

// ================= البداية =================
loadFirstPage();
