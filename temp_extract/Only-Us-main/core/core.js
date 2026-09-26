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

// ---------- عناصر الصفحة (مشتركة) ----------
const entryScreen = document.getElementById('entry-screen');
const roomScreen = document.getElementById('room-screen');

const entryStepMode = document.getElementById('entry-step-mode');
const entryStepCreate = document.getElementById('entry-step-create');
const entryStepJoin = document.getElementById('entry-step-join');
const modeCards = document.querySelectorAll('.mode-card');
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

const chatMessages = document.getElementById('chat-messages');
const chatEmpty = document.getElementById('chat-empty');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
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

function randomCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000)); // 8 أرقام
}
function peerIdFor(code) { return 'wt-' + code; }

// ================= استمرارية الجلسة =================

function readSession() {
  try { return JSON.parse(sessionStorage.getItem('wt_session')); } catch (e) { return null; }
}
function writeSession(role, code, name, mode) {
  sessionStorage.setItem('wt_session', JSON.stringify({ role, code, name, mode }));
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
const MODE_CREATE_LABELS = { watch: 'إنشاء غرفة نتابع', games: 'إنشاء غرفة نلعب' };

function goToStep(step) {
  entryStepMode.classList.add('hidden');
  entryStepCreate.classList.add('hidden');
  entryStepJoin.classList.add('hidden');
  step.classList.remove('hidden');
}

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
  writeSession('host', code, name, pendingMode);
  confirmCreateBtn.disabled = true;
  confirmCreateText.textContent = 'جاري الاتصال';
  createSpinner.classList.remove('hidden');
  requestNotificationPermission();
  beginAsHost(code, name, pendingMode);
});

joinRoomBtn.addEventListener('click', () => {
  const name = (nameInputJoin.value || 'ضيف').trim();
  const code = (roomCodeInput.value || '').replace(/\D/g, '');
  if (code.length < 6) {
    showEntryError('اكتب رمز الغرفة كامل');
    return;
  }
  writeSession('guest', code, name, null);
  joinRoomBtn.disabled = true;
  document.getElementById('join-room-text').textContent = 'جاري الاتصال';
  joinSpinner.classList.remove('hidden');
  requestNotificationPermission();
  beginAsGuest(code, name);
});

if (storedSession) {
  showRoom();
  if (storedSession.role === 'host') beginAsHost(storedSession.code, storedSession.name, storedSession.mode || 'watch');
  else beginAsGuest(storedSession.code, storedSession.name);
}

// ================= تفعيل نوع الغرفة (متابعة / ألعاب) =================

function activateRoomMode(mode) {
  roomMode = mode;
  roomModeLabel.textContent = MODE_LABELS[mode] || 'onlyUs';
  watchPanel.classList.toggle('hidden', mode !== 'watch');
  gamesPanel.classList.toggle('hidden', mode !== 'games');
  browseRefBtn.classList.toggle('hidden', mode !== 'watch');
  // applyPlayerSize معرّفة في watch.js (يتحمّل بعد core.js)، فنستدعيها بدالة عشان تنقرأ وقت التنفيذ مو وقت التحميل
  if (mode === 'watch') setTimeout(() => applyPlayerSize(), 30);
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

  // الضيف بوضع المتابعة لا يتحكم بالفيديو إطلاقًا (تُطبَّق فعليًا داخل watch.js عبر isHost)
  const videoInputBar = document.getElementById('video-input-bar');
  const changeVideoBtn = document.getElementById('change-video-btn');
  if (videoInputBar) videoInputBar.classList.add('hidden');
  if (changeVideoBtn) changeVideoBtn.classList.add('hidden');

  // بعض الألعاب (مثل خمّن الرقم) يبدأها المضيف بس
  document.querySelectorAll('[data-host-only-game]').forEach((btn) => { btn.style.display = 'none'; });

  peer = new Peer({ config: RTC_CONFIG });

  peer.on('open', () => {
    showRoom();
    setPeerState('pending', 'جاري الاتصال بالغرفة');
    connectToHost(remotePeerId);
  });

  registerIncomingCallHandler();
  peer.on('error', handlePeerError);
  peer.on('disconnected', () => { if (peer) peer.reconnect(); });
}

function connectToHost(hostPeerId) {
  const conn = peer.connect(hostPeerId, { reliable: true });
  dataConn = conn;
  setupDataConnection();

  const connectTimeout = setTimeout(() => {
    if (!(dataConn && dataConn.open)) setPeerState('error', 'تعذر الوصول للغرفة');
  }, 12000);

  conn.on('open', () => {
    clearTimeout(connectTimeout);
    sendData({ kind: 'hello', name: myName });
    setPeerState('pending', 'جاري تأكيد الاتصال');
  });
}

function handlePeerError(err) {
  console.error(err);
  if (err.type === 'peer-unavailable') {
    setPeerState('error', 'رمز الغرفة غير صحيح');
  } else if (err.type === 'unavailable-id' && isHost) {
    // الرمز نفسه لسا مسجّل بسيرفر PeerJS من محاولة سابقة (غالبًا رجعنا من تنقّل داخلي
    // زي فتح فئة مرجع بالسهم) — السيرفر يفرّغه خلال ثوانٍ قليلة، فنعيد المحاولة بنفس
    // الرمز أول قبل ما نتخلى عنه ونسوي غرفة جديدة (اللي كانت تقفل الغرفة على الطرف الثاني).
    unavailableIdRetries += 1;
    if (unavailableIdRetries <= 5) {
      setTimeout(() => beginAsHost(currentRoomCode, myName, roomMode), 700);
      return;
    }
    unavailableIdRetries = 0;
    const newCode = randomCode();
    writeSession('host', newCode, myName, roomMode);
    beginAsHost(newCode, myName, roomMode);
  } else {
    setPeerState('error', 'خطأ بالاتصال');
  }
}

function showRoom() {
  entryScreen.classList.add('hidden');
  roomScreen.classList.remove('hidden');
  if (roomMode === 'watch') setTimeout(() => applyPlayerSize(), 30); // نفس السبب: watch.js يتحمّل بعد core.js
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

// ================= الخروج من الغرفة =================

leaveRoomBtn.addEventListener('click', () => {
  if (!confirm('تبي تنهي الغرفة؟ بتنتهي عند الطرف الثاني برضو.')) return;
  sendData({ kind: 'peer-left' });
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
        if (isHost && typeof currentVideoState !== 'undefined' && currentVideoState) {
          dataConn.send({ kind: 'load-video', ...currentVideoState });
        }
        break;
      case 'room-full':
        setPeerState('error', 'الغرفة ممتلئة بالفعل');
        break;
      case 'mic-state':
        peerMicIndicator.classList.toggle('peer-mic-on', !!msg.on);
        peerMicIndicator.querySelector('.icon-mic-on').classList.toggle('hidden', !msg.on);
        peerMicIndicator.querySelector('.icon-mic-off').classList.toggle('hidden', !!msg.on);
        break;
      case 'chat':
        addMessage(msg.name, msg.text, false);
        hideTyping();
        notifyNewMessage(msg.name, msg.text);
        break;
      case 'typing':
        showTyping(msg.name);
        break;
      case 'typing-stop':
        hideTyping();
        break;

      // ---- رسائل وضع "نتابع" (المعالجة الفعلية بملف watch.js) ----
      case 'load-video':
        handleIncomingLoadVideo(msg);
        break;
      case 'request-video':
        handleIncomingRequestVideo(msg);
        break;
      case 'play':
        applyRemote('play', msg.time);
        break;
      case 'pause':
        applyRemote('pause', msg.time);
        break;
      case 'seek':
        applyRemote('seek', msg.time);
        break;
      case 'sync-tick':
        applySyncTick(msg.time, msg.paused);
        break;
      case 'buffering-start':
        handleBufferingStart();
        break;
      case 'buffering-end':
        handleBufferingEnd();
        break;

      // ---- رسائل وضع "نلعب" (المعالجة الفعلية بملف games.js) ----
      case 'game-start':
        startGame(msg.game, false, msg.layout, msg.first);
        break;
      case 'game-move':
        handleRemoteGameMove(msg);
        break;
      case 'game-restart':
        handleRemoteGameRestart(msg);
        break;
      case 'game-exit':
        exitToPicker(false);
        break;

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

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  sendData({ kind: 'chat', text, name: myName });
  addMessage(myName, text, true);
  chatInput.value = '';
  sendData({ kind: 'typing-stop' });
  clearTimeout(typingStopTimer);
}
sendChatBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

let lastTypingSentAt = 0;
let typingStopTimer = null;
let peerTypingHideTimer = null;

chatInput.addEventListener('input', () => {
  const now = Date.now();
  if (now - lastTypingSentAt > 1500) {
    lastTypingSentAt = now;
    sendData({ kind: 'typing', name: myName });
  }
  clearTimeout(typingStopTimer);
  typingStopTimer = setTimeout(() => sendData({ kind: 'typing-stop' }), 2000);
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
let incomingCallAnswered = false;

async function onMicButtonClick() {
  if (!micOn) await startMic();
  else stopMic();
}
micBtn.addEventListener('click', onMicButtonClick);

async function startMic() {
  try {
    // ملاحظة مهمة: طلب المايك بخصائص إلغاء الصدى الافتراضية (echoCancellation) يخلي
    // متصفحات أندرويد تحوّل وضع الصوت بالجهاز لوضع "مكالمة" (Communication Mode)،
    // وهذا يوقف/يخفت صوت أي فيديو أو صوت ثاني شغال بالصفحة تلقائيًا مهما رفعت
    // مستوى الصوت من المشغل. تعطيل الخصائص التالية يخلي الصوتين (المايك + الفيديو)
    // يشتغلون سوا بدون ما يأثر أحدهم على الثاني.
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
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
  sendData({ kind: 'mic-state', on: true });

  if (incomingCall && !incomingCallAnswered) {
    incomingCallAnswered = true;
    incomingCall.answer(localStream);
    incomingCall.on('stream', attachRemoteStream);
  } else if (remotePeerId && !outgoingCall) {
    outgoingCall = peer.call(remotePeerId, localStream);
    outgoingCall.on('stream', attachRemoteStream);
  }
}

function stopMic() {
  micOn = false;
  micBtn.classList.remove('mic-active');
  micBtn.title = 'تشغيل المايك';
  micBtn.querySelector('.icon-mic-on').classList.remove('hidden');
  micBtn.querySelector('.icon-mic-off').classList.add('hidden');
  sendData({ kind: 'mic-state', on: false });
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  closeCall();
}

function attachRemoteStream(stream) {
  remoteAudio.srcObject = stream; // مستوى الصوت يتحكم فيه المستخدم من أزرار جهازه مباشرة
}

function registerIncomingCallHandler() {
  peer.on('call', (call) => {
    incomingCall = call;
    incomingCallAnswered = false;
    if (micOn && localStream) {
      incomingCallAnswered = true;
      call.answer(localStream);
      call.on('stream', attachRemoteStream);
    }
  });
}

function closeCall() {
  if (outgoingCall) { outgoingCall.close(); outgoingCall = null; }
  if (incomingCall) { incomingCall.close(); incomingCall = null; }
  incomingCallAnswered = false;
  remoteAudio.srcObject = null;
}
