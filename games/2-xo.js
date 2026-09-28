// ============================================================
// xo.js
// كل منطق لعبة إكس أو. يعتمد على games-core.js (broadcastGameState,
// toArabicDigits, isHost من core.js). لازم يتحمّل بعد games-core.js.
// ============================================================

const xoBoardEl = document.getElementById('xo-board');
const xoGrid = document.getElementById('xo-grid');
const xoCells = document.querySelectorAll('.xo-cell');
const xoStatus = document.getElementById('xo-status');
const xoRestartBtn = document.getElementById('xo-restart-btn');
const xoWinLine = document.getElementById('xo-win-line');

let xoBoard = Array(9).fill(null);
let xoMySymbol = 'X';
let xoTurn = 'X';
let xoGameOver = false;
let xoFirst = null; // من بدأ آخر جولة (X أو O)؛ الجولة اللي بعدها يبدأها الثاني

function resetXO(first) {
  xoBoard = Array(9).fill(null);
  xoMySymbol = isHost ? 'X' : 'O';
  // اللي يبدأ الجولة يحدد من يلعب أول ويرسله للطرف الثاني (first)، فيتطابق الطرفين دايمًا
  // حتى لو أحدهم حدّث الصفحة (العدّاد المحلي القديم كان يختلف بينهم ويعلّق اللعبة)
  xoFirst = first || (xoFirst === 'X' ? 'O' : 'X');
  xoTurn = xoFirst;
  xoGameOver = false;
  xoStatus.classList.remove('win', 'lose', 'tie');
  xoRestartBtn.classList.add('hidden');
  clearXoWinLine();
  renderXO();
}

// خط الفوز: خط متحرك يُرسم فوق الخانات الرابحة + توهج على الخانات نفسها
// (أخضر لو فزت، أحمر لو خسرت) - خانة = ٥٢px وفراغ ٦px، فمركز الخانة = عمود*٥٨+٢٦
function clearXoWinLine() {
  xoGrid.classList.remove('win', 'lose');
  xoCells.forEach((c) => c.classList.remove('xo-win'));
  xoWinLine.style.transition = 'none';
  xoWinLine.style.strokeDasharray = '';
  xoWinLine.style.strokeDashoffset = '';
  xoWinLine.setAttribute('x1', 0); xoWinLine.setAttribute('y1', 0);
  xoWinLine.setAttribute('x2', 0); xoWinLine.setAttribute('y2', 0);
  xoWinLine.style.opacity = '0';
}

function drawXoWinLine(line, iWon) {
  const center = (i) => ({ x: (i % 3) * 58 + 26, y: Math.floor(i / 3) * 58 + 26 });
  const a = center(line[0]);
  const c = center(line[2]);
  const len0 = Math.hypot(c.x - a.x, c.y - a.y);
  const ux = (c.x - a.x) / len0;
  const uy = (c.y - a.y) / len0;
  const pad = 16; // نمدّ الخط شوي قبل أول خانة وبعد آخر خانة
  const x1 = a.x - ux * pad, y1 = a.y - uy * pad;
  const x2 = c.x + ux * pad, y2 = c.y + uy * pad;
  const len = len0 + pad * 2;
  xoGrid.classList.add(iWon ? 'win' : 'lose');
  line.forEach((i) => xoCells[i].classList.add('xo-win'));
  xoWinLine.setAttribute('x1', x1); xoWinLine.setAttribute('y1', y1);
  xoWinLine.setAttribute('x2', x2); xoWinLine.setAttribute('y2', y2);
  xoWinLine.style.opacity = '1';
  xoWinLine.style.transition = 'none';
  xoWinLine.style.strokeDasharray = String(len);
  xoWinLine.style.strokeDashoffset = String(len);
  void xoWinLine.getBoundingClientRect(); // إجبار المتصفح يسجّل البداية قبل الأنيميشن
  xoWinLine.style.transition = 'stroke-dashoffset .5s ease-out';
  xoWinLine.style.strokeDashoffset = '0';
}

function renderXO() {
  xoCells.forEach((cell, i) => {
    cell.textContent = xoBoard[i] || '';
    cell.disabled = !!xoBoard[i] || xoGameOver || xoTurn !== xoMySymbol;
  });
  if (!xoGameOver) {
    xoStatus.textContent = xoTurn === xoMySymbol ? 'دورك' : `دور ${peerName || 'الطرف الآخر'}`;
  }
}

xoCells.forEach((cell) => {
  cell.addEventListener('click', () => {
    const i = Number(cell.dataset.i);
    if (xoBoard[i] || xoGameOver || xoTurn !== xoMySymbol) return;
    xoBoard[i] = xoMySymbol;
    broadcastGameState({ type: 'move', game: 'xo', index: i });
    xoTurn = xoMySymbol === 'X' ? 'O' : 'X';
    checkXoResult();
  });
});

const XO_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkXoResult() {
  let winner = null;
  let winLine = null;
  for (const [a,b,c] of XO_LINES) {
    if (xoBoard[a] && xoBoard[a] === xoBoard[b] && xoBoard[b] === xoBoard[c]) { winner = xoBoard[a]; winLine = [a,b,c]; }
  }
  const isFull = xoBoard.every((v) => v);
  if (winner || isFull) {
    xoGameOver = true;
    xoStatus.classList.remove('win', 'lose', 'tie');
    if (!winner) { xoStatus.textContent = 'تعادل'; xoStatus.classList.add('tie'); }
    else if (winner === xoMySymbol) { xoStatus.textContent = 'فزت!'; xoStatus.classList.add('win'); }
    else { xoStatus.textContent = 'خسرت هالجولة'; xoStatus.classList.add('lose'); }
    xoRestartBtn.classList.remove('hidden');
    if (winner) drawXoWinLine(winLine, winner === xoMySymbol);
  }
  renderXO();
}

xoRestartBtn.addEventListener('click', () => {
  resetXO();
  broadcastGameState({ type: 'restart', game: 'xo', first: xoFirst });
});
