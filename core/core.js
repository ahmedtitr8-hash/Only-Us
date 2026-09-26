// ============================================================
// core.js
// المسؤول عن: الاتصال (PeerJS)، الجلسة، شاشة الدخول، المشاركين،
// المايك، الشات، والتبديل بين أوضاع الغرفة (نتابع / نلعب).
// watch.js و games.js يعتمدون على الدوال هنا (sendData, isHost,
// myName, peerName...) وهي متاحة لهم تلقائيًا لأنها بنفس النطاق
// العام (كل الملفات سكربتات عادية بنفس الصفحة).
// ============================================================

// ---------- إصلاح ارتفاع الشاشة عند ظهور لوحة المفاتيح (مشكلة شائعة على الجوال) ----------
function applyViewportHeight() {
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.querySelectorAll('.screen').forEach((el) => { el.style.height = vh + 'px'; });
}
window.addEventListener('resize', applyViewportHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', applyViewportHeight);
}
applyViewportHeight();

// ---------- Firebase: نستخدمها بس لتتبّع "حياة" رمز الغرفة (30 دقيقة بدون أي طرف = الرمز ينحذف نهائيًا) ----------
const firebaseConfig = {
  apiKey: 'AIzaSyDG8hrBDfBRFAEZETJQvTxV5XozBF-wDaU',
  authDomain: 'onlyus-863cf.firebaseapp.com',
  projectId: 'onlyus-863cf',
  storageBucket: 'onlyus-863cf.firebasestorage.app',
  messagingSenderId: '84204575362',
  appId: '1:84204575362:web:bb29e0be31b8295df6329b',
};
firebase.initializeApp(firebaseConfig);
const roomsDb = firebase.firestore();
const ROOM_EXPIRY_MS = 30 * 60 * 1000; // 30 دقيقة
let roomHeartbeatInterval = null;

// ينبض كل ما نكون فعليًا متصلين بالغرفة (نبضة كل دقيقة + عند أول دخول) — يخلي الرمز "حي"
function startRoomHeartbeat(code) {
  stopRoomHeartbeat();
  const beat = () => {
    roomsDb.collection('rooms').doc(code).set(
      { lastSeenAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    ).catch(() => {});
  };
  beat();
  roomHeartbeatInterval = setInterval(beat, 60 * 1000);
}
function stopRoomHeartbeat() {
  if (roomHeartbeatInterval) { clearInterval(roomHeartbeatInterval); roomHeartbeatInterval = null; }
}

// يجيب بيانات الغرفة من فايربيس بقراءة وحدة (نستخدمها لفحص الانتهاء ولجلب الاسم/الوضع
// المحفوظين بنفس الوقت، بدل قراءتين منفصلتين)
async function fetchRoomDoc(code) {
  try {
    const snap = await roomsDb.collection('rooms').doc(code).get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    return null; // فشل الفحص (شبكة مثلًا) — نتعامل معه كغرفة غير منتهية، ما نمنع الدخول
  }
}
function isRoomDataExpired(data) {
  if (!data) return false; // ما فيه سجل = غرفة جديدة أو فشل الفحص، طبيعي تكمل
  const lastSeenAt = data.lastSeenAt && data.lastSeenAt.toMillis ? data.lastSeenAt.toMillis() : 0;
  if (!lastSeenAt) return false;
  return (Date.now() - lastSeenAt) > ROOM_EXPIRY_MS;
}

// ---------- عناصر الصفحة (مشتركة) ----------
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

// ملاحظة: كل عناصر ومنطق "الغرفة الدائمة" (permanent-room-btn وخطواتها) صارت
// بالكامل بملفها المستقل permanent/permanent.js - core.js ما يعرف عنها شي غير
// الأعلام المشتركة isPermanentFlow/permanentFallbackDone تحت (يحتاجها
// handlePeerError). شوف تعليق "الغرفة الدائمة" بأسفل permanent.js للتفاصيل.

const roomModeLabel = document.getElementById('room-mode-label');
const watchPanel = document.getElementById('watch-panel');
const gamesPanel = document.getElementById('games-panel');

const copyCodeBtn = document.getElementById('copy-code-btn');
const browseRefBtn = document.getElementById('browse-ref-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

const avatarMe = document.getElementById('avatar-me');
const nameMeLabel = document.getElementById('name-me-label');
const avatarPeer = document.getElementById('avatar-peer');
const namePeerLabel = document.getElementById('name-peer-label');
const peerMicIndicator = document.getElementById('peer-mic-indicator');

const micBtn = document.getElementById('mic-btn');
const callVolumeSlider = document.getElementById('call-volume');
const remoteVolumeSlider = callVolumeSlider; // اسم مستعار أوضح بمكان الاستخدام بالأسفل

const chatMessages = document.getElementById('chat-messages');
const chatEmpty = document.getElementById('chat-empty');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatForm = document.getElementById('chat-form');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');

const remoteAudio = document.getElementById('remote-audio');
const mainLayoutEl = document.getElementById('main-layout');

// ---------- إعدادات الاتصال (STUN + TURN مجاني) ----------
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

// ---------- حالة عامة (يقرأها watch.js و games.js) ----------
// معرّف فريد لهذي الجلسة (التبويب/الجهاز) — نستخدمه لتمييز كتاباتنا احنا بالـFirestore
// عن كتابات الطرف الثاني، لأن onSnapshot يرجّع لك كتاباتك انت كمان (شات المرحلة ١ من
// نقل التزامن لـFirestore). يتولد من جديد كل تحميل صفحة، مو محتاج يكون ثابت أكثر من هذا.
const myDeviceId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('d-' + Math.random().toString(36).slice(2) + Date.now());
let unsubMessages = null;
let unsubRoomDoc = null;

let myName = 'ضيف';
let peerName = null;
let isHost = false;
let unavailableIdRetries = 0;
let currentRoomCode = null;
let peer = null;
let dataConn = null;
let remotePeerId = null;
let roomMode = 'watch'; // 'watch' | 'games'
let pendingMode = 'watch';
let lastMessageSender = null;

// تُستخدم من permanent.js (نفس النطاق العام) لتعليم إن الغرفة الحالية دخلناها عبر
// الغرفة الدائمة - handlePeerError تحت يحتاجها فيحتفظ بيها هنا عشان تكون معرّفة
// دايمًا حتى لو permanent.js لسا ما وصل تحميله (يتحمّل غير متزامن)
let isPermanentFlow = false;
let permanentFallbackDone = false;

const switchCategoryBtn = document.getElementById('switch-category-btn');

// لو رجعنا هنا بعد "تبديل فئة" بالغرفة الدائمة (شوف permanent.js)، نخفي خطوة
// الاختيار الرئيسية فورًا عشان ما تنومض قبل ما permanent.js يوصل ويدخلنا مباشرة
// للفئة الجديدة (بدون المرور على أي شاشة اختيار)
if (sessionStorage.getItem('wt_return_to_permanent_mode')) {
  entryStepMode.classList.add('hidden');
}

function randomCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000)); // 8 أرقام
}
function peerIdFor(code) { return 'wt-' + code; }

// ================= استمرارية الجلسة =================
// نخزن محليًا أقل شي ممكن فعليًا (رمز الغرفة والدور بس) بـsessionStorage عمدًا (مو
// localStorage): لازم يبقى عبر تحديث الصفحة (F5) أو الرجوع من صفحة مرجع بنفس التبويب،
// لكن ما يصير يرجعنا للغرفة لو المستخدم سكّر التبويب أو المتصفح بنفسه قصدًا —
// sessionStorage ينمسح تلقائيًا بهالحالة، وهذا بالضبط السلوك المطلوب. كل شي ثاني
// (الاسم، الوضع، الفيديو الحالي، صحة الغرفة) يجي من فايربيس مباشرة كل ما نرجع.

function readSession() {
  try { return JSON.parse(sessionStorage.getItem('wt_session')); } catch (e) { return null; }
}
function writeSession(role, code) {
  sessionStorage.setItem('wt_session', JSON.stringify({ role, code }));
}
function clearSession() {
  sessionStorage.removeItem('wt_session');
}

const storedSession = readSession();

// ================= أفاتار بالأحرف الأولى =================

function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 62%, 46%)`;
}
function setAvatar(el, name) {
  const initial = (name || '؟').trim().charAt(0).toUpperCase();
  el.textContent = initial || '؟';
  el.style.background = nameToColor(name || 'x');
  el.classList.remove('avatar-empty');
}

// ================= حالة اتصال الطرف الآخر =================

function setPeerState(state, fallbackText) {
  avatarPeer.classList.remove('status-pending', 'status-connected', 'status-error');
  avatarPeer.classList.add('status-' + state);
  if (state === 'connected' && peerName) {
    namePeerLabel.textContent = peerName;
  } else {
    namePeerLabel.textContent = fallbackText;
  }
}

// ================= شاشة الدخول: اختيار نشاط ثم اسم =================

function showEntryError(msg) {
  entryError.textContent = msg;
  entryError.classList.remove('hidden');
}

const MODE_LABELS = { watch: 'نتابع', games: 'نلعب' };
const MODE_CREATE_LABELS = { watch: 'إنشاء', games: 'إنشاء' };

// عام لكل خطوات الدخول (بما فيها خطوات الغرفة الدائمة اللي تُضاف لاحقًا من
// permanent.js) - نعتمد على كلاس entry-step المشترك بدل تعداد كل عنصر بالاسم،
// عشان استدعاء هذي الدالة يشتغل صح حتى لو permanent.js لسا ما حمّل عناصره
function goToStep(step) {
  document.querySelectorAll('.entry-step').forEach((el) => el.classList.add('hidden'));
  step.classList.remove('hidden');
}

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
  const name = (nameInputCreate.value || 'ضيف').trim();
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
  const name = (nameInputJoin.value || 'ضيف').trim();
  const code = (roomCodeInput.value || '').replace(/\D/g, '');
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

if (storedSession) {
  fetchRoomDoc(storedSession.code).then((data) => {
    if (isRoomDataExpired(data)) {
      clearSession();
      return; // نخليه بشاشة الدخول العادية، الرمز ميت نهائيًا
    }
    // الاسم والوضع يجون من فايربيس الحين (مو من تخزين محلي) — لو تعذر جلبهم لأي سبب
    // (غرفة قديمة جدًا مثلًا) نرجع لقيمة افتراضية بدل ما نوقف الدخول للغرفة
    const name = (data && (storedSession.role === 'host' ? data.hostName : data.guestName)) || 'ضيف';
    const mode = (data && data.mode) || 'watch';
    showRoom();
    if (storedSession.role === 'host') beginAsHost(storedSession.code, name, mode);
    else beginAsGuest(storedSession.code, name);
  });
}

// ================= تفعيل نوع الغرفة (متابعة / ألعاب) =================

function activateRoomMode(mode) {
  roomMode = mode;
  roomModeLabel.textContent = MODE_LABELS[mode] || 'onlyUs';
  watchPanel.classList.toggle('hidden', mode !== 'watch');
  gamesPanel.classList.toggle('hidden', mode !== 'games');
  browseRefBtn.classList.toggle('hidden', mode !== 'watch');
  // نجيبه بـgetElementById مباشرة (بدل الاعتماد على متغير changeVideoBtn المعرّف
  // بـwatch.js) عشان هالدالة ممكن تُنادى قبل ما watch.js يخلص تحميله (مثلًا رجوع
  // تلقائي لجلسة قديمة فور تحميل الصفحة)
  document.getElementById('change-video-btn').title = mode === 'games' ? 'الألعاب' : 'تغيير الفيديو';
  // applyPlayerSize و restorePersistedVideoIfAny معرّفتين بـwatch.js (يتحمّل بعد core.js
  // بشكل غير متزامن، عبر fetch) — ممكن نوصل هذا السطر قبل ما يخلص تحميله (خصوصًا أول
  // دخول على نت بطيء)، فنتحقق إنهم موجودين فعلًا قبل ما نناديهم عشان ما نكسر تنفيذ
  // الدالة كلها بخطأ صامت.
  if (mode === 'watch') {
    setTimeout(() => { if (typeof applyPlayerSize === 'function') applyPlayerSize(); }, 30);
    if (typeof restorePersistedVideoIfAny === 'function') restorePersistedVideoIfAny();
  }
}

// ================= المضيف =================

function beginAsHost(code, name, mode) {
  isHost = true;
  myName = name;
  currentRoomCode = code;
  nameMeLabel.textContent = myName;
  setAvatar(avatarMe, myName);
  activateRoomMode(mode || 'watch');

  peer = new Peer(peerIdFor(code), { config: RTC_CONFIG });

  peer.on('open', () => {
    unavailableIdRetries = 0;
    roomsDb.collection('rooms').doc(code).set(
      { hostName: name, mode: mode || 'watch', lastSeenAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    ).catch(() => {});
    showRoom();
    setPeerState('pending', 'بانتظار الانضمام');
  });

  peer.on('connection', (conn) => {
    if (dataConn && dataConn.open) {
      // الغرفة مشغولة بالفعل بشخصين، نرفض أي اتصال إضافي لحماية الغرفة
      conn.on('open', () => {
        conn.send({ kind: 'room-full' });
        setTimeout(() => conn.close(), 300);
      });
      return;
    }
    dataConn = conn;
    remotePeerId = conn.peer;
    setupDataConnection();
    conn.on('open', () => {
      sendData({ kind: 'hello', name: myName, mode: roomMode });
      setPeerState('pending', 'جاري تأكيد الاتصال');
    });
  });

  registerIncomingCallHandler();
  peer.on('error', handlePeerError);
  peer.on('disconnected', () => { if (peer) peer.reconnect(); });
}

// ================= الضيف: نوع الغرفة يحدده المضيف =================

function beginAsGuest(code, name) {
  isHost = false;
  myName = name;
  currentRoomCode = code;
  remotePeerId = peerIdFor(code);
  nameMeLabel.textContent = myName;
  setAvatar(avatarMe, myName);

  // ملاحظة: صار الضيف يقدر يتحكم بالفيديو زي المضيف بالضبط (تحميل/تشغيل/إيقاف/تقديم) -
  // ما فيه تقييد هنا بعد الآن، كل شي يُدار من داخل watch.js بدون فرق بين مضيف وضيف.

  // بعض الألعاب (مثل خمّن الرقم) يبدأها المضيف بس
  document.querySelectorAll('[data-host-only-game]').forEach((btn) => { btn.style.display = 'none'; });

  peer = new Peer({ config: RTC_CONFIG });

  peer.on('open', () => {
    roomsDb.collection('rooms').doc(code).set({ guestName: name }, { merge: true }).catch(() => {});
    showRoom();
    setPeerState('pending', 'جاري الاتصال بالغرفة');
    connectToHost(remotePeerId);
  });

  registerIncomingCallHandler();
  peer.on('error', handlePeerError);
  peer.on('disconnected', () => { if (peer) peer.reconnect(); });
}

let guestReconnectAttempts = 0;

function connectToHost(hostPeerId) {
  const conn = peer.connect(hostPeerId, { reliable: true });
  dataConn = conn;
  setupDataConnection();

  const connectTimeout = setTimeout(() => {
    if (dataConn && dataConn.open) return;
    // ما نستسلم من أول مرة — المضيف ممكن يكون هو نفسه لسا يعيد الاتصال بنفس رمز
    // الغرفة (بعد تحديث صفحته مثلًا)، فنعيد محاولة الاتصال بدل ما نعرض خطأ نهائي فورًا.
    guestReconnectAttempts += 1;
    if (guestReconnectAttempts <= 15) {
      setPeerState('pending', 'جاري إعادة الاتصال بالغرفة');
      connectToHost(hostPeerId);
    } else {
      setPeerState('error', 'تعذر الوصول للغرفة');
    }
  }, 4000);

  conn.on('open', () => {
    clearTimeout(connectTimeout);
    guestReconnectAttempts = 0;
    sendData({ kind: 'hello', name: myName });
    setPeerState('pending', 'جاري تأكيد الاتصال');
  });
}

function handlePeerError(err) {
  console.error(err);
  if (err.type === 'peer-unavailable') {
    setPeerState('error', 'رمز الغرفة غير صحيح');
  } else if (err.type === 'unavailable-id' && isHost && isPermanentFlow && !permanentFallbackDone) {
    // بالغرفة الدائمة، "الرمز محجوز" معناها الأغلب إن شريكك موجود فعلاً بنفس
    // النشاط هذا الحين — فنتحول تلقائيًا نتصل عليه كضيف بدل ما نعيد محاولة نصير
    // مضيف من جديد (اللي كان صحيح بس بالغرفة المؤقتة، وقت إعادة اتصال الشخص نفسه)
    permanentFallbackDone = true;
    beginAsGuest(currentRoomCode, myName);
  } else if (err.type === 'unavailable-id' && isHost) {
    // الرمز نفسه لسا مسجّل بسيرفر PeerJS من محاولة سابقة (أي تحديث للصفحة، أو رجوع من
    // صفحة مرجع، أو زر "مشاهدة مباشرة" كلها تمرّ من هنا). السيرفر يفرّغه خلال ثوانٍ
    // عادة لكن ممكن يتأخر أكثر. **مهم:** ما نتخلى عن رمز الغرفة أبدًا هنا ولا ننشئ رمز
    // جديد — هذا بالضبط كان سبب "يدخلني غرفة ثانية" (نتخلى بصمت ونسوي غرفة جديدة
    // ويضيع الطرف الثاني). نفضل نستمر نحاول بنفس الرمز مهما طال الوقت: أول ٢٠ محاولة
    // كل ٩٠٠ مل ثانية (تغطي التحديث العادي خلال ثوانٍ قليلة)، وبعدها نستمر كل ٣ ثواني
    // بدون حد أقصى.
    unavailableIdRetries += 1;
    setPeerState('pending', 'جاري إعادة الاتصال بنفس الغرفة');
    const delay = unavailableIdRetries <= 20 ? 900 : 3000;
    setTimeout(() => beginAsHost(currentRoomCode, myName, roomMode), delay);
  } else {
    setPeerState('error', 'خطأ بالاتصال');
  }
}

function showRoom() {
  entryScreen.classList.add('hidden');
  roomScreen.classList.remove('hidden');
  if (currentRoomCode) startRoomHeartbeat(currentRoomCode);
  if (currentRoomCode) setupFirestoreChatSync(currentRoomCode);
  // نفس السبب أعلاه: watch.js ممكن يكون لسا ما تحمّل، نتحقق قبل النداء
  if (roomMode === 'watch') setTimeout(() => { if (typeof applyPlayerSize === 'function') applyPlayerSize(); }, 30);
}

// إعادة اتصال تلقائية عند الرجوع للتبويب + تصفير إشعارات الرسائل غير المقروءة
const originalTitle = document.title;
let unreadCount = 0;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    unreadCount = 0;
    document.title = originalTitle;
  }
  if (document.visibilityState !== 'visible' || !peer) return;
  if (peer.disconnected) peer.reconnect();
  if (!isHost && remotePeerId && (!dataConn || !dataConn.open)) {
    setPeerState('pending', 'إعادة الاتصال');
    connectToHost(remotePeerId);
  }
});

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function notifyNewMessage(name, text) {
  if (document.visibilityState === 'visible') return;
  unreadCount++;
  document.title = `(${unreadCount}) رسالة جديدة`;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(name, { body: text });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* بعض المتصفحات ترفض إشعارات من صفحة غير مثبتة، نتجاهل بهدوء */ }
  }
}

// ================= نسخ الرمز =================

function copyRoomCode(btnEl) {
  if (!currentRoomCode) return;
  navigator.clipboard.writeText(currentRoomCode).then(() => {
    btnEl.classList.add('copied');
    setTimeout(() => btnEl.classList.remove('copied'), 1200);
  });
}
copyCodeBtn.addEventListener('click', () => copyRoomCode(copyCodeBtn));

// ================= تأكيد عام (بديل confirm() الافتراضي بالمتصفح) =================
const confirmModal = document.getElementById('confirm-modal');
const confirmModalText = document.getElementById('confirm-modal-text');
const confirmModalOk = document.getElementById('confirm-modal-ok');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');

function showConfirm(message) {
  return new Promise((resolve) => {
    confirmModalText.textContent = message;
    confirmModal.classList.remove('hidden');
    function cleanup(result) {
      confirmModal.classList.add('hidden');
      confirmModalOk.removeEventListener('click', onOk);
      confirmModalCancel.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    confirmModalOk.addEventListener('click', onOk);
    confirmModalCancel.addEventListener('click', onCancel);
  });
}

// ================= الخروج من الغرفة =================

leaveRoomBtn.addEventListener('click', async () => {
  const ok = await showConfirm('الخروج');
  if (!ok) return;
  sendData({ kind: 'peer-left' });
  stopRoomHeartbeat();
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (unsubRoomDoc) { unsubRoomDoc(); unsubRoomDoc = null; }
  if (currentRoomCode) {
    roomsDb.collection('rooms').doc(currentRoomCode).set({ currentVideo: null }, { merge: true }).catch(() => {});
  }
  clearSession();
  setTimeout(() => window.location.reload(), 80);
});

// ================= قناة البيانات (المُوزِّع المركزي للرسائل) =================

function setupDataConnection() {
  dataConn.on('data', (msg) => {
    switch (msg.kind) {
      case 'hello':
        peerName = msg.name;
        setAvatar(avatarPeer, peerName);
        setPeerState('connected', peerName);
        if (!isHost && msg.mode) activateRoomMode(msg.mode);
        break;
      case 'room-full':
        setPeerState('error', 'الغرفة ممتلئة بالفعل');
        break;
      // ملاحظة: الشات ومؤشر "يكتب الآن" (مرحلة ١)، تزامن الفيديو بالكامل (مرحلة ٢)،
      // حركات الألعاب الست (مرحلة ٣)، وحالة المايك النصية (تشغيل/إيقاف، مو الصوت نفسه)
      // كلها انتقلت لـFirestore (شوف setupFirestoreChatSync أسفل) - ما عادت تمر من
      // هنا إطلاقًا. peer.call() الخاص ببث صوت المايك نفسه هو الوحيد الباقي على
      // PeerJS/WebRTC (ما فيه بديل تقني له).

      case 'peer-left':
        setPeerState('pending', 'غادر الغرفة');
        addSystemMessage(`${peerName || 'الطرف الآخر'} غادر الغرفة`);
        closeCall();
        break;
    }
  });
  dataConn.on('close', () => {
    setPeerState('error', 'انقطع الاتصال');
    closeCall();
    if (!isHost && remotePeerId) {
      setTimeout(() => {
        if (!(dataConn && dataConn.open)) {
          setPeerState('pending', 'إعادة الاتصال');
          connectToHost(remotePeerId);
        }
      }, 2000);
    }
  });
}

function sendData(payload) {
  if (dataConn && dataConn.open) dataConn.send(payload);
}

// ملاحظة: ما نرسل "peer-left" هنا. هذا الحدث يشتغل على أي خروج من الصفحة، حتى لو كان
// بس تنقّل داخلي (مثلًا فتح فئة مرجع بالسهم) — إرسال "غادر الغرفة" بهذي الحالة كان يخلي
// الطرف الثاني يظن الغرفة انتهت فعليًا كل ما ترجع/تروح، رغم إن الجلسة نفسها باقية
// بـsessionStorage وبترجع تتصل من نفس الرمز. الخروج الفعلي المقصود إله زر "إنهاء الغرفة"
// اللي يرسل الإشارة صراحة (شوف leaveRoomBtn تحت). الانقطاع الحقيقي (تبويب مقفول فعلًا)
// ينكشف تلقائيًا عن طريق dataConn.on('close') عند الطرف الثاني، وعنده منطق إعادة اتصال أصلًا.

// ================= الشات =================

function addMessage(name, text, mine) {
  chatEmpty.classList.add('hidden');
  const grouped = lastMessageSender === name;
  lastMessageSender = name;

  const row = document.createElement('div');
  row.className = 'msg-row' + (mine ? ' me' : '') + (grouped ? ' grouped' : '');

  const avatar = document.createElement('span');
  avatar.className = 'msg-avatar';
  avatar.textContent = (name || '؟').charAt(0).toUpperCase();
  avatar.style.background = nameToColor(name || 'x');

  const body = document.createElement('div');
  body.className = 'msg-body';

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const sender = document.createElement('span');
  sender.className = 'msg-sender';
  sender.textContent = name;
  const time = document.createElement('span');
  time.className = 'msg-time';
  time.textContent = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  meta.appendChild(sender);
  meta.appendChild(time);

  // زر نسخ حقيقي لكل رسالة — التحديد بالمتصفح ("تحديد الكل") ما ينحصر برسالة وحدة على
  // الجوال ويسحب معه باقي عناصر الصفحة، فنعتمد على Clipboard API مباشرة بدل التحديد اليدوي.
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'msg-copy-btn';
  copyBtn.title = 'نسخ الرسالة';
  copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.6"/></svg>';
  copyBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      copyBtn.classList.add('copied');
      setTimeout(() => copyBtn.classList.remove('copied'), 1200);
    } catch (e) { /* تجاهل فشل النسخ */ }
  });
  meta.appendChild(copyBtn);

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  body.appendChild(meta);
  body.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(body);
  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
  lastMessageSender = null;
  chatEmpty.classList.add('hidden');
  const div = document.createElement('div');
  div.className = 'msg-system';
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ---------- تزامن الشات عبر Firestore (المرحلة ١ من خطة نقل التزامن) ----------
// كل رسالة مستند مستقل بـrooms/{code}/messages، استماع لحظي onSnapshot بدل sendData/dataConn.
// نفس سلوك التحديث المتفائل السابق: الرسالة تظهر عندي فورًا (addMessage) قبل ما ننتظر
// تأكيد الكتابة، والكتابة نفسها تصير Firestore بدل قناة بيانات P2P.
function setupFirestoreChatSync(code) {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (unsubRoomDoc) { unsubRoomDoc(); unsubRoomDoc = null; }

  // نستمع بس للرسائل اللي توصل بعد لحظة الدخول - ما نعيد بث كل سجل الشات القديم
  // (يطابق سلوك قناة البيانات السابقة اللي ما كانت تحتفظ بأي تاريخ أصلًا)
  const joinedAt = firebase.firestore.Timestamp.now();
  unsubMessages = roomsDb.collection('rooms').doc(code).collection('messages')
    .where('sentAt', '>', joinedAt)
    .orderBy('sentAt')
    .onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const msg = change.doc.data();
        if (msg.senderId === myDeviceId) return; // رسالتنا احنا، سبق وعرضناها محليًا فورًا
        addMessage(msg.sender, msg.text, false);
        hideTyping();
        notifyNewMessage(msg.sender, msg.text);
      });
    });

  // استماع لحقل "يكتب الآن" (مرحلة ١) وحقل الفيديو الحي currentVideo (مرحلة ٢) على
  // مستند الغرفة نفسه. نتجاهل أول قراءة (snapshot) عمدًا: هذي هي الحالة القديمة
  // المخزّنة من قبل ما ندخل، وrestorePersistedVideoIfAny (قراءة وحدة بwatch.js) هي
  // المسؤولة عن تحميلها أول ما ندخل - لو عالجناها هنا كمان بنكرر نفس التحميل أو
  // نطبّق حركة تشغيل/إيقاف قديمة على مشغل لسا فاضي.
  let sawFirstRoomSnapshot = false;
  unsubRoomDoc = roomsDb.collection('rooms').doc(code).onSnapshot((snap) => {
    const data = snap.data();
    if (!data) return;
    if (!sawFirstRoomSnapshot) { sawFirstRoomSnapshot = true; return; }
    if (data.typing && data.typing.senderId && data.typing.senderId !== myDeviceId) {
      showTyping(data.typing.name);
    } else if (!data.typing) {
      hideTyping();
    }
    if (data.currentVideo && typeof handleRemoteVideoUpdate === 'function') {
      handleRemoteVideoUpdate(data.currentVideo);
    }
    if (data.game && typeof handleRemoteGameState === 'function') {
      handleRemoteGameState(data.game);
    }
    if (data.mic) {
      const peerOn = isHost ? data.mic.guestOn : data.mic.hostOn;
      peerMicIndicator.classList.toggle('peer-mic-on', !!peerOn);
      peerMicIndicator.querySelector('.icon-mic-on').classList.toggle('hidden', !peerOn);
      peerMicIndicator.querySelector('.icon-mic-off').classList.toggle('hidden', !!peerOn);
    }
  });
}

// حالة المايك النصية (تشغيل/إيقاف - النص لا الصوت نفسه) - حقل rooms/{code}.mic بشكلين
// منفصلين (hostOn/guestOn) بدل senderId: كل طرف يقرأ حقل الطرف الثاني بس، فما يحتاج
// نتجاهل كتاباتنا احنا (نقرأ أصلًا حقل ثاني غير اللي نكتبه).
function broadcastMicState(on) {
  if (!currentRoomCode) return;
  const patch = isHost ? { hostOn: on } : { guestOn: on };
  roomsDb.collection('rooms').doc(currentRoomCode).set({ mic: patch }, { merge: true }).catch(() => {});
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage(myName, text, true);
  chatInput.value = '';
  clearTypingState();
  clearTimeout(typingStopTimer);
  if (!currentRoomCode) return;
  roomsDb.collection('rooms').doc(currentRoomCode).collection('messages').add({
    text,
    sender: myName,
    senderId: myDeviceId,
    sentAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(() => {});
}
// الإدخال صار داخل <form> (شوف chat-form بـindex.html) عشان يقلل من ظهور شريط اقتراحات
// المتصفح (عناوين/بطاقات/مفاتيح مرور) فوق الكيبورد؛ الإرسال بالضغط على الزر أو Enter
// يصير submit عادي للفورم، فنمنع سلوكه الافتراضي (تحديث الصفحة) ونستدعي sendChat يدويًا.
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendChat();
});

let lastTypingSentAt = 0;
let typingStopTimer = null;
let peerTypingHideTimer = null;

function setTypingState() {
  if (!currentRoomCode) return;
  roomsDb.collection('rooms').doc(currentRoomCode).set(
    { typing: { senderId: myDeviceId, name: myName } },
    { merge: true }
  ).catch(() => {});
}
function clearTypingState() {
  if (!currentRoomCode) return;
  roomsDb.collection('rooms').doc(currentRoomCode).set(
    { typing: firebase.firestore.FieldValue.delete() },
    { merge: true }
  ).catch(() => {});
}

chatInput.addEventListener('input', () => {
  const now = Date.now();
  if (now - lastTypingSentAt > 1500) {
    lastTypingSentAt = now;
    setTypingState();
  }
  clearTimeout(typingStopTimer);
  typingStopTimer = setTimeout(clearTypingState, 2000);
});

function showTyping(name) {
  typingText.textContent = `${name} يكتب الآن`;
  typingIndicator.classList.remove('hidden');
  clearTimeout(peerTypingHideTimer);
  peerTypingHideTimer = setTimeout(hideTyping, 3000);
}
function hideTyping() {
  typingIndicator.classList.add('hidden');
}

// ================= المايك (صوت مباشر بين الاثنين عبر PeerJS) =================

let localStream = null;
let micOn = false;
let outgoingCall = null;
let incomingCall = null;

async function onMicButtonClick() {
  if (!micOn) await startMic();
  else stopMic();
}
micBtn.addEventListener('click', onMicButtonClick);

// حجم صوت المكالمة (المايك) منفصل تمامًا عن حجم صوت الفيديو — كل وحد له سلايدر لحاله
if (callVolumeSlider) {
  callVolumeSlider.addEventListener('input', () => {
    remoteAudio.volume = Number(callVolumeSlider.value) / 100;
  });
}

// منسدلة التحكم بصوت الطرف الآخر: مخفية افتراضيًا، زر مايكه يفتحها/يقفلها، وأي ضغطة
// برّاها تقفلها
const callVolumeGroup = document.getElementById('call-volume-group');
if (peerMicIndicator && callVolumeGroup) {
  peerMicIndicator.addEventListener('click', (e) => {
    e.stopPropagation();
    callVolumeGroup.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (callVolumeGroup.classList.contains('hidden')) return;
    if (callVolumeGroup.contains(e.target) || e.target === peerMicIndicator) return;
    callVolumeGroup.classList.add('hidden');
  });
}

// نعيد أي مكالمة قائمة من الصفر (بدل محاولة تعديلها) في هالحالات:
// - أول ما نفتح المايك (نبي نرسل صوتنا الآن).
// - أول ما نقفله (نبي نوقف إرسال صوتنا، لكن نفضل نسمع الطرف الثاني لو مايكه شغال).
// إعادة الاتصال من الصفر أبسط وأوثق من محاولة إضافة/حذف مسار صوت من اتصال قائم.
function reconnectCallWithCurrentStream() {
  if (outgoingCall) { outgoingCall.close(); outgoingCall = null; }
  if (incomingCall) { incomingCall.close(); incomingCall = null; }
  if (!remotePeerId || !peer) return;
  // localStream ممكن يكون null هنا (يعني نتصل باستقبال بس بدون ما نرسل صوتنا)
  outgoingCall = peer.call(remotePeerId, localStream || undefined);
  outgoingCall.on('stream', attachRemoteStream);
}

async function startMic() {
  try {
    // ملاحظة: فعّلنا إلغاء الصدى/الضوضاء (echoCancellation/noiseSuppression) عشان نحل
    // مشكلة الصدى المزعجة. الأثر الجانبي المعروف بمتصفحات أندرويد: تفعيلها يخلي نظام
    // الصوت بالجهاز يتحول لوضع "مكالمة" وقد يخفت صوت الفيديو تلقائيًا لحظة تشغيل المايك -
    // هذا سلوك من نظام التشغيل نفسه مو من الكود، وأفضل حل عملي له فعليًا استخدام سماعة
    // رأس/أذن بدل سماعة الجهاز (يمنع رجوع صوت الفيديو للمايك من الأساس ويلغي الصدى تمامًا).
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err) {
    const original = micBtn.title;
    micBtn.title = 'تعذر الوصول للمايك';
    micBtn.classList.add('mic-error');
    setTimeout(() => { micBtn.title = original; micBtn.classList.remove('mic-error'); }, 2000);
    return;
  }
  micOn = true;
  micBtn.classList.add('mic-active');
  micBtn.title = 'إيقاف المايك';
  micBtn.querySelector('.icon-mic-on').classList.add('hidden');
  micBtn.querySelector('.icon-mic-off').classList.remove('hidden');
  broadcastMicState(true);
  reconnectCallWithCurrentStream();
}

function stopMic() {
  micOn = false;
  micBtn.classList.remove('mic-active');
  micBtn.title = 'تشغيل المايك';
  micBtn.querySelector('.icon-mic-on').classList.remove('hidden');
  micBtn.querySelector('.icon-mic-off').classList.add('hidden');
  broadcastMicState(false);
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  // نعيد الاتصال باستقبال بس (بدون بث صوتنا) عشان نظل نسمع الطرف الثاني لو مايكه شغال
  reconnectCallWithCurrentStream();
}

function attachRemoteStream(stream) {
  remoteAudio.srcObject = stream;
  remoteAudio.volume = remoteVolumeSlider ? Number(remoteVolumeSlider.value) / 100 : 1;
}

function registerIncomingCallHandler() {
  peer.on('call', (call) => {
    if (incomingCall) incomingCall.close();
    incomingCall = call;
    // نجاوب فورًا دايمًا (حتى لو مايكنا مقفل) عشان نسمع الطرف الثاني بمجرد ما يفتح مايكه،
    // بدون ما يكون شرط إن مايكنا احنا يكون شغال. لو مايكنا مقفل نجاوب باستقبال بس (بدون
    // نبعث صوتنا) بتمرير undefined بدل الستريم.
    call.answer(localStream || undefined);
    call.on('stream', attachRemoteStream);
  });
}

function closeCall() {
  if (outgoingCall) { outgoingCall.close(); outgoingCall = null; }
  if (incomingCall) { incomingCall.close(); incomingCall = null; }
  remoteAudio.srcObject = null;
}
