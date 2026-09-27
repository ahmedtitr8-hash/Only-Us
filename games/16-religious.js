// ============================================================
// religious.js
// منطق لعبة "أسئلة دينية" (الأسئلة/الإجابات/التقدّم). نفس منطق trivia.js
// بالضبط (فيه إجابة صح/غلط ونقاط). يعتمد على games-core.js
// (broadcastGameState، toArabicDigits) وعلى RELIGIOUS_BANK من
// religious-questions.js. لازم يتحمّل بعد الاثنين.
// ============================================================

let religiousOrder = [];
let religiousIndex = 0;
let religiousMyAnswer = null;
let religiousPeerAnswer = null;
let religiousRoundActive = true;
let religiousMyScore = 0;
let religiousPeerScore = 0;

function shuffledReligiousOrder() {
  const idx = RELIGIOUS_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 10);
}

function resetReligiousMatch(order) {
  religiousOrder = order && order.length ? order : shuffledReligiousOrder();
  religiousIndex = 0;
  religiousMyScore = 0;
  religiousPeerScore = 0;
  document.getElementById('religious-restart-btn').classList.add('hidden');
  document.getElementById('religious-next-btn').classList.add('hidden');
  document.getElementById('religious-options').classList.remove('hidden');
  loadReligiousQuestion();
}

function loadReligiousQuestion() {
  religiousMyAnswer = null;
  religiousPeerAnswer = null;
  religiousRoundActive = true;
  const q = RELIGIOUS_BANK[religiousOrder[religiousIndex]];
  document.getElementById('religious-progress').textContent = `سؤال ${toArabicDigits(religiousIndex + 1)} من ${toArabicDigits(religiousOrder.length)}`;
  document.getElementById('religious-question').textContent = q.q;
  document.getElementById('religious-score').textContent = `${toArabicDigits(religiousMyScore)} - ${toArabicDigits(religiousPeerScore)}`;
  document.querySelectorAll('.religious-option').forEach((btn, i) => {
    btn.textContent = q.options[i];
    btn.disabled = false;
    btn.classList.remove('correct', 'wrong', 'my-pick');
  });
  document.getElementById('religious-options').classList.remove('hidden');
  document.getElementById('religious-next-btn').classList.add('hidden');
}

document.querySelectorAll('.religious-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!religiousRoundActive) return;
    const idx = Number(btn.dataset.idx);
    religiousMyAnswer = idx;
    document.querySelectorAll('.religious-option').forEach((b) => (b.disabled = true));
    btn.classList.add('my-pick');
    broadcastGameState({ type: 'move', game: 'religious', answer: idx });
    checkReligiousResolve();
  });
});

function checkReligiousResolve() {
  if (!religiousRoundActive || religiousMyAnswer === null || religiousPeerAnswer === null) return;
  religiousRoundActive = false;
  const q = RELIGIOUS_BANK[religiousOrder[religiousIndex]];
  document.querySelectorAll('.religious-option').forEach((btn, i) => {
    if (i === q.correct) btn.classList.add('correct');
    else if (i === religiousMyAnswer) btn.classList.add('wrong');
  });
  if (religiousMyAnswer === q.correct) religiousMyScore++;
  if (religiousPeerAnswer === q.correct) religiousPeerScore++;
  document.getElementById('religious-score').textContent = `${toArabicDigits(religiousMyScore)} - ${toArabicDigits(religiousPeerScore)}`;
  document.getElementById('religious-next-btn').classList.remove('hidden');
  document.getElementById('religious-next-btn').textContent = (religiousIndex + 1 < religiousOrder.length) ? 'السؤال التالي' : 'عرض النتيجة';
}

document.getElementById('religious-next-btn').addEventListener('click', () => {
  const from = religiousIndex;
  broadcastGameState({ type: 'move', game: 'religious-next', index: from });
  advanceReligious(from);
});

function advanceReligious(fromIndex) {
  // لو ضغط الطرفين "التالي" بنفس اللحظة، الرسالة اللي توصل من سؤال سبق وتجاوزناه تُتجاهل (بدل ما نقفز سؤالين)
  if (fromIndex !== undefined && fromIndex !== religiousIndex) return;
  if (religiousIndex + 1 < religiousOrder.length) {
    religiousIndex++;
    loadReligiousQuestion();
  } else {
    showReligiousFinal();
  }
}

function showReligiousFinal() {
  const status = document.getElementById('religious-question');
  status.textContent = religiousMyScore === religiousPeerScore
    ? `انتهت الأسئلة! تعادلتوا (${toArabicDigits(religiousMyScore)} - ${toArabicDigits(religiousPeerScore)})`
    : (religiousMyScore > religiousPeerScore
      ? `انتهت الأسئلة! فزت (${toArabicDigits(religiousMyScore)} - ${toArabicDigits(religiousPeerScore)})`
      : `انتهت الأسئلة! خسرت (${toArabicDigits(religiousMyScore)} - ${toArabicDigits(religiousPeerScore)})`);
  document.getElementById('religious-progress').textContent = '';
  document.getElementById('religious-options').classList.add('hidden');
  document.getElementById('religious-next-btn').classList.add('hidden');
  document.getElementById('religious-restart-btn').classList.remove('hidden');
}

document.getElementById('religious-restart-btn').addEventListener('click', () => {
  const order = shuffledReligiousOrder();
  resetReligiousMatch(order);
  broadcastGameState({ type: 'restart', game: 'religious', layout: order });
});
