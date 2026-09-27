// ============================================================
// rps.js
// كل منطق لعبة حجر ورقة مقص. يعتمد على games-core.js (broadcastGameState,
// toArabicDigits). لازم يتحمّل بعد games-core.js.
// ============================================================

const rpsBoardEl = document.getElementById('rps-board');
const rpsScoreEl = document.getElementById('rps-score');
const rpsChoiceBtns = document.querySelectorAll('.rps-choice');
const rpsWaiting = document.getElementById('rps-waiting');
const rpsResult = document.getElementById('rps-result');
const rpsReveal = document.getElementById('rps-reveal');
const rpsResultText = document.getElementById('rps-result-text');
const rpsNextBtn = document.getElementById('rps-next-btn');

let rpsMyChoice = null;
let rpsPeerChoice = null;
let rpsRoundActive = true;
let rpsMyScore = 0;
let rpsPeerScore = 0;

function resetRpsMatch() {
  rpsMyScore = 0;
  rpsPeerScore = 0;
  resetRpsRound();
}

function resetRpsRound() {
  rpsMyChoice = null;
  rpsPeerChoice = null;
  rpsRoundActive = true;
  rpsChoiceBtns.forEach((b) => (b.disabled = false));
  rpsWaiting.classList.add('hidden');
  rpsResult.classList.add('hidden');
  rpsResultText.classList.remove('win', 'lose', 'tie');
  rpsScoreEl.textContent = `${toArabicDigits(rpsMyScore)} - ${toArabicDigits(rpsPeerScore)}`;
}

rpsChoiceBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!rpsRoundActive || rpsMyChoice) return;
    rpsMyChoice = btn.dataset.choice;
    rpsChoiceBtns.forEach((b) => (b.disabled = true));
    rpsWaiting.textContent = `بانتظار ${peerName || 'الطرف الآخر'}...`;
    rpsWaiting.classList.remove('hidden');
    broadcastGameState({ type: 'move', game: 'rps', choice: rpsMyChoice });
    checkRpsResolve();
  });
});

const RPS_LABELS = { rock: 'حجر', paper: 'ورقة', scissors: 'مقص' };
const RPS_BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

function checkRpsResolve() {
  if (!rpsRoundActive || !rpsMyChoice || !rpsPeerChoice) return;
  rpsRoundActive = false;
  rpsWaiting.classList.add('hidden');
  rpsResult.classList.remove('hidden');
  rpsReveal.textContent = `أنت: ${RPS_LABELS[rpsMyChoice]}  —  ${peerName || 'الطرف الآخر'}: ${RPS_LABELS[rpsPeerChoice]}`;

  rpsResultText.classList.remove('win', 'lose', 'tie');
  let resultText;
  if (rpsMyChoice === rpsPeerChoice) {
    resultText = 'تعادل';
    rpsResultText.classList.add('tie');
  } else if (RPS_BEATS[rpsMyChoice] === rpsPeerChoice) {
    resultText = 'فزت بهالجولة!';
    rpsResultText.classList.add('win');
    rpsMyScore++;
  } else {
    resultText = 'خسرت هالجولة';
    rpsResultText.classList.add('lose');
    rpsPeerScore++;
  }
  rpsResultText.textContent = resultText;
  rpsScoreEl.textContent = `${toArabicDigits(rpsMyScore)} - ${toArabicDigits(rpsPeerScore)}`;
}

rpsNextBtn.addEventListener('click', () => {
  resetRpsRound();
  broadcastGameState({ type: 'move', game: 'rps-next' });
});
