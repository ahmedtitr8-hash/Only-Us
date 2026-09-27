// ============================================================
// wird.js
// فئة "وِرد": طبقة مستقلة فوق نفس الصفحة، بدون أي غرفة أو اتصال حي (PeerJS).
// نفس نظام حساب "مرجع" بالضبط: رمز ٤ أرقام محفوظ بـlocalStorage (نفس المفتاح
// only_us_account_code) ونفس مجموعة users بفايربيس - فلو عندهم حساب من مرجع
// أصلًا، يدخلهم هنا تلقائيًا بدون أي شي إضافي. نضيف بس حقل جديد "wird" لمستند
// المستخدم (merge)، ما نلمس favorites/watched اللي مرجع يستخدمها.
// ملاحظة تسمية: كل المتغيرات هنا مسبوقة بـwird عمدًا (بدل نفس أسماء
// reference.js زي accountCode/db/accountBtn...) عشان الملفين سكربتات عادية
// بنفس الصفحة (نفس النطاق العام)، فلو تكرر نفس الاسم بين الاثنين يصير خطأ
// إعادة تعريف لو انفتحت الفئتين بنفس الجلسة.
// ============================================================

// roomsDb أصلًا معرّف ومهيّأ بـcore/connection.js (نفس مشروع فايربيس بالضبط)
// ويتحمّل دايمًا بكل صفحات التطبيق بغض النظر عن الغرفة - فنعيد استخدامه بدل
// ما نسوي تهيئة firebase.initializeApp ثانية.
const wirdDb = roomsDb;

let wirdAccountCode = localStorage.getItem('only_us_account_code') || null;
let wirdAccountData = { wird: null }; // يتحمّل بعد تسجيل الدخول

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
    await ref.set({ wird: null, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { wird: null };
  }
  const data = snap.data();
  return { wird: data.wird || null };
}

async function saveWirdField(value) {
  if (!wirdAccountCode) return;
  await wirdDb.collection('users').doc(wirdAccountCode).set(
    { wird: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

function updateWirdAccountUi() {
  const loggedIn = !!wirdAccountCode;
  wirdAccountBtn.classList.toggle('logged-in', loggedIn);
  renderWirdCheckUi();
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
  wirdAccountData = { wird: null };
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

// ---------- بنك المحتوى (بيانات ثابتة بحتة) ----------
const WIRD_CONTENT = {
  morning: {
    short: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس)', count: '٣ مرات لكل وحدة' },
      { text: 'سيد الاستغفار: "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك..."', count: 'مرة' },
      { text: 'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له...', count: 'مرة' },
    ],
    full: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس)', count: '٣ مرات لكل وحدة' },
      { text: 'سيد الاستغفار: "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك..."', count: 'مرة' },
      { text: 'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له...', count: 'مرة' },
      { text: 'اللهم بك أصبحنا، وبك أمسينا، وبك نحيا، وبك نموت، وإليك النشور', count: 'مرة' },
      { text: 'اللهم إني أصبحت أشهدك، وأشهد حملة عرشك، وملائكتك، وجميع خلقك، أنك أنت الله لا إله إلا أنت وأن محمدًا عبدك ورسولك', count: '٤ مرات' },
      { text: 'اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري، لا إله إلا أنت', count: '٣ مرات' },
      { text: 'اللهم إني أسألك العفو والعافية في الدنيا والآخرة', count: '٣ مرات' },
      { text: 'حسبي الله لا إله إلا هو، عليه توكلت وهو رب العرش العظيم', count: '٧ مرات' },
      { text: 'رضيت بالله ربًا، وبالإسلام دينًا، وبمحمد ﷺ نبيًا', count: '٣ مرات' },
      { text: 'سبحان الله وبحمده', count: '١٠٠ مرة' },
      { text: 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير', count: '١٠ مرات (أو مرة)' },
      { text: 'أستغفر الله وأتوب إليه', count: '١٠٠ مرة' },
    ],
  },
  evening: {
    short: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس)', count: '٣ مرات لكل وحدة' },
      { text: 'سيد الاستغفار: "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك..."', count: 'مرة' },
      { text: 'أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له...', count: 'مرة' },
    ],
    full: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس)', count: '٣ مرات لكل وحدة' },
      { text: 'سيد الاستغفار: "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك..."', count: 'مرة' },
      { text: 'أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له...', count: 'مرة' },
      { text: 'اللهم بك أمسينا، وبك أصبحنا، وبك نحيا، وبك نموت، وإليك المصير', count: 'مرة' },
      { text: 'اللهم إني أمسيت أشهدك، وأشهد حملة عرشك، وملائكتك، وجميع خلقك، أنك أنت الله لا إله إلا أنت وأن محمدًا عبدك ورسولك', count: '٤ مرات' },
      { text: 'اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري، لا إله إلا أنت', count: '٣ مرات' },
      { text: 'اللهم إني أسألك العفو والعافية في الدنيا والآخرة', count: '٣ مرات' },
      { text: 'حسبي الله لا إله إلا هو، عليه توكلت وهو رب العرش العظيم', count: '٧ مرات' },
      { text: 'رضيت بالله ربًا، وبالإسلام دينًا، وبمحمد ﷺ نبيًا', count: '٣ مرات' },
      { text: 'سبحان الله وبحمده', count: '١٠٠ مرة' },
      { text: 'أستغفر الله وأتوب إليه', count: '١٠٠ مرة' },
    ],
  },
  sleep: {
    short: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس) - تُقرأ وتُنفث بها اليدين ثم تُمسح على الجسد', count: '٣ مرات' },
      { text: 'تسبيح فاطمة: سبحان الله، الحمد لله، الله أكبر', count: '٣٣ / ٣٣ / ٣٤' },
    ],
    full: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس) - تُقرأ وتُنفث بها اليدين ثم تُمسح على الجسد', count: '٣ مرات' },
      { text: 'تسبيح فاطمة: سبحان الله، الحمد لله، الله أكبر', count: '٣٣ / ٣٣ / ٣٤' },
      { text: 'آخر آيتين من سورة البقرة: "آمن الرسول بما أنزل إليه من ربه..."', count: 'مرة' },
      { text: 'باسمك اللهم أموت وأحيا', count: 'مرة' },
      { text: 'اللهم أسلمت نفسي إليك، وفوضت أمري إليك، وألجأت ظهري إليك...', count: 'مرة' },
      { text: 'اللهم قني عذابك يوم تبعث عبادك', count: '٣ مرات' },
    ],
  },
};

let wirdSection = 'morning';
let wirdVersion = 'short';

const wirdTabsEl = document.getElementById('wird-tabs');
const wirdVersionToggleEl = document.getElementById('wird-version-toggle');
const wirdListEl = document.getElementById('wird-list');

function renderWirdList() {
  const items = WIRD_CONTENT[wirdSection][wirdVersion];
  wirdListEl.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'wird-item';
    const text = document.createElement('span');
    text.className = 'wird-item-text';
    text.textContent = item.text;
    const count = document.createElement('span');
    count.className = 'wird-item-count';
    count.textContent = item.count;
    row.appendChild(text);
    row.appendChild(count);
    wirdListEl.appendChild(row);
  });
}

wirdTabsEl.querySelectorAll('.wird-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdSection = btn.dataset.wirdSection;
    wirdTabsEl.querySelectorAll('.wird-tab').forEach((b) => b.classList.toggle('active', b === btn));
    renderWirdList();
  });
});

wirdVersionToggleEl.querySelectorAll('.wird-version-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdVersion = btn.dataset.wirdVersion;
    wirdVersionToggleEl.querySelectorAll('.wird-version-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderWirdList();
  });
});

renderWirdList();

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
  saveWirdField(next).catch(() => { /* فشل الحفظ، بيحاول تلقائيًا المرة الجاية */ });
});

renderWirdCheckUi();
