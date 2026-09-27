// ============================================================
// fastanswer.js
// منطق لعبة "جاوب صح": أول واحد يجاوب صح على السؤال يفوز فيه ويطلع جوابه.
// لو حد جاوب غلط يتمنع من الجواب ثاني مرة على نفس السؤال (خياراته تنقفل
// عنده بس)، والطرف الثاني (لو ما جاوب لسه) يقدر يحاول. النتيجة تنكتب
// بكلمة وحدة بس ("غلط"/"إجابة صحيحة") على جهاز اللي جاوب، والانتقال
// للسؤال التالي يصير تلقائي (بدون زر) سواء فاز أحد أو جاوب الاثنين غلط.
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

// ---- أصوات قصيرة (Web Audio API) بدون أي ملفات خارجية - تشتغل أوفلاين ----
let fastanswerAudioCtx = null;
function fastanswerGetAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!fastanswerAudioCtx) fastanswerAudioCtx = new Ctx();
  if (fastanswerAudioCtx.state === 'suspended') fastanswerAudioCtx.resume();
  return fastanswerAudioCtx;
}
function fastanswerPlayTone(freq, duration, type, startDelay, volume) {
  const ctx = fastanswerGetAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + (startDelay || 0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}
function playFastanswerCorrectSound() {
  fastanswerPlayTone(880, 0.16, 'sine', 0, 0.22);
  fastanswerPlayTone(1320, 0.2, 'sine', 0.12, 0.22);
}
function playFastanswerWrongSound() {
  fastanswerPlayTone(220, 0.28, 'square', 0, 0.15);
}

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
    if (who === 'me') {
      fastanswerMyScore++;
      const hint = document.getElementById('fastanswer-hint');
      hint.textContent = 'إجابة صحيحة';
      hint.classList.add('correct');
      playFastanswerCorrectSound();
    } else {
      fastanswerPeerScore++;
    }
    finalizeFastanswerRound();
    return;
  }

  if (who === 'me') {
    fastanswerMyBlocked = true;
    document.querySelectorAll('.fastanswer-option').forEach((b) => {
      const i = Number(b.dataset.idx);
      if (i === idx) b.classList.add('wrong');
      b.disabled = true;
    });
    const hint = document.getElementById('fastanswer-hint');
    hint.textContent = 'غلط';
    hint.classList.add('wrong');
    playFastanswerWrongSound();
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
  setTimeout(() => advanceFastanswer(atIndex), 1100);
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
  status.textContent = fastanswerMyScore === fastanswerPeerScore
    ? `انتهت الأسئلة! تعادلتوا (${toArabicDigits(fastanswerMyScore)} - ${toArabicDigits(fastanswerPeerScore)})`
    : (fastanswerMyScore > fastanswerPeerScore
      ? `انتهت الأسئلة! فزت (${toArabicDigits(fastanswerMyScore)} - ${toArabicDigits(fastanswerPeerScore)})`
      : `انتهت الأسئلة! خسرت (${toArabicDigits(fastanswerMyScore)} - ${toArabicDigits(fastanswerPeerScore)})`);
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
