// ============================================================
// compat.js
// منطق لعبة "توافق" (الأسئلة/الإجابات/التقدّم). يعتمد على games-core.js
// (broadcastGameState، toArabicDigits) وعلى COMPAT_BANK من
// compat-questions.js. لازم يتحمّل بعد الاثنين.
//
// الفرق عن trivia.js: ما فيه إجابة صح/غلط - كل واحد يجاوب سري، وبعد
// ما يجاوب الطرفين تنكشف الاختيارات مع بعض ونشوف تطابقتوا أو لا.
// ============================================================

let compatOrder = [];
let compatIndex = 0;
let compatMyAnswer = null;
let compatPeerAnswer = null;
let compatRoundActive = true;
let compatMatches = 0;

function shuffledCompatOrder() {
  const idx = COMPAT_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 10);
}

function resetCompatMatch(order) {
  compatOrder = order && order.length ? order : shuffledCompatOrder();
  compatIndex = 0;
  compatMatches = 0;
  document.getElementById('compat-restart-btn').classList.add('hidden');
  document.getElementById('compat-next-btn').classList.add('hidden');
  document.getElementById('compat-options').classList.remove('hidden');
  document.getElementById('compat-waiting').classList.add('hidden');
  loadCompatQuestion();
}

function loadCompatQuestion() {
  compatMyAnswer = null;
  compatPeerAnswer = null;
  compatRoundActive = true;
  const q = COMPAT_BANK[compatOrder[compatIndex]];
  document.getElementById('compat-progress').textContent = `سؤال ${toArabicDigits(compatIndex + 1)} من ${toArabicDigits(compatOrder.length)}`;
  document.getElementById('compat-question').textContent = q.q;
  document.getElementById('compat-score').textContent = `تطابقتوا في ${toArabicDigits(compatMatches)} من ${toArabicDigits(compatIndex)}`;
  document.querySelectorAll('.compat-option').forEach((btn, i) => {
    const has = i < q.options.length;
    btn.classList.toggle('hidden', !has);
    if (has) btn.textContent = q.options[i];
    btn.disabled = false;
    btn.classList.remove('match', 'my-pick', 'peer-pick');
  });
  document.getElementById('compat-options').classList.remove('hidden');
  document.getElementById('compat-waiting').classList.add('hidden');
  document.getElementById('compat-result-note').textContent = '';
  document.getElementById('compat-next-btn').classList.add('hidden');
}

document.querySelectorAll('.compat-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!compatRoundActive) return;
    const idx = Number(btn.dataset.idx);
    compatMyAnswer = idx;
    document.querySelectorAll('.compat-option').forEach((b) => (b.disabled = true));
    btn.classList.add('my-pick');
    document.getElementById('compat-waiting').textContent = `بانتظار ${peerName || 'شريكك'} يجاوب...`;
    document.getElementById('compat-waiting').classList.toggle('hidden', compatPeerAnswer !== null);
    broadcastGameState({ type: 'move', game: 'compat', answer: idx });
    checkCompatResolve();
  });
});

function checkCompatResolve() {
  if (!compatRoundActive || compatMyAnswer === null || compatPeerAnswer === null) return;
  compatRoundActive = false;
  document.getElementById('compat-waiting').classList.add('hidden');
  const isMatch = compatMyAnswer === compatPeerAnswer;
  if (isMatch) {
    compatMatches++;
    const matchBtn = document.querySelector(`.compat-option[data-idx="${compatMyAnswer}"]`);
    matchBtn.classList.remove('my-pick');
    matchBtn.classList.add('match');
    document.getElementById('compat-result-note').textContent = 'تطابقتوا! 💞';
  } else {
    document.querySelector(`.compat-option[data-idx="${compatMyAnswer}"]`).classList.add('my-pick');
    document.querySelector(`.compat-option[data-idx="${compatPeerAnswer}"]`).classList.add('peer-pick');
    document.getElementById('compat-result-note').textContent = 'اخترتوا إجابات مختلفة هالمرة';
  }
  document.getElementById('compat-score').textContent = `تطابقتوا في ${toArabicDigits(compatMatches)} من ${toArabicDigits(compatIndex + 1)}`;
  document.getElementById('compat-next-btn').classList.remove('hidden');
  document.getElementById('compat-next-btn').textContent = (compatIndex + 1 < compatOrder.length) ? 'السؤال التالي' : 'عرض النتيجة';
}

document.getElementById('compat-next-btn').addEventListener('click', () => {
  const from = compatIndex;
  broadcastGameState({ type: 'move', game: 'compat-next', index: from });
  advanceCompat(from);
});

function advanceCompat(fromIndex) {
  // لو ضغط الطرفين "التالي" بنفس اللحظة، الرسالة اللي توصل من سؤال سبق وتجاوزناه تُتجاهل
  if (fromIndex !== undefined && fromIndex !== compatIndex) return;
  if (compatIndex + 1 < compatOrder.length) {
    compatIndex++;
    loadCompatQuestion();
  } else {
    showCompatFinal();
  }
}

function showCompatFinal() {
  const status = document.getElementById('compat-question');
  status.textContent = `انتهت الأسئلة! تطابقتوا في ${toArabicDigits(compatMatches)} من ${toArabicDigits(compatOrder.length)} سؤال`;
  document.getElementById('compat-progress').textContent = '';
  document.getElementById('compat-result-note').textContent = '';
  document.getElementById('compat-options').classList.add('hidden');
  document.getElementById('compat-waiting').classList.add('hidden');
  document.getElementById('compat-next-btn').classList.add('hidden');
  document.getElementById('compat-restart-btn').classList.remove('hidden');
}

document.getElementById('compat-restart-btn').addEventListener('click', () => {
  const order = shuffledCompatOrder();
  resetCompatMatch(order);
  broadcastGameState({ type: 'restart', game: 'compat', layout: order });
});
