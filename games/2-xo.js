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
  renderXO();
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
  for (const [a,b,c] of XO_LINES) {
    if (xoBoard[a] && xoBoard[a] === xoBoard[b] && xoBoard[b] === xoBoard[c]) winner = xoBoard[a];
  }
  const isFull = xoBoard.every((v) => v);
  if (winner || isFull) {
    xoGameOver = true;
    xoStatus.classList.remove('win', 'lose', 'tie');
    if (!winner) { xoStatus.textContent = 'تعادل'; xoStatus.classList.add('tie'); }
    else if (winner === xoMySymbol) { xoStatus.textContent = 'فزت!'; xoStatus.classList.add('win'); }
    else { xoStatus.textContent = 'خسرت هالجولة'; xoStatus.classList.add('lose'); }
    xoRestartBtn.classList.remove('hidden');
  }
  renderXO();
}

xoRestartBtn.addEventListener('click', () => {
  resetXO();
  broadcastGameState({ type: 'restart', game: 'xo', first: xoFirst });
});
