// ============================================================
// fastanswer.js
// منطق لعبة "جاوب صح": أول واحد يجاوب صح على السؤال يفوز فيه ويطلع جوابه.
// لو حد جاوب غلط يتمنع من الجواب ثاني مرة على نفس السؤال (زر خياراته
// تنقفل عنده بس)، والطرف الثاني (لو ما جاوب لسه) يقدر يحاول. لو الاثنين
// جاوبوا غلط، ما فيه فايز وننتقل للسؤال اللي بعده مباشرة.
// يعتمد على games-core.js (broadcastGameState، toArabicDigits) وعلى
// FASTANSWER_BANK من fastanswer-questions.js. لازم يتحمّل بعد الاثنين.
// ============================================================

let fastanswerOrder = [];
let fastanswerIndex = 0;
let fastanswerRoundActive = true;
let fastanswerMyBlocked = false;
let fastanswerPeerBlocked = false;
let fastanswerMyScore = 0;
let fastanswerPeerScore = 0;

function shuffledFastanswerOrder() {
  const idx = FASTANSWER_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 10);
}

function resetFastanswerMatch(order) {
  fastanswerOrder = order && order.length ? order : shuffledFastanswerOrder();
  fastanswerIndex = 0;
  fastanswerMyScore = 0;
  fastanswerPeerScore = 0;
  document.getElementById('fastanswer-restart-btn').classList.add('hidden');
  document.getElementById('fastanswer-next-btn').classList.add('hidden');
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
  document.getElementById('fastanswer-hint').textContent = 'أول وحدة تجاوب صح تفوز بالسؤال!';
  document.querySelectorAll('.fastanswer-option').forEach((btn, i) => {
    btn.textContent = q.options[i];
    btn.disabled = false;
    btn.classList.remove('correct', 'wrong', 'my-pick');
  });
  document.getElementById('fastanswer-options').classList.remove('hidden');
  document.getElementById('fastanswer-next-btn').classList.add('hidden');
}

document.querySelectorAll('.fastanswer-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!fastanswerRoundActive || fastanswerMyBlocked) return;
    const idx = Number(btn.dataset.idx);
    btn.classList.add('my-pick');
    broadcastGameState({ type: 'move', game: 'fastanswer', idx });
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
    if (who === 'me') fastanswerMyScore++;
    else fastanswerPeerScore++;
    finalizeFastanswerRound(who);
    return;
  }

  if (who === 'me') {
    fastanswerMyBlocked = true;
    document.querySelectorAll('.fastanswer-option').forEach((b) => {
      const i = Number(b.dataset.idx);
      if (i === idx) b.classList.add('wrong');
      b.disabled = true;
    });
  } else {
    fastanswerPeerBlocked = true;
  }

  if (fastanswerMyBlocked && fastanswerPeerBlocked) {
    fastanswerRoundActive = false;
    finalizeFastanswerRound(null);
  } else if (who === 'me') {
    document.getElementById('fastanswer-hint').textContent = 'جاوبت غلط! ممنوع تحاول ثاني على هذا السؤال، بانتظار الطرف الثاني...';
  } else {
    document.getElementById('fastanswer-hint').textContent = 'الطرف الثاني جاوب غلط! دورك، حاول تجاوب صح.';
  }
}

function finalizeFastanswerRound(winner) {
  const q = FASTANSWER_BANK[fastanswerOrder[fastanswerIndex]];
  document.querySelectorAll('.fastanswer-option').forEach((b, i) => {
    if (i === q.correct) b.classList.add('correct');
    b.disabled = true;
  });
  const hint = document.getElementById('fastanswer-hint');
  if (winner === 'me') hint.textContent = 'فزت بهذا السؤال! ✓';
  else if (winner === 'peer') hint.textContent = 'فاز الطرف الثاني بهذا السؤال';
  else hint.textContent = 'ما جاوب حد صح 😅';
  document.getElementById('fastanswer-score').textContent = `${toArabicDigits(fastanswerMyScore)} - ${toArabicDigits(fastanswerPeerScore)}`;
  document.getElementById('fastanswer-next-btn').classList.remove('hidden');
  document.getElementById('fastanswer-next-btn').textContent = (fastanswerIndex + 1 < fastanswerOrder.length) ? 'السؤال التالي' : 'عرض النتيجة';
}

document.getElementById('fastanswer-next-btn').addEventListener('click', () => {
  const from = fastanswerIndex;
  broadcastGameState({ type: 'move', game: 'fastanswer-next', index: from });
  advanceFastanswer(from);
});

function advanceFastanswer(fromIndex) {
  // لو ضغط الطرفين "التالي" بنفس اللحظة، الرسالة اللي توصل من سؤال سبق وتجاوزناه تُتجاهل
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
  status.textContent = fastanswerMyScore === fastanswerPeerScore
    ? `انتهت الأسئلة! تعادلتوا (${toArabicDigits(fastanswerMyScore)} - ${toArabicDigits(fastanswerPeerScore)})`
    : (fastanswerMyScore > fastanswerPeerScore
      ? `انتهت الأسئلة! فزت (${toArabicDigits(fastanswerMyScore)} - ${toArabicDigits(fastanswerPeerScore)})`
      : `انتهت الأسئلة! خسرت (${toArabicDigits(fastanswerMyScore)} - ${toArabicDigits(fastanswerPeerScore)})`);
  document.getElementById('fastanswer-progress').textContent = '';
  document.getElementById('fastanswer-hint').textContent = '';
  document.getElementById('fastanswer-options').classList.add('hidden');
  document.getElementById('fastanswer-next-btn').classList.add('hidden');
  document.getElementById('fastanswer-restart-btn').classList.remove('hidden');
}

document.getElementById('fastanswer-restart-btn').addEventListener('click', () => {
  const order = shuffledFastanswerOrder();
  resetFastanswerMatch(order);
  broadcastGameState({ type: 'restart', game: 'fastanswer', layout: order });
});
