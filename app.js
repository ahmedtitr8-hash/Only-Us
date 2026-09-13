// ---------- عناصر الصفحة ----------
const entryScreen = document.getElementById('entry-screen');
const roomScreen = document.getElementById('room-screen');
const nameInput = document.getElementById('name-input');
const enterBtn = document.getElementById('enter-btn');
const modeHint = document.getElementById('mode-hint');
const copyLinkBtn = document.getElementById('copy-link-btn');
const peerStatus = document.getElementById('peer-status');
const micBtn = document.getElementById('mic-btn');
const videoUrlInput = document.getElementById('video-url');
const loadVideoBtn = document.getElementById('load-video-btn');
const placeholder = document.getElementById('placeholder');
const youtubeContainer = document.getElementById('youtube-player');
const nativePlayer = document.getElementById('native-player');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const remoteAudio = document.getElementById('remote-audio');

// ---------- حالة عامة ----------
let myName = 'ضيف';
let isHost = false;
let hostRoomId = null; // معرف الغرفة (نفس Peer ID لصاحب الغرفة)
let peer = null;
let dataConn = null;
let remotePeerId = null;
let suppressSync = false;
let currentVideoType = null;
let currentVideoState = null; // آخر فيديو محمّل، يُرسل تلقائي لمن ينضم متأخر
let ytPlayer = null;
let hlsInstance = null;

const roomFromUrl = new URLSearchParams(window.location.search).get('room');
if (roomFromUrl) {
  modeHint.textContent = 'بتنضم لغرفة موجودة';
} 

function randomId() {
  return 'wt-' + Math.random().toString(36).slice(2, 10);
}

// ================= الدخول / إنشاء الغرفة =================

enterBtn.addEventListener('click', () => {
  myName = (nameInput.value || 'ضيف').trim();
  enterBtn.disabled = true;
  enterBtn.textContent = 'جاري الاتصال...';

  if (roomFromUrl) {
    joinAsGuest(roomFromUrl);
  } else {
    createAsHost();
  }
});

function createAsHost() {
  isHost = true;
  hostRoomId = randomId();
  peer = new Peer(hostRoomId);

  peer.on('open', (id) => {
    hostRoomId = id;
    const newUrl = `${window.location.origin}${window.location.pathname}?room=${id}`;
    window.history.replaceState({}, '', newUrl);
    showRoom();
    peerStatus.textContent = 'انسخ رابط الدعوة وأرسله لخويك';
  });

  peer.on('connection', (conn) => {
    dataConn = conn;
    remotePeerId = conn.peer;
    setupDataConnection();
    conn.on('open', () => {
      peerStatus.textContent = 'خويك انضم للغرفة ✅';
      if (currentVideoState) {
        dataConn.send({ kind: 'load-video', ...currentVideoState });
      }
    });
  });

  registerIncomingCallHandler();
  peer.on('error', handlePeerError);
}

function joinAsGuest(roomId) {
  isHost = false;
  remotePeerId = roomId;
  peer = new Peer();

  peer.on('open', () => {
    showRoom();
    peerStatus.textContent = 'جاري الاتصال بالغرفة...';
    const conn = peer.connect(roomId, { reliable: true });
    dataConn = conn;
    setupDataConnection();
    conn.on('open', () => {
      peerStatus.textContent = 'متصل مع خويك ✅';
    });
  });

  registerIncomingCallHandler();
  peer.on('error', handlePeerError);
}

function handlePeerError(err) {
  console.error(err);
  if (err.type === 'peer-unavailable') {
    peerStatus.textContent = 'ما قدرنا نلقى الغرفة، تأكد إن صاحبها فاتح الصفحة';
  } else if (err.type === 'unavailable-id') {
    // نادر جدًا، نعيد المحاولة بمعرف ثاني
    createAsHost();
  } else {
    peerStatus.textContent = 'صار خطأ بالاتصال، جرب تحدّث الصفحة';
  }
}

function showRoom() {
  entryScreen.classList.add('hidden');
  roomScreen.classList.remove('hidden');
}

// ---------- نسخ رابط الدعوة ----------
copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    copyLinkBtn.textContent = '✅ تم النسخ';
    setTimeout(() => (copyLinkBtn.textContent = '📋 نسخ رابط الدعوة'), 1500);
  });
});

// ================= قناة البيانات (شات + مزامنة) =================

function setupDataConnection() {
  dataConn.on('data', (msg) => {
    switch (msg.kind) {
      case 'chat':
        addMessage(msg.name, msg.text, false);
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
      case 'peer-left':
        peerStatus.textContent = 'خويك غادر الغرفة';
        addSystemMessage('خويك غادر الغرفة');
        closeCall();
        break;
    }
  });
  dataConn.on('close', () => {
    peerStatus.textContent = 'انقطع الاتصال';
    closeCall();
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
  const url = videoUrlInput.value.trim();
  if (!url) return;
  const info = detectVideoType(url);
  currentVideoState = { url, type: info.type };
  loadVideo(url, info.type, true);
});

function loadVideo(url, type, broadcast) {
  placeholder.classList.add('hidden');
  currentVideoType = type;

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
    attachNativeEvents();
  }

  if (broadcast) {
    sendData({ kind: 'load-video', url, type });
  }
}

// ---------- يوتيوب ----------
let ytReady = false;
window.onYouTubeIframeAPIReady = () => { ytReady = true; };

function createOrLoadYouTube(videoId) {
  const start = () => {
    if (ytPlayer) {
      ytPlayer.loadVideoById(videoId);
    } else {
      ytPlayer = new YT.Player('youtube-player', {
        videoId,
        playerVars: { rel: 0 },
        events: { onStateChange: onYouTubeStateChange },
      });
    }
  };
  if (ytReady) start();
  else {
    const check = setInterval(() => {
      if (ytReady) { clearInterval(check); start(); }
    }, 300);
  }
}

function onYouTubeStateChange(e) {
  if (suppressSync) return;
  const time = ytPlayer.getCurrentTime();
  if (e.data === YT.PlayerState.PLAYING) {
    sendData({ kind: 'play', time });
  } else if (e.data === YT.PlayerState.PAUSED) {
    sendData({ kind: 'pause', time });
  }
}

// ---------- فيديو مباشر ----------
function attachNativeEvents() {
  nativePlayer.onplay = () => {
    if (suppressSync) return;
    sendData({ kind: 'play', time: nativePlayer.currentTime });
  };
  nativePlayer.onpause = () => {
    if (suppressSync) return;
    sendData({ kind: 'pause', time: nativePlayer.currentTime });
  };
  nativePlayer.onseeked = () => {
    if (suppressSync) return;
    sendData({ kind: 'seek', time: nativePlayer.currentTime });
  };
}

// ---------- تطبيق أوامر المزامنة الجاية من الطرف الثاني ----------
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

// ================= الشات =================

function addMessage(name, text, mine) {
  const div = document.createElement('div');
  div.className = 'msg' + (mine ? ' me' : '');
  div.innerHTML = `<span class="name">${escapeHtml(name)}</span>${escapeHtml(text)}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  sendData({ kind: 'chat', text, name: myName });
  addMessage(myName, text, true);
  chatInput.value = '';
}
sendChatBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

// ================= المايك (صوت مباشر بين الاثنين عبر PeerJS) =================

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
    alert('ما قدرنا نوصل للمايك، تأكد من صلاحيات المتصفح');
    return;
  }
  micOn = true;
  micBtn.classList.add('mic-on');
  micBtn.textContent = '🎤 المايك شغال';

  // إذا خويك سبقنا وطلب مكالمة، نرد عليها بصوتنا (تصير مكالمة واحدة بالاتجاهين)
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
  micBtn.classList.remove('mic-on');
  micBtn.textContent = '🎤 المايك';
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  closeCall();
}

function attachRemoteStream(stream) {
  remoteAudio.srcObject = stream;
}

function registerIncomingCallHandler() {
  peer.on('call', (call) => {
    incomingCall = call;
    incomingCallAnswered = false;
    // إذا مايكنا شغال أصلاً، نرد فورًا بصوتنا
    if (micOn && localStream) {
      incomingCallAnswered = true;
      call.answer(localStream);
      call.on('stream', attachRemoteStream);
    }
    // إذا مايكنا مو شغال، ننتظر لين يضغط المستخدم زر المايك (startMic فوق يتكفل بالرد حينها)
  });
}

function closeCall() {
  if (outgoingCall) { outgoingCall.close(); outgoingCall = null; }
  if (incomingCall) { incomingCall.close(); incomingCall = null; }
  incomingCallAnswered = false;
  remoteAudio.srcObject = null;
}
