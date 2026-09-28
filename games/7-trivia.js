// ============================================================
// 7-trivia.js
// منطق لعبة "تحدي المعلومات": سباق - أول واحد يجاوب صح يفوز بالسؤال ويطلع جوابه.
// لو حد جاوب غلط يتمنع من الجواب ثاني مرة على نفس السؤال (خياراته تنقفل عنده
// بس) وينتظر الطرف الثاني؛ والطرف الثاني (لو ما جاوب لسه) يقدر يحاول. لو جاوب
// الاثنين غلط ما فيه فايز. النتيجة كلمة وحدة بس ("غلط"/"إجابة صحيحة") مع
// أنيميشن وصوت، والانتقال للسؤال التالي تلقائي (بدون أي زر).
// يعتمد على games-core.js (broadcastGameState، toArabicDigits، playCorrectSound،
// playWrongSound) وعلى TRIVIA_BANK من ملف الأسئلة. لازم يتحمّل بعد الاثنين.
// ============================================================

let triviaOrder = [];
let triviaIndex = 0;
let triviaRoundActive = true;
let triviaMyBlocked = false;
let triviaPeerBlocked = false;
let triviaMyScore = 0;
let triviaPeerScore = 0;
let triviaTimer = null;

function shuffledTriviaOrder() {
  const idx = TRIVIA_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 10);
}

function resetTriviaMatch(order) {
  clearTimeout(triviaTimer);
  triviaOrder = order && order.length ? order : shuffledTriviaOrder();
  triviaIndex = 0;
  triviaMyScore = 0;
  triviaPeerScore = 0;
  document.getElementById('trivia-restart-btn').classList.add('hidden');
  document.getElementById('trivia-options').classList.remove('hidden');
  loadTriviaQuestion();
}

function loadTriviaQuestion() {
  triviaRoundActive = true;
  triviaMyBlocked = false;
  triviaPeerBlocked = false;
  const q = TRIVIA_BANK[triviaOrder[triviaIndex]];
  document.getElementById('trivia-progress').textContent = `سؤال ${toArabicDigits(triviaIndex + 1)} من ${toArabicDigits(triviaOrder.length)}`;
  document.getElementById('trivia-question').textContent = q.q;
  document.getElementById('trivia-score').textContent = `${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)}`;
  const hint = document.getElementById('trivia-hint');
  hint.textContent = '';
  hint.classList.remove('correct', 'wrong');
  document.querySelectorAll('.trivia-option').forEach((btn, i) => {
    btn.textContent = q.options[i];
    btn.disabled = false;
    btn.classList.remove('correct', 'wrong', 'my-pick');
  });
  document.getElementById('trivia-options').classList.remove('hidden');
}

document.querySelectorAll('.trivia-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!triviaRoundActive || triviaMyBlocked) return;
    const idx = Number(btn.dataset.idx);
    btn.classList.add('my-pick');
    broadcastGameState({ type: 'move', game: 'trivia', idx, q: triviaIndex });
    applyTriviaAttempt('me', idx);
  });
});

function applyTriviaAttempt(who, idx) {
  if (!triviaRoundActive) return;
  if (who === 'me' && triviaMyBlocked) return;
  if (who === 'peer' && triviaPeerBlocked) return;

  const q = TRIVIA_BANK[triviaOrder[triviaIndex]];
  const isCorrect = idx === q.correct;

  if (isCorrect) {
    triviaRoundActive = false;
    if (who === 'me') {
      triviaMyScore++;
      const hint = document.getElementById('trivia-hint');
      hint.textContent = 'إجابة صحيحة';
      hint.classList.add('correct');
      playCorrectSound();
    } else {
      triviaPeerScore++;
    }
    finalizeTriviaRound();
    return;
  }

  if (who === 'me') {
    triviaMyBlocked = true;
    document.querySelectorAll('.trivia-option').forEach((b) => {
      if (Number(b.dataset.idx) === idx) b.classList.add('wrong');
      b.disabled = true;
    });
    const hint = document.getElementById('trivia-hint');
    hint.textContent = 'غلط';
    hint.classList.add('wrong');
    playWrongSound();
  } else {
    triviaPeerBlocked = true;
  }

  if (triviaMyBlocked && triviaPeerBlocked) {
    triviaRoundActive = false;
    finalizeTriviaRound();
  }
}

function finalizeTriviaRound() {
  const q = TRIVIA_BANK[triviaOrder[triviaIndex]];
  document.querySelectorAll('.trivia-option').forEach((b, i) => {
    if (i === q.correct) b.classList.add('correct');
    b.disabled = true;
  });
  document.getElementById('trivia-score').textContent = `${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)}`;
  const atIndex = triviaIndex;
  clearTimeout(triviaTimer);
  triviaTimer = setTimeout(() => advanceTrivia(atIndex), 1200);
}

function advanceTrivia(fromIndex) {
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
  const s = `${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)}`;
  status.textContent = triviaMyScore === triviaPeerScore
    ? `تعادلتوا (${s})`
    : (triviaMyScore > triviaPeerScore ? `فزت! (${s})` : `خسرت (${s})`);
  document.getElementById('trivia-progress').textContent = '';
  const hint = document.getElementById('trivia-hint');
  hint.textContent = '';
  hint.classList.remove('correct', 'wrong');
  document.getElementById('trivia-options').classList.add('hidden');
  document.getElementById('trivia-restart-btn').classList.remove('hidden');
}

document.getElementById('trivia-restart-btn').addEventListener('click', () => {
  const order = shuffledTriviaOrder();
  resetTriviaMatch(order);
  broadcastGameState({ type: 'restart', game: 'trivia', layout: order });
});
