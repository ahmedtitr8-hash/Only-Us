// ============================================================
// 18-fastanswer.js
// منطق لعبة "جاوب صح": سباق - أول واحد يجاوب صح يفوز بالسؤال ويطلع جوابه.
// لو حد جاوب غلط يتمنع من الجواب ثاني مرة على نفس السؤال (خياراته تنقفل عنده
// بس) وينتظر الطرف الثاني؛ والطرف الثاني (لو ما جاوب لسه) يقدر يحاول. لو جاوب
// الاثنين غلط ما فيه فايز. النتيجة كلمة وحدة بس ("غلط"/"إجابة صحيحة") مع
// أنيميشن وصوت، والانتقال للسؤال التالي تلقائي (بدون أي زر).
// يعتمد على games-core.js (broadcastGameState، toArabicDigits، playCorrectSound،
// playWrongSound) وعلى FASTANSWER_BANK من ملف الأسئلة. لازم يتحمّل بعد الاثنين.
// ============================================================

let fastanswerOrder = [];
let fastanswerIndex = 0;
let fastanswerRoundActive = true;
let fastanswerMyBlocked = false;
let fastanswerPeerBlocked = false;
let fastanswerMyScore = 0;
let fastanswerPeerScore = 0;
let fastanswerTimer = null;

function shuffledFastanswerOrder() {
  const idx = FASTANSWER_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 10);
}

function resetFastanswerMatch(order) {
  clearTimeout(fastanswerTimer);
  fastanswerOrder = order && order.length ? order : shuffledFastanswerOrder();
  fastanswerIndex = 0;
  fastanswerMyScore = 0;
  fastanswerPeerScore = 0;
  document.getElementById('fastanswer-restart-btn').classList.add('hidden');
  document.getElementById('fastanswer-options').classList.remove('hidden');
  loadFastanswerQuestion();
}

function loadFastanswerQuestion() {
  fastanswerRoundActive = true;
  fastanswerMyBlocked = false;
  fastanswerPeerBlocked = false;
  const q = FASTANSWER_BANK[fastanswerOrder[fastanswerIndex]];
  document.getElementById('fastanswer-progress').textContent = `سؤال ${toArabicDigits(fastanswerIndex + 1)} من ${toArabicDigits(fastanswerOrder.length)}`;
  document.getElementById('fastanswer-question').textContent = q.q;
  document.getElementById('fastanswer-score').textContent = `${toArabicDigits(fastanswerMyScore)} - ${toArabicDigits(fastanswerPeerScore)}`;
  const hint = document.getElementById('fastanswer-hint');
  hint.textContent = '';
  hint.classList.remove('correct', 'wrong');
  document.querySelectorAll('.fastanswer-option').forEach((btn, i) => {
    btn.textContent = q.options[i];
    btn.disabled = false;
    btn.classList.remove('correct', 'wrong', 'my-pick');
  });
  document.getElementById('fastanswer-options').classList.remove('hidden');
}

document.querySelectorAll('.fastanswer-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!fastanswerRoundActive || fastanswerMyBlocked) return;
    const idx = Number(btn.dataset.idx);
    btn.classList.add('my-pick');
    broadcastGameState({ type: 'move', game: 'fastanswer', idx, q: fastanswerIndex });
    applyFastanswerAttempt('me', idx);
  });
});

function applyFastanswerAttempt(who, idx) {
  if (!fastanswerRoundActive) return;
  if (who === 'me' && fastanswerMyBlocked) return;
  if (who === 'peer' && fastanswerPeerBlocked) return;

  const q = FASTANSWER_BANK[fastanswerOrder[fastanswerIndex]];
  const isCorrect = idx === q.correct;

  if (isCorrect) {
    fastanswerRoundActive = false;
    if (who === 'me') {
      fastanswerMyScore++;
      const hint = document.getElementById('fastanswer-hint');
      hint.textContent = 'إجابة صحيحة';
      hint.classList.add('correct');
      playCorrectSound();
    } else {
      fastanswerPeerScore++;
    }
    finalizeFastanswerRound();
    return;
  }

  if (who === 'me') {
    fastanswerMyBlocked = true;
    document.querySelectorAll('.fastanswer-option').forEach((b) => {
      if (Number(b.dataset.idx) === idx) b.classList.add('wrong');
      b.disabled = true;
    });
    const hint = document.getElementById('fastanswer-hint');
    hint.textContent = 'غلط';
    hint.classList.add('wrong');
    playWrongSound();
  } else {
    fastanswerPeerBlocked = true;
  }

  if (fastanswerMyBlocked && fastanswerPeerBlocked) {
    fastanswerRoundActive = false;
    finalizeFastanswerRound();
  }
}

function finalizeFastanswerRound() {
  const q = FASTANSWER_BANK[fastanswerOrder[fastanswerIndex]];
  document.querySelectorAll('.fastanswer-option').forEach((b, i) => {
    if (i === q.correct) b.classList.add('correct');
    b.disabled = true;
  });
  document.getElementById('fastanswer-score').textContent = `${toArabicDigits(fastanswerMyScore)} - ${toArabicDigits(fastanswerPeerScore)}`;
  const atIndex = fastanswerIndex;
  clearTimeout(fastanswerTimer);
  fastanswerTimer = setTimeout(() => advanceFastanswer(atIndex), 1200);
}

function advanceFastanswer(fromIndex) {
  if (fromIndex !== undefined && fromIndex !== fastanswerIndex) return;
  if (fastanswerIndex + 1 < fastanswerOrder.length) {
    fastanswerIndex++;
    loadFastanswerQuestion();
  } else {
    showFastanswerFinal();
  }
}

function showFastanswerFinal() {
  const status = document.getElementById('fastanswer-question');
  const s = `${toArabicDigits(fastanswerMyScore)} - ${toArabicDigits(fastanswerPeerScore)}`;
  status.textContent = fastanswerMyScore === fastanswerPeerScore
    ? `تعادلتوا (${s})`
    : (fastanswerMyScore > fastanswerPeerScore ? `فزت! (${s})` : `خسرت (${s})`);
  document.getElementById('fastanswer-progress').textContent = '';
  const hint = document.getElementById('fastanswer-hint');
  hint.textContent = '';
  hint.classList.remove('correct', 'wrong');
  document.getElementById('fastanswer-options').classList.add('hidden');
  document.getElementById('fastanswer-restart-btn').classList.remove('hidden');
}

document.getElementById('fastanswer-restart-btn').addEventListener('click', () => {
  const order = shuffledFastanswerOrder();
  resetFastanswerMatch(order);
  broadcastGameState({ type: 'restart', game: 'fastanswer', layout: order });
});
