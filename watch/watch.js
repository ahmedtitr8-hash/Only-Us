// ============================================================
// watch.js
// كل شيء خاص بوضع "نتابع": المشغل، تحميل الصيغ المختلفة
// (يوتيوب / mp4 / mkv / hls / ts)، والمزامنة بين الطرفين.
// يعتمد على core.js لأشياء مثل sendData, isHost, myName...
// ============================================================
const videoUrlInput = document.getElementById('video-url');
const loadVideoBtn = document.getElementById('load-video-btn');
const videoInputBar = document.getElementById('video-input-bar');
const changeVideoBtn = document.getElementById('change-video-btn');
const addVideoBtn = document.getElementById('add-video-btn');
const placeholder = document.getElementById('placeholder');
const youtubeContainer = document.getElementById('youtube-player');
const nativePlayer = document.getElementById('native-player');
const playerContainer = document.getElementById('player-container');
const videoSectionEl = document.querySelector('.video-section');
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
const bufferingOverlay = document.getElementById('buffering-overlay');
const playerError = document.getElementById('player-error');
const playerErrorMsg = document.getElementById('player-error-msg');
const playerErrorRetry = document.getElementById('player-error-retry');
const skipBackBtn = document.getElementById('skip-back-btn');
const skipFwdBtn = document.getElementById('skip-fwd-btn');

const HARD_DRIFT_THRESHOLD = 1.2; // فرق كبير: نقفز فورًا لتصحيحه
const SOFT_DRIFT_THRESHOLD = 0.25; // فرق بسيط: نصححه بتسريع/إبطاء خفيف بدل القفزة المزعجة
const SYNC_TICK_MS = 2000;
const BUFFER_DEBOUNCE_MS = 700; // نتجاهل التهنيج القصير جدًا اللي يصلح نفسه بسرعة
const BUFFER_WATCHDOG_MS = 9000; // أقصى مدة ننتظر فيها الطرف المتعثر قبل ما نكمل تلقائيًا
let suppressSync = false;
let currentVideoType = null;
let currentVideoState = null;
let pendingSubtitleUrl = null; // ترجمة عربية جاية من صفحة "مرجع" — تُستهلك مرة وحدة عند أول تحميل
let ytPlayer = null;
let ytReady = false;
let hlsInstance = null;
let mpegtsInstance = null;
let isDraggingProgress = false;
let progressInterval = null;
let syncTickInterval = null;
let bufferingDebounceTimer = null;
let bufferingSentToPeer = false;
let bufferingWatchdogTimer = null;
let triedHlsFallback = false; // لو رابط اتحدد "native" غلط وهو فعليًا بث HLS، نجرب مرة نحوّله تلقائيًا
let videoSeq = 0; // رقم تسلسلي بسيط لكل تحديث نبثّه (مساعد للتشخيص، مو حرج للمنطق)

// ---------- حجم المشغل الفعلي: يتبع شكل الفيديو الحقيقي، بدون مساحة سوداء زايدة ----------
let currentAspectRatio = 16 / 9;

function applyPlayerSize() {
  // مهم: نقيس العرض من #main-layout (عنصر ثابت، عرضه ما يعتمد على شيء داخله) مو من
  // قسم الفيديو نفسه. قبل كذا كنا نقيس rect.height لقسم الفيديو، لكن ارتفاع هذا القسم
  // أصلًا يتحدد من حجم المشغل الحالي (flex: 0 0 auto) — قياس دائري: أول قياس مبكر/خاطئ
  // يصير هو أساس القياس اللي بعده، فيثبت المشغل على حجم صغير (شكل بيضاوي أسود) ومايتصحح
  // إلا لما فيديو يتحمّل فعليًا. الحل: نقيس من عنصر خارجي ثابت، ونستخدم ارتفاع الشاشة
  // مباشرة كحد أقصى (بدل ارتفاع قسم يعتمد على نفسه)، ونرفض أي نتيجة غير منطقية.
  if (!mainLayoutEl) return;
  const layoutWidth = mainLayoutEl.clientWidth;
  if (layoutWidth < 10) return;
  const isFs = !!document.fullscreenElement;
  const maxW = Math.max(0, layoutWidth - 24); // نطرح بادنق .activity-panel اليمين/يسار تقريبًا
  const maxH = isFs ? window.innerHeight * 0.68 : window.innerHeight * 0.48;
  let w = maxW;
  let h = w / currentAspectRatio;
  if (h > maxH) {
    h = maxH;
    w = h * currentAspectRatio;
  }
  // صمام أمان: نرفض نكتب حجم صغير غير منطقي بدل ما نعلّق المشغل عليه
  if (w < 120 || h < 68) return;
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

// ---------- حالة أولية نظيفة عند دخول الغرفة (قبل أي فيديو) ----------
// بدون هذا، لو أي حالة قديمة تسربت (مثلًا شاشة الخطأ أو أدوات التحكم كانت ظاهرة من
// قبل)، المشغل يظهر بشكل مكسور أول ما تدخل الغرفة بدل ما يبين المكان الفاضي الطبيعي
// (الأيقونة + زر "أضف رابط الفيديو"). ننادي هذا مباشرة أول ما يتحمّل watch.js.
function resetPlayerToEmptyState() {
  placeholder.classList.remove('hidden');
  customControls.classList.add('hidden');
  bufferingOverlay.classList.add('hidden');
  playerError.classList.add('hidden');
  // زر "تغيير الفيديو" صار ثابت دائمًا بالهيدر (مو يظهر بس بعد أول تحميل فيديو)
}
resetPlayerToEmptyState();

// ---------- استمرار الفيديو عبر تحديث الصفحة (على فايربيس، مو تخزين المتصفح) ----------
// نحفظ آخر فيديو محمّل بنفس مستند الغرفة على فايربيس (rooms/{code}.currentVideo)، بدل
// تخزين المتصفح المحلي. سبب هذا: لما الصفحة تتحدث (F5) أو نرجع من صفحة مرجع، كل متغيرات
// جافاسكربت (منها currentVideoState) تنمسح، والمشغل يبين فاضي لين نجيب آخر حالة محفوظة.
// من المرحلة ٢: broadcastVideoState (تحت) هي اللي تكتب currentVideo الآن (بدل دالة
// منفصلة)، فهذا القسم صار بس عن قراءة الحالة المحفوظة عند الدخول/تحديث الصفحة.
// تُنادى من activateRoomMode بـcore.js (مو من هنا مباشرة) عشان نضمن إن رمز الغرفة صار
// معروف فعلًا (currentRoomCode) قبل ما نحاول نجيب أي شيء من فايربيس
async function restorePersistedVideoIfAny() {
  if (currentVideoType) return; // فيديو محمّل فعلًا بهذا التحميل (مثلًا جانا من صفحة مرجع)، لا نستبدله
  if (!currentRoomCode) return;
  try {
    const snap = await roomsDb.collection('rooms').doc(currentRoomCode).get();
    const saved = snap.exists ? snap.data().currentVideo : null;
    if (saved && saved.url && !currentVideoType) {
      currentVideoState = saved;
      loadVideo(saved.url, saved.type, false, saved.subUrl);
    }
  } catch (e) { /* تجاهل */ }
}

// ================= الفيديو =================

function detectVideoType(url) {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1], isShort: url.includes('/shorts/') };
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.m3u8')) return { type: 'hls' };
  if (clean.endsWith('.ts') || clean.endsWith('.m2ts')) return { type: 'mpegts' };
  // روابط مصدر "مرجع" (embed API) تجي ملفوفة ببروكسي (.../m3u8-proxy?url=...) فما ينتهي
  // مسارها بـ .m3u8 أبدًا رغم إنه بث HLS فعليًا — لو اعتمدنا بس على الامتداد بالأعلى
  // كانت تنكشف "native" غلط ويحاول المتصفح يشغلها كفيديو عادي فيفشل فورًا (تعذر تشغيل
  // هذا الرابط) — نتحقق أيضًا من نمط رابط البروكسي نفسه، ومن ".m3u8" لو ظهرت بأي مكان
  // بالرابط (حتى لو داخل باراميتر مرمّز) كاحتياط إضافي.
  if (/\/m3u8-proxy(?:[/?]|$)/i.test(url) || /\.m3u8(?:\?|&|%3f|%26|$)/i.test(url)) return { type: 'hls' };
  return { type: 'native' }; // mp4, mkv, webm, mov, m4v أو أي رابط ما نعرف امتداده - نخلي المتصفح يجرب
}

// يحمّل فيديو (مع ترجمة اختيارية) ويبث التحميل للطرف الثاني — أي طرف (مضيف أو ضيف) يقدر يسويها
function submitVideoUrl(url, subUrl) {
  if (!url) return;
  const info = detectVideoType(url);
  currentVideoState = { url, type: info.type, subUrl: subUrl || null };
  loadVideo(url, info.type, true, subUrl);
}

loadVideoBtn.addEventListener('click', () => {
  const url = videoUrlInput.value.trim();
  if (!url) return;
  submitVideoUrl(url, pendingSubtitleUrl);
  pendingSubtitleUrl = null; // ما نستخدمها إلا مرة وحدة (أول تحميل جاي من صفحة مرجع)
  closeVideoUrlPanel();
});
videoUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadVideoBtn.click(); });

// اللوحة منسدلة: مخفية افتراضيًا، وزر "تغيير الفيديو" ثابت دائمًا فوق بالهيدر يفتحها/يقفلها
function openVideoUrlPanel() {
  videoInputBar.classList.remove('hidden');
  videoUrlInput.value = '';
  videoUrlInput.focus();
}
function closeVideoUrlPanel() {
  videoInputBar.classList.add('hidden');
}
function toggleVideoUrlPanel() {
  if (videoInputBar.classList.contains('hidden')) openVideoUrlPanel();
  else closeVideoUrlPanel();
}

// زر "تغيير" بالشريط العلوي مشترك بين الوضعين (نفس الزر بالـDOM لكل الغرفة): بوضع
// "نتابع" يفتح خانة رابط فيديو جديد، وبوضع "نلعب" يرجّع لقائمة الألعاب بدل ما يكون
// بدون فايدة (games.js يعرّف exitToPicker، يتحمّل بعد watch.js فنتأكد إنها موجودة
// وقت الضغط الفعلي لا وقت التحميل)
changeVideoBtn.addEventListener('click', () => {
  if (roomMode === 'games') {
    if (typeof exitToPicker === 'function') {
      sendData({ kind: 'game-exit' });
      exitToPicker(true);
    }
  } else {
    toggleVideoUrlPanel();
  }
});
if (addVideoBtn) addVideoBtn.addEventListener('click', toggleVideoUrlPanel);

// ---------- المرحلة ٢ من خطة نقل التزامن: تزامن الفيديو بالكامل عبر Firestore ----------
// كل حركة (تحميل/تشغيل/إيقاف/تقديم/نبضة مزامنة/تهنيج) تُكتب بحقل rooms/{code}.currentVideo
// وحده (كتابة merge وحدة، مو عدة مستندات)، ويُتجاهل عندنا احنا أي تحديث كتبناه نفسنا
// عبر updatedBy (نفس فكرة senderId بالشات). التحديث المحلي يصير فورًا (نفس السلوك القديم)
// قبل ما ننتظر تأكيد الكتابة.
function broadcastVideoState(patch) {
  if (!currentRoomCode) return;
  videoSeq += 1;
  roomsDb.collection('rooms').doc(currentRoomCode).set(
    { currentVideo: Object.assign({ updatedBy: myDeviceId, seq: videoSeq }, patch) },
    { merge: true }
  ).catch(() => {});
}

// تُنادى من مستمع rooms/{code} المشترك بـcore.js (setupFirestoreChatSync) كل ما يتحدث
// حقل currentVideo - تتجاهل تحديثاتنا احنا، وتوزّع الباقي حسب action زي ما كانت
// dataConn.on('data') توزّع kind سابقًا.
function handleRemoteVideoUpdate(data) {
  if (!data || data.updatedBy === myDeviceId) return;
  switch (data.action) {
    case 'load':
      if (!currentVideoType || !currentVideoState || currentVideoState.url !== data.url) {
        currentVideoState = { url: data.url, type: data.type, subUrl: data.subUrl || null };
        closeVideoUrlPanel();
        loadVideo(data.url, data.type, false, data.subUrl);
      }
      break;
    case 'play': applyRemote('play', data.time); break;
    case 'pause': applyRemote('pause', data.time); break;
    case 'seek': applyRemote('seek', data.time); break;
    case 'sync-tick': applySyncTick(data.time, data.paused); break;
    case 'buffering-start': handleBufferingStart(); break;
    case 'buffering-end': handleBufferingEnd(); break;
  }
}

function destroyActiveEngines() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  if (mpegtsInstance) { mpegtsInstance.destroy(); mpegtsInstance = null; }
}

function loadVideo(url, type, broadcast, subUrl) {
  placeholder.classList.add('hidden');
  playerError.classList.add('hidden');
  customControls.classList.remove('hidden');
  bufferingOverlay.classList.add('hidden');
  clearTimeout(bufferingWatchdogTimer);
  bufferingSentToPeer = false;
  currentVideoType = type;

  changeVideoBtn.classList.remove('hidden');
  videoUrlInput.value = '';
  triedHlsFallback = false; // فيديو جديد = نسمح بمحاولة واحدة جديدة للتحويل التلقائي لـHLS لو احتجناه

  // الاثنين صاروا يتحكمون بالتشغيل/التقديم سوا، ما فيه "مشاهد فقط" بعد الآن
  playPauseBtn.classList.remove('hidden');
  progressTrack.classList.remove('disabled');

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

    // ترجمة عربية (لو جاتنا من مصدر يدعمها) — نحذف أي مسار قديم أول
    nativePlayer.querySelectorAll('track').forEach((t) => t.remove());
    if (subUrl) {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.srclang = 'ar';
      track.label = 'العربية';
      track.default = true;
      track.src = subUrl;
      track.addEventListener('load', () => { track.track.mode = 'showing'; });
      nativePlayer.appendChild(track);
    }
  }

  startProgressLoop();
  showControls();
  startHostSyncTicks(); // كلا الطرفين يبثون نبضة مزامنة الآن، مب المضيف بس

  if (broadcast) broadcastVideoState({ action: 'load', url, type, subUrl: subUrl || null });
}

function showPlayerError(msg) {
  playerErrorMsg.textContent = msg;
  playerError.classList.remove('hidden');
  customControls.classList.add('hidden');
}

// إعادة محاولة محلية بدون بث — أي طرف (المضيف أو الضيف) يقدر يعيد تحميل نفس الفيديو
// عنده لو تعثّر، بدل ما يكون عالقًا بدون أي حل غير إعادة فتح الصفحة كاملة
playerErrorRetry.addEventListener('click', () => {
  if (!currentVideoState) return;
  loadVideo(currentVideoState.url, currentVideoState.type, false, currentVideoState.subUrl);
});

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
  if (ytReady) { start(); return; }
  // لو سكربت يوتيوب محجوب (مانع إعلانات أو فلترة شبكة) window.onYouTubeIframeAPIReady ما
  // ينادى أبدًا، وكان الكود قبل كذا يفضل يتحقق كل ٣٠٠ مل ثانية للأبد بدون أي رسالة —
  // فيبين المشغل أسود وما يصير أي شيء ظاهريًا. نحط سقف ٨ ثواني وبعده نعرض خطأ واضح.
  let waited = 0;
  const check = setInterval(() => {
    if (ytReady) {
      clearInterval(check);
      start();
      return;
    }
    waited += 300;
    if (waited >= 8000) {
      clearInterval(check);
      showPlayerError('تعذر تحميل مشغل يوتيوب — تأكد من اتصال الإنترنت أو جرّب تعطيل مانع الإعلانات');
    }
  }, 300);
}

function onYouTubeStateChange(e) {
  updatePlayIcon(e.data === YT.PlayerState.PLAYING);
  if (e.data === YT.PlayerState.PLAYING) markBufferingEnded();
  if (suppressSync) return;
  const time = ytPlayer.getCurrentTime();
  if (e.data === YT.PlayerState.PLAYING) broadcastVideoState({ action: 'play', time });
  else if (e.data === YT.PlayerState.PAUSED) broadcastVideoState({ action: 'pause', time });
  else if (e.data === YT.PlayerState.BUFFERING) markBufferingStarted();
}

// ---------- فيديو مباشر (mp4 / mkv / webm / hls / mpegts) ----------
function attachNativeEvents() {
  nativePlayer.onplay = () => {
    updatePlayIcon(true);
    if (suppressSync) return;
    broadcastVideoState({ action: 'play', time: nativePlayer.currentTime });
  };
  nativePlayer.onpause = () => {
    updatePlayIcon(false);
    if (suppressSync) return;
    broadcastVideoState({ action: 'pause', time: nativePlayer.currentTime });
  };
  nativePlayer.onseeked = () => {
    if (suppressSync) return;
    broadcastVideoState({ action: 'seek', time: nativePlayer.currentTime });
  };
  nativePlayer.onwaiting = () => { if (!suppressSync) markBufferingStarted(); };
  nativePlayer.onplaying = () => { markBufferingEnded(); };
  // مهم: لما نستقبل buffering-start من الطرف الثاني، نوقف مشغلنا نحن ريثما يجهز —
  // لكن التوقف المتعمد هذا يمنع onplaying من الاشتغال مرة ثانية (هو بس يشتغل لما
  // التشغيل يرجع فعليًا)، فلو الاثنين متوقفين بانتظار بعض بنفس اللحظة نوصل لقفلة ما
  // تنفك (كل واحد ينتظر إشارة "جاهز" من الثاني وما احد يقدر يرسلها). oncanplay يشتغل
  // بمجرد ما الفيديو يصير جاهز للتشغيل حتى وهو متوقف، فيكسر هالقفلة.
  nativePlayer.oncanplay = () => { markBufferingEnded(); };
  nativePlayer.onerror = () => {
    // نسجل تفاصيل الخطأ الحقيقي بالكونسول (رقم/نوع الخطأ + الرابط) عشان تشخيص أي
    // مشكلة مستقبلية يصير أسهل، بدل ما نعرف بس "تعذر تشغيل" بدون أي تفاصيل.
    const code = nativePlayer.error && nativePlayer.error.code;
    const CODE_NAMES = { 1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED' };
    console.warn('[video error]', CODE_NAMES[code] || code, nativePlayer.currentSrc);

    // بعض روابط "مرجع" (بروكسي HLS) ما تنطبق على النمط اللي نكتشف منه نوع HLS بـ
    // detectVideoType (مثلًا شكل بروكسي مختلف)، فتتحمّل كـ"native" غلط والمتصفح يفشل
    // فورًا (SRC_NOT_SUPPORTED) لأنه مانع يشغّل ملف m3u8 مباشرة. قبل ما نستسلم، نجرب
    // مرة وحدة تشغيلها عبر Hls.js بدل ما نعرض خطأ نهائي مباشرة.
    if (!triedHlsFallback && currentVideoType === 'native' && code === 4 && window.Hls && Hls.isSupported()) {
      triedHlsFallback = true;
      const url = nativePlayer.currentSrc;
      destroyActiveEngines();
      currentVideoType = 'hls';
      hlsInstance = new Hls({
        maxBufferLength: 60,
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
          else showPlayerError('تعذر تشغيل هذا الرابط');
        }
      });
      hlsInstance.loadSource(url);
      hlsInstance.attachMedia(nativePlayer);
      return;
    }

    showPlayerError('تعذر تشغيل هذا الرابط');
  };
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
      broadcastVideoState({ action: 'buffering-start' });
    }
  }, BUFFER_DEBOUNCE_MS);
}
function markBufferingEnded() {
  clearTimeout(bufferingDebounceTimer);
  if (bufferingSentToPeer) {
    bufferingSentToPeer = false;
    broadcastVideoState({ action: 'buffering-end' });
  }
}

function handleBufferingStart() {
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
}

function handleBufferingEnd() {
  clearTimeout(bufferingWatchdogTimer);
  bufferingOverlay.classList.add('hidden');
  suppressSync = true;
  if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.playVideo();
  else if (nativePlayer) nativePlayer.play();
  setTimeout(() => (suppressSync = false), 400);
}

// ---------- مزامنة دورية (المضيف هو مصدر الحقيقة) ----------
function startHostSyncTicks() {
  if (syncTickInterval) clearInterval(syncTickInterval);
  syncTickInterval = setInterval(() => {
    if (!currentVideoType) return;
    broadcastVideoState({ action: 'sync-tick', time: playerGetCurrentTime(), paused: playerIsPaused() });
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
  if (playerIsPaused()) {
    if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.playVideo();
    else nativePlayer.play();
  } else {
    if (currentVideoType === 'youtube' && ytPlayer) ytPlayer.pauseVideo();
    else nativePlayer.pause();
  }
});

function skipBy(seconds) {
  if (!currentVideoType) return;
  const duration = playerGetDuration();
  let newTime = playerGetCurrentTime() + seconds;
  if (duration > 0) newTime = Math.min(duration - 0.5, newTime);
  newTime = Math.max(0, newTime);
  playerSeek(newTime);
  setProgressUI(duration > 0 ? newTime / duration : 0);
  timeCurrent.textContent = formatTime(newTime);
  broadcastVideoState({ action: 'seek', time: newTime });
  showControls();
}

skipBackBtn.addEventListener('click', () => skipBy(-10));
skipFwdBtn.addEventListener('click', () => skipBy(10));

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
playerContainer.addEventListener('click', (e) => {
  if (customControls.contains(e.target)) return; // ضغطة على أحد الأزرار نفسها، ما نتدخل
  if (customControls.classList.contains('controls-hidden')) {
    showControls();
  } else {
    clearTimeout(hideControlsTimer);
    customControls.classList.add('controls-hidden');
  }
});
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
  isDraggingProgress = true;
  progressTrack.classList.add('dragging');
  setProgressUI(fractionFromPointer(e));
  progressTrack.setPointerCapture(e.pointerId);
});
progressTrack.addEventListener('pointermove', (e) => {
  if (!isDraggingProgress) return;
  setProgressUI(fractionFromPointer(e));
});
progressTrack.addEventListener('pointerup', (e) => {
  if (!isDraggingProgress) return;
  isDraggingProgress = false;
  progressTrack.classList.remove('dragging');
  const duration = playerGetDuration();
  const newTime = fractionFromPointer(e) * duration;
  playerSeek(newTime);
  broadcastVideoState({ action: 'seek', time: newTime });
});

// ================= استقبال فيديو من صفحة "مرجع" =================
// إذا فتحنا الرابط بباراميتر ?video=... (جاي من صفحة مرجع)، إما ننشئ غرفة "نتابع"
// جديدة، أو (لو كنا أصلًا بغرفة) نرجع لنفس الغرفة ونحمّل الفيديو فيها مباشرة.
(function initFromReference() {
  const params = new URLSearchParams(window.location.search);
  const incomingUrl = params.get('video');
  if (!incomingUrl) return;

  // ملاحظة: URLSearchParams.get() يرجّع القيمة مفكوكة الترميز أصلًا — فك ترميز ثاني هنا
  // كان يفشل (URIError) على أي رابط فيه علامة % مو جزء من ترميز صحيح، ويوقف التحميل
  // بالكامل بصمت. هذا على الأغلب سبب "تعذر تشغيل الرابط" المتقطع.
  const pendingVideoUrl = incomingUrl;
  pendingSubtitleUrl = params.get('subUrl') || null;
  const isPermanentVideo = params.get('permanentVideo') === '1';
  history.replaceState(null, '', window.location.pathname); // ننظف الرابط من الباراميتر

  // لو ما فيه جلسة محفوظة (دخول أول مرة من غير غرفة سابقة)، نجهز خطوة "إنشاء غرفة نتابع"
  // - إلا لو جاي من "مرجع" بغرفتنا الدائمة (permanentVideo=1)، فوقتها ندخل مباشرة
  // لفئة "نتابع" بنفس رمزنا الدائم بدل ما ننشئ غرفة مؤقتة عشوائية. الكود هنا مكرر
  // عمدًا عن joinPermanentMode بpermanent.js (بدل ما ننادي تلك الدالة مباشرة) لأن
  // permanent.js يتحمّل بالتوازي مع هذا الملف وممكن ما يكون وصل لحظة تنفيذ هذا
  // السطر - بينما كل شي نستخدمه هنا (beginAsHost, isPermanentFlow...) من core.js
  // اللي متأكدين إنه محمّل قبلنا دايمًا.
  if (!storedSession) {
    const permCode = localStorage.getItem('wt_permanent_code');
    const permName = localStorage.getItem('wt_permanent_name');
    if (isPermanentVideo && permCode && permName) {
      const meetingCode = permCode + '_watch';
      isPermanentFlow = true;
      permanentFallbackDone = false;
      switchCategoryBtn.classList.remove('hidden');
      requestNotificationPermission();
      beginAsHost(meetingCode, permName, 'watch');
    } else {
      pendingMode = 'watch';
      confirmCreateText.textContent = MODE_CREATE_LABELS.watch;
      goToStep(entryStepCreate);
      nameInputCreate.focus();
    }
  }

  // أي طرف يقدر يحمّل الفيديو ويبثه للثاني الآن (مو المضيف بس) — أول واحد توصله الغرفة
  // جاهزة (روم-سكرين ظاهرة) يحمّله مباشرة.
  const tryDeliver = () => {
    if (roomScreen.classList.contains('hidden')) return false;
    submitVideoUrl(pendingVideoUrl, pendingSubtitleUrl);
    pendingSubtitleUrl = null;
    return true;
  };

  const watcher = setInterval(() => {
    if (tryDeliver()) clearInterval(watcher);
  }, 200);
  setTimeout(() => clearInterval(watcher), 20000); // نتوقف بعد ٢٠ ثانية لو تعذر الاتصال
})();
