// ============================================================
// whoami.js
// منطق لعبة "مين فينا" (الأسئلة/الإجابات/التقدّم). يعتمد على games-core.js
// (broadcastGameState، toArabicDigits) وعلى WHOAMI_BANK من
// whoami-questions.js. لازم يتحمّل بعد الاثنين.
//
// نفس منطق compat.js بالضبط (كل واحد يجاوب سري مين ينطبق عليه السؤال -
// نفسه أو شريكه، وبعدين تنكشف الإجابتين ونشوف اتفقتوا أو لا)، بس ببنك
// أسئلة "مين فينا" وخيارات ثابتة ['أنا', 'شريكي'].
// ============================================================

let whoamiOrder = [];
let whoamiIndex = 0;
let whoamiMyAnswer = null;
let whoamiPeerAnswer = null;
let whoamiRoundActive = true;
let whoamiMatches = 0;

function shuffledWhoamiOrder() {
  const idx = WHOAMI_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 10);
}

function resetWhoamiMatch(order) {
  whoamiOrder = order && order.length ? order : shuffledWhoamiOrder();
  whoamiIndex = 0;
  whoamiMatches = 0;
  document.getElementById('whoami-restart-btn').classList.add('hidden');
  document.getElementById('whoami-next-btn').classList.add('hidden');
  document.getElementById('whoami-options').classList.remove('hidden');
  document.getElementById('whoami-waiting').classList.add('hidden');
  loadWhoamiQuestion();
}

function loadWhoamiQuestion() {
  whoamiMyAnswer = null;
  whoamiPeerAnswer = null;
  whoamiRoundActive = true;
  const q = WHOAMI_BANK[whoamiOrder[whoamiIndex]];
  document.getElementById('whoami-progress').textContent = `سؤال ${toArabicDigits(whoamiIndex + 1)} من ${toArabicDigits(whoamiOrder.length)}`;
  document.getElementById('whoami-question').textContent = q.q;
  document.getElementById('whoami-score').textContent = `تطابقتوا في ${toArabicDigits(whoamiMatches)} من ${toArabicDigits(whoamiIndex)}`;
  document.querySelectorAll('.whoami-option').forEach((btn, i) => {
    const has = i < q.options.length;
    btn.classList.toggle('hidden', !has);
    if (has) btn.textContent = q.options[i];
    btn.disabled = false;
    btn.classList.remove('match', 'my-pick', 'peer-pick');
  });
  document.getElementById('whoami-options').classList.remove('hidden');
  document.getElementById('whoami-waiting').classList.add('hidden');
  document.getElementById('whoami-result-note').textContent = '';
  document.getElementById('whoami-next-btn').classList.add('hidden');
}

document.querySelectorAll('.whoami-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!whoamiRoundActive) return;
    const idx = Number(btn.dataset.idx);
    whoamiMyAnswer = idx;
    document.querySelectorAll('.whoami-option').forEach((b) => (b.disabled = true));
    btn.classList.add('my-pick');
    document.getElementById('whoami-waiting').textContent = `بانتظار ${peerName || 'شريكك'} يجاوب...`;
    document.getElementById('whoami-waiting').classList.toggle('hidden', whoamiPeerAnswer !== null);
    broadcastGameState({ type: 'move', game: 'whoami', answer: idx });
    checkWhoamiResolve();
  });
});

function checkWhoamiResolve() {
  if (!whoamiRoundActive || whoamiMyAnswer === null || whoamiPeerAnswer === null) return;
  whoamiRoundActive = false;
  document.getElementById('whoami-waiting').classList.add('hidden');
  const isMatch = whoamiMyAnswer === whoamiPeerAnswer;
  if (isMatch) {
    whoamiMatches++;
    const matchBtn = document.querySelector(`.whoami-option[data-idx="${whoamiMyAnswer}"]`);
    matchBtn.classList.remove('my-pick');
    matchBtn.classList.add('match');
    document.getElementById('whoami-result-note').textContent = 'تطابقتوا! 💞';
  } else {
    document.querySelector(`.whoami-option[data-idx="${whoamiMyAnswer}"]`).classList.add('my-pick');
    document.querySelector(`.whoami-option[data-idx="${whoamiPeerAnswer}"]`).classList.add('peer-pick');
    document.getElementById('whoami-result-note').textContent = 'اخترتوا إجابات مختلفة هالمرة';
  }
  document.getElementById('whoami-score').textContent = `تطابقتوا في ${toArabicDigits(whoamiMatches)} من ${toArabicDigits(whoamiIndex + 1)}`;
  document.getElementById('whoami-next-btn').classList.remove('hidden');
  document.getElementById('whoami-next-btn').textContent = (whoamiIndex + 1 < whoamiOrder.length) ? 'السؤال التالي' : 'عرض النتيجة';
}

document.getElementById('whoami-next-btn').addEventListener('click', () => {
  const from = whoamiIndex;
  broadcastGameState({ type: 'move', game: 'whoami-next', index: from });
  advanceWhoami(from);
});

function advanceWhoami(fromIndex) {
  // لو ضغط الطرفين "التالي" بنفس اللحظة، الرسالة اللي توصل من سؤال سبق وتجاوزناه تُتجاهل
  if (fromIndex !== undefined && fromIndex !== whoamiIndex) return;
  if (whoamiIndex + 1 < whoamiOrder.length) {
    whoamiIndex++;
    loadWhoamiQuestion();
  } else {
    showWhoamiFinal();
  }
}

function showWhoamiFinal() {
  const status = document.getElementById('whoami-question');
  status.textContent = `انتهت الأسئلة! تطابقتوا في ${toArabicDigits(whoamiMatches)} من ${toArabicDigits(whoamiOrder.length)} سؤال`;
  document.getElementById('whoami-progress').textContent = '';
  document.getElementById('whoami-result-note').textContent = '';
  document.getElementById('whoami-options').classList.add('hidden');
  document.getElementById('whoami-waiting').classList.add('hidden');
  document.getElementById('whoami-next-btn').classList.add('hidden');
  document.getElementById('whoami-restart-btn').classList.remove('hidden');
}

document.getElementById('whoami-restart-btn').addEventListener('click', () => {
  const order = shuffledWhoamiOrder();
  resetWhoamiMatch(order);
  broadcastGameState({ type: 'restart', game: 'whoami', layout: order });
});
