// ============================================================
// numberguess.js
// كل منطق لعبة خمّن الرقم. يعتمد على games-core.js (broadcastGameState،
// toArabicDigits، isHost من core.js). لازم يتحمّل بعد games-core.js.
// ============================================================

let ngSecret = null;
let ngGameOver = false;
let ngHistory = [];

initEditableField(document.getElementById('ng-secret-input'), { numeric: true });
initEditableField(document.getElementById('ng-guess-input'), { numeric: true });

function resetNumberGuess() {
  ngSecret = null;
  ngGameOver = false;
  ngHistory = [];
  renderNgLog();
  document.getElementById('ng-restart-btn').classList.add('hidden');
  document.getElementById('ng-guess-area').classList.add('hidden');
  document.getElementById('ng-host-setup').classList.add('hidden');
  setFieldDisabled(document.getElementById('ng-guess-input'), false);
  document.getElementById('ng-guess-btn').disabled = false;
  setFieldValue(document.getElementById('ng-guess-input'), '');
  setFieldValue(document.getElementById('ng-secret-input'), '');
  const status = document.getElementById('ng-status');
  status.classList.remove('win', 'lose', 'tie');
  if (isHost) {
    document.getElementById('ng-host-setup').classList.remove('hidden');
    status.textContent = 'حدد رقمك السري';
  } else {
    status.textContent = `بانتظار ${peerName || 'المضيف'} يجهز رقم سري...`;
  }
}

function activateNgGuesserView() {
  document.getElementById('ng-guess-area').classList.remove('hidden');
  document.getElementById('ng-status').textContent = 'خمّن رقم من ١ إلى ١٠٠';
}

document.getElementById('ng-start-btn').addEventListener('click', () => {
  const input = document.getElementById('ng-secret-input');
  const val = Number(getFieldValue(input));
  if (!Number.isInteger(val) || val < 1 || val > 100) return;
  ngSecret = val;
  setFieldValue(input, '');
  document.getElementById('ng-host-setup').classList.add('hidden');
  document.getElementById('ng-status').textContent = `بانتظار تخمين ${peerName || 'الطرف الآخر'}...`;
  broadcastGameState({ type: 'start', game: 'numberguess' });
});

document.getElementById('ng-guess-btn').addEventListener('click', () => {
  const input = document.getElementById('ng-guess-input');
  const val = Number(getFieldValue(input));
  if (!Number.isInteger(val) || val < 1 || val > 100 || ngGameOver) return;
  broadcastGameState({ type: 'move', game: 'numberguess', number: val });
  ngHistory.push({ number: val, hint: null });
  renderNgLog();
  document.getElementById('ng-guess-btn').disabled = true;
  setFieldDisabled(input, true);
});

// المضيف يقارن التخمين برقمه السري ويرد تلقائيًا (أعلى / أقل / صح) بدون ما يقدر يغلط أو يغش
function resolveNgGuess(number) {
  if (!isHost || ngSecret === null || ngGameOver) return;
  if (!Number.isInteger(number) || number < 1 || number > 100) return;
  const result = number === ngSecret ? 'correct' : (number < ngSecret ? 'higher' : 'lower');
  broadcastGameState({ type: 'move', game: 'numberguess', number, result });
  ngHistory.push({ number, hint: result });
  renderNgLog();
  if (result === 'correct') {
    ngGameOver = true;
    const status = document.getElementById('ng-status');
    status.classList.remove('win', 'lose', 'tie');
    status.textContent = `${peerName || 'الطرف الآخر'} عرف الرقم!`;
    status.classList.add('lose');
    document.getElementById('ng-restart-btn').classList.remove('hidden');
  }
}

function hintLabel(result) {
  return result === 'higher' ? 'أعلى' : result === 'lower' ? 'أقل' : 'صح!';
}

function renderNgLog() {
  const log = document.getElementById('ng-log');
  log.innerHTML = '';
  ngHistory.forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'ng-log-entry';
    const numSpan = document.createElement('span');
    numSpan.textContent = toArabicDigits(entry.number);
    const hintSpan = document.createElement('span');
    hintSpan.textContent = entry.hint ? hintLabel(entry.hint) : 'بانتظار الرد...';
    div.appendChild(numSpan);
    div.appendChild(hintSpan);
    log.appendChild(div);
  });
  log.scrollTop = log.scrollHeight;
}

document.getElementById('ng-restart-btn').addEventListener('click', () => {
  broadcastGameState({ type: 'restart', game: 'numberguess' });
  resetNumberGuess();
});
