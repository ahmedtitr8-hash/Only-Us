// ============================================================
// 16-religious.js
// منطق لعبة "أسئلة دينية": سباق - أول واحد يجاوب صح يفوز بالسؤال ويطلع جوابه.
// لو حد جاوب غلط يتمنع من الجواب ثاني مرة على نفس السؤال (خياراته تنقفل عنده
// بس) وينتظر الطرف الثاني؛ والطرف الثاني (لو ما جاوب لسه) يقدر يحاول. لو جاوب
// الاثنين غلط ما فيه فايز. النتيجة كلمة وحدة بس ("غلط"/"إجابة صحيحة") مع
// أنيميشن وصوت، والانتقال للسؤال التالي تلقائي (بدون أي زر).
// يعتمد على games-core.js (broadcastGameState، toArabicDigits، playCorrectSound،
// playWrongSound) وعلى RELIGIOUS_BANK من ملف الأسئلة. لازم يتحمّل بعد الاثنين.
// ============================================================

let religiousOrder = [];
let religiousIndex = 0;
let religiousRoundActive = true;
let religiousMyBlocked = false;
let religiousPeerBlocked = false;
let religiousMyScore = 0;
let religiousPeerScore = 0;
let religiousTimer = null;

function shuffledReligiousOrder() {
  const idx = RELIGIOUS_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 10);
}

function resetReligiousMatch(order) {
  clearTimeout(religiousTimer);
  religiousOrder = order && order.length ? order : shuffledReligiousOrder();
  religiousIndex = 0;
  religiousMyScore = 0;
  religiousPeerScore = 0;
  document.getElementById('religious-restart-btn').classList.add('hidden');
  document.getElementById('religious-options').classList.remove('hidden');
  loadReligiousQuestion();
}

function loadReligiousQuestion() {
  religiousRoundActive = true;
  religiousMyBlocked = false;
  religiousPeerBlocked = false;
  const q = RELIGIOUS_BANK[religiousOrder[religiousIndex]];
  document.getElementById('religious-progress').textContent = `سؤال ${toArabicDigits(religiousIndex + 1)} من ${toArabicDigits(religiousOrder.length)}`;
  document.getElementById('religious-question').textContent = q.q;
  document.getElementById('religious-score').textContent = `${toArabicDigits(religiousMyScore)} - ${toArabicDigits(religiousPeerScore)}`;
  const hint = document.getElementById('religious-hint');
  hint.textContent = '';
  hint.classList.remove('correct', 'wrong');
  document.querySelectorAll('.religious-option').forEach((btn, i) => {
    btn.textContent = q.options[i];
    btn.disabled = false;
    btn.classList.remove('correct', 'wrong', 'my-pick');
  });
  document.getElementById('religious-options').classList.remove('hidden');
}

document.querySelectorAll('.religious-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!religiousRoundActive || religiousMyBlocked) return;
    const idx = Number(btn.dataset.idx);
    btn.classList.add('my-pick');
    broadcastGameState({ type: 'move', game: 'religious', idx, q: religiousIndex });
    applyReligiousAttempt('me', idx);
  });
});

function applyReligiousAttempt(who, idx) {
  if (!religiousRoundActive) return;
  if (who === 'me' && religiousMyBlocked) return;
  if (who === 'peer' && religiousPeerBlocked) return;

  const q = RELIGIOUS_BANK[religiousOrder[religiousIndex]];
  const isCorrect = idx === q.correct;

  if (isCorrect) {
    religiousRoundActive = false;
    if (who === 'me') {
      religiousMyScore++;
      const hint = document.getElementById('religious-hint');
      hint.textContent = 'إجابة صحيحة';
      hint.classList.add('correct');
      playCorrectSound();
    } else {
      religiousPeerScore++;
    }
    finalizeReligiousRound();
    return;
  }

  if (who === 'me') {
    religiousMyBlocked = true;
    document.querySelectorAll('.religious-option').forEach((b) => {
      if (Number(b.dataset.idx) === idx) b.classList.add('wrong');
      b.disabled = true;
    });
    const hint = document.getElementById('religious-hint');
    hint.textContent = 'غلط';
    hint.classList.add('wrong');
    playWrongSound();
  } else {
    religiousPeerBlocked = true;
  }

  if (religiousMyBlocked && religiousPeerBlocked) {
    religiousRoundActive = false;
    finalizeReligiousRound();
  }
}

function finalizeReligiousRound() {
  const q = RELIGIOUS_BANK[religiousOrder[religiousIndex]];
  document.querySelectorAll('.religious-option').forEach((b, i) => {
    if (i === q.correct) b.classList.add('correct');
    b.disabled = true;
  });
  document.getElementById('religious-score').textContent = `${toArabicDigits(religiousMyScore)} - ${toArabicDigits(religiousPeerScore)}`;
  const atIndex = religiousIndex;
  clearTimeout(religiousTimer);
  religiousTimer = setTimeout(() => advanceReligious(atIndex), 1200);
}

function advanceReligious(fromIndex) {
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
  const s = `${toArabicDigits(religiousMyScore)} - ${toArabicDigits(religiousPeerScore)}`;
  status.textContent = religiousMyScore === religiousPeerScore
    ? `تعادلتوا (${s})`
    : (religiousMyScore > religiousPeerScore ? `فزت! (${s})` : `خسرت (${s})`);
  document.getElementById('religious-progress').textContent = '';
  const hint = document.getElementById('religious-hint');
  hint.textContent = '';
  hint.classList.remove('correct', 'wrong');
  document.getElementById('religious-options').classList.add('hidden');
  document.getElementById('religious-restart-btn').classList.remove('hidden');
}

document.getElementById('religious-restart-btn').addEventListener('click', () => {
  const order = shuffledReligiousOrder();
  resetReligiousMatch(order);
  broadcastGameState({ type: 'restart', game: 'religious', layout: order });
});
