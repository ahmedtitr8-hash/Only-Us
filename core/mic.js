// ============================================================
// mic.js
// قسم "المايك" كامل: تشغيل/إيقاف المايك، بث/استقبال صوت المكالمة عبر
// PeerJS (peer.call — الشيء الوحيد الباقي على WebRTC المباشر، بدون
// Firestore)، وحالة المايك النصية (broadcastMicState، تُقرأ بـchat.js
// عند استقبالها). يعتمد على peer/remotePeerId/isHost/currentRoomCode
// (من connection.js) وهي متاحة تلقائيًا لأنها بنفس النطاق العام.
// ============================================================

// ---------- عناصر المايك ----------
const micBtn = document.getElementById('mic-btn');
const callVolumeSlider = document.getElementById('call-volume');
const remoteVolumeSlider = callVolumeSlider; // اسم مستعار أوضح بمكان الاستخدام بالأسفل
const peerMicIndicator = document.getElementById('peer-mic-indicator');
const remoteAudio = document.getElementById('remote-audio');

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
  micBtn.querySelector('.icon-mic-on').classList.remove('hidden');
  micBtn.querySelector('.icon-mic-off').classList.add('hidden');
  broadcastMicState(true);
  reconnectCallWithCurrentStream();
}

function stopMic() {
  micOn = false;
  micBtn.classList.remove('mic-active');
  micBtn.title = 'تشغيل المايك';
  micBtn.querySelector('.icon-mic-on').classList.add('hidden');
  micBtn.querySelector('.icon-mic-off').classList.remove('hidden');
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

// حالة المايك النصية (تشغيل/إيقاف - النص لا الصوت نفسه) - حقل rooms/{code}.mic بشكلين
// منفصلين (hostOn/guestOn) بدل senderId: كل طرف يقرأ حقل الطرف الثاني بس، فما يحتاج
// نتجاهل كتاباتنا احنا (نقرأ أصلًا حقل ثاني غير اللي نكتبه). القراءة (تحديث أيقونة
// peerMicIndicator) تصير بـchat.js جوا setupFirestoreChatSync لأنها جزء من نفس
// onSnapshot المركزي لمستند الغرفة.
function broadcastMicState(on) {
  if (!currentRoomCode) return;
  const patch = isHost ? { hostOn: on } : { guestOn: on };
  roomsDb.collection('rooms').doc(currentRoomCode).set({ mic: patch }, { merge: true }).catch(() => {});
}
