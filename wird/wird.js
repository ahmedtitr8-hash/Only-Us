// ============================================================
// wird.js — فئة "وِرد"
// حساب برمز ٤ أرقام (نفس حساب "مرجع" بالضبط - نفس مجموعة users بفايربيس).
// المحتوى حي بالكامل من islamic.app API (مجاني، بدون مفتاح، CORS مفتوح):
// https://docs.islamic.app - أذكار حصن المسلم + قرآن كامل بنظام صفحات مصحف.
// ملاحظة تسمية: كل المتغيرات مسبوقة بـwird عمدًا (الملفات هنا سكربتات عادية
// بنفس نطاق الصفحة العام، فتكرار اسم متغير مع reference.js يسبب خطأ).
// ============================================================

const WIRD_API = 'https://api.islamic.app/v1';
const WIRD_TOTAL_PAGES = 604;
const wirdDb = roomsDb; // معرّف ومهيّأ أصلًا بـcore/connection.js

let wirdAccountCode = localStorage.getItem('only_us_account_code') || null;
let wirdAccountData = { quran: null };

// ================= الحساب (نفس نظام مرجع بالضبط) =================
const wirdBackBtn = document.getElementById('wird-back-btn');
const wirdAccountBtn = document.getElementById('wird-account-btn');
const wirdAccountModal = document.getElementById('wird-account-modal');
const wirdAccountModalTitle = document.getElementById('wird-account-modal-title');
const wirdAccountCodeInput = document.getElementById('wird-account-code-input');
initEditableField(wirdAccountCodeInput, { numeric: true, maxLength: 4 });
const wirdAccountModalError = document.getElementById('wird-account-modal-error');
const wirdAccountModalCancel = document.getElementById('wird-account-modal-cancel');
const wirdAccountModalConfirm = document.getElementById('wird-account-modal-confirm');
const wirdAccountModalLogout = document.getElementById('wird-account-modal-logout');

if (wirdBackBtn) {
  wirdBackBtn.addEventListener('click', () => {
    if (typeof closeWirdView === 'function') closeWirdView();
    else window.location.href = '../index.html';
  });
}

async function loadWirdAccount(code) {
  const ref = wirdDb.collection('users').doc(code);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ quran: null, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { quran: null };
  }
  const data = snap.data();
  return { quran: data.quran || null };
}

async function saveWirdQuran(value) {
  if (!wirdAccountCode) return;
  await wirdDb.collection('users').doc(wirdAccountCode).set(
    { quran: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

function updateWirdAccountUi() {
  wirdAccountBtn.classList.toggle('logged-in', !!wirdAccountCode);
  renderWirdDailyPanel();
}

async function loginWirdWithCode(code) {
  wirdAccountModalError.classList.add('hidden');
  wirdAccountModalConfirm.disabled = true;
  wirdAccountModalConfirm.textContent = 'جاري الدخول...';
  try {
    wirdAccountData = await loadWirdAccount(code);
    wirdAccountCode = code;
    localStorage.setItem('only_us_account_code', code);
    updateWirdAccountUi();
    closeWirdAccountModal();
  } catch (err) {
    wirdAccountModalError.textContent = 'تعذر الاتصال بقاعدة البيانات، تأكد من اتصالك بالنت';
    wirdAccountModalError.classList.remove('hidden');
  } finally {
    wirdAccountModalConfirm.disabled = false;
    wirdAccountModalConfirm.textContent = 'دخول';
  }
}

function logoutWirdAccount() {
  wirdAccountCode = null;
  wirdAccountData = { quran: null };
  localStorage.removeItem('only_us_account_code');
  updateWirdAccountUi();
  closeWirdAccountModal();
}

function openWirdAccountModal() {
  setFieldValue(wirdAccountCodeInput, '');
  wirdAccountModalError.classList.add('hidden');
  if (wirdAccountCode) {
    wirdAccountModalTitle.textContent = `أنت مسجّل برمز ${wirdAccountCode}`;
    wirdAccountCodeInput.setAttribute('data-placeholder', 'رمز جديد؟ اكتبه هنا');
    wirdAccountModalLogout.classList.remove('hidden');
  } else {
    wirdAccountModalTitle.textContent = 'ادخل رمزك المكوّن من 4 أرقام';
    wirdAccountCodeInput.setAttribute('data-placeholder', '----');
    wirdAccountModalLogout.classList.add('hidden');
  }
  wirdAccountModal.classList.remove('hidden');
  setTimeout(() => wirdAccountCodeInput.focus(), 50);
}
function closeWirdAccountModal() { wirdAccountModal.classList.add('hidden'); }

wirdAccountBtn.addEventListener('click', openWirdAccountModal);
wirdAccountModalCancel.addEventListener('click', closeWirdAccountModal);
wirdAccountModal.addEventListener('click', (e) => { if (e.target === wirdAccountModal) closeWirdAccountModal(); });
wirdAccountModalLogout.addEventListener('click', logoutWirdAccount);
wirdAccountCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') wirdAccountModalConfirm.click(); });
wirdAccountModalConfirm.addEventListener('click', () => {
  const code = getFieldValue(wirdAccountCodeInput).trim();
  if (code.length !== 4) {
    wirdAccountModalError.textContent = 'لازم يكون الرمز 4 أرقام بالضبط';
    wirdAccountModalError.classList.remove('hidden');
    return;
  }
  loginWirdWithCode(code);
});

if (wirdAccountCode) {
  loadWirdAccount(wirdAccountCode)
    .then((data) => { wirdAccountData = data; updateWirdAccountUi(); })
    .catch(() => {});
}

// ================= التنقّل: الرئيسية / الأذكار / القرآن =================
const wirdHomeEl = document.getElementById('wird-home');
const wirdAzkarSection = document.getElementById('wird-azkar-section');
const wirdQuranSection = document.getElementById('wird-quran-section');

function wirdShowHome() {
  wirdHomeEl.classList.remove('hidden');
  wirdAzkarSection.classList.add('hidden');
  wirdQuranSection.classList.add('hidden');
}
document.getElementById('wird-home-azkar').addEventListener('click', () => {
  wirdHomeEl.classList.add('hidden');
  wirdAzkarSection.classList.remove('hidden');
  loadWirdAzkar(wirdSection);
});
document.getElementById('wird-home-quran').addEventListener('click', () => {
  wirdHomeEl.classList.add('hidden');
  wirdQuranSection.classList.remove('hidden');
  initWirdQuranSectionOnce();
});
document.querySelectorAll('[data-wird-home-btn]').forEach((btn) => btn.addEventListener('click', wirdShowHome));

const WIRD_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function wirdToArabicDigits(n) { return String(n).replace(/[0-9]/g, (d) => WIRD_ARABIC_DIGITS[d]); }

// ================= الأذكار (حية من islamic.app - حصن المسلم كامل) =================
const WIRD_SHORTCUTS = { morning: 'morning', evening: 'evening', sleep: 'before-sleep' };
const wirdAzkarCache = {};
let wirdSection = 'morning';
let wirdVersion = 'short';
let wirdDhikrIndex = 0;
let wirdDhikrCount = 0;

const wirdTabsEl = document.getElementById('wird-tabs');
const wirdVersionToggleEl = document.getElementById('wird-version-toggle');
const wirdDhikrPos = document.getElementById('wird-dhikr-pos');
const wirdDhikrBody = document.getElementById('wird-dhikr-body');
const wirdDhikrCountEl = document.getElementById('wird-dhikr-count');
const wirdDhikrFrame = document.getElementById('wird-dhikr-frame');

wirdTabsEl.querySelectorAll('.wird-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdSection = btn.dataset.wirdSection;
    wirdTabsEl.querySelectorAll('.wird-tab').forEach((b) => b.classList.toggle('active', b === btn));
    wirdDhikrIndex = 0;
    loadWirdAzkar(wirdSection);
  });
});

wirdVersionToggleEl.querySelectorAll('.wird-version-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdVersion = btn.dataset.wirdVersion;
    wirdVersionToggleEl.querySelectorAll('.wird-version-btn').forEach((b) => b.classList.toggle('active', b === btn));
    wirdDhikrIndex = 0;
    renderWirdDhikr();
  });
});

function wirdCurrentAzkarList() {
  const all = wirdAzkarCache[wirdSection];
  if (!all) return null;
  return wirdVersion === 'short' ? all.slice(0, 6) : all;
}

function renderWirdDhikr() {
  const list = wirdCurrentAzkarList();
  if (!list || !list.length) return;
  if (wirdDhikrIndex < 0) wirdDhikrIndex = list.length - 1;
  if (wirdDhikrIndex >= list.length) wirdDhikrIndex = 0;
  const dua = list[wirdDhikrIndex];
  wirdDhikrPos.textContent = `${wirdToArabicDigits(wirdDhikrIndex + 1)} / ${wirdToArabicDigits(list.length)}`;
  wirdDhikrBody.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'wird-dhikr-text amiri';
  p.textContent = (dua.ar && dua.ar.text) || '';
  wirdDhikrBody.appendChild(p);
  if (dua.source && dua.source.ar) {
    const src = document.createElement('span');
    src.className = 'wird-dhikr-source';
    src.textContent = dua.source.ar;
    wirdDhikrBody.appendChild(src);
  }
  wirdDhikrCount = 0;
  wirdDhikrCountEl.textContent = '٠';
}

document.getElementById('wird-dhikr-prev').addEventListener('click', () => { wirdDhikrIndex--; renderWirdDhikr(); });
document.getElementById('wird-dhikr-next').addEventListener('click', () => { wirdDhikrIndex++; renderWirdDhikr(); });
document.getElementById('wird-dhikr-counter').addEventListener('click', () => {
  wirdDhikrCount++;
  wirdDhikrCountEl.textContent = wirdToArabicDigits(wirdDhikrCount);
});

(function attachWirdDhikrSwipe() {
  let startX = null;
  wirdDhikrFrame.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  wirdDhikrFrame.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) < 40) return;
    if (dx > 0) { wirdDhikrIndex--; } else { wirdDhikrIndex++; }
    renderWirdDhikr();
  }, { passive: true });
})();

async function loadWirdAzkar(section) {
  if (wirdAzkarCache[section]) { renderWirdDhikr(); return; }
  wirdDhikrBody.innerHTML = '<p class="wird-status">جاري تحميل الأذكار...</p>';
  try {
    const res = await fetch(`${WIRD_API}/dhikr/${WIRD_SHORTCUTS[section]}`);
    if (!res.ok) throw new Error('bad status');
    const json = await res.json();
    wirdAzkarCache[section] = (json.data && json.data.duas) || [];
    if (wirdSection === section) renderWirdDhikr();
  } catch (err) {
    wirdDhikrBody.innerHTML = '<p class="wird-status error">تعذر تحميل الأذكار، تأكد من اتصالك بالنت</p>';
  }
}

// ================= القرآن: قراءة حرة + ورد ختمة (صفحات مصحف حقيقية) =================
const wirdQuranTabsEl = document.getElementById('wird-quran-tabs');
const wirdDailyPanel = document.getElementById('wird-daily-panel');
const wirdFreePanel = document.getElementById('wird-free-panel');
let wirdQuranSectionInited = false;
let wirdChapters = null; // [{id, name_arabic, verses_count, pages:[start,end]}]
const wirdPageVersesCache = {}; // { [pageNum]: verses[] }

wirdQuranTabsEl.querySelectorAll('.wird-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdQuranTabsEl.querySelectorAll('.wird-tab').forEach((b) => b.classList.toggle('active', b === btn));
    const tab = btn.dataset.wirdQuranTab;
    wirdDailyPanel.classList.toggle('hidden', tab !== 'daily');
    wirdFreePanel.classList.toggle('hidden', tab !== 'free');
  });
});

async function initWirdQuranSectionOnce() {
  if (wirdQuranSectionInited) return;
  wirdQuranSectionInited = true;
  try {
    const res = await fetch(`${WIRD_API}/chapters?language=ar`);
    const json = await res.json();
    wirdChapters = (json.data && json.data.chapters) || [];
  } catch (err) {
    wirdChapters = [];
  }
  renderWirdSurahList();
  renderWirdDailyPanel();
}

async function wirdFetchPage(pageNum) {
  if (wirdPageVersesCache[pageNum]) return wirdPageVersesCache[pageNum];
  let all = [];
  let page = 1;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${WIRD_API}/verses/by_page/${pageNum}?per_page=50&page=${page}`);
    const json = await res.json();
    const verses = (json.data && json.data.verses) || [];
    all = all.concat(verses);
    const pagination = json.data && json.data.pagination;
    if (!pagination || !pagination.next_page || verses.length === 0) break;
    page = pagination.next_page;
  }
  wirdPageVersesCache[pageNum] = all;
  return all;
}

function wirdSurahNameForPage(verses) {
  if (!verses || !verses.length || !wirdChapters) return '-';
  const chapterId = verses[0].verse_key ? Number(verses[0].verse_key.split(':')[0]) : null;
  const chapter = chapterId && wirdChapters.find((c) => c.id === chapterId);
  return chapter ? chapter.name_arabic : '-';
}

// ---- مكوّن "عارض المصحف" عام: يُستخدم للقراءة الحرة ولورد الختمة ----
function createWirdMushafPager(ids) {
  const els = {
    body: document.getElementById(ids.body),
    surahLabel: document.getElementById(ids.surahLabel),
    pageNumLabel: document.getElementById(ids.pageNum),
    prevBtn: document.getElementById(ids.prevBtn),
    nextBtn: document.getElementById(ids.nextBtn),
    pageEl: document.getElementById(ids.pageEl),
  };
  const state = { current: 1, min: 1, max: WIRD_TOTAL_PAGES };

  async function render() {
    els.body.innerHTML = '<p class="wird-status">جاري تحميل الصفحة...</p>';
    els.prevBtn.disabled = state.current <= state.min;
    els.nextBtn.disabled = state.current >= state.max;
    try {
      const verses = await wirdFetchPage(state.current);
      els.body.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'wird-quran-verse-text amiri';
      verses.forEach((v) => {
        p.appendChild(document.createTextNode(v.text_uthmani + ' '));
        const mark = document.createElement('span');
        mark.className = 'wird-ayah-mark';
        mark.textContent = wirdToArabicDigits(v.verse_number);
        p.appendChild(mark);
        p.appendChild(document.createTextNode(' '));
      });
      els.body.appendChild(p);
      els.surahLabel.textContent = wirdSurahNameForPage(verses);
      els.pageNumLabel.textContent = `صفحة ${wirdToArabicDigits(state.current)}`;
    } catch (err) {
      els.body.innerHTML = '<p class="wird-status error">تعذر تحميل الصفحة، تأكد من اتصالك بالنت</p>';
    }
  }

  function goTo(pageNum) {
    state.current = Math.max(state.min, Math.min(state.max, pageNum));
    render();
  }

  els.prevBtn.addEventListener('click', () => goTo(state.current - 1));
  els.nextBtn.addEventListener('click', () => goTo(state.current + 1));

  // سحب داخل الصفحة: يمين = السابقة (رجوع لليمين)، يسار = التالية
  let startX = null;
  els.pageEl.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  els.pageEl.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) < 40) return;
    if (dx > 0) goTo(state.current - 1); else goTo(state.current + 1);
  }, { passive: true });

  return {
    setBounds(min, max) { state.min = min; state.max = max; },
    goTo,
    get current() { return state.current; },
  };
}

const wirdFreePager = createWirdMushafPager({
  body: 'wird-free-verses', surahLabel: 'wird-free-surah-label',
  pageNum: 'wird-free-pagenum', prevBtn: 'wird-free-prev', nextBtn: 'wird-free-next',
  pageEl: 'wird-free-verses',
});
const wirdDailyPager = createWirdMushafPager({
  body: 'wird-daily-verses', surahLabel: 'wird-daily-surah-label',
  pageNum: 'wird-daily-pagenum', prevBtn: 'wird-daily-prev', nextBtn: 'wird-daily-next',
  pageEl: 'wird-daily-verses',
});

// ---- قراءة حرة: ورقة اختيار سورة ----
const wirdSurahSheet = document.getElementById('wird-surah-sheet');
const wirdSurahList = document.getElementById('wird-surah-list');
const wirdSurahPickerBtn = document.getElementById('wird-surah-picker-btn');
const wirdSurahPickerLabel = document.getElementById('wird-surah-picker-label');

function renderWirdSurahList() {
  wirdSurahList.innerHTML = '';
  (wirdChapters || []).forEach((c) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'wird-surah-list-item';
    item.textContent = `${wirdToArabicDigits(c.id)}. ${c.name_arabic}`;
    item.addEventListener('click', () => {
      wirdSurahPickerLabel.textContent = `${c.id}. ${c.name_arabic}`;
      wirdSurahSheet.classList.add('hidden');
      const startPage = (c.pages && c.pages[0]) || 1;
      wirdFreePager.goTo(startPage);
    });
    wirdSurahList.appendChild(item);
  });
}
wirdSurahPickerBtn.addEventListener('click', () => wirdSurahSheet.classList.remove('hidden'));
document.getElementById('wird-surah-sheet-close').addEventListener('click', () => wirdSurahSheet.classList.add('hidden'));
wirdSurahSheet.addEventListener('click', (e) => { if (e.target === wirdSurahSheet) wirdSurahSheet.classList.add('hidden'); });

// ================= ورد الختمة =================
const WIRD_UNIT_TOTAL = { page: 604, hizb: 60, juz: 30 };
const WIRD_UNIT_LABEL = { page: 'صفحة', hizb: 'حزب', juz: 'جزء' };
const WIRD_UNIT_PATH = { page: 'by_page', hizb: 'by_hizb', juz: 'by_juz' };

const wirdDailyStatus = document.getElementById('wird-daily-status');
const wirdPlanForm = document.getElementById('wird-plan-form');
const wirdPlanUnitRow = document.getElementById('wird-plan-unit-row');
const wirdPlanMethodRow = document.getElementById('wird-plan-method-row');
const wirdPlanNumberInput = document.getElementById('wird-plan-number-input');
const wirdPlanNumberLabel = document.getElementById('wird-plan-number-label');
const wirdPlanPreview = document.getElementById('wird-plan-preview');
const wirdPlanSubmitBtn = document.getElementById('wird-plan-submit-btn');
const wirdDailyCard = document.getElementById('wird-daily-card');
const wirdDailyRange = document.getElementById('wird-daily-range');
const wirdDailyMeta = document.getElementById('wird-daily-meta');
const wirdDailyBacklog = document.getElementById('wird-daily-backlog');
const wirdDailyDoneBtn = document.getElementById('wird-daily-done-btn');
const wirdPlanResetLink = document.getElementById('wird-plan-reset-link');

let wirdPlanUnit = 'page';
let wirdPlanMethod = 'days';

wirdPlanUnitRow.querySelectorAll('.wird-choice-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdPlanUnit = btn.dataset.unit;
    wirdPlanUnitRow.querySelectorAll('.wird-choice-btn').forEach((b) => b.classList.toggle('active', b === btn));
    if (wirdPlanMethod === 'perday') wirdPlanNumberLabel.textContent = WIRD_UNIT_LABEL[wirdPlanUnit] + ' يوميًا';
    updateWirdPlanPreview();
  });
});
wirdPlanMethodRow.querySelectorAll('.wird-choice-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdPlanMethod = btn.dataset.method;
    wirdPlanMethodRow.querySelectorAll('.wird-choice-btn').forEach((b) => b.classList.toggle('active', b === btn));
    wirdPlanNumberLabel.textContent = wirdPlanMethod === 'days' ? 'يوم' : WIRD_UNIT_LABEL[wirdPlanUnit] + ' يوميًا';
    updateWirdPlanPreview();
  });
});
wirdPlanNumberInput.addEventListener('input', updateWirdPlanPreview);

function updateWirdPlanPreview() {
  const total = WIRD_UNIT_TOTAL[wirdPlanUnit];
  const n = Math.max(1, Number(wirdPlanNumberInput.value) || 1);
  const unitLabel = WIRD_UNIT_LABEL[wirdPlanUnit];
  if (wirdPlanMethod === 'days') {
    const perDay = Math.ceil(total / n);
    wirdPlanPreview.textContent = `يعني تقريبًا ${wirdToArabicDigits(perDay)} ${unitLabel} باليوم`;
  } else {
    const days = Math.ceil(total / n);
    wirdPlanPreview.textContent = `بتختمون تقريبًا خلال ${wirdToArabicDigits(days)} يوم`;
  }
}
updateWirdPlanPreview();

wirdPlanSubmitBtn.addEventListener('click', () => {
  if (!wirdAccountCode) { openWirdAccountModal(); return; }
  const total = WIRD_UNIT_TOTAL[wirdPlanUnit];
  const n = Math.max(1, Number(wirdPlanNumberInput.value) || 1);
  const perDay = wirdPlanMethod === 'days' ? Math.max(1, Math.ceil(total / n)) : n;
  const plan = { unit: wirdPlanUnit, perDay, totalUnits: total, startedAt: Date.now(), currentIndex: 0 };
  const prevKhatmah = (wirdAccountData.quran && wirdAccountData.quran.khatmahCount) || 0;
  wirdAccountData.quran = { khatmahCount: prevKhatmah, plan };
  renderWirdDailyPanel();
  saveWirdQuran(wirdAccountData.quran).catch(() => {});
});

wirdPlanResetLink.addEventListener('click', () => {
  const prevKhatmah = (wirdAccountData.quran && wirdAccountData.quran.khatmahCount) || 0;
  wirdAccountData.quran = { khatmahCount: prevKhatmah, plan: null };
  renderWirdDailyPanel();
  saveWirdQuran(wirdAccountData.quran).catch(() => {});
});

function wirdKhatmahStatus(plan) {
  const daysSince = Math.max(1, Math.floor((Date.now() - plan.startedAt) / 86400000) + 1);
  const plannedIndex = Math.min(plan.perDay * daysSince, plan.totalUnits);
  const actualIndex = plan.currentIndex;
  const backlogUnits = Math.max(0, plannedIndex - actualIndex - plan.perDay);
  const backlogDays = Math.floor(backlogUnits / plan.perDay);
  const rangeStart = actualIndex + 1;
  const rangeEnd = Math.min(actualIndex + plan.perDay, plan.totalUnits);
  return { backlogDays, rangeStart, rangeEnd, isComplete: actualIndex >= plan.totalUnits };
}

// لأحزاب/أجزاء: نحسب حدود الصفحات الفعلية من أول آية وآخر آية بذاك النطاق
// (كل آية من islamic.app فيها page_number)، عشان عارض المصحف يشتغل بصفحات حقيقية
// حتى لو الخطة مقسّمة بالحزب أو الجزء.
async function wirdFirstVersePage(path, unitNum) {
  const res = await fetch(`${WIRD_API}/verses/${path}/${unitNum}?per_page=1&page=1`);
  const json = await res.json();
  const v = json.data && json.data.verses && json.data.verses[0];
  return { page: v && v.page_number, pagination: json.data && json.data.pagination };
}

async function wirdResolvePageBounds(plan, status) {
  if (plan.unit === 'page') return { min: status.rangeStart, max: status.rangeEnd };
  const path = WIRD_UNIT_PATH[plan.unit];
  const first = await wirdFirstVersePage(path, status.rangeStart);
  const minPage = first.page || 1;
  // آخر آية بآخر وحدة بالنطاق: نجيب آخر صفحة ترقيم لذاك المصدر ونطلب عنصرها الوحيد
  let maxPage = minPage;
  const lastUnitMeta = await wirdFirstVersePage(path, status.rangeEnd);
  const totalPages = lastUnitMeta.pagination && lastUnitMeta.pagination.total_pages;
  if (totalPages) {
    const lastRes = await fetch(`${WIRD_API}/verses/${path}/${status.rangeEnd}?per_page=1&page=${totalPages}`);
    const lastJson = await lastRes.json();
    const lastVerse = lastJson.data && lastJson.data.verses && lastJson.data.verses[0];
    if (lastVerse && lastVerse.page_number) maxPage = lastVerse.page_number;
  }
  return { min: minPage, max: Math.max(minPage, maxPage) };
}

function renderWirdDailyPanel() {
  if (!wirdChapters) return;
  const q = wirdAccountData.quran;
  if (!wirdAccountCode) {
    wirdDailyStatus.textContent = 'سجّل دخولك عشان تنشئ خطة ختمة يشوفها الاثنين';
    wirdDailyStatus.classList.remove('hidden');
    wirdPlanForm.classList.add('hidden');
    wirdDailyCard.classList.add('hidden');
    return;
  }
  const plan = q && q.plan;
  if (!plan) {
    wirdDailyStatus.classList.add('hidden');
    wirdPlanForm.classList.remove('hidden');
    wirdDailyCard.classList.add('hidden');
    return;
  }
  wirdDailyStatus.classList.add('hidden');
  wirdPlanForm.classList.add('hidden');
  wirdDailyCard.classList.remove('hidden');

  const status = wirdKhatmahStatus(plan);
  const unitLabel = WIRD_UNIT_LABEL[plan.unit];
  wirdDailyRange.textContent = status.rangeStart === status.rangeEnd
    ? `${unitLabel} ${wirdToArabicDigits(status.rangeStart)}`
    : `من ${unitLabel} ${wirdToArabicDigits(status.rangeStart)} إلى ${wirdToArabicDigits(status.rangeEnd)}`;
  wirdDailyMeta.textContent = `عدد الختمات: ${wirdToArabicDigits((q && q.khatmahCount) || 0)}`;
  if (status.backlogDays > 0) {
    wirdDailyBacklog.textContent = `متراكم عليكم ${wirdToArabicDigits(status.backlogDays)} يوم`;
    wirdDailyBacklog.classList.remove('hidden');
  } else {
    wirdDailyBacklog.classList.add('hidden');
  }

  wirdResolvePageBounds(plan, status).then((bounds) => {
    wirdDailyPager.setBounds(bounds.min, bounds.max);
    wirdDailyPager.goTo(bounds.min);
  });
}

wirdDailyDoneBtn.addEventListener('click', () => {
  const plan = wirdAccountData.quran && wirdAccountData.quran.plan;
  if (!plan) return;
  const nextIndex = Math.min(plan.currentIndex + plan.perDay, plan.totalUnits);
  const khatmahDone = nextIndex >= plan.totalUnits;
  if (khatmahDone) {
    const prevKhatmah = (wirdAccountData.quran && wirdAccountData.quran.khatmahCount) || 0;
    wirdAccountData.quran = { khatmahCount: prevKhatmah + 1, plan: null };
    wirdDailyStatus.textContent = 'مبارك عليكم ختم القرآن! 🌙 أنشئوا خطة ختمة جديدة متى ما بغيتوا';
  } else {
    plan.currentIndex = nextIndex;
    wirdAccountData.quran.plan = plan;
  }
  renderWirdDailyPanel();
  saveWirdQuran(wirdAccountData.quran).catch(() => {});
});
