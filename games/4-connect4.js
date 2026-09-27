// ============================================================
// connect4.js
// كل منطق لعبة أربح أربعة (الشبكة، إسقاط القرص، فحص الفوز). يعتمد على
// games-core.js (broadcastGameState، isHost من core.js). لازم يتحمّل
// بعد games-core.js.
// ============================================================

const C4_COLS = 7;
const C4_ROWS = 6;
let c4Board = [];
let c4MySymbol = 'A';
let c4Turn = 'A';
let c4GameOver = false;
let c4Cells = [];
let c4First = null; // من بدأ آخر جولة (A أو B)؛ الجولة اللي بعدها يبدأها الثاني

function buildConnect4Grid() {
  const grid = document.getElementById('connect4-grid');
  grid.innerHTML = '';
  c4Cells = [];
  for (let i = 0; i < C4_COLS * C4_ROWS; i++) {
    const btn = document.createElement('button');
    btn.className = 'connect4-cell';
    btn.addEventListener('click', () => onConnect4Click(i % C4_COLS));
    grid.appendChild(btn);
    c4Cells.push(btn);
  }
}

function resetConnect4(first) {
  c4Board = Array(C4_COLS * C4_ROWS).fill(null);
  c4MySymbol = isHost ? 'A' : 'B';
  c4First = first || (c4First === 'A' ? 'B' : 'A');
  c4Turn = c4First;
  c4GameOver = false;
  document.getElementById('connect4-status').classList.remove('win', 'lose', 'tie');
  document.getElementById('connect4-restart-btn').classList.add('hidden');
  if (c4Cells.length === 0) buildConnect4Grid();
  renderConnect4();
}

function renderConnect4() {
  const status = document.getElementById('connect4-status');
  c4Cells.forEach((cell, i) => {
    cell.classList.remove('c4-me', 'c4-peer');
    if (c4Board[i] === c4MySymbol) cell.classList.add('c4-me');
    else if (c4Board[i]) cell.classList.add('c4-peer');
    cell.disabled = c4GameOver || c4Turn !== c4MySymbol;
  });
  if (!c4GameOver) status.textContent = c4Turn === c4MySymbol ? 'دورك' : `دور ${peerName || 'الطرف الآخر'}`;
}

function dropDisc(col, symbol) {
  for (let row = C4_ROWS - 1; row >= 0; row--) {
    const idx = row * C4_COLS + col;
    if (!c4Board[idx]) { c4Board[idx] = symbol; return idx; }
  }
  return -1;
}

function onConnect4Click(col) {
  if (c4GameOver || c4Turn !== c4MySymbol) return;
  const idx = dropDisc(col, c4MySymbol);
  if (idx === -1) return;
  renderConnect4();
  broadcastGameState({ type: 'move', game: 'connect4', col });
  c4Turn = c4MySymbol === 'A' ? 'B' : 'A';
  checkConnect4Result();
}

function checkConnect4Result() {
  const status = document.getElementById('connect4-status');
  const winner = getConnect4Winner();
  const isFull = c4Board.every((v) => v);
  if (winner || isFull) {
    c4GameOver = true;
    status.classList.remove('win', 'lose', 'tie');
    if (!winner) { status.textContent = 'تعادل'; status.classList.add('tie'); }
    else if (winner === c4MySymbol) { status.textContent = 'فزت!'; status.classList.add('win'); }
    else { status.textContent = 'خسرت هالجولة'; status.classList.add('lose'); }
    document.getElementById('connect4-restart-btn').classList.remove('hidden');
  }
  renderConnect4();
}

function getConnect4Winner() {
  const at = (r, c) => (r < 0 || r >= C4_ROWS || c < 0 || c >= C4_COLS) ? null : c4Board[r * C4_COLS + c];
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const sym = at(r, c);
      if (!sym) continue;
      for (const [dr, dc] of dirs) {
        if (at(r+dr,c+dc)===sym && at(r+2*dr,c+2*dc)===sym && at(r+3*dr,c+3*dc)===sym) return sym;
      }
    }
  }
  return null;
}

document.getElementById('connect4-restart-btn').addEventListener('click', () => {
  resetConnect4();
  broadcastGameState({ type: 'restart', game: 'connect4', first: c4First });
});
