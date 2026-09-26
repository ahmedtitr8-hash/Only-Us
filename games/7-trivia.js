// ============================================================
// trivia.js
// منطق تحدي المعلومات (الأسئلة/الإجابات/التقدّم). يعتمد على games-core.js
// (broadcastGameState، toArabicDigits) وعلى TRIVIA_BANK من
// trivia-questions.js. لازم يتحمّل بعد الاثنين.
// ============================================================

let triviaOrder = [];
let triviaIndex = 0;
let triviaMyAnswer = null;
let triviaPeerAnswer = null;
let triviaRoundActive = true;
let triviaMyScore = 0;
let triviaPeerScore = 0;

function shuffledTriviaOrder() {
  const idx = TRIVIA_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 10);
}

function resetTriviaMatch(order) {
  triviaOrder = order && order.length ? order : shuffledTriviaOrder();
  triviaIndex = 0;
  triviaMyScore = 0;
  triviaPeerScore = 0;
  document.getElementById('trivia-restart-btn').classList.add('hidden');
  document.getElementById('trivia-next-btn').classList.add('hidden');
  document.getElementById('trivia-options').classList.remove('hidden');
  loadTriviaQuestion();
}

function loadTriviaQuestion() {
  triviaMyAnswer = null;
  triviaPeerAnswer = null;
  triviaRoundActive = true;
  const q = TRIVIA_BANK[triviaOrder[triviaIndex]];
  document.getElementById('trivia-progress').textContent = `سؤال ${toArabicDigits(triviaIndex + 1)} من ${toArabicDigits(triviaOrder.length)}`;
  document.getElementById('trivia-question').textContent = q.q;
  document.getElementById('trivia-score').textContent = `${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)}`;
  document.querySelectorAll('.trivia-option').forEach((btn, i) => {
    btn.textContent = q.options[i];
    btn.disabled = false;
    btn.classList.remove('correct', 'wrong', 'my-pick');
  });
  document.getElementById('trivia-options').classList.remove('hidden');
  document.getElementById('trivia-next-btn').classList.add('hidden');
}

document.querySelectorAll('.trivia-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!triviaRoundActive) return;
    const idx = Number(btn.dataset.idx);
    triviaMyAnswer = idx;
    document.querySelectorAll('.trivia-option').forEach((b) => (b.disabled = true));
    btn.classList.add('my-pick');
    broadcastGameState({ type: 'move', game: 'trivia', answer: idx });
    checkTriviaResolve();
  });
});

function checkTriviaResolve() {
  if (!triviaRoundActive || triviaMyAnswer === null || triviaPeerAnswer === null) return;
  triviaRoundActive = false;
  const q = TRIVIA_BANK[triviaOrder[triviaIndex]];
  document.querySelectorAll('.trivia-option').forEach((btn, i) => {
    if (i === q.correct) btn.classList.add('correct');
    else if (i === triviaMyAnswer) btn.classList.add('wrong');
  });
  if (triviaMyAnswer === q.correct) triviaMyScore++;
  if (triviaPeerAnswer === q.correct) triviaPeerScore++;
  document.getElementById('trivia-score').textContent = `${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)}`;
  document.getElementById('trivia-next-btn').classList.remove('hidden');
  document.getElementById('trivia-next-btn').textContent = (triviaIndex + 1 < triviaOrder.length) ? 'السؤال التالي' : 'عرض النتيجة';
}

document.getElementById('trivia-next-btn').addEventListener('click', () => {
  const from = triviaIndex;
  broadcastGameState({ type: 'move', game: 'trivia-next', index: from });
  advanceTrivia(from);
});

function advanceTrivia(fromIndex) {
  // لو ضغط الطرفين "التالي" بنفس اللحظة، الرسالة اللي توصل من سؤال سبق وتجاوزناه تُتجاهل (بدل ما نقفز سؤالين)
  if (fromIndex !== undefined && fromIndex !== triviaIndex) return;
  if (triviaIndex + 1 < triviaOrder.length) {
    triviaIndex++;
    loadTriviaQuestion();
  } else {
    showTriviaFinal();
  }
}

function showTriviaFinal() {
  const status = document.getElementById('trivia-question');
  status.textContent = triviaMyScore === triviaPeerScore
    ? `انتهت الأسئلة! تعادلتوا (${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)})`
    : (triviaMyScore > triviaPeerScore
      ? `انتهت الأسئلة! فزت (${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)})`
      : `انتهت الأسئلة! خسرت (${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)})`);
  document.getElementById('trivia-progress').textContent = '';
  document.getElementById('trivia-options').classList.add('hidden');
  document.getElementById('trivia-next-btn').classList.add('hidden');
  document.getElementById('trivia-restart-btn').classList.remove('hidden');
}

document.getElementById('trivia-restart-btn').addEventListener('click', () => {
  const order = shuffledTriviaOrder();
  resetTriviaMatch(order);
  broadcastGameState({ type: 'restart', game: 'trivia', layout: order });
});
