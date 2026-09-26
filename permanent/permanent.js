// ============================================================
// permanent.js
// كل شيء خاص بـ"غرفتنا الدائمة" منفصل تمامًا هنا: رمزها (يختاره
// المستخدم بنفسه، ٤ أرقام)، إعدادها أول مرة، اختيار فئتها
// (نتابع/نلعب)، والتبديل بين فئاتها من داخل الغرفة عن طريق قائمة
// منسدلة بالشريط العلوي.
//
// السبب اللي خلانا نفصلها بملف مستقل: قبل كذا كانت أزرار الغرفة
// الدائمة تشارك أزرار الدخول العادي بنفس المستمعين (event
// listeners)، فكان الضغط على فئة بالغرفة الدائمة يشغّل استماع
// الدخول العادي كمان بالغلط. هذا الملف يستخدم عناصره ومستمعاته
// الخاصة بس، وما يلمس عناصر الدخول العادي إطلاقًا.
//
// يعتمد على دوال ومتغيرات معرّفة بـcore.js (بنفس النطاق العام،
// نفس أسلوب watch.js/games.js): goToStep, beginAsHost,
// requestNotificationPermission, sendData, stopRoomHeartbeat,
// clearSession, roomsDb, currentRoomCode, roomMode,
// switchCategoryBtn, isPermanentFlow, permanentFallbackDone.
// ============================================================

// ---------- عناصر خطوة الإعداد أول مرة (اسم + رمز، بدون تفريق إنشاء/دخول) ----------
const permanentRoomBtn = document.getElementById('permanent-room-btn');
const entryStepPermanentSetup = document.getElementById('entry-step-permanent-setup');
const nameInputPermanentSetup = document.getElementById('name-input-permanent-setup');
const permanentCodeInput = document.getElementById('permanent-code-input');
const permanentEnterBtn = document.getElementById('permanent-enter-btn');
const entryErrorPermanentSetup = document.getElementById('entry-error-permanent-setup');
const backFromPermanentSetup = document.getElementById('back-from-permanent-setup');

// ---------- عناصر خطوة اختيار الفئة (تظهر أول مرة من الصفحة الرئيسية بس) ----------
const entryStepPermanentMode = document.getElementById('entry-step-permanent-mode');
const permanentModeGreeting = document.getElementById('permanent-mode-greeting');
const permanentModeCards = document.querySelectorAll('#entry-step-permanent-mode [data-permanent-mode]');
const permanentReferenceBtn = document.getElementById('permanent-reference-btn');
const backFromPermanentMode = document.getElementById('back-from-permanent-mode');

// ---------- عناصر القائمة المنسدلة (تبديل الفئة من داخل الغرفة) ----------
const switchCategoryMenu = document.getElementById('switch-category-menu');
const switchCategoryItems = document.querySelectorAll('.switch-category-item');

function showPermanentSetupError(msg) {
  entryErrorPermanentSetup.textContent = msg;
  entryErrorPermanentSetup.classList.remove('hidden');
}

// ================= فتح الغرفة الدائمة (من الصفحة الرئيسية) =================
// رمز واحد ثابت يتخزن محليًا (localStorage — عمدًا هنا، بخلاف جلسة الغرفة
// المؤقتة اللي بـsessionStorage: هذا رمز دائم يبي له الطرفين يتذكرونه دايمًا).
// كل مرة تُفتح من الصفحة الرئيسية، تظهر قائمة اختيار الفئة من جديد دايمًا.

function openPermanentFlow() {
  const savedCode = localStorage.getItem('wt_permanent_code');
  const savedName = localStorage.getItem('wt_permanent_name');
  if (savedCode && savedName) {
    showPermanentModePicker(savedName);
  } else {
    entryErrorPermanentSetup.classList.add('hidden');
    goToStep(entryStepPermanentSetup);
    nameInputPermanentSetup.focus();
  }
}

function showPermanentModePicker(name) {
  permanentModeGreeting.textContent = 'هلا ' + name + '، وش نتشارك به؟';
  goToStep(entryStepPermanentMode);
}

permanentRoomBtn.addEventListener('click', openPermanentFlow);
backFromPermanentSetup.addEventListener('click', () => goToStep(entryStepMode));
backFromPermanentMode.addEventListener('click', () => goToStep(entryStepMode));

// ================= إعداد الغرفة الدائمة: اسم + رمز، خطوة وحدة بس =================
// رمز موجود من قبل = يدخلكم فيه، رمز جديد = ينشئه لكم من أول استخدام - ما فيه
// فرق بالواجهة بين الحالتين (نفس زر "دخول")؛ الفرق الفعلي (مضيف/ضيف) يتحدد لاحقًا
// تلقائيًا وقت اختيار الفئة (شوف beginAsHost/handlePeerError بـcore.js).

permanentEnterBtn.addEventListener('click', () => {
  const name = (nameInputPermanentSetup.value || '').trim();
  if (!name) {
    showPermanentSetupError('اكتب اسمك الأول');
    nameInputPermanentSetup.focus();
    return;
  }
  const code = (permanentCodeInput.value || '').replace(/\D/g, '');
  if (!/^\d{4}$/.test(code)) {
    showPermanentSetupError('اكتب رمز مكوّن من ٤ أرقام');
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
    // نعلّم إن "مرجع" انفتحت من قائمة فئات غرفتنا الدائمة (قبل ما ندخل أي غرفة)،
    // عشان لو اخترنا فيلم/مسلسل يروح لفئة "نتابع" بنفس رمزنا الدائم، مو غرفة
    // مؤقتة عشوائية (شوف goWatch بreference.js وinitFromReference بwatch.js)
    window.referenceEntryIsPermanent = true;
    if (typeof openReferenceView === 'function') openReferenceView();
  });
}

// ================= الدخول الفعلي لفئة بالغرفة الدائمة =================
// دالة واحدة يستخدمها كل من: الضغط على بطاقة فئة أول مرة (من قائمة الاختيار)،
// والاختيار من القائمة المنسدلة داخل الغرفة (بدل الرجوع لشاشة الاختيار).

function joinPermanentMode(mode) {
  const name = localStorage.getItem('wt_permanent_name') || 'ضيف';
  const permanentCode = localStorage.getItem('wt_permanent_code');
  if (!permanentCode) { goToStep(entryStepPermanentSetup); return; }
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
}

permanentModeCards.forEach((card) => {
  card.addEventListener('click', () => joinPermanentMode(card.dataset.permanentMode));
});

// ================= تبديل الفئة من داخل الغرفة: قائمة منسدلة مباشرة =================
// بدل ما يرجّعك لشاشة اختيار منفصلة، الزر يفتح قائمة صغيرة بمكانه فيها الفئتين -
// تختار وحدة وتنتقل لها على طول، بدون ما تشوف أي شاشة "رجوع" بينهم.

function closeSwitchCategoryMenu() {
  switchCategoryMenu.classList.add('hidden');
}

switchCategoryBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = !switchCategoryMenu.classList.contains('hidden');
  if (isOpen) { closeSwitchCategoryMenu(); return; }
  // نعلّم الفئة الحالية عشان تبين معطّلة بالقائمة (اختيارها ثانية بدون فايدة)
  switchCategoryItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.switchMode === roomMode);
  });
  switchCategoryMenu.classList.remove('hidden');
});

document.addEventListener('click', (e) => {
  if (!switchCategoryMenu.classList.contains('hidden') && !e.target.closest('.switch-category-wrap')) {
    closeSwitchCategoryMenu();
  }
});

switchCategoryItems.forEach((item) => {
  item.addEventListener('click', () => {
    if (item.classList.contains('active')) { closeSwitchCategoryMenu(); return; }
    closeSwitchCategoryMenu();
    switchToPermanentMode(item.dataset.switchMode);
  });
});

// نعتمد على إعادة تحميل الصفحة (زي أي خروج ثاني بالمشروع) عشان نضمن تصفير كل
// حالة نتابع/الألعاب بشكل نظيف، بس نحط الفئة الجديدة المطلوبة بـsessionStorage
// قبل الإعادة عشان أول شي يصير بعد التحميل هو الدخول المباشر للفئة الجديدة -
// بدون المرور على شاشة اختيار الفئة ولا الصفحة الرئيسية العادية إطلاقًا.
function switchToPermanentMode(newMode) {
  sendData({ kind: 'peer-left' });
  stopRoomHeartbeat();
  if (currentRoomCode) {
    roomsDb.collection('rooms').doc(currentRoomCode).set({ currentVideo: null }, { merge: true }).catch(() => {});
  }
  clearSession();
  sessionStorage.setItem('wt_return_to_permanent_mode', newMode);
  setTimeout(() => window.location.reload(), 80);
}

// ================= الدخول المباشر للفئة الجديدة بعد "تبديل الفئة" =================
// core.js يخفي خطوة الدخول الرئيسية فورًا (بدون انتظار وصول هذا الملف) لو لقى
// نفس العلامة، عشان ما تنومض الصفحة الرئيسية العادية قبل ما نوصل لهنا.
const pendingPermanentMode = sessionStorage.getItem('wt_return_to_permanent_mode');
if (pendingPermanentMode) {
  sessionStorage.removeItem('wt_return_to_permanent_mode');
  const savedCode = localStorage.getItem('wt_permanent_code');
  const savedName = localStorage.getItem('wt_permanent_name');
  if (savedCode && savedName) {
    joinPermanentMode(pendingPermanentMode);
  } else {
    goToStep(entryStepMode);
  }
}
