// ============================================================
// wird.js
// فئة "وِرد": طبقة مستقلة فوق نفس الصفحة، بدون أي غرفة أو اتصال حي (PeerJS).
// نفس نظام حساب "مرجع" بالضبط: رمز ٤ أرقام محفوظ بـlocalStorage (نفس المفتاح
// only_us_account_code) ونفس مجموعة users بفايربيس - فلو عندهم حساب من مرجع
// أصلًا، يدخلهم هنا تلقائيًا. نضيف حقلين جدد لمستند المستخدم (merge): wird
// (تشيك أسبوعي) وquran (آخر موضع + عدد الختمات) - ما نلمس favorites/watched.
//
// المحتوى (الأذكار والقرآن) كله حي من islamic.app API: مجاني بالكامل، بدون
// مفتاح، CORS مفتوح - https://docs.islamic.app
//
// ملاحظة تسمية: كل المتغيرات هنا مسبوقة بـwird عمدًا (بدل نفس أسماء
// reference.js) عشان الملفين سكربتات عادية بنفس الصفحة (نفس النطاق العام).
// ============================================================

const WIRD_API = 'https://api.islamic.app/v1';

// roomsDb أصلًا معرّف ومهيّأ بـcore/connection.js (نفس مشروع فايربيس بالضبط)
// ويتحمّل دايمًا بكل صفحات التطبيق - فنعيد استخدامه بدل تهيئة firebase ثانية.
const wirdDb = roomsDb;

let wirdAccountCode = localStorage.getItem('only_us_account_code') || null;
let wirdAccountData = { wird: null, quran: null }; // يتحمّل بعد تسجيل الدخول

// ---------- عناصر DOM: الشريط العلوي + الحساب ----------
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
    await ref.set({ wird: null, quran: null, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { wird: null, quran: null };
  }
  const data = snap.data();
  return { wird: data.wird || null, quran: data.quran || null };
}

async function saveWirdField(field, value) {
  if (!wirdAccountCode) return;
  await wirdDb.collection('users').doc(wirdAccountCode).set(
    { [field]: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

function updateWirdAccountUi() {
  const loggedIn = !!wirdAccountCode;
  wirdAccountBtn.classList.toggle('logged-in', loggedIn);
  renderWirdCheckUi();
  renderWirdQuranProgress();
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
  wirdAccountData = { wird: null, quran: null };
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

function closeWirdAccountModal() {
  wirdAccountModal.classList.add('hidden');
}

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

// دخول تلقائي صامت لو فيه رمز محفوظ بهذا الجهاز من قبل (من مرجع أو من وِرد نفسها)
if (wirdAccountCode) {
  loadWirdAccount(wirdAccountCode)
    .then((data) => { wirdAccountData = data; updateWirdAccountUi(); })
    .catch(() => { /* تجاهل فشل الدخول التلقائي، يقدر يعيد المحاولة يدويًا */ });
}

// ================= التبويبات =================
const wirdTabsEl = document.getElementById('wird-tabs');
const wirdAzkarPanel = document.getElementById('wird-azkar-panel');
const wirdQuranPanel = document.getElementById('wird-quran-panel');
let wirdSection = 'morning';

wirdTabsEl.querySelectorAll('.wird-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdSection = btn.dataset.wirdSection;
    wirdTabsEl.querySelectorAll('.wird-tab').forEach((b) => b.classList.toggle('active', b === btn));
    if (wirdSection === 'quran') {
      wirdAzkarPanel.classList.add('hidden');
      wirdQuranPanel.classList.remove('hidden');
      initWirdQuranPanelOnce();
    } else {
      wirdQuranPanel.classList.add('hidden');
      wirdAzkarPanel.classList.remove('hidden');
      loadWirdAzkar(wirdSection);
    }
  });
});

// ================= الأذكار (حية من islamic.app - حصن المسلم كامل) =================
const WIRD_SHORTCUTS = { morning: 'morning', evening: 'evening', sleep: 'before-sleep' };
const wirdAzkarCache = {}; // { morning: [duas...], evening: [...], sleep: [...] }
let wirdVersion = 'short';

const wirdVersionToggleEl = document.getElementById('wird-version-toggle');
const wirdListEl = document.getElementById('wird-list');

wirdVersionToggleEl.querySelectorAll('.wird-version-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdVersion = btn.dataset.wirdVersion;
    wirdVersionToggleEl.querySelectorAll('.wird-version-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderWirdAzkarList();
  });
});

function renderWirdAzkarList() {
  const all = wirdAzkarCache[wirdSection];
  if (!all) return;
  const items = wirdVersion === 'short' ? all.slice(0, 6) : all;
  wirdListEl.innerHTML = '';
  items.forEach((dua) => {
    const row = document.createElement('div');
    row.className = 'wird-item';
    const text = document.createElement('p');
    text.className = 'wird-item-text amiri';
    text.textContent = dua.ar && dua.ar.text ? dua.ar.text : '';
    row.appendChild(text);
    if (dua.source && dua.source.ar) {
      const src = document.createElement('span');
      src.className = 'wird-item-source';
      src.textContent = dua.source.ar;
      row.appendChild(src);
    }
    wirdListEl.appendChild(row);
  });
}

async function loadWirdAzkar(section) {
  if (wirdAzkarCache[section]) { renderWirdAzkarList(); return; }
  wirdListEl.innerHTML = '<p class="wird-status">جاري تحميل الأذكار...</p>';
  try {
    const res = await fetch(`${WIRD_API}/dhikr/${WIRD_SHORTCUTS[section]}`);
    if (!res.ok) throw new Error('bad status');
    const json = await res.json();
    wirdAzkarCache[section] = (json.data && json.data.duas) || [];
    if (wirdSection === section) renderWirdAzkarList();
  } catch (err) {
    wirdListEl.innerHTML = '<p class="wird-status error">تعذر تحميل الأذكار، تأكد من اتصالك بالنت وحاول مرة ثانية</p>';
  }
}

// أول تحميل (تبويب الصباح مفعّل افتراضيًا)
loadWirdAzkar('morning');

// ================= ورد القرآن (قراءة حية + تتبّع ختمة) =================
const wirdQuranLastEl = document.getElementById('wird-quran-last');
const wirdQuranGotoBtn = document.getElementById('wird-quran-goto-last');
const wirdQuranSelect = document.getElementById('wird-quran-surah-select');
const wirdQuranVersesEl = document.getElementById('wird-quran-verses');
const wirdQuranAyahInput = document.getElementById('wird-quran-ayah-input');
const wirdQuranSaveBtn = document.getElementById('wird-quran-save-btn');
const wirdQuranKhatmahBtn = document.getElementById('wird-quran-khatmah-btn');
const wirdKhatmahCountEl = document.getElementById('wird-khatmah-count');

const WIRD_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function wirdToArabicDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => WIRD_ARABIC_DIGITS[d]);
}

let wirdChapters = null; // [{id, name_arabic, verses_count}, ...]
let wirdQuranPanelInited = false;

function renderWirdQuranProgress() {
  const q = wirdAccountData && wirdAccountData.quran;
  wirdKhatmahCountEl.textContent = wirdToArabicDigits((q && q.khatmahCount) || 0);
  if (!wirdAccountCode) {
    wirdQuranLastEl.textContent = 'سجّل دخولك عشان يتحفظ لكم آخر موضع وعدد الختمات';
    wirdQuranGotoBtn.classList.add('hidden');
    return;
  }
  if (q && q.surah && q.ayah && wirdChapters) {
    const chapter = wirdChapters.find((c) => c.id === q.surah);
    const name = chapter ? chapter.name_arabic : `سورة ${q.surah}`;
    wirdQuranLastEl.textContent = `آخر موضع: ${name} - آية ${wirdToArabicDigits(q.ayah)}`;
    wirdQuranGotoBtn.classList.remove('hidden');
  } else {
    wirdQuranLastEl.textContent = 'ما فيه موضع محفوظ بعد - ابدأوا من الفاتحة';
    wirdQuranGotoBtn.classList.add('hidden');
  }
}

async function initWirdQuranPanelOnce() {
  if (wirdQuranPanelInited) return;
  wirdQuranPanelInited = true;
  wirdQuranVersesEl.innerHTML = '<p class="wird-status">جاري تحميل فهرس السور...</p>';
  try {
    const res = await fetch(`${WIRD_API}/chapters?language=ar`);
    const json = await res.json();
    wirdChapters = (json.data && json.data.chapters) || [];
    wirdQuranSelect.innerHTML = '';
    wirdChapters.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.id}. ${c.name_arabic}`;
      wirdQuranSelect.appendChild(opt);
    });
    renderWirdQuranProgress();
    const startSurah = (wirdAccountData.quran && wirdAccountData.quran.surah) || 1;
    wirdQuranSelect.value = String(startSurah);
    loadWirdSurah(startSurah);
  } catch (err) {
    wirdQuranVersesEl.innerHTML = '<p class="wird-status error">تعذر تحميل فهرس السور، تأكد من اتصالك بالنت</p>';
  }
}

wirdQuranSelect.addEventListener('change', () => {
  loadWirdSurah(Number(wirdQuranSelect.value));
});

wirdQuranGotoBtn.addEventListener('click', () => {
  const q = wirdAccountData.quran;
  if (!q || !q.surah) return;
  wirdQuranSelect.value = String(q.surah);
  loadWirdSurah(q.surah, q.ayah);
});

async function loadWirdSurah(surahId, scrollToAyah) {
  wirdQuranVersesEl.innerHTML = '<p class="wird-status">جاري تحميل السورة...</p>';
  wirdQuranAyahInput.value = 1;
  try {
    const verses = await fetchAllWirdVerses(surahId);
    const chapter = wirdChapters.find((c) => c.id === surahId);
    wirdQuranAyahInput.max = chapter ? chapter.verses_count : verses.length;
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
    wirdQuranVersesEl.innerHTML = '';
    wirdQuranVersesEl.appendChild(p);
    if (scrollToAyah) wirdQuranAyahInput.value = scrollToAyah;
  } catch (err) {
    wirdQuranVersesEl.innerHTML = '<p class="wird-status error">تعذر تحميل السورة، تأكد من اتصالك بالنت</p>';
  }
}

// by_chapter مرتّبة على صفحات (زي quran.com v4 بالضبط) - نلف على الصفحات لين
// نجيب كل آيات السورة، بحد أقصى احترازي (أطول سورة بالقرآن ٢٨٦ آية).
async function fetchAllWirdVerses(surahId) {
  let all = [];
  let page = 1;
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${WIRD_API}/verses/by_chapter/${surahId}?per_page=50&page=${page}`);
    const json = await res.json();
    const verses = (json.data && json.data.verses) || [];
    all = all.concat(verses);
    const pagination = json.data && json.data.pagination;
    if (!pagination || !pagination.next_page || verses.length === 0) break;
    page = pagination.next_page;
  }
  return all;
}

wirdQuranSaveBtn.addEventListener('click', () => {
  if (!wirdAccountCode) { openWirdAccountModal(); return; }
  const surahId = Number(wirdQuranSelect.value);
  const ayah = Number(wirdQuranAyahInput.value) || 1;
  const prevKhatmah = (wirdAccountData.quran && wirdAccountData.quran.khatmahCount) || 0;
  const next = { surah: surahId, ayah, khatmahCount: prevKhatmah };
  wirdAccountData.quran = next;
  renderWirdQuranProgress();
  saveWirdField('quran', next).catch(() => { /* فشل الحفظ، بيحاول تلقائيًا المرة الجاية */ });
});

wirdQuranKhatmahBtn.addEventListener('click', () => {
  if (!wirdAccountCode) { openWirdAccountModal(); return; }
  const prevKhatmah = (wirdAccountData.quran && wirdAccountData.quran.khatmahCount) || 0;
  const next = { surah: 1, ayah: 1, khatmahCount: prevKhatmah + 1 };
  wirdAccountData.quran = next;
  renderWirdQuranProgress();
  wirdQuranSelect.value = '1';
  loadWirdSurah(1);
  saveWirdField('quran', next).catch(() => {});
});

// ================= التشيك الأسبوعي (مرتبط بالحساب) =================
// نخزّن بمستند الحساب users/{code}.wird = { weekKey, done }. weekKey يتغيّر
// تلقائيًا كل أسبوع - لو مختلف عن المخزّن نتعامل معه كـ"لسا" بدون ما نحتاج
// نمسحه فعليًا، ويصير التحديث الرسمي أول ما يضغط أحد التشيك بالأسبوع الجديد.
function currentWirdWeekKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - start) / 86400000);
  const week = Math.floor(dayOfYear / 7);
  return `${now.getFullYear()}-${week}`;
}

const wirdCheckBtn = document.getElementById('wird-check-btn');
const wirdCheckSubEl = document.getElementById('wird-check-sub');

function renderWirdCheckUi() {
  const wk = currentWirdWeekKey();
  const stored = wirdAccountData && wirdAccountData.wird;
  const done = !!(stored && stored.weekKey === wk && stored.done);
  wirdCheckBtn.classList.toggle('done', done);
  wirdCheckSubEl.textContent = wirdAccountCode
    ? 'يتجدد تلقائيًا كل أسبوع، مشترك بينكم بنفس الحساب'
    : 'سجّل دخولك بنفس رمز مرجع عشان يتحفظ لكم الاثنين';
}

wirdCheckBtn.addEventListener('click', () => {
  if (!wirdAccountCode) { openWirdAccountModal(); return; }
  const wk = currentWirdWeekKey();
  const stored = wirdAccountData.wird;
  const currentlyDone = !!(stored && stored.weekKey === wk && stored.done);
  const next = { weekKey: wk, done: !currentlyDone };
  wirdAccountData.wird = next;
  renderWirdCheckUi();
  saveWirdField('wird', next).catch(() => { /* فشل الحفظ، بيحاول تلقائيًا المرة الجاية */ });
});

renderWirdCheckUi();
renderWirdQuranProgress();
