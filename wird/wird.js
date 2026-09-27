// ============================================================
// wird.js
// فئة "وِرد": محتوى ثابت (أذكار صباح/مساء/نوم، كل وحدة مختصر/كامل)
// + تشيك أسبوعي مشترك يتجدد كل أسبوع (يعتمد على roomsDb/currentRoomCode/
// isHost/myDeviceId/peerName المعرّفة أصلًا بـcore.js/connection.js - نفس
// أسلوب games/*.js وpermanent.js بالضبط، بدون أي منطق خاص إضافي).
// ============================================================

// ---------- بنك المحتوى (بيانات ثابتة بحتة) ----------
const WIRD_CONTENT = {
  morning: {
    short: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس)', count: '٣ مرات لكل وحدة' },
      { text: 'سيد الاستغفار: "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك..."', count: 'مرة' },
      { text: 'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له...', count: 'مرة' },
    ],
    full: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس)', count: '٣ مرات لكل وحدة' },
      { text: 'سيد الاستغفار: "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك..."', count: 'مرة' },
      { text: 'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له...', count: 'مرة' },
      { text: 'اللهم بك أصبحنا، وبك أمسينا، وبك نحيا، وبك نموت، وإليك النشور', count: 'مرة' },
      { text: 'اللهم إني أصبحت أشهدك، وأشهد حملة عرشك، وملائكتك، وجميع خلقك، أنك أنت الله لا إله إلا أنت وأن محمدًا عبدك ورسولك', count: '٤ مرات' },
      { text: 'اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري، لا إله إلا أنت', count: '٣ مرات' },
      { text: 'اللهم إني أسألك العفو والعافية في الدنيا والآخرة', count: '٣ مرات' },
      { text: 'حسبي الله لا إله إلا هو، عليه توكلت وهو رب العرش العظيم', count: '٧ مرات' },
      { text: 'رضيت بالله ربًا، وبالإسلام دينًا، وبمحمد ﷺ نبيًا', count: '٣ مرات' },
      { text: 'سبحان الله وبحمده', count: '١٠٠ مرة' },
      { text: 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير', count: '١٠ مرات (أو مرة)' },
      { text: 'أستغفر الله وأتوب إليه', count: '١٠٠ مرة' },
    ],
  },
  evening: {
    short: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس)', count: '٣ مرات لكل وحدة' },
      { text: 'سيد الاستغفار: "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك..."', count: 'مرة' },
      { text: 'أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له...', count: 'مرة' },
    ],
    full: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس)', count: '٣ مرات لكل وحدة' },
      { text: 'سيد الاستغفار: "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك..."', count: 'مرة' },
      { text: 'أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له...', count: 'مرة' },
      { text: 'اللهم بك أمسينا، وبك أصبحنا، وبك نحيا، وبك نموت، وإليك المصير', count: 'مرة' },
      { text: 'اللهم إني أمسيت أشهدك، وأشهد حملة عرشك، وملائكتك، وجميع خلقك، أنك أنت الله لا إله إلا أنت وأن محمدًا عبدك ورسولك', count: '٤ مرات' },
      { text: 'اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري، لا إله إلا أنت', count: '٣ مرات' },
      { text: 'اللهم إني أسألك العفو والعافية في الدنيا والآخرة', count: '٣ مرات' },
      { text: 'حسبي الله لا إله إلا هو، عليه توكلت وهو رب العرش العظيم', count: '٧ مرات' },
      { text: 'رضيت بالله ربًا، وبالإسلام دينًا، وبمحمد ﷺ نبيًا', count: '٣ مرات' },
      { text: 'سبحان الله وبحمده', count: '١٠٠ مرة' },
      { text: 'أستغفر الله وأتوب إليه', count: '١٠٠ مرة' },
    ],
  },
  sleep: {
    short: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس) - تُقرأ وتُنفث بها اليدين ثم تُمسح على الجسد', count: '٣ مرات' },
      { text: 'تسبيح فاطمة: سبحان الله، الحمد لله، الله أكبر', count: '٣٣ / ٣٣ / ٣٤' },
    ],
    full: [
      { text: 'آية الكرسي: "الله لا إله إلا هو الحي القيوم..."', count: 'مرة' },
      { text: 'قل هو الله أحد، والمعوذتين (الفلق والناس) - تُقرأ وتُنفث بها اليدين ثم تُمسح على الجسد', count: '٣ مرات' },
      { text: 'تسبيح فاطمة: سبحان الله، الحمد لله، الله أكبر', count: '٣٣ / ٣٣ / ٣٤' },
      { text: 'آخر آيتين من سورة البقرة: "آمن الرسول بما أنزل إليه من ربه..."', count: 'مرة' },
      { text: 'باسمك اللهم أموت وأحيا', count: 'مرة' },
      { text: 'اللهم أسلمت نفسي إليك، وفوضت أمري إليك، وألجأت ظهري إليك...', count: 'مرة' },
      { text: 'اللهم قني عذابك يوم تبعث عبادك', count: '٣ مرات' },
    ],
  },
};

const WIRD_SECTION_LABELS = { morning: 'الصباح', evening: 'المساء', sleep: 'النوم' };

let wirdSection = 'morning';
let wirdVersion = 'short';

// ---------- عناصر DOM ----------
const wirdTabsEl = document.getElementById('wird-tabs');
const wirdVersionToggleEl = document.getElementById('wird-version-toggle');
const wirdListEl = document.getElementById('wird-list');
const wirdCheckMeBtn = document.getElementById('wird-check-me');
const wirdCheckSubEl = document.getElementById('wird-check-sub');
const wirdCheckPeerLabelEl = document.getElementById('wird-check-peer-label');
const wirdCheckPeerBadgeEl = document.getElementById('wird-check-peer-badge');

function renderWirdList() {
  const items = WIRD_CONTENT[wirdSection][wirdVersion];
  wirdListEl.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'wird-item';
    const text = document.createElement('span');
    text.className = 'wird-item-text';
    text.textContent = item.text;
    const count = document.createElement('span');
    count.className = 'wird-item-count';
    count.textContent = item.count;
    row.appendChild(text);
    row.appendChild(count);
    wirdListEl.appendChild(row);
  });
}

wirdTabsEl.querySelectorAll('.wird-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdSection = btn.dataset.wirdSection;
    wirdTabsEl.querySelectorAll('.wird-tab').forEach((b) => b.classList.toggle('active', b === btn));
    renderWirdList();
  });
});

wirdVersionToggleEl.querySelectorAll('.wird-version-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    wirdVersion = btn.dataset.wirdVersion;
    wirdVersionToggleEl.querySelectorAll('.wird-version-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderWirdList();
  });
});

renderWirdList();

// ================= التشيك الأسبوعي المشترك =================
// نخزّن بمستند الغرفة rooms/{code}.wird = { weekKey, hostDone, guestDone }.
// weekKey يتغيّر كل أسبوع تلقائيًا (رقم سنة+رقم أسبوع تقريبي) - لو مختلف عن
// المخزّن نتعامل مع الاثنين كـ"لسا" بدون ما نحتاج مسح فعلي، ويصير التحديث
// الرسمي بمستند الغرفة أول ما أحد يضغط التشيك بالأسبوع الجديد.
function currentWirdWeekKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - start) / 86400000);
  const week = Math.floor(dayOfYear / 7);
  return `${now.getFullYear()}-${week}`;
}

let wirdState = { weekKey: currentWirdWeekKey(), hostDone: false, guestDone: false };

function renderWirdCheckUI() {
  const myDone = isHost ? wirdState.hostDone : wirdState.guestDone;
  const peerDone = isHost ? wirdState.guestDone : wirdState.hostDone;
  wirdCheckMeBtn.classList.toggle('done', myDone);
  wirdCheckPeerBadgeEl.textContent = peerDone ? 'خلّص' : 'لسا';
  wirdCheckPeerBadgeEl.classList.toggle('done', peerDone);
  wirdCheckPeerLabelEl.textContent = (typeof peerName !== 'undefined' && peerName) ? peerName : 'الطرف الثاني';
  wirdCheckSubEl.textContent = 'يتجدد تلقائيًا كل أسبوع';
}

function applyWirdState(data) {
  const wk = currentWirdWeekKey();
  if (data && data.weekKey === wk) {
    wirdState = { weekKey: wk, hostDone: !!data.hostDone, guestDone: !!data.guestDone };
  } else {
    wirdState = { weekKey: wk, hostDone: false, guestDone: false };
  }
  renderWirdCheckUI();
}

function broadcastWirdCheck() {
  if (!currentRoomCode) return;
  const patch = { weekKey: wirdState.weekKey };
  if (isHost) patch.hostDone = wirdState.hostDone;
  else patch.guestDone = wirdState.guestDone;
  roomsDb.collection('rooms').doc(currentRoomCode).set(
    { wird: Object.assign({ updatedBy: myDeviceId }, patch) },
    { merge: true }
  ).catch(() => {});
}

wirdCheckMeBtn.addEventListener('click', () => {
  const wk = currentWirdWeekKey();
  if (wirdState.weekKey !== wk) wirdState = { weekKey: wk, hostDone: false, guestDone: false };
  if (isHost) wirdState.hostDone = !wirdState.hostDone;
  else wirdState.guestDone = !wirdState.guestDone;
  renderWirdCheckUI();
  broadcastWirdCheck();
});

// تُنادى من setupFirestoreChatSync بـchat.js كل ما يتحدث حقل wird بمستند الغرفة
// (نفس أسلوب handleRemoteGameState بالضبط)
function handleRemoteWirdUpdate(data) {
  applyWirdState(data);
}

// أول دخول للفئة (تُنادى من activateRoomMode بـconnection.js لمّا mode === 'wird')-
// نجيب حالة التشيك المخزّنة حاليًا مرة وحدة (مو onSnapshot، لأن أول snapshot بمستمع
// chat.js المركزي يُتجاهل عمدًا لأسباب فيديو/ألعاب، فما ينفع نعتمد عليه هنا)
function initWirdPanel() {
  if (!currentRoomCode) return;
  roomsDb.collection('rooms').doc(currentRoomCode).get().then((doc) => {
    const data = doc.exists ? doc.data() : null;
    applyWirdState(data && data.wird);
  }).catch(() => {});
}

renderWirdCheckUI();
