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
const nameInput = document.getElementById('name-input');
const createRoomBtn = document.getElementById('create-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const entryError = document.getElementById('entry-error');

const copyCodeBtn = document.getElementById('copy-code-btn');
const copyCodeLabel = document.getElementById('copy-code-label');
const leaveRoomBtn = document.getElementById('leave-room-btn');

const avatarMe = document.getElementById('avatar-me');
const nameMeLabel = document.getElementById('name-me-label');
const avatarPeer = document.getElementById('avatar-peer');
const namePeerLabel = document.getElementById('name-peer-label');
const peerMicIndicator = document.getElementById('peer-mic-indicator');

const callVolumeSlider = document.getElementById('call-volume');
const micBtn = document.getElementById('mic-btn');

const videoUrlInput = document.getElementById('video-url');
const loadVideoBtn = document.getElementById('load-video-btn');
const videoInputBar = document.getElementById('video-input-bar');
const changeVideoBtn = document.getElementById('change-video-btn');
const placeholder = document.getElementById('placeholder');
const youtubeContainer = document.getElementById('youtube-player');
const nativePlayer = document.getElementById('native-player');
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

const DRIFT_THRESHOLD = 1.2; // ثانية: أعلى فرق نقبله قبل تصحيح المزامنة
const SYNC_TICK_MS = 2500;

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
let isDraggingProgress = false;
let progressInterval = null;
let syncTickInterval = null;
let lastMessageSender = null;

function randomCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000)); // 8 أرقام
}
function peerIdFor(code) { return 'wt-' + code; }

// ================= استمرارية الجلسة =================

function readSession() {
  try { return JSON.parse(sessionStorage.getItem('wt_session')); } catch (e) { return null; }
}
function writeSession(role, code, name) {
  sessionStorage.setItem('wt_session', JSON.stringify({ role, code, name }));
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

// ================= شاشة الدخول =================

function showEntryError(msg) {
  entryError.textContent = msg;
  entryError.classList.remove('hidden');
}

createRoomBtn.addEventListener('click', () => {
  const name = (nameInput.value || 'ضيف').trim();
  const code = randomCode();
  writeSession('host', code, name);
  createRoomBtn.disabled = true;
  joinRoomBtn.disabled = true;
  beginAsHost(code, name);
});

joinRoomBtn.addEventListener('click', () => {
  const name = (nameInput.value || 'ضيف').trim();
  const code = (roomCodeInput.value || '').replace(/\D/g, '');
  if (code.length < 6) {
    showEntryError('اكتب رمز الغرفة كامل');
    return;
  }
  writeSession('guest', code, name);
  createRoomBtn.disabled = true;
  joinRoomBtn.disabled = true;
  beginAsGuest(code, name);
});

if (storedSession) {
  showRoom();
  if (storedSession.role === 'host') beginAsHost(storedSession.code, storedSession.name);
  else beginAsGuest(storedSession.code, storedSession.name);
}

// ================= المضيف =================

function beginAsHost(code, name) {
  isHost = true;
  myName = name;
  currentRoomCode = code;
  nameMeLabel.textContent = myName;
  setAvatar(avatarMe, myName);
  waitingCode.textContent = code;

  peer = new Peer(peerIdFor(code), { config: RTC_CONFIG });

  peer.on('open', () => {
    showRoom();
    waitingOverlay.classList.remove('hidden');
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
      sendData({ kind: 'hello', name: myName });
      setPeerState('pending', 'جاري تأكيد الاتصال');
    });
  });

  registerIncomingCallHandler();
  peer.on('error', handlePeerError);
  peer.on('disconnected', () => { if (peer) peer.reconnect(); });
}

// ================= الضيف: مشاهدة فقط =================

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
    writeSession('host', newCode, myName);
    beginAsHost(newCode, myName);
  } else {
    setPeerState('error', 'خطأ بالاتصال');
  }
}

function showRoom() {
  entryScreen.classList.add('hidden');
  roomScreen.classList.remove('hidden');
}

// إعادة اتصال تلقائية عند الرجوع للتبويب
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !peer) return;
  if (peer.disconnected) peer.reconnect();
  if (!isHost && remotePeerId && (!dataConn || !dataConn.open)) {
    setPeerState('pending', 'إعادة الاتصال');
    connectToHost(remotePeerId);
  }
});

// ================= نسخ الرمز =================

function copyRoomCode(labelEl) {
  if (!currentRoomCode) return;
  navigator.clipboard.writeText(currentRoomCode).then(() => {
    const original = labelEl.textContent;
    labelEl.textContent = 'تم النسخ';
    setTimeout(() => (labelEl.textContent = original), 1500);
  });
}
copyCodeBtn.addEventListener('click', () => copyRoomCode(copyCodeLabel));
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
        break;
      case 'buffering-end':
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
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
  if (url.match(/\.m3u8($|\?)/i)) return { type: 'direct', sub: 'hls' };
  return { type: 'direct', sub: 'file' };
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

function loadVideo(url, type, broadcast) {
  placeholder.classList.add('hidden');
  customControls.classList.remove('hidden');
  bufferingOverlay.classList.add('hidden');
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
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
    const info = detectVideoType(url);
    createOrLoadYouTube(info.id);
  } else {
    youtubeContainer.style.display = 'none';
    nativePlayer.style.display = 'block';
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

    if (url.match(/\.m3u8($|\?)/i) && window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls();
      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(nativePlayer);
    } else {
      nativePlayer.src = url;
    }
    nativePlayer.volume = videoVolumeSlider.value / 100;
    attachNativeEvents();
  }

  startProgressLoop();
  if (isHost) startHostSyncTicks();

  if (broadcast) sendData({ kind: 'load-video', url, type });
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
  if (suppressSync) return;
  const time = ytPlayer.getCurrentTime();
  if (e.data === YT.PlayerState.PLAYING) sendData({ kind: 'play', time });
  else if (e.data === YT.PlayerState.PAUSED) sendData({ kind: 'pause', time });
  else if (e.data === YT.PlayerState.BUFFERING) sendData({ kind: 'buffering-start' });
}

// ---------- فيديو مباشر ----------
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
  nativePlayer.onwaiting = () => {
    if (!suppressSync) sendData({ kind: 'buffering-start' });
  };
  nativePlayer.onplaying = () => {
    if (!suppressSync) sendData({ kind: 'buffering-end' });
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

// ---------- مزامنة دورية (المضيف هو مصدر الحقيقة) ----------
function startHostSyncTicks() {
  if (syncTickInterval) clearInterval(syncTickInterval);
  syncTickInterval = setInterval(() => {
    if (!currentVideoType) return;
    sendData({ kind: 'sync-tick', time: playerGetCurrentTime(), paused: playerIsPaused() });
  }, SYNC_TICK_MS);
}

function applySyncTick(hostTime, hostPaused) {
  if (!currentVideoType || isDraggingProgress) return;
  const myTime = playerGetCurrentTime();
  const drift = hostTime - myTime;
  const iAmPaused = playerIsPaused();

  if (Math.abs(drift) > DRIFT_THRESHOLD) {
    suppressSync = true;
    playerSeek(hostTime);
    setTimeout(() => (suppressSync = false), 400);
  }
  if (hostPaused && !iAmPaused) {
    suppressSync = true;
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
  if (currentVideoType === 'youtube') return ytPlayer && ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
  return nativePlayer.currentTime || 0;
}
function playerGetDuration() {
  if (currentVideoType === 'youtube') return ytPlayer && ytPlayer.getDuration ? ytPlayer.getDuration() : 0;
  return nativePlayer.duration || 0;
}
function playerIsPaused() {
  if (currentVideoType === 'youtube') return !ytPlayer || ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING;
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

callVolumeSlider.addEventListener('input', () => {
  remoteAudio.volume = Number(callVolumeSlider.value) / 100;
});

fullscreenBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else mainLayoutEl.requestFullscreen();
});

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

micBtn.addEventListener('click', async () => {
  if (!micOn) await startMic();
  else stopMic();
});

async function startMic() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
  remoteAudio.srcObject = stream;
  remoteAudio.volume = Number(callVolumeSlider.value) / 100;
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
