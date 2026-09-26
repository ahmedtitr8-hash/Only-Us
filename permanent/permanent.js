// ============================================================
// permanent.js
// كل شيء خاص بـ"غرفتنا الدائمة" منفصل تمامًا هنا: رمزها (يختاره
// المستخدم بنفسه، ٤ أرقام)، إعدادها أول مرة، اختيار فئتها
// (نتابع/نلعب)، والتنقّل بين فئاتها من داخل الغرفة.
//
// السبب اللي خلانا نفصلها بملف مستقل: قبل كذا كانت أزرار الغرفة
// الدائمة تشارك أزرار الدخول العادي بنفس المستمعين (event
// listeners)، فكان الضغط على فئة بالغرفة الدائمة يشغّل استماع
// الدخول العادي كمان بالغلط (يطلب الاسم من جديد وكأنك بتسوي غرفة
// عادية) لحظة قبل ما يوصلك فعليًا. هذا الملف يستخدم عناصره
// ومستمعاته الخاصة بس، وما يلمس عناصر الدخول العادي إطلاقًا.
//
// يعتمد على دوال ومتغيرات معرّفة بـcore.js (بنفس النطاق العام،
// نفس أسلوب watch.js/games.js): goToStep, beginAsHost,
// beginAsGuest, requestNotificationPermission, sendData,
// stopRoomHeartbeat, clearSession, roomsDb, currentRoomCode,
// switchCategoryBtn, isPermanentFlow, permanentFallbackDone.
// ============================================================

// ---------- عناصر خطوة الإعداد أول مرة ----------
const permanentRoomBtn = document.getElementById('permanent-room-btn');
const entryStepPermanentSetup = document.getElementById('entry-step-permanent-setup');
const permanentSetupChoice = document.getElementById('permanent-setup-choice');
const permanentSetupCreated = document.getElementById('permanent-setup-created');
const nameInputPermanentSetup = document.getElementById('name-input-permanent-setup');
const permanentCodeCreateInput = document.getElementById('permanent-code-create-input');
const permanentCreateBtn = document.getElementById('permanent-create-btn');
const permanentCodeInput = document.getElementById('permanent-code-input');
const permanentEnterBtn = document.getElementById('permanent-enter-btn');
const entryErrorPermanentSetup = document.getElementById('entry-error-permanent-setup');
const permanentCodeDisplay = document.getElementById('permanent-code-display');
const permanentCopyBtn = document.getElementById('permanent-copy-btn');
const permanentContinueBtn = document.getElementById('permanent-continue-btn');
const backFromPermanentSetup = document.getElementById('back-from-permanent-setup');

// ---------- عناصر خطوة اختيار الفئة ----------
const entryStepPermanentMode = document.getElementById('entry-step-permanent-mode');
const permanentModeGreeting = document.getElementById('permanent-mode-greeting');
const permanentModeCards = document.querySelectorAll('#entry-step-permanent-mode [data-permanent-mode]');
const permanentReferenceBtn = document.getElementById('permanent-reference-btn');
const backFromPermanentMode = document.getElementById('back-from-permanent-mode');

function showPermanentSetupError(msg) {
  entryErrorPermanentSetup.textContent = msg;
  entryErrorPermanentSetup.classList.remove('hidden');
}

// ================= فتح الغرفة الدائمة (من الصفحة الرئيسية) =================
// رمز واحد ثابت يتخزن محليًا (localStorage — عمدًا هنا، بخلاف جلسة الغرفة
// المؤقتة اللي بـsessionStorage: هذا رمز دائم يبي له الطرفين يتذكرونه دايمًا).
// كل مرة تُفتح، تظهر قائمة اختيار الفئة من جديد دايمًا - بدون أي دخول تلقائي.

function openPermanentFlow() {
  const savedCode = localStorage.getItem('wt_permanent_code');
  const savedName = localStorage.getItem('wt_permanent_name');
  if (savedCode && savedName) {
    showPermanentModePicker(savedName);
  } else {
    permanentSetupChoice.classList.remove('hidden');
    permanentSetupCreated.classList.add('hidden');
    entryErrorPermanentSetup.classList.add('hidden');
    goToStep(entryStepPermanentSetup);
    nameInputPermanentSetup.focus();
  }
}

function showPermanentModePicker(name) {
  permanentModeGreeting.textContent = 'هلا ' + name + '، وش نسوي بغرفتنا الدائمة؟';
  goToStep(entryStepPermanentMode);
}

permanentRoomBtn.addEventListener('click', openPermanentFlow);
backFromPermanentSetup.addEventListener('click', () => goToStep(entryStepMode));
backFromPermanentMode.addEventListener('click', () => goToStep(entryStepMode));

// ================= إنشاء رمز دائم جديد (يكتبه المستخدم بنفسه) =================

permanentCreateBtn.addEventListener('click', () => {
  const name = (nameInputPermanentSetup.value || '').trim();
  const code = (permanentCodeCreateInput.value || '').replace(/\D/g, '');
  if (!name) {
    showPermanentSetupError('اكتب اسمك الأول');
    nameInputPermanentSetup.focus();
    return;
  }
  if (!/^\d{4}$/.test(code)) {
    showPermanentSetupError('الرمز لازم يكون ٤ أرقام بالضبط');
    permanentCodeCreateInput.focus();
    return;
  }
  entryErrorPermanentSetup.classList.add('hidden');
  localStorage.setItem('wt_permanent_code', code);
  localStorage.setItem('wt_permanent_name', name);
  permanentCodeDisplay.textContent = code;
  permanentSetupChoice.classList.add('hidden');
  permanentSetupCreated.classList.remove('hidden');
});

permanentCopyBtn.addEventListener('click', () => {
  const code = localStorage.getItem('wt_permanent_code') || '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).catch(() => {});
  }
  const original = permanentCopyBtn.textContent;
  permanentCopyBtn.textContent = 'تم النسخ';
  setTimeout(() => { permanentCopyBtn.textContent = original; }, 1500);
});

permanentContinueBtn.addEventListener('click', () => {
  const name = localStorage.getItem('wt_permanent_name') || '';
  showPermanentModePicker(name);
});

// ================= دخول برمز أرسله الشريك =================

permanentEnterBtn.addEventListener('click', () => {
  const name = (nameInputPermanentSetup.value || '').trim();
  if (!name) {
    showPermanentSetupError('اكتب اسمك الأول');
    nameInputPermanentSetup.focus();
    return;
  }
  const code = (permanentCodeInput.value || '').replace(/\D/g, '');
  if (!/^\d{4}$/.test(code)) {
    showPermanentSetupError('اكتب الرمز كامل (٤ أرقام)');
    permanentCodeInput.focus();
    return;
  }
  entryErrorPermanentSetup.classList.add('hidden');
  localStorage.setItem('wt_permanent_code', code);
  localStorage.setItem('wt_permanent_name', name);
  showPermanentModePicker(name);
});

if (permanentReferenceBtn) {
  permanentReferenceBtn.addEventListener('click', () => {
    if (typeof openReferenceView === 'function') openReferenceView();
  });
}

// ================= اختيار فئة الغرفة الدائمة (نتابع / نلعب) =================

permanentModeCards.forEach((card) => {
  card.addEventListener('click', () => {
    const name = localStorage.getItem('wt_permanent_name') || 'ضيف';
    const permanentCode = localStorage.getItem('wt_permanent_code');
    if (!permanentCode) { goToStep(entryStepPermanentSetup); return; }
    const mode = card.dataset.permanentMode;
    // كل نشاط (نتابع/نلعب) نقطة لقاء منفصلة تمامًا بنفس الرمز الدائم - عشان
    // الطرفين يقدرون يكونون بنشاطين مختلفين بنفس الوقت بدون ما يتعارضون
    const meetingCode = permanentCode + '_' + mode;
    isPermanentFlow = true;
    permanentFallbackDone = false;
    switchCategoryBtn.classList.remove('hidden');
    requestNotificationPermission();
    // نحاول نصير "المضيف" لهالنقطة أول (أول وحد يوصلها). لو فيه حد موجود فيها
    // فعلًا، handlePeerError بـcore.js يتحول تلقائيًا يوصلنا كضيف
    beginAsHost(meetingCode, name, mode);
  });
});

// ================= تبديل الفئة من داخل الغرفة الدائمة =================
// الفرق عن "الخروج من الغرفة" (leaveRoomBtn بـcore.js): هذا ما يودّي للصفحة
// الرئيسية العادية، يرجّع مباشرة لقائمة فئات الغرفة الدائمة (نتابع/نلعب).
// نعتمد على إعادة تحميل الصفحة (زي أي خروج ثاني بالمشروع) عشان نضمن تصفير كل
// حالة نتابع/الألعاب بشكل نظيف، بس نحط علامة بـsessionStorage قبل الإعادة
// عشان أول شي يصير بعد التحميل هو عرض قائمة فئات الغرفة الدائمة تلقائيًا -
// بدون ما تمر أبدًا على الصفحة الرئيسية العادية (شوف الفحص تحت + core.js).

switchCategoryBtn.addEventListener('click', () => {
  if (!confirm('بترجع لقائمة فئات غرفتكم الدائمة، وينقطع النشاط الحالي عند الطرفين. تكمل؟')) return;
  sendData({ kind: 'peer-left' });
  stopRoomHeartbeat();
  if (currentRoomCode) {
    roomsDb.collection('rooms').doc(currentRoomCode).set({ currentVideo: null }, { merge: true }).catch(() => {});
  }
  clearSession();
  sessionStorage.setItem('wt_return_to_permanent', '1');
  setTimeout(() => window.location.reload(), 80);
});

// ================= الرجوع التلقائي لقائمة الفئات بعد "تبديل الفئة" =================
// core.js يخفي خطوة الدخول الرئيسية فورًا (بدون انتظار وصول هذا الملف) لو لقى
// نفس العلامة، عشان ما تنومض الصفحة الرئيسية العادية قبل ما نوصل لهنا.
if (sessionStorage.getItem('wt_return_to_permanent') === '1') {
  sessionStorage.removeItem('wt_return_to_permanent');
  const savedCode = localStorage.getItem('wt_permanent_code');
  const savedName = localStorage.getItem('wt_permanent_name');
  if (savedCode && savedName) {
    showPermanentModePicker(savedName);
  } else {
    goToStep(entryStepMode);
  }
}
