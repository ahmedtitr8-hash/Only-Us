// ============================================================
// core.js
// نقطة الدخول الرئيسية: عناصر شاشة الدخول ومنطقها (اختيار نشاط ثم اسم،
// إنشاء غرفة أو الدخول برمز). باقي مسؤوليات core.js القديم انتقلت
// لملفات مستقلة بنفس المجلد:
//   connection.js → الاتصال (PeerJS/Firestore)، الجلسة، المضيف/الضيف،
//                   قناة البيانات المركزية، الخروج من الغرفة
//   chat.js       → الشات وقائمة خياراته
//   mic.js        → المكالمة الصوتية (المايك)
//   ui-shared.js  → المودال العام (تأكيد)، نسخ الرمز، الأفاتار، أدوات
//                   صغيرة مشتركة (تعديل ارتفاع الشاشة، إذن الإشعارات)
// كل الملفات الخمسة سكربتات عادية بنفس الصفحة (بدون type="module")،
// فتشترك كلها بنفس النطاق العام — أي دالة أو متغيّر يتعرّف بملف يصير
// متاح تلقائيًا للباقي (نفس ما كان عليه الوضع قبل التقسيم). watch.js
// و games/*.js يعتمدون عليها كلها بنفس الطريقة القديمة.
// ترتيب التحميل بـindex.html: core.js أول شي، ثم connection.js/chat.js/
// mic.js/ui-shared.js (الترتيب بينها الأربعة مو مهم لأن كل التفاعل بينها
// يصير جوا دوال تُستدعى لاحقًا، مو بكود يشتغل فورًا وقت التحميل).
// ============================================================

// ---------- عناصر شاشة الدخول ----------
const entryScreen = document.getElementById('entry-screen');
const roomScreen = document.getElementById('room-screen');

const entryStepMode = document.getElementById('entry-step-mode');
const entryStepCreate = document.getElementById('entry-step-create');
const entryStepJoin = document.getElementById('entry-step-join');
const showJoinBtn = document.getElementById('show-join-btn');
const backFromCreate = document.getElementById('back-from-create');
const backFromJoin = document.getElementById('back-from-join');
const nameInputCreate = document.getElementById('name-input-create');
const nameInputJoin = document.getElementById('name-input-join');
const confirmCreateBtn = document.getElementById('confirm-create-btn');
const confirmCreateText = document.getElementById('confirm-create-text');
const createSpinner = document.getElementById('create-spinner');
const roomCodeInput = document.getElementById('room-code-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinSpinner = document.getElementById('join-spinner');
const entryError = document.getElementById('entry-error');
const switchCategoryBtn = document.getElementById('switch-category-btn');

initEditableField(nameInputCreate, { maxLength: 20 });
initEditableField(nameInputJoin, { maxLength: 20 });
initEditableField(roomCodeInput, { numeric: true, maxLength: 8 });

// الحقول name-input-create / name-input-join / room-code-input صارت عناصر
// <div contenteditable> بدل <input> (شوف field-editable.js) عشان نظام الإكمال
// التلقائي بالأندرويد ما يتعرف عليها كحقول نموذج من الأساس، فما يقترح عليها شي.
// getFieldValue/setFieldValue بملف field-editable.js يتعاملون معها بدل .value.

// ملاحظة: كل عناصر ومنطق "الغرفة الدائمة" (permanent-room-btn وخطواتها) صارت
// بالكامل بملفها المستقل permanent/permanent.js - core.js ما يعرف عنها شي غير
// الأعلام المشتركة isPermanentFlow/permanentFallbackDone (معرّفة بـconnection.js،
// يحتاجها handlePeerError هناك). شوف تعليق "الغرفة الدائمة" بأسفل permanent.js
// للتفاصيل.

// لو رجعنا هنا بعد "تبديل فئة" بالغرفة الدائمة (شوف permanent.js)، نخفي خطوة
// الاختيار الرئيسية فورًا عشان ما تنومض قبل ما permanent.js يوصل ويدخلنا مباشرة
// للفئة الجديدة (بدون المرور على أي شاشة اختيار)
if (sessionStorage.getItem('wt_return_to_permanent_mode')) {
  entryStepMode.classList.add('hidden');
}

function randomCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000)); // 8 أرقام
}

// عام لكل خطوات الدخول (بما فيها خطوات الغرفة الدائمة اللي تُضاف لاحقًا من
// permanent.js) - نعتمد على كلاس entry-step المشترك بدل تعداد كل عنصر بالاسم،
// عشان استدعاء هذي الدالة يشتغل صح حتى لو permanent.js لسا ما حمّل عناصره
function goToStep(step) {
  document.querySelectorAll('.entry-step').forEach((el) => el.classList.add('hidden'));
  step.classList.remove('hidden');
}

function showEntryError(msg) {
  entryError.textContent = msg;
  entryError.classList.remove('hidden');
}

const MODE_LABELS = { watch: 'نتابع', games: 'نلعب' };
const MODE_CREATE_LABELS = { watch: 'إنشاء', games: 'إنشاء' };

const modeCards = document.querySelectorAll('#entry-step-mode .mode-card');
modeCards.forEach((card) => {
  card.addEventListener('click', () => {
    pendingMode = card.dataset.mode;
    confirmCreateText.textContent = MODE_CREATE_LABELS[pendingMode] || 'إنشاء الغرفة';
    goToStep(entryStepCreate);
    nameInputCreate.focus();
  });
});

showJoinBtn.addEventListener('click', () => {
  goToStep(entryStepJoin);
  nameInputJoin.focus();
});
backFromCreate.addEventListener('click', () => goToStep(entryStepMode));
backFromJoin.addEventListener('click', () => goToStep(entryStepMode));

confirmCreateBtn.addEventListener('click', () => {
  const name = (getFieldValue(nameInputCreate) || 'ضيف').trim();
  const code = randomCode();
  writeSession('host', code);
  isPermanentFlow = false;
  switchCategoryBtn.classList.add('hidden');
  confirmCreateBtn.disabled = true;
  confirmCreateText.textContent = 'جاري الاتصال';
  createSpinner.classList.remove('hidden');
  requestNotificationPermission();
  beginAsHost(code, name, pendingMode);
});

joinRoomBtn.addEventListener('click', async () => {
  const name = (getFieldValue(nameInputJoin) || 'ضيف').trim();
  const code = (getFieldValue(roomCodeInput) || '').replace(/\D/g, '');
  if (code.length < 6) {
    showEntryError('اكتب رمز الغرفة كامل');
    return;
  }
  joinRoomBtn.disabled = true;
  document.getElementById('join-room-text').textContent = 'جاري الاتصال';
  joinSpinner.classList.remove('hidden');
  const roomData = await fetchRoomDoc(code);
  if (isRoomDataExpired(roomData)) {
    joinRoomBtn.disabled = false;
    document.getElementById('join-room-text').textContent = 'دخول';
    joinSpinner.classList.add('hidden');
    showEntryError('رمز الغرفة غير صحيح');
    return;
  }
  writeSession('guest', code);
  isPermanentFlow = false;
  switchCategoryBtn.classList.add('hidden');
  requestNotificationPermission();
  beginAsGuest(code, name);
});
