// ============================================================
// numberguess.js
// لعبة "خمّن الرقم": الجهاز يختار رقم سري عشوائي من ١ إلى ١٠٠ ويوصله للطرفين
// (نفس الرقم عند الاثنين). تتناوبون الأدوار: كل واحد بدوره يكتب تخمين، والنتيجة
// تظهر للاثنين: "الرقم أعلى" أو "الرقم أقل" أو صح. اللي يوصل للرقم الصحيح يفوز.
// فوق اللوحة سطر "الرقم بين X و Y" يتضيّق مع كل تخمين، وتحته آخر ٣ تخمينات.
// يعتمد على games-core.js (broadcastGameState، toArabicDigits، isHost، peerName).
// ============================================================

let ngSecret = null;
let ngFirst = null; // 'host' | 'guest' - من بدأ الجولة الحالية (الجولة اللي بعدها يبدأها الثاني)
let ngTurn = 'me';
let ngGameOver = false;
let ngLo = 1;
let ngHi = 100;
let ngHistory = []; // { who: 'me'|'peer', number, hint: 'higher'|'lower'|'correct' }

initEditableField(document.getElementById('ng-guess-input'), { numeric: true });

// يولّد بيانات جولة جديدة (الرقم السري + من يبدأ) - المبادر يرسلها للطرف الثاني
function newNumberGuessRound(prevFirst) {
  const myRole = isHost ? 'host' : 'guest';
  const first = prevFirst ? (prevFirst === 'host' ? 'guest' : 'host') : myRole;
  return { secret: 1 + Math.floor(Math.random() * 100), first };
}

function resetNumberGuess(layout) {
  const round = layout && layout.secret ? layout : newNumberGuessRound(ngFirst);
  const myRole = isHost ? 'host' : 'guest';
  ngSecret = round.secret;
  ngFirst = round.first;
  ngTurn = ngFirst === myRole ? 'me' : 'peer';
  ngGameOver = false;
  ngLo = 1;
  ngHi = 100;
  ngHistory = [];
  setFieldValue(document.getElementById('ng-guess-input'), '');
  const status = document.getElementById('ng-status');
  status.classList.remove('win', 'lose', 'tie');
  document.getElementById('ng-restart-btn').classList.add('hidden');
  renderNg();
}

function renderNg() {
  const status = document.getElementById('ng-status');
  const range = document.getElementById('ng-range');
  const canGuess = !ngGameOver && ngTurn === 'me';
  if (!ngGameOver) {
    status.textContent = ngTurn === 'me' ? 'دورك' : `دور ${peerName || 'الطرف الآخر'}`;
    range.textContent = `الرقم بين ${toArabicDigits(ngLo)} و ${toArabicDigits(ngHi)}`;
  } else {
    range.textContent = `الرقم كان ${toArabicDigits(ngSecret)}`;
  }
  setFieldDisabled(document.getElementById('ng-guess-input'), !canGuess);
  document.getElementById('ng-guess-btn').disabled = !canGuess;

  const log = document.getElementById('ng-log');
  log.innerHTML = '';
  ngHistory.slice(-3).reverse().forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'ng-log-entry' + (entry.hint === 'correct' ? ' ng-correct' : '');
    const who = document.createElement('span');
    who.className = 'ng-who';
    who.textContent = entry.who === 'me' ? 'أنت' : (peerName || 'الطرف الآخر');
    const num = document.createElement('span');
    num.className = 'ng-num';
    num.textContent = toArabicDigits(entry.number);
    const hint = document.createElement('span');
    hint.className = 'ng-hint';
    hint.textContent = entry.hint === 'higher' ? 'الرقم أعلى' : entry.hint === 'lower' ? 'الرقم أقل' : 'صح!';
    div.appendChild(who);
    div.appendChild(num);
    div.appendChild(hint);
    log.appendChild(div);
  });
}

// تطبيق تخمين (مني أو من الطرف الثاني) - الاثنين يحسبون النتيجة بنفس الرقم السري
function applyNgGuess(who, number) {
  if (ngGameOver || ngSecret === null) return;
  if (who !== ngTurn) return; // تخمين بدون دور - يتجاهل
  if (!Number.isInteger(number) || number < 1 || number > 100) return;
  const hint = number === ngSecret ? 'correct' : (number < ngSecret ? 'higher' : 'lower');
  ngHistory.push({ who, number, hint });
  if (hint === 'higher') ngLo = Math.max(ngLo, number + 1);
  else if (hint === 'lower') ngHi = Math.min(ngHi, number - 1);

  if (hint === 'correct') {
    ngGameOver = true;
    const status = document.getElementById('ng-status');
    status.classList.remove('win', 'lose', 'tie');
    if (who === 'me') { status.textContent = 'فزت!'; status.classList.add('win'); playCorrectSound(); }
    else { status.textContent = 'خسرت هالجولة'; status.classList.add('lose'); playWrongSound(); }
    document.getElementById('ng-restart-btn').classList.remove('hidden');
  } else {
    ngTurn = who === 'me' ? 'peer' : 'me';
  }
  renderNg();
}

function submitNgGuess() {
  const input = document.getElementById('ng-guess-input');
  if (ngGameOver || ngTurn !== 'me') return;
  const val = Number(getFieldValue(input));
  if (!Number.isInteger(val) || val < 1 || val > 100) return;
  setFieldValue(input, '');
  broadcastGameState({ type: 'move', game: 'numberguess', number: val });
  applyNgGuess('me', val);
}

document.getElementById('ng-guess-btn').addEventListener('click', submitNgGuess);
document.getElementById('ng-guess-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitNgGuess(); }
});

document.getElementById('ng-restart-btn').addEventListener('click', () => {
  const layout = newNumberGuessRound(ngFirst);
  broadcastGameState({ type: 'restart', game: 'numberguess', layout });
  resetNumberGuess(layout);
});
