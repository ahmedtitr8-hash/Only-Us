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

// ---------- عناصر الصفحة ----------
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
const worldPanel = document.getElementById('world-panel');
const worldContainer = document.getElementById('world-container');

const copyCodeBtn = document.getElementById('copy-code-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const worldChatBtn = document.getElementById('world-chat-btn');
const worldMicBtn = document.getElementById('world-mic-btn');
const worldChatBackdrop = document.getElementById('world-chat-backdrop');

const avatarMe = document.getElementById('avatar-me');
const nameMeLabel = document.getElementById('name-me-label');
const avatarPeer = document.getElementById('avatar-peer');
const namePeerLabel = document.getElementById('name-peer-label');
const peerMicIndicator = document.getElementById('peer-mic-indicator');

const micBtn = document.getElementById('mic-btn');

const videoUrlInput = document.getElementById('video-url');
const loadVideoBtn = document.getElementById('load-video-btn');
const videoInputBar = document.getElementById('video-input-bar');
const changeVideoBtn = document.getElementById('change-video-btn');
const placeholder = document.getElementById('placeholder');
const youtubeContainer = document.getElementById('youtube-player');
const nativePlayer = document.getElementById('native-player');
const playerContainer = document.getElementById('player-container');
const customControls = document.getElementById('custom-controls');
const playPauseBtn = document.getElementById('play-pause-btn');
const muteBtn = document.getElementById('mute-btn');
const videoVolumeSlider = document.getElementById('video-volume');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const progressTrack = document.getElementById('progress-track');
const progressFill = document.getElementById('progress-fill');
const progressHandle = document.getElementById('progress-handle');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');
const waitingOverlay = document.getElementById('waiting-overlay');
const waitingCode = document.getElementById('waiting-code');
const waitingCopyBtn = document.getElementById('waiting-copy-btn');
const bufferingOverlay = document.getElementById('buffering-overlay');
const playerError = document.getElementById('player-error');

// عناصر الألعاب
const gamePicker = document.getElementById('game-picker');
const gameChoiceBtns = document.querySelectorAll('.game-choice');
const gameBoardWrap = document.getElementById('game-board-wrap');
const gameBackBtn = document.getElementById('game-back-btn');
const xoBoardEl = document.getElementById('xo-board');
const xoGrid = document.getElementById('xo-grid');
const xoCells = document.querySelectorAll('.xo-cell');
const xoStatus = document.getElementById('xo-status');
const xoRestartBtn = document.getElementById('xo-restart-btn');
const rpsBoardEl = document.getElementById('rps-board');
const rpsScoreEl = document.getElementById('rps-score');
const rpsChoiceBtns = document.querySelectorAll('.rps-choice');
const rpsWaiting = document.getElementById('rps-waiting');
const rpsResult = document.getElementById('rps-result');
const rpsReveal = document.getElementById('rps-reveal');
const rpsResultText = document.getElementById('rps-result-text');
const rpsNextBtn = document.getElementById('rps-next-btn');

const chatSectionEl = document.getElementById('chat-section');
const chatMessages = document.getElementById('chat-messages');
const chatEmpty = document.getElementById('chat-empty');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');

const remoteAudio = document.getElementById('remote-audio');
const mainLayoutEl = document.getElementById('main-layout');
const videoSectionEl = document.querySelector('.video-section');

// ---------- حجم المشغل الفعلي: يتبع شكل الفيديو الحقيقي، بدون مساحة سوداء زايدة ----------
let currentAspectRatio = 16 / 9;

function applyPlayerSize() {
  if (!videoSectionEl) return;
  const rect = videoSectionEl.getBoundingClientRect();
  if (rect.width < 10) return;
  const isFs = !!document.fullscreenElement;
  const maxW = rect.width;
  // بملء الشاشة نسمح للفيديو ياخذ نسبة أكبر من ارتفاع الشاشة الفعلي، لا نعتمد على ارتفاع
  // حاوية القسم نفسها لأنها تتمدد لتملأ المساحة وتسبب فراغ فاضي حول الفيديو
  const maxH = isFs ? window.innerHeight * 0.56 : Math.min(rect.height, window.innerHeight * 0.42);
  let w = maxW;
  let h = w / currentAspectRatio;
  if (h > maxH) {
    h = maxH;
    w = h * currentAspectRatio;
  }
  playerContainer.style.width = Math.max(0, Math.floor(w)) + 'px';
  playerContainer.style.height = Math.max(0, Math.floor(h)) + 'px';
}

function setAspectRatio(ratio) {
  currentAspectRatio = ratio && isFinite(ratio) && ratio > 0 ? ratio : 16 / 9;
  applyPlayerSize();
}

window.addEventListener('resize', applyPlayerSize);
document.addEventListener('fullscreenchange', () => setTimeout(applyPlayerSize, 50));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', applyPlayerSize);
}

// ---------- إعدادات الاتصال (STUN + TURN مجاني) ----------
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

const HARD_DRIFT_THRESHOLD = 1.2; // فرق كبير: نقفز فورًا لتصحيحه
const SOFT_DRIFT_THRESHOLD = 0.25; // فرق بسيط: نصححه بتسريع/إبطاء خفيف بدل القفزة المزعجة
const SYNC_TICK_MS = 2000;
const BUFFER_DEBOUNCE_MS = 700; // نتجاهل التهنيج القصير جدًا اللي يصلح نفسه بسرعة
const BUFFER_WATCHDOG_MS = 9000; // أقصى مدة ننتظر فيها الطرف المتعثر قبل ما نكمل تلقائيًا

// ---------- حالة عامة ----------
let myName = 'ضيف';
let peerName = null;
let isHost = false;
let currentRoomCode = null;
let peer = null;
let dataConn = null;
let remotePeerId = null;
let suppressSync = false;
let currentVideoType = null;
let currentVideoState = null;
let ytPlayer = null;
let ytReady = false;
let hlsInstance = null;
let mpegtsInstance = null;
let isDraggingProgress = false;
let progressInterval = null;
let syncTickInterval = null;
let lastMessageSender = null;
let bufferingDebounceTimer = null;
let bufferingSentToPeer = false;
let bufferingWatchdogTimer = null;
let roomMode = 'watch'; // 'watch' | 'games'
let pendingMode = 'watch';

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

const MODE_LABELS = { watch: 'نتابع', games: 'نلعب', world: 'سوا' };
const MODE_CREATE_LABELS = { watch: 'إنشاء غرفة نتابع', games: 'إنشاء غرفة نلعب', world: 'إنشاء غرفة سوا' };

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

// ================= تفعيل نوع الغرفة (متابعة / ألعاب / عالمنا) =================

function activateRoomMode(mode) {
  roomMode = mode;
  roomModeLabel.textContent = MODE_LABELS[mode] || 'onlyUs';
  watchPanel.classList.toggle('hidden', mode !== 'watch');
  gamesPanel.classList.toggle('hidden', mode !== 'games');
  worldPanel.classList.toggle('hidden', mode !== 'world');
  roomScreen.classList.toggle('mode-world', mode === 'world');
  if (mode !== 'world') setChatOpen(false);
  if (mode === 'watch') setTimeout(applyPlayerSize, 30);
  if (mode === 'world') loadWorld();
}

// ================= الشات العائم (وضع عالمنا: الشات مخفي افتراضيًا ويفتح بزر فوق) =================
function setChatOpen(open) {
  chatSectionEl.classList.toggle('chat-open', open);
  worldChatBackdrop.classList.toggle('chat-open', open);
  if (open) {
    worldChatBtn.classList.remove('has-unread');
    setTimeout(() => chatInput.focus(), 250);
  }
}
worldChatBtn.addEventListener('click', () => setChatOpen(!chatSectionEl.classList.contains('chat-open')));
worldChatBackdrop.addEventListener('click', () => setChatOpen(false));

// ================= عالمنا (3D) — Module مستقل، يُحمَّل فقط عند اختيار هذا الوضع =================
window.WorldBridge = {
  send: (payload) => sendData(payload),
  onMessage: null, // يسجّله worlds/network/world-sync.js
  getMyName: () => myName,
  getPeerName: () => peerName,
  isHost: () => isHost,
};

let worldLoaded = false;
function loadWorld() {
  if (worldLoaded) return;
  worldLoaded = true;
  import('./worlds/world-main.js')
    .then((mod) => mod.enterWorld({ container: worldContainer, bridge: window.WorldBridge, worldId: 'living-room' }))
    .catch((err) => {
      console.error('تعذر تحميل عالمنا:', err);
      worldContainer.innerHTML = '<p style="padding:24px;text-align:center">تعذر تحميل «سوا» — تأكد من اتصال الإنترنت وحاول مرة ثانية.</p>';
    });
}

// ================= المضيف =================

function beginAsHost(code, name, mode) {
  isHost = true;
  myName = name;
  currentRoomCode = code;
  nameMeLabel.textContent = myName;
  setAvatar(avatarMe, myName);
  waitingCode.textContent = code;
  activateRoomMode(mode || 'watch');

  peer = new Peer(peerIdFor(code), { config: RTC_CONFIG });

  peer.on('open', () => {
    showRoom();
    if (roomMode === 'watch') waitingOverlay.classList.remove('hidden');
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

// ================= الضيف: مشاهدة/مشاركة فقط - نوع الغرفة يحدده المضيف =================

function beginAsGuest(code, name) {
  isHost = false;
  myName = name;
  currentRoomCode = code;
  remotePeerId = peerIdFor(code);
  nameMeLabel.textContent = myName;
  setAvatar(avatarMe, myName);

  // الضيف لا يتحكم بالفيديو إطلاقًا: لا رابط، لا تغيير، لا تشغيل/إيقاف ولا تقديم
  videoInputBar.classList.add('hidden');
  changeVideoBtn.classList.add('hidden');

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
  if (roomMode === 'watch') setTimeout(applyPlayerSize, 30);
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
waitingCopyBtn.addEventListener('click', () => copyRoomCode(waitingCopyBtn));

// ================= الخروج من الغرفة =================

leaveRoomBtn.addEventListener('click', () => {
  if (!confirm('تبي تطلع من الغرفة؟')) return;
  sendData({ kind: 'peer-left' });
  clearSession();
  setTimeout(() => window.location.reload(), 80);
});

// ================= قناة البيانات =================

function setupDataConnection() {
  dataConn.on('data', (msg) => {
    switch (msg.kind) {
      case 'hello':
        peerName = msg.name;
        setAvatar(avatarPeer, peerName);
        setPeerState('connected', peerName);
        waitingOverlay.classList.add('hidden');
        if (!isHost && msg.mode) activateRoomMode(msg.mode);
        if (isHost && currentVideoState) {
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
        if (roomScreen.classList.contains('mode-world') && !chatSectionEl.classList.contains('chat-open')) {
          worldChatBtn.classList.add('has-unread');
        }
        break;
      case 'typing':
        showTyping(msg.name);
        break;
      case 'typing-stop':
        hideTyping();
        break;
      case 'load-video':
        currentVideoState = { url: msg.url, type: msg.type };
        loadVideo(msg.url, msg.type, false);
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
        bufferingOverlay.classList.remove('hidden');
        suppressSync = true;
        if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.pauseVideo();
        else if (nativePlayer) nativePlayer.pause();
        setTimeout(() => (suppressSync = false), 400);
        // شبكة حماية: إذا الطرف المتعثر ما رجع خلال مدة معقولة، نكمل التشغيل بدل ما نتعلق للأبد
        clearTimeout(bufferingWatchdogTimer);
        bufferingWatchdogTimer = setTimeout(() => {
          bufferingOverlay.classList.add('hidden');
          suppressSync = true;
          if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.playVideo();
          else if (nativePlayer) nativePlayer.play();
          setTimeout(() => (suppressSync = false), 400);
        }, BUFFER_WATCHDOG_MS);
        break;
      case 'buffering-end':
        clearTimeout(bufferingWatchdogTimer);
        bufferingOverlay.classList.add('hidden');
        suppressSync = true;
        if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.playVideo();
        else if (nativePlayer) nativePlayer.play();
        setTimeout(() => (suppressSync = false), 400);
        break;
      case 'peer-left':
        setPeerState('pending', 'غادر الغرفة');
        addSystemMessage(`${peerName || 'الطرف الآخر'} غادر الغرفة`);
        closeCall();
        break;
      case 'game-start':
        startGame(msg.game, false, msg.layout);
        break;
      case 'game-move':
        handleRemoteGameMove(msg);
        break;
      case 'game-restart':
        if (msg.game === 'xo') resetXO();
        else if (msg.game === 'connect4') resetConnect4();
        else if (msg.game === 'memory') resetMemory(msg.layout);
        break;
      case 'game-exit':
        exitToPicker(false);
        break;
      case 'world-enter':
      case 'world-state':
        if (window.WorldBridge && window.WorldBridge.onMessage) window.WorldBridge.onMessage(msg);
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

window.addEventListener('beforeunload', () => {
  sendData({ kind: 'peer-left' });
});

// ================= الفيديو =================

function detectVideoType(url) {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1], isShort: url.includes('/shorts/') };
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.m3u8')) return { type: 'hls' };
  if (clean.endsWith('.ts') || clean.endsWith('.m2ts')) return { type: 'mpegts' };
  return { type: 'native' }; // mp4, mkv, webm, mov, m4v أو أي رابط ما نعرف امتداده - نخلي المتصفح يجرب
}

loadVideoBtn.addEventListener('click', () => {
  if (!isHost) return;
  const url = videoUrlInput.value.trim();
  if (!url) return;
  const info = detectVideoType(url);
  currentVideoState = { url, type: info.type };
  loadVideo(url, info.type, true);
});
videoUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadVideoBtn.click(); });

changeVideoBtn.addEventListener('click', () => {
  if (!isHost) return;
  changeVideoBtn.classList.add('hidden');
  videoInputBar.classList.remove('hidden');
  videoUrlInput.value = '';
  videoUrlInput.focus();
});

function destroyActiveEngines() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  if (mpegtsInstance) { mpegtsInstance.destroy(); mpegtsInstance = null; }
}

function loadVideo(url, type, broadcast) {
  placeholder.classList.add('hidden');
  playerError.classList.add('hidden');
  customControls.classList.remove('hidden');
  bufferingOverlay.classList.add('hidden');
  clearTimeout(bufferingWatchdogTimer);
  bufferingSentToPeer = false;
  currentVideoType = type;

  if (isHost) {
    videoInputBar.classList.add('hidden');
    changeVideoBtn.classList.remove('hidden');
  }

  // الضيف مشاهد فقط: لا يتحكم بالتشغيل أو التقديم
  playPauseBtn.classList.toggle('hidden', !isHost);
  progressTrack.classList.toggle('disabled', !isHost);

  if (type === 'youtube') {
    nativePlayer.style.display = 'none';
    youtubeContainer.style.display = 'block';
    destroyActiveEngines();
    const info = detectVideoType(url);
    setAspectRatio(info.isShort ? 9 / 16 : 16 / 9);
    createOrLoadYouTube(info.id);
  } else {
    youtubeContainer.style.display = 'none';
    nativePlayer.style.display = 'block';
    destroyActiveEngines();
    attachNativeEvents();
    setAspectRatio(16 / 9); // قيمة مبدئية لحين ما نعرف أبعاد الفيديو الحقيقية

    if (type === 'hls' && window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({
        maxBufferLength: 60, // نخزن دقيقة كاملة مقدمًا عشان نتحمل تقطيع النت البسيط
        maxMaxBufferLength: 120,
        liveSyncDurationCount: 3,
        liveBackBufferLength: 30,
        fragLoadingMaxRetry: 8,
        manifestLoadingMaxRetry: 6,
      });
      hlsInstance.on(Hls.Events.ERROR, (evt, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hlsInstance.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
          else showPlayerError('تعذر تشغيل هذا البث');
        }
      });
      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(nativePlayer);
    } else if (type === 'mpegts' && window.mpegts && mpegts.isSupported()) {
      mpegtsInstance = mpegts.createPlayer(
        { type: 'mpegts', isLive: true, url },
        { enableStashBuffer: true, stashInitialSize: 512 * 1024, liveBufferLatencyChasing: true }
      );
      mpegtsInstance.attachMediaElement(nativePlayer);
      mpegtsInstance.load();
    } else {
      // يشمل mp4/mkv/webm/mov وأي رابط m3u8 على متصفح يدعم HLS أصلاً (سفاري)
      nativePlayer.src = url;
    }
    nativePlayer.volume = videoVolumeSlider.value / 100;
  }

  startProgressLoop();
  showControls();
  if (isHost) startHostSyncTicks();

  if (broadcast) sendData({ kind: 'load-video', url, type });
}

function showPlayerError(msg) {
  playerError.textContent = msg;
  playerError.classList.remove('hidden');
  customControls.classList.add('hidden');
}

// ---------- يوتيوب ----------
window.onYouTubeIframeAPIReady = () => { ytReady = true; };

function createOrLoadYouTube(videoId) {
  const start = () => {
    if (ytPlayer) {
      ytPlayer.loadVideoById(videoId);
      ytPlayer.setVolume(Number(videoVolumeSlider.value));
    } else {
      ytPlayer = new YT.Player('youtube-player', {
        videoId,
        playerVars: { rel: 0, controls: 0, disablekb: 1, modestbranding: 1 },
        events: {
          onStateChange: onYouTubeStateChange,
          onReady: () => ytPlayer.setVolume(Number(videoVolumeSlider.value)),
          onError: () => showPlayerError('تعذر تشغيل فيديو يوتيوب هذا'),
        },
      });
    }
  };
  if (ytReady) start();
  else {
    const check = setInterval(() => { if (ytReady) { clearInterval(check); start(); } }, 300);
  }
}

function onYouTubeStateChange(e) {
  updatePlayIcon(e.data === YT.PlayerState.PLAYING);
  if (e.data === YT.PlayerState.PLAYING) markBufferingEnded();
  if (suppressSync) return;
  const time = ytPlayer.getCurrentTime();
  if (e.data === YT.PlayerState.PLAYING) sendData({ kind: 'play', time });
  else if (e.data === YT.PlayerState.PAUSED) sendData({ kind: 'pause', time });
  else if (e.data === YT.PlayerState.BUFFERING) markBufferingStarted();
}

// ---------- فيديو مباشر (mp4 / mkv / webm / hls / mpegts) ----------
function attachNativeEvents() {
  nativePlayer.onplay = () => {
    updatePlayIcon(true);
    if (suppressSync) return;
    sendData({ kind: 'play', time: nativePlayer.currentTime });
  };
  nativePlayer.onpause = () => {
    updatePlayIcon(false);
    if (suppressSync) return;
    sendData({ kind: 'pause', time: nativePlayer.currentTime });
  };
  nativePlayer.onseeked = () => {
    if (suppressSync) return;
    sendData({ kind: 'seek', time: nativePlayer.currentTime });
  };
  nativePlayer.onwaiting = () => { if (!suppressSync) markBufferingStarted(); };
  nativePlayer.onplaying = () => { markBufferingEnded(); };
  nativePlayer.onerror = () => showPlayerError('تعذر تشغيل هذا الرابط');
  nativePlayer.onloadedmetadata = () => {
    if (nativePlayer.videoWidth && nativePlayer.videoHeight) {
      setAspectRatio(nativePlayer.videoWidth / nativePlayer.videoHeight);
    }
  };
}

function applyRemote(action, time) {
  suppressSync = true;
  if (currentVideoType === 'youtube' && ytPlayer) {
    ytPlayer.seekTo(time, true);
    if (action === 'play') ytPlayer.playVideo();
    if (action === 'pause') ytPlayer.pauseVideo();
  } else if (nativePlayer) {
    nativePlayer.currentTime = time;
    if (action === 'play') nativePlayer.play();
    if (action === 'pause') nativePlayer.pause();
  }
  setTimeout(() => (suppressSync = false), 400);
}

// ---------- التعامل مع التهنيج: تأجيل قصير قبل الإخبار، عشان ما نزعج على أول توقف بسيط ----------
function markBufferingStarted() {
  clearTimeout(bufferingDebounceTimer);
  bufferingDebounceTimer = setTimeout(() => {
    if (!bufferingSentToPeer) {
      bufferingSentToPeer = true;
      sendData({ kind: 'buffering-start' });
    }
  }, BUFFER_DEBOUNCE_MS);
}
function markBufferingEnded() {
  clearTimeout(bufferingDebounceTimer);
  if (bufferingSentToPeer) {
    bufferingSentToPeer = false;
    sendData({ kind: 'buffering-end' });
  }
}

// ---------- مزامنة دورية (المضيف هو مصدر الحقيقة) ----------
function startHostSyncTicks() {
  if (syncTickInterval) clearInterval(syncTickInterval);
  syncTickInterval = setInterval(() => {
    if (!currentVideoType) return;
    sendData({ kind: 'sync-tick', time: playerGetCurrentTime(), paused: playerIsPaused() });
  }, SYNC_TICK_MS);
}

function setPlaybackRateSafe(rate) {
  try {
    if (currentVideoType === 'youtube' && ytPlayer && ytPlayer.setPlaybackRate) ytPlayer.setPlaybackRate(rate);
    else if (nativePlayer) nativePlayer.playbackRate = rate;
  } catch (e) { /* تجاهل لو المشغل ما كان جاهز بعد */ }
}

let rateResetTimer = null;
function resetPlaybackRate() {
  clearTimeout(rateResetTimer);
  setPlaybackRateSafe(1);
}

function applySyncTick(hostTime, hostPaused) {
  if (!currentVideoType || isDraggingProgress) return;
  const myTime = playerGetCurrentTime();
  const drift = hostTime - myTime;
  const absDrift = Math.abs(drift);
  const iAmPaused = playerIsPaused();

  if (absDrift > HARD_DRIFT_THRESHOLD) {
    // فرق كبير: قفزة فورية
    suppressSync = true;
    playerSeek(hostTime);
    resetPlaybackRate();
    setTimeout(() => (suppressSync = false), 400);
  } else if (absDrift > SOFT_DRIFT_THRESHOLD && !iAmPaused && !hostPaused) {
    // فرق بسيط: نلحق الفرق بتغيير طفيف بسرعة التشغيل بدل قفزة محسوسة، ثم نرجّعها طبيعية
    setPlaybackRateSafe(drift > 0 ? 1.06 : 0.94);
    clearTimeout(rateResetTimer);
    rateResetTimer = setTimeout(resetPlaybackRate, 1200);
  } else if (absDrift <= SOFT_DRIFT_THRESHOLD) {
    resetPlaybackRate();
  }

  if (hostPaused && !iAmPaused) {
    suppressSync = true;
    resetPlaybackRate();
    if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.pauseVideo(); else nativePlayer.pause();
    setTimeout(() => (suppressSync = false), 400);
  } else if (!hostPaused && iAmPaused) {
    suppressSync = true;
    if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.playVideo(); else nativePlayer.play();
    setTimeout(() => (suppressSync = false), 400);
  }
}

// ================= مشغل موحّد =================

function playerGetCurrentTime() {
  if (currentVideoType === 'youtube') {
    try { return ytPlayer && ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0; } catch (e) { return 0; }
  }
  return nativePlayer.currentTime || 0;
}
function playerGetDuration() {
  if (currentVideoType === 'youtube') {
    try { return ytPlayer && ytPlayer.getDuration ? ytPlayer.getDuration() : 0; } catch (e) { return 0; }
  }
  return nativePlayer.duration || 0;
}
function playerIsPaused() {
  if (currentVideoType === 'youtube') {
    try {
      return !ytPlayer || typeof ytPlayer.getPlayerState !== 'function' || ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING;
    } catch (e) { return true; }
  }
  return nativePlayer.paused;
}
function playerSeek(time) {
  if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.seekTo(time, true);
  else nativePlayer.currentTime = time;
}

playPauseBtn.addEventListener('click', () => {
  if (!isHost) return;
  if (playerIsPaused()) {
    if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.playVideo();
    else nativePlayer.play();
  } else {
    if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.pauseVideo();
    else nativePlayer.pause();
  }
});

function updatePlayIcon(isPlaying) {
  playPauseBtn.querySelector('.icon-play').classList.toggle('hidden', isPlaying);
  playPauseBtn.querySelector('.icon-pause').classList.toggle('hidden', !isPlaying);
  showControls();
}

let isVideoMuted = false;
let lastVideoVolume = 100;

videoVolumeSlider.addEventListener('input', () => {
  const value = Number(videoVolumeSlider.value);
  applyVideoVolume(value);
  isVideoMuted = value === 0;
  updateMuteIcon();
});

function applyVideoVolume(value) {
  if (currentVideoType === 'youtube' && ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(value);
  else nativePlayer.volume = value / 100;
}

muteBtn.addEventListener('click', () => {
  if (isVideoMuted) {
    isVideoMuted = false;
    videoVolumeSlider.value = lastVideoVolume || 100;
  } else {
    lastVideoVolume = Number(videoVolumeSlider.value) || 100;
    isVideoMuted = true;
    videoVolumeSlider.value = 0;
  }
  applyVideoVolume(Number(videoVolumeSlider.value));
  updateMuteIcon();
});

function updateMuteIcon() {
  muteBtn.querySelector('.icon-vol-on').classList.toggle('hidden', isVideoMuted);
  muteBtn.querySelector('.icon-vol-off').classList.toggle('hidden', !isVideoMuted);
}

fullscreenBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else mainLayoutEl.requestFullscreen();
});

// ---------- إخفاء أزرار المشغل تلقائيًا أثناء التشغيل، تظهر فقط عند اللمس/التحريك ----------
let hideControlsTimer = null;

function showControls() {
  customControls.classList.remove('controls-hidden');
  clearTimeout(hideControlsTimer);
  if (!playerIsPaused()) {
    hideControlsTimer = setTimeout(() => {
      customControls.classList.add('controls-hidden');
    }, 2800);
  }
}

playerContainer.addEventListener('pointermove', showControls);
playerContainer.addEventListener('pointerdown', showControls);
customControls.addEventListener('pointerenter', () => clearTimeout(hideControlsTimer));
customControls.addEventListener('pointerleave', showControls);

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startProgressLoop() {
  if (progressInterval) clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    if (isDraggingProgress) return;
    const duration = playerGetDuration();
    const current = playerGetCurrentTime();
    if (duration > 0) setProgressUI(Math.min(1, Math.max(0, current / duration)));
    timeCurrent.textContent = formatTime(current);
    timeDuration.textContent = formatTime(duration);
  }, 400);
}

function setProgressUI(fraction) {
  progressFill.style.width = `${fraction * 100}%`;
  progressHandle.style.right = `${fraction * 100}%`;
}

function fractionFromPointer(e) {
  const rect = progressTrack.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const fromLeft = Math.min(1, Math.max(0, x / rect.width));
  return 1 - fromLeft;
}

progressTrack.addEventListener('pointerdown', (e) => {
  if (!isHost) return;
  isDraggingProgress = true;
  setProgressUI(fractionFromPointer(e));
  progressTrack.setPointerCapture(e.pointerId);
});
progressTrack.addEventListener('pointermove', (e) => {
  if (!isHost || !isDraggingProgress) return;
  setProgressUI(fractionFromPointer(e));
});
progressTrack.addEventListener('pointerup', (e) => {
  if (!isHost || !isDraggingProgress) return;
  isDraggingProgress = false;
  const duration = playerGetDuration();
  const newTime = fractionFromPointer(e) * duration;
  playerSeek(newTime);
  sendData({ kind: 'seek', time: newTime });
});

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

// ================= المايك =================

let localStream = null;
let micOn = false;
let outgoingCall = null;
let incomingCall = null;
let incomingCallAnswered = false;

const micButtons = [micBtn, worldMicBtn];

async function onMicButtonClick() {
  if (!micOn) await startMic();
  else stopMic();
}
micBtn.addEventListener('click', onMicButtonClick);
worldMicBtn.addEventListener('click', onMicButtonClick);

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
    micButtons.forEach((btn) => {
      const original = btn.title;
      btn.title = 'تعذر الوصول للمايك';
      btn.classList.add('mic-error');
      setTimeout(() => { btn.title = original; btn.classList.remove('mic-error'); }, 2000);
    });
    return;
  }
  micOn = true;
  micButtons.forEach((btn) => {
    btn.classList.add('mic-active');
    btn.title = 'إيقاف المايك';
    btn.querySelector('.icon-mic-on').classList.add('hidden');
    btn.querySelector('.icon-mic-off').classList.remove('hidden');
  });
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
  micButtons.forEach((btn) => {
    btn.classList.remove('mic-active');
    btn.title = 'تشغيل المايك';
    btn.querySelector('.icon-mic-on').classList.remove('hidden');
    btn.querySelector('.icon-mic-off').classList.add('hidden');
  });
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

// ================= الألعاب =================

let activeGame = null; // 'xo' | 'rps' | null
let xoBoard = Array(9).fill(null);
let xoMySymbol = 'X';
let xoTurn = 'X';
let xoGameOver = false;
let rpsMyChoice = null;
let rpsPeerChoice = null;
let rpsRoundActive = true;
let rpsMyScore = 0;
let rpsPeerScore = 0;

gameChoiceBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const game = btn.dataset.game;
    if (game === 'memory') {
      const layout = shuffledMemoryLayout();
      sendData({ kind: 'game-start', game, layout });
      startGame(game, true, layout);
    } else {
      sendData({ kind: 'game-start', game });
      startGame(game, true);
    }
  });
});

gameBackBtn.addEventListener('click', () => {
  sendData({ kind: 'game-exit' });
  exitToPicker(true);
});

function startGame(game, iInitiated, layout) {
  activeGame = game;
  gamePicker.classList.add('hidden');
  gameBoardWrap.classList.remove('hidden');
  xoBoardEl.classList.toggle('hidden', game !== 'xo');
  rpsBoardEl.classList.toggle('hidden', game !== 'rps');
  document.getElementById('connect4-board').classList.toggle('hidden', game !== 'connect4');
  document.getElementById('memory-board').classList.toggle('hidden', game !== 'memory');
  if (game === 'xo') resetXO();
  if (game === 'rps') resetRpsMatch();
  if (game === 'connect4') resetConnect4();
  if (game === 'memory') resetMemory(layout);
}

function exitToPicker(sendExit) {
  activeGame = null;
  gameBoardWrap.classList.add('hidden');
  gamePicker.classList.remove('hidden');
}

function handleRemoteGameMove(msg) {
  if (msg.game === 'xo') {
    const opponentSymbol = xoMySymbol === 'X' ? 'O' : 'X';
    xoBoard[msg.index] = opponentSymbol;
    renderXO();
    xoTurn = xoMySymbol;
    checkXoResult();
  } else if (msg.game === 'rps') {
    rpsPeerChoice = msg.choice;
    checkRpsResolve();
  } else if (msg.game === 'rps-next') {
    resetRpsRound();
  } else if (msg.game === 'connect4') {
    const opponentSymbol = c4MySymbol === 'A' ? 'B' : 'A';
    dropDisc(msg.col, opponentSymbol);
    c4Turn = c4MySymbol;
    checkConnect4Result();
  } else if (msg.game === 'memory' && msg.action === 'flip') {
    flipMemoryCard(msg.index);
  }
}

// ---------- إكس أو ----------
function resetXO() {
  xoBoard = Array(9).fill(null);
  xoMySymbol = isHost ? 'X' : 'O';
  xoTurn = 'X'; // المضيف (X) يبدأ دائمًا
  xoGameOver = false;
  xoRestartBtn.classList.add('hidden');
  renderXO();
}

function renderXO() {
  xoCells.forEach((cell, i) => {
    cell.textContent = xoBoard[i] || '';
    cell.disabled = !!xoBoard[i] || xoGameOver || xoTurn !== xoMySymbol;
  });
  if (!xoGameOver) {
    xoStatus.textContent = xoTurn === xoMySymbol ? 'دورك' : 'دور الطرف الآخر';
  }
}

xoCells.forEach((cell) => {
  cell.addEventListener('click', () => {
    const i = Number(cell.dataset.i);
    if (xoBoard[i] || xoGameOver || xoTurn !== xoMySymbol) return;
    xoBoard[i] = xoMySymbol;
    renderXO();
    sendData({ kind: 'game-move', game: 'xo', index: i });
    xoTurn = xoMySymbol === 'X' ? 'O' : 'X';
    checkXoResult();
  });
});

const XO_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkXoResult() {
  let winner = null;
  for (const [a,b,c] of XO_LINES) {
    if (xoBoard[a] && xoBoard[a] === xoBoard[b] && xoBoard[b] === xoBoard[c]) winner = xoBoard[a];
  }
  const isFull = xoBoard.every((v) => v);
  if (winner || isFull) {
    xoGameOver = true;
    xoStatus.textContent = !winner ? 'تعادل' : (winner === xoMySymbol ? 'فزت!' : 'خسرت هالجولة');
    xoRestartBtn.classList.remove('hidden');
  }
  renderXO();
}

xoRestartBtn.addEventListener('click', () => {
  resetXO();
  sendData({ kind: 'game-restart', game: 'xo' });
});

// ---------- حجر ورقة مقص ----------
function resetRpsMatch() {
  rpsMyScore = 0;
  rpsPeerScore = 0;
  resetRpsRound();
}

function resetRpsRound() {
  rpsMyChoice = null;
  rpsPeerChoice = null;
  rpsRoundActive = true;
  rpsChoiceBtns.forEach((b) => (b.disabled = false));
  rpsWaiting.classList.add('hidden');
  rpsResult.classList.add('hidden');
  rpsScoreEl.textContent = `${toArabicDigits(rpsMyScore)} - ${toArabicDigits(rpsPeerScore)}`;
}

function toArabicDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

rpsChoiceBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!rpsRoundActive || rpsMyChoice) return;
    rpsMyChoice = btn.dataset.choice;
    rpsChoiceBtns.forEach((b) => (b.disabled = true));
    rpsWaiting.classList.remove('hidden');
    sendData({ kind: 'game-move', game: 'rps', choice: rpsMyChoice });
    checkRpsResolve();
  });
});

const RPS_LABELS = { rock: 'حجر', paper: 'ورقة', scissors: 'مقص' };
const RPS_BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

function checkRpsResolve() {
  if (!rpsRoundActive || !rpsMyChoice || !rpsPeerChoice) return;
  rpsRoundActive = false;
  rpsWaiting.classList.add('hidden');
  rpsResult.classList.remove('hidden');
  rpsReveal.textContent = `أنت: ${RPS_LABELS[rpsMyChoice]}  —  الطرف الآخر: ${RPS_LABELS[rpsPeerChoice]}`;

  let resultText;
  if (rpsMyChoice === rpsPeerChoice) {
    resultText = 'تعادل';
  } else if (RPS_BEATS[rpsMyChoice] === rpsPeerChoice) {
    resultText = 'فزت بهالجولة!';
    rpsMyScore++;
  } else {
    resultText = 'خسرت هالجولة';
    rpsPeerScore++;
  }
  rpsResultText.textContent = resultText;
  rpsScoreEl.textContent = `${toArabicDigits(rpsMyScore)} - ${toArabicDigits(rpsPeerScore)}`;
}

rpsNextBtn.addEventListener('click', () => {
  resetRpsRound();
  sendData({ kind: 'game-move', game: 'rps-next' });
});

// ================= أربح أربعة =================

const C4_COLS = 7;
const C4_ROWS = 6;
let c4Board = [];
let c4MySymbol = 'A';
let c4Turn = 'A';
let c4GameOver = false;
let c4Cells = [];

function buildConnect4Grid() {
  const grid = document.getElementById('connect4-grid');
  grid.innerHTML = '';
  c4Cells = [];
  for (let i = 0; i < C4_COLS * C4_ROWS; i++) {
    const btn = document.createElement('button');
    btn.className = 'connect4-cell';
    btn.addEventListener('click', () => onConnect4Click(i % C4_COLS));
    grid.appendChild(btn);
    c4Cells.push(btn);
  }
}

function resetConnect4() {
  c4Board = Array(C4_COLS * C4_ROWS).fill(null);
  c4MySymbol = isHost ? 'A' : 'B';
  c4Turn = 'A'; // المضيف يبدأ دائمًا
  c4GameOver = false;
  document.getElementById('connect4-restart-btn').classList.add('hidden');
  if (c4Cells.length === 0) buildConnect4Grid();
  renderConnect4();
}

function renderConnect4() {
  const status = document.getElementById('connect4-status');
  c4Cells.forEach((cell, i) => {
    cell.classList.remove('c4-me', 'c4-peer');
    if (c4Board[i] === c4MySymbol) cell.classList.add('c4-me');
    else if (c4Board[i]) cell.classList.add('c4-peer');
    cell.disabled = c4GameOver || c4Turn !== c4MySymbol;
  });
  if (!c4GameOver) status.textContent = c4Turn === c4MySymbol ? 'دورك' : 'دور الطرف الآخر';
}

function dropDisc(col, symbol) {
  for (let row = C4_ROWS - 1; row >= 0; row--) {
    const idx = row * C4_COLS + col;
    if (!c4Board[idx]) { c4Board[idx] = symbol; return idx; }
  }
  return -1;
}

function onConnect4Click(col) {
  if (c4GameOver || c4Turn !== c4MySymbol) return;
  const idx = dropDisc(col, c4MySymbol);
  if (idx === -1) return;
  renderConnect4();
  sendData({ kind: 'game-move', game: 'connect4', col });
  c4Turn = c4MySymbol === 'A' ? 'B' : 'A';
  checkConnect4Result();
}

function checkConnect4Result() {
  const status = document.getElementById('connect4-status');
  const winner = getConnect4Winner();
  const isFull = c4Board.every((v) => v);
  if (winner || isFull) {
    c4GameOver = true;
    status.textContent = !winner ? 'تعادل' : (winner === c4MySymbol ? 'فزت!' : 'خسرت هالجولة');
    document.getElementById('connect4-restart-btn').classList.remove('hidden');
  }
  renderConnect4();
}

function getConnect4Winner() {
  const at = (r, c) => (r < 0 || r >= C4_ROWS || c < 0 || c >= C4_COLS) ? null : c4Board[r * C4_COLS + c];
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const sym = at(r, c);
      if (!sym) continue;
      for (const [dr, dc] of dirs) {
        if (at(r+dr,c+dc)===sym && at(r+2*dr,c+2*dc)===sym && at(r+3*dr,c+3*dc)===sym) return sym;
      }
    }
  }
  return null;
}

document.getElementById('connect4-restart-btn').addEventListener('click', () => {
  resetConnect4();
  sendData({ kind: 'game-restart', game: 'connect4' });
});

// ================= الذاكرة =================

let memoryLayout = [];
let memoryMatched = new Set();
let memoryPending = [];
let memoryMySymbol = 'A';
let memoryTurn = 'A';
let memoryMyScore = 0;
let memoryPeerScore = 0;
let memoryCells = [];

function shuffledMemoryLayout() {
  const values = [];
  for (let v = 0; v < 8; v++) { values.push(v, v); }
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function buildMemoryGrid() {
  const grid = document.getElementById('memory-grid');
  grid.innerHTML = '';
  memoryCells = [];
  for (let i = 0; i < 16; i++) {
    const btn = document.createElement('button');
    btn.className = 'memory-card';
    btn.addEventListener('click', () => onMemoryClick(i));
    grid.appendChild(btn);
    memoryCells.push(btn);
  }
}

function resetMemory(layout) {
  memoryLayout = layout && layout.length === 16 ? layout : shuffledMemoryLayout();
  memoryMatched = new Set();
  memoryPending = [];
  memoryMySymbol = isHost ? 'A' : 'B';
  memoryTurn = 'A';
  memoryMyScore = 0;
  memoryPeerScore = 0;
  document.getElementById('memory-restart-btn').classList.add('hidden');
  if (memoryCells.length === 0) buildMemoryGrid();
  renderMemory();
}

function renderMemory() {
  const status = document.getElementById('memory-status');
  memoryCells.forEach((cell, i) => {
    if (memoryMatched.has(i)) {
      cell.textContent = toArabicDigits(memoryLayout[i] + 1);
      cell.classList.add('matched');
      cell.classList.remove('flipped');
      cell.disabled = true;
    } else if (memoryPending.includes(i)) {
      cell.textContent = toArabicDigits(memoryLayout[i] + 1);
      cell.classList.add('flipped');
      cell.classList.remove('matched');
      cell.disabled = true;
    } else {
      cell.textContent = '';
      cell.classList.remove('flipped', 'matched');
      cell.disabled = memoryTurn !== memoryMySymbol || memoryPending.length >= 2;
    }
  });
  status.textContent = `${toArabicDigits(memoryMyScore)} - ${toArabicDigits(memoryPeerScore)}`;
}

function onMemoryClick(i) {
  if (memoryTurn !== memoryMySymbol) return;
  if (memoryMatched.has(i) || memoryPending.includes(i) || memoryPending.length >= 2) return;
  flipMemoryCard(i);
  sendData({ kind: 'game-move', game: 'memory', action: 'flip', index: i });
}

function flipMemoryCard(i) {
  memoryPending.push(i);
  renderMemory();
  if (memoryPending.length === 2) setTimeout(resolveMemoryPair, 700);
}

function resolveMemoryPair() {
  const [a, b] = memoryPending;
  if (memoryLayout[a] === memoryLayout[b]) {
    memoryMatched.add(a); memoryMatched.add(b);
    if (memoryTurn === memoryMySymbol) memoryMyScore++; else memoryPeerScore++;
  } else {
    memoryTurn = memoryTurn === 'A' ? 'B' : 'A';
  }
  memoryPending = [];
  renderMemory();
  if (memoryMatched.size === 16) {
    document.getElementById('memory-restart-btn').classList.remove('hidden');
  }
}

document.getElementById('memory-restart-btn').addEventListener('click', () => {
  const layout = shuffledMemoryLayout();
  resetMemory(layout);
  sendData({ kind: 'game-restart', game: 'memory', layout });
});

