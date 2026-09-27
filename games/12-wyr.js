// ============================================================
// wyr.js
// منطق لعبة "لو خيروك" (الأسئلة/الإجابات/التقدّم). يعتمد على games-core.js
// (broadcastGameState، toArabicDigits) وعلى WYR_BANK من
// wyr-questions.js. لازم يتحمّل بعد الاثنين.
//
// نفس منطق compat.js بالضبط (ما فيه إجابة صح/غلط - كل واحد يجاوب سري،
// وبعد ما يجاوب الطرفين تنكشف الاختيارات مع بعض ونشوف تطابقتوا أو لا)،
// بس ببنك أسئلة "لو خيروك" المختلف.
// ============================================================

let wyrOrder = [];
let wyrIndex = 0;
let wyrMyAnswer = null;
let wyrPeerAnswer = null;
let wyrRoundActive = true;
let wyrMatches = 0;

function shuffledWyrOrder() {
  const idx = WYR_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 10);
}

function resetWyrMatch(order) {
  wyrOrder = order && order.length ? order : shuffledWyrOrder();
  wyrIndex = 0;
  wyrMatches = 0;
  document.getElementById('wyr-restart-btn').classList.add('hidden');
  document.getElementById('wyr-next-btn').classList.add('hidden');
  document.getElementById('wyr-options').classList.remove('hidden');
  document.getElementById('wyr-waiting').classList.add('hidden');
  loadWyrQuestion();
}

function loadWyrQuestion() {
  wyrMyAnswer = null;
  wyrPeerAnswer = null;
  wyrRoundActive = true;
  const q = WYR_BANK[wyrOrder[wyrIndex]];
  document.getElementById('wyr-progress').textContent = `سؤال ${toArabicDigits(wyrIndex + 1)} من ${toArabicDigits(wyrOrder.length)}`;
  document.getElementById('wyr-question').textContent = q.q;
  document.getElementById('wyr-score').textContent = `تطابقتوا في ${toArabicDigits(wyrMatches)} من ${toArabicDigits(wyrIndex)}`;
  document.querySelectorAll('.wyr-option').forEach((btn, i) => {
    const has = i < q.options.length;
    btn.classList.toggle('hidden', !has);
    if (has) btn.textContent = q.options[i];
    btn.disabled = false;
    btn.classList.remove('match', 'my-pick', 'peer-pick');
  });
  document.getElementById('wyr-options').classList.remove('hidden');
  document.getElementById('wyr-waiting').classList.add('hidden');
  document.getElementById('wyr-result-note').textContent = '';
  document.getElementById('wyr-next-btn').classList.add('hidden');
}

document.querySelectorAll('.wyr-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!wyrRoundActive) return;
    const idx = Number(btn.dataset.idx);
    wyrMyAnswer = idx;
    document.querySelectorAll('.wyr-option').forEach((b) => (b.disabled = true));
    btn.classList.add('my-pick');
    document.getElementById('wyr-waiting').textContent = `بانتظار ${peerName || 'شريكك'} يجاوب...`;
    document.getElementById('wyr-waiting').classList.toggle('hidden', wyrPeerAnswer !== null);
    broadcastGameState({ type: 'move', game: 'wyr', answer: idx });
    checkWyrResolve();
  });
});

function checkWyrResolve() {
  if (!wyrRoundActive || wyrMyAnswer === null || wyrPeerAnswer === null) return;
  wyrRoundActive = false;
  document.getElementById('wyr-waiting').classList.add('hidden');
  const isMatch = wyrMyAnswer === wyrPeerAnswer;
  if (isMatch) {
    wyrMatches++;
    const matchBtn = document.querySelector(`.wyr-option[data-idx="${wyrMyAnswer}"]`);
    matchBtn.classList.remove('my-pick');
    matchBtn.classList.add('match');
    document.getElementById('wyr-result-note').textContent = 'تطابقتوا! 💞';
  } else {
    document.querySelector(`.wyr-option[data-idx="${wyrMyAnswer}"]`).classList.add('my-pick');
    document.querySelector(`.wyr-option[data-idx="${wyrPeerAnswer}"]`).classList.add('peer-pick');
    document.getElementById('wyr-result-note').textContent = 'اخترتوا إجابات مختلفة هالمرة';
  }
  document.getElementById('wyr-score').textContent = `تطابقتوا في ${toArabicDigits(wyrMatches)} من ${toArabicDigits(wyrIndex + 1)}`;
  document.getElementById('wyr-next-btn').classList.remove('hidden');
  document.getElementById('wyr-next-btn').textContent = (wyrIndex + 1 < wyrOrder.length) ? 'السؤال التالي' : 'عرض النتيجة';
}

document.getElementById('wyr-next-btn').addEventListener('click', () => {
  const from = wyrIndex;
  broadcastGameState({ type: 'move', game: 'wyr-next', index: from });
  advanceWyr(from);
});

function advanceWyr(fromIndex) {
  // لو ضغط الطرفين "التالي" بنفس اللحظة، الرسالة اللي توصل من سؤال سبق وتجاوزناه تُتجاهل
  if (fromIndex !== undefined && fromIndex !== wyrIndex) return;
  if (wyrIndex + 1 < wyrOrder.length) {
    wyrIndex++;
    loadWyrQuestion();
  } else {
    showWyrFinal();
  }
}

function showWyrFinal() {
  const status = document.getElementById('wyr-question');
  status.textContent = `انتهت الأسئلة! تطابقتوا في ${toArabicDigits(wyrMatches)} من ${toArabicDigits(wyrOrder.length)} سؤال`;
  document.getElementById('wyr-progress').textContent = '';
  document.getElementById('wyr-result-note').textContent = '';
  document.getElementById('wyr-options').classList.add('hidden');
  document.getElementById('wyr-waiting').classList.add('hidden');
  document.getElementById('wyr-next-btn').classList.add('hidden');
  document.getElementById('wyr-restart-btn').classList.remove('hidden');
}

document.getElementById('wyr-restart-btn').addEventListener('click', () => {
  const order = shuffledWyrOrder();
  resetWyrMatch(order);
  broadcastGameState({ type: 'restart', game: 'wyr', layout: order });
});
