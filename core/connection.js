// ============================================================
// connection.js
// المسؤول عن: الاتصال (PeerJS + Firestore)، استمرارية الجلسة، منطق
// المضيف/الضيف، قناة البيانات المركزية (dataConn)، حالة اتصال الطرف
// الآخر، وتفعيل نوع الغرفة (نتابع/نلعب). watch.js و games/*.js و
// permanent.js و reference.js يعتمدون على الدوال والمتغيرات هنا
// (sendData, isHost, myName, peerName, currentRoomCode, roomsDb...)
// وهي متاحة لهم تلقائيًا لأنها بنفس النطاق العام.
// لازم يتحمّل بعد core.js (يستخدم عناصره: entryScreen, roomScreen,
// switchCategoryBtn...) وقبل chat.js/mic.js لأن showRoom تستدعي
// setupFirestoreChatSync المعرّفة بـchat.js - لكن هذا ما يهم عمليًا
// لأن الاستدعاء الفعلي يصير لاحقًا بعد ما كل الملفات تخلص تحميلها.
// ============================================================

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

// ---------- عناصر الصفحة (خاصة بشاشة الغرفة والاتصال) ----------
const roomModeLabel = document.getElementById('room-mode-label');
const watchPanel = document.getElementById('watch-panel');
const gamesPanel = document.getElementById('games-panel');
const mainLayoutEl = document.getElementById('main-layout'); // يُستخدم بـwatch.js بس (fullscreen/حجم المشغّل)

const browseRefBtn = document.getElementById('browse-ref-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');

const avatarMe = document.getElementById('avatar-me');
const nameMeLabel = document.getElementById('name-me-label');
const avatarPeer = document.getElementById('avatar-peer');
const namePeerLabel = document.getElementById('name-peer-label');

// ---------- إعدادات الاتصال (STUN + TURN مجاني) ----------
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

// ---------- حالة عامة (يقرأها watch.js و games-core.js و permanent.js و reference.js) ----------
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

// تُستخدم من permanent.js (نفس النطاق العام) لتعليم إن الغرفة الحالية دخلناها عبر
// الغرفة الدائمة - handlePeerError تحت يحتاجها فيحتفظ بيها هنا عشان تكون معرّفة
// دايمًا حتى لو permanent.js لسا ما وصل تحميله (يتحمّل غير متزامن)
let isPermanentFlow = false;
let permanentFallbackDone = false;

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

// إعادة اتصال تلقائية عند الرجوع للتبويب (تصفير إشعارات الرسائل غير المقروءة منطقه
// بـchat.js بمستمع visibilitychange منفصل، عشان كل ملف يبقى مسؤول عن همّه بس)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !peer) return;
  if (peer.disconnected) peer.reconnect();
  if (!isHost && remotePeerId && (!dataConn || !dataConn.open)) {
    setPeerState('pending', 'إعادة الاتصال');
    connectToHost(remotePeerId);
  }
});

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
      // كلها انتقلت لـFirestore (شوف setupFirestoreChatSync بـchat.js) - ما عادت تمر من
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
// اللي يرسل الإشارة صراحة (شوف leaveRoomBtn أعلاه). الانقطاع الحقيقي (تبويب مقفول فعلًا)
// ينكشف تلقائيًا عن طريق dataConn.on('close') عند الطرف الثاني، وعنده منطق إعادة اتصال أصلًا.
