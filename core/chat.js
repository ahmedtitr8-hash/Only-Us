// ============================================================
// chat.js
// قسم "الشات" كامل: عرض الرسائل، إرسالها، مزامنتها عبر Firestore،
// مؤشر "يكتب الآن"، وإشعارات الرسائل الجديدة (عنوان التبويب +
// Notification API). يعتمد على roomsDb/myDeviceId/currentRoomCode/
// myName (من connection.js) ونسخ الرمز/الأفاتار (من ui-shared.js عبر
// nameToColor)، وهي متاحة تلقائيًا لأنها بنفس النطاق العام.
// ============================================================

// ---------- عناصر الشات ----------
const chatMessages = document.getElementById('chat-messages');
const chatEmpty = document.getElementById('chat-empty');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatForm = document.getElementById('chat-form');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');

let lastMessageSender = null;

initEditableField(chatInput, { maxLength: 500 });

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
// ملاحظة: هذي الدالة صارت أيضًا المستمع المركزي لمستند الغرفة كامل (مو الرسائل بس) —
// "يكتب الآن" (شات)، الفيديو الحي (watch.js)، حركة الألعاب (games/*.js)، وحالة المايك
// النصية (mic.js) كلها توصل عبر نفس onSnapshot هنا تحت. بقيت هنا بدل ما تنفصل لأنها
// أصلًا استماع Firestore واحد لمستند الغرفة، وتفكيكها لعدة onSnapshot منفصلة يكلف أداء
// بلا داعي.
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

function sendChat() {
  const text = getFieldValue(chatInput).trim();
  if (!text) return;
  addMessage(myName, text, true);
  setFieldValue(chatInput, '');
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
// الإدخال صار <div contenteditable> (شوف field-editable.js) مو <input>، فما يعود
// يسوّي submit تلقائي للفورم بالضغط على Enter زي ما كان يصير مع input داخل form؛
// فنمسك Enter يدويًا هنا ونستدعي sendChat مباشرة. زر الإرسال (type=submit) يضل
// يشتغل عبر حدث submit العادي للفورم.
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendChat();
});
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
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

// ================= إشعارات الرسائل الجديدة (عنوان التبويب + Notification API) =================

const originalTitle = document.title;
let unreadCount = 0;

// تصفير العنوان لما نرجع للتبويب - منفصل عمدًا عن مستمع visibilitychange تبع إعادة
// الاتصال بـconnection.js (كل ملف يبقى مسؤول عن همّه بس)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    unreadCount = 0;
    document.title = originalTitle;
  }
});

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
