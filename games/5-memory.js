// ============================================================
// memory.js
// كل منطق لعبة الذاكرة (الشبكة، القلب، المطابقة). يعتمد على games-core.js
// (broadcastGameState، toArabicDigits، isHost من core.js). لازم يتحمّل
// بعد games-core.js.
// ============================================================

let memoryLayout = [];
let memoryMatched = new Set();
let memoryPending = [];
let memoryMySymbol = 'A';
let memoryTurn = 'A';
let memoryMyScore = 0;
let memoryPeerScore = 0;
let memoryCells = [];

function shuffledMemoryLayout() {
  const values = [];
  for (let v = 0; v < 8; v++) { values.push(v, v); }
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function buildMemoryGrid() {
  const grid = document.getElementById('memory-grid');
  grid.innerHTML = '';
  memoryCells = [];
  for (let i = 0; i < 16; i++) {
    const btn = document.createElement('button');
    btn.className = 'memory-card';
    btn.addEventListener('click', () => onMemoryClick(i));
    grid.appendChild(btn);
    memoryCells.push(btn);
  }
}

function resetMemory(layout) {
  memoryLayout = layout && layout.length === 16 ? layout : shuffledMemoryLayout();
  memoryMatched = new Set();
  memoryPending = [];
  memoryMySymbol = isHost ? 'A' : 'B';
  memoryTurn = 'A';
  memoryMyScore = 0;
  memoryPeerScore = 0;
  document.getElementById('memory-restart-btn').classList.add('hidden');
  if (memoryCells.length === 0) buildMemoryGrid();
  renderMemory();
}

function renderMemory() {
  const status = document.getElementById('memory-status');
  memoryCells.forEach((cell, i) => {
    if (memoryMatched.has(i)) {
      cell.textContent = toArabicDigits(memoryLayout[i] + 1);
      cell.classList.add('matched');
      cell.classList.remove('flipped');
      cell.disabled = true;
    } else if (memoryPending.includes(i)) {
      cell.textContent = toArabicDigits(memoryLayout[i] + 1);
      cell.classList.add('flipped');
      cell.classList.remove('matched');
      cell.disabled = true;
    } else {
      cell.textContent = '';
      cell.classList.remove('flipped', 'matched');
      cell.disabled = memoryTurn !== memoryMySymbol || memoryPending.length >= 2;
    }
  });
  status.textContent = `${toArabicDigits(memoryMyScore)} - ${toArabicDigits(memoryPeerScore)}`;
}

function onMemoryClick(i) {
  if (memoryTurn !== memoryMySymbol) return;
  if (memoryMatched.has(i) || memoryPending.includes(i) || memoryPending.length >= 2) return;
  flipMemoryCard(i);
  broadcastGameState({ type: 'move', game: 'memory', action: 'flip', index: i });
}

function flipMemoryCard(i) {
  memoryPending.push(i);
  renderMemory();
  if (memoryPending.length === 2) setTimeout(resolveMemoryPair, 700);
}

function resolveMemoryPair() {
  const [a, b] = memoryPending;
  if (memoryLayout[a] === memoryLayout[b]) {
    memoryMatched.add(a); memoryMatched.add(b);
    if (memoryTurn === memoryMySymbol) memoryMyScore++; else memoryPeerScore++;
  } else {
    memoryTurn = memoryTurn === 'A' ? 'B' : 'A';
  }
  memoryPending = [];
  renderMemory();
  if (memoryMatched.size === 16) {
    document.getElementById('memory-restart-btn').classList.remove('hidden');
  }
}

document.getElementById('memory-restart-btn').addEventListener('click', () => {
  const layout = shuffledMemoryLayout();
  resetMemory(layout);
  broadcastGameState({ type: 'restart', game: 'memory', layout });
});
