// ============================================================
// games.js
// كل الألعاب (وضع "نلعب" فقط). يعتمد على core.js لأشياء مثل
// sendData, isHost, myName, peerName...
// ============================================================

// عناصر الألعاب
const gamePicker = document.getElementById('game-picker');
const gameChoiceBtns = document.querySelectorAll('.game-choice');
const gameBoardWrap = document.getElementById('game-board-wrap');
const gameBackBtn = document.getElementById('game-back-btn');
const xoBoardEl = document.getElementById('xo-board');
const xoGrid = document.getElementById('xo-grid');
const xoCells = document.querySelectorAll('.xo-cell');
const xoStatus = document.getElementById('xo-status');
const xoRestartBtn = document.getElementById('xo-restart-btn');
const rpsBoardEl = document.getElementById('rps-board');
const rpsScoreEl = document.getElementById('rps-score');
const rpsChoiceBtns = document.querySelectorAll('.rps-choice');
const rpsWaiting = document.getElementById('rps-waiting');
const rpsResult = document.getElementById('rps-result');
const rpsReveal = document.getElementById('rps-reveal');
const rpsResultText = document.getElementById('rps-result-text');
const rpsNextBtn = document.getElementById('rps-next-btn');

// ================= الألعاب =================

let activeGame = null; // 'xo' | 'rps' | 'connect4' | 'memory' | 'trivia' | 'numberguess' | null

// ---------- المرحلة ٣ من خطة نقل التزامن: حركات كل الألعاب عبر Firestore ----------
// حقل واحد rooms/{code}.game يحمل آخر حدث لعبة (بداية/حركة/إعادة تشغيل/خروج) ويُستبدل
// بالكامل كل مرة (مو تراكمي) - نفس فكرة currentVideo بـwatch.js. منطق كل لعبة
// (فوز/خسارة/دور مين) يبقى محسوب بالمتصفح تمامًا زي الحين، يتغيّر بس مصدر استقبال
// حركة الطرف الثاني.
let gameSeq = 0;
function broadcastGameState(patch) {
  if (!currentRoomCode) return;
  gameSeq += 1;
  roomsDb.collection('rooms').doc(currentRoomCode).set(
    { game: Object.assign({ updatedBy: myDeviceId, seq: gameSeq }, patch) },
    { merge: true }
  ).catch(() => {});
}

// تُنادى من مستمع rooms/{code} المشترك بـcore.js (setupFirestoreChatSync) كل ما يتحدث
// حقل game - تتجاهل تحديثاتنا احنا، وتوزّع الباقي حسب type زي ما كانت dataConn.on('data')
// توزّع kind سابقًا.
function handleRemoteGameState(data) {
  if (!data || data.updatedBy === myDeviceId) return;
  switch (data.type) {
    case 'start':
      startGame(data.game, false, data.layout, data.first);
      break;
    case 'move':
      handleRemoteGameMove(data);
      break;
    case 'restart':
      handleRemoteGameRestart(data);
      break;
    case 'exit':
      exitToPicker(false);
      break;
  }
}

function toArabicDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

// ================= اختيار اللعبة / الرجوع =================

gameChoiceBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const game = btn.dataset.game;
    if (game === 'memory') {
      const layout = shuffledMemoryLayout();
      broadcastGameState({ type: 'start', game, layout });
      startGame(game, true, layout);
    } else if (game === 'trivia') {
      const layout = shuffledTriviaOrder();
      broadcastGameState({ type: 'start', game, layout });
      startGame(game, true, layout);
    } else if (game === 'numberguess') {
      startGame(game, true);
    } else if (game === 'xo' || game === 'connect4') {
      startGame(game, true);
      broadcastGameState({ type: 'start', game, first: game === 'xo' ? xoFirst : c4First });
    } else {
      broadcastGameState({ type: 'start', game });
      startGame(game, true);
    }
  });
});

gameBackBtn.addEventListener('click', () => {
  broadcastGameState({ type: 'exit' });
  exitToPicker(true);
});

function startGame(game, iInitiated, layout, first) {
  activeGame = game;
  gamePicker.classList.add('hidden');
  gameBoardWrap.classList.remove('hidden');
  xoBoardEl.classList.toggle('hidden', game !== 'xo');
  rpsBoardEl.classList.toggle('hidden', game !== 'rps');
  document.getElementById('connect4-board').classList.toggle('hidden', game !== 'connect4');
  document.getElementById('memory-board').classList.toggle('hidden', game !== 'memory');
  document.getElementById('trivia-board').classList.toggle('hidden', game !== 'trivia');
  document.getElementById('numberguess-board').classList.toggle('hidden', game !== 'numberguess');

  if (game === 'xo') resetXO(first);
  else if (game === 'rps') resetRpsMatch();
  else if (game === 'connect4') resetConnect4(first);
  else if (game === 'memory') resetMemory(layout);
  else if (game === 'trivia') resetTriviaMatch(layout);
  else if (game === 'numberguess') {
    resetNumberGuess();
    if (!iInitiated) activateNgGuesserView();
  }
}

function exitToPicker(sendExit) {
  activeGame = null;
  gameBoardWrap.classList.add('hidden');
  gamePicker.classList.remove('hidden');
}

function handleRemoteGameMove(msg) {
  if (msg.game === 'xo') {
    const opponentSymbol = xoMySymbol === 'X' ? 'O' : 'X';
    xoBoard[msg.index] = opponentSymbol;
    renderXO();
    xoTurn = xoMySymbol;
    checkXoResult();
  } else if (msg.game === 'rps') {
    rpsPeerChoice = msg.choice;
    checkRpsResolve();
  } else if (msg.game === 'rps-next') {
    resetRpsRound();
  } else if (msg.game === 'connect4') {
    const opponentSymbol = c4MySymbol === 'A' ? 'B' : 'A';
    dropDisc(msg.col, opponentSymbol);
    c4Turn = c4MySymbol;
    checkConnect4Result();
  } else if (msg.game === 'memory' && msg.action === 'flip') {
    flipMemoryCard(msg.index);
  } else if (msg.game === 'trivia' && msg.answer !== undefined) {
    triviaPeerAnswer = msg.answer;
    checkTriviaResolve();
  } else if (msg.game === 'trivia-next') {
    advanceTrivia(msg.index);
  } else if (msg.game === 'numberguess' && msg.number !== undefined && msg.result === undefined) {
    resolveNgGuess(msg.number);
  } else if (msg.game === 'numberguess' && msg.result !== undefined) {
    // نحدّث سطر التخمين اللي كان "بانتظار الرد" بدل ما نضيف سطر ثاني مكرر
    const pending = ngHistory.find((e) => e.hint === null && e.number === msg.number);
    if (pending) pending.hint = msg.result;
    else ngHistory.push({ number: msg.number, hint: msg.result });
    renderNgLog();
    document.getElementById('ng-guess-input').disabled = false;
    document.getElementById('ng-guess-btn').disabled = false;
    document.getElementById('ng-guess-input').value = '';
    if (msg.result === 'correct') {
      ngGameOver = true;
      const status = document.getElementById('ng-status');
      status.classList.remove('win', 'lose', 'tie');
      status.textContent = 'عرفتها! فزت!';
      status.classList.add('win');
      document.getElementById('ng-restart-btn').classList.remove('hidden');
    }
  }
}

function handleRemoteGameRestart(msg) {
  if (msg.game === 'xo') resetXO(msg.first);
  else if (msg.game === 'connect4') resetConnect4(msg.first);
  else if (msg.game === 'memory') resetMemory(msg.layout);
  else if (msg.game === 'trivia') resetTriviaMatch(msg.layout);
  else if (msg.game === 'numberguess') resetNumberGuess();
}

// ================= إكس أو =================

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
    xoStatus.textContent = xoTurn === xoMySymbol ? 'دورك' : 'دور الطرف الآخر';
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

// ================= حجر ورقة مقص =================

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
  rpsReveal.textContent = `أنت: ${RPS_LABELS[rpsMyChoice]}  —  الطرف الآخر: ${RPS_LABELS[rpsPeerChoice]}`;

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

// ================= أربح أربعة =================

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
  if (!c4GameOver) status.textContent = c4Turn === c4MySymbol ? 'دورك' : 'دور الطرف الآخر';
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

// ================= الذاكرة =================

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

// ================= تحدي المعلومات =================

const TRIVIA_BANK = [
  { q: 'ما عاصمة السعودية؟', options: ['الرياض', 'جدة', 'مكة المكرمة', 'الدمام'], correct: 0 },
  { q: 'كم عدد لاعبي فريق كرة القدم الأساسيين بالملعب؟', options: ['٩', '١٠', '١١', '١٢'], correct: 2 },
  { q: 'ما أكبر محيط في العالم؟', options: ['الأطلسي', 'الهادئ', 'الهندي', 'المتجمد الشمالي'], correct: 1 },
  { q: 'كم عدد قارات العالم؟', options: ['٥', '٦', '٧', '٨'], correct: 2 },
  { q: 'ما عاصمة فرنسا؟', options: ['باريس', 'ليون', 'مرسيليا', 'نيس'], correct: 0 },
  { q: 'كم عدد ألوان قوس قزح؟', options: ['٥', '٦', '٧', '٨'], correct: 2 },
  { q: 'ما أكبر كوكب في مجموعتنا الشمسية؟', options: ['الأرض', 'المشتري', 'زحل', 'نبتون'], correct: 1 },
  { q: 'ما عملة اليابان؟', options: ['الين', 'الوون', 'اليوان', 'الروبية'], correct: 0 },
  { q: 'كم عدد أضلاع المربع؟', options: ['٣', '٤', '٥', '٦'], correct: 1 },
  { q: 'ما أسرع حيوان بري في العالم؟', options: ['الفهد', 'الأسد', 'الحصان', 'النمر'], correct: 0 },
  { q: 'كم عدد أشهر السنة الهجرية؟', options: ['١٠', '١١', '١٢', '١٣'], correct: 2 },
  { q: 'ما أصغر قارة من حيث المساحة؟', options: ['أستراليا', 'أوروبا', 'أفريقيا', 'آسيا'], correct: 0 },
  { q: 'كم عدد أيام السنة الكبيسة؟', options: ['٣٦٤', '٣٦٥', '٣٦٦', '٣٦٧'], correct: 2 },
  { q: 'من اخترع المصباح الكهربائي المعروف؟', options: ['توماس إديسون', 'إسحاق نيوتن', 'ألبرت أينشتاين', 'غاليليو غاليلي'], correct: 0 },
  { q: 'كم عدد حروف اللغة العربية؟', options: ['٢٦', '٢٧', '٢٨', '٢٩'], correct: 2 },
  { q: 'ما أطول نهر معروف في العالم؟', options: ['النيل', 'الأمازون', 'المسيسيبي', 'اليانغتسي'], correct: 0 },
];

let triviaOrder = [];
let triviaIndex = 0;
let triviaMyAnswer = null;
let triviaPeerAnswer = null;
let triviaRoundActive = true;
let triviaMyScore = 0;
let triviaPeerScore = 0;

function shuffledTriviaOrder() {
  const idx = TRIVIA_BANK.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, 10);
}

function resetTriviaMatch(order) {
  triviaOrder = order && order.length ? order : shuffledTriviaOrder();
  triviaIndex = 0;
  triviaMyScore = 0;
  triviaPeerScore = 0;
  document.getElementById('trivia-restart-btn').classList.add('hidden');
  document.getElementById('trivia-next-btn').classList.add('hidden');
  document.getElementById('trivia-options').classList.remove('hidden');
  loadTriviaQuestion();
}

function loadTriviaQuestion() {
  triviaMyAnswer = null;
  triviaPeerAnswer = null;
  triviaRoundActive = true;
  const q = TRIVIA_BANK[triviaOrder[triviaIndex]];
  document.getElementById('trivia-progress').textContent = `سؤال ${toArabicDigits(triviaIndex + 1)} من ${toArabicDigits(triviaOrder.length)}`;
  document.getElementById('trivia-question').textContent = q.q;
  document.getElementById('trivia-score').textContent = `${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)}`;
  document.querySelectorAll('.trivia-option').forEach((btn, i) => {
    btn.textContent = q.options[i];
    btn.disabled = false;
    btn.classList.remove('correct', 'wrong', 'my-pick');
  });
  document.getElementById('trivia-options').classList.remove('hidden');
  document.getElementById('trivia-next-btn').classList.add('hidden');
}

document.querySelectorAll('.trivia-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!triviaRoundActive) return;
    const idx = Number(btn.dataset.idx);
    triviaMyAnswer = idx;
    document.querySelectorAll('.trivia-option').forEach((b) => (b.disabled = true));
    btn.classList.add('my-pick');
    broadcastGameState({ type: 'move', game: 'trivia', answer: idx });
    checkTriviaResolve();
  });
});

function checkTriviaResolve() {
  if (!triviaRoundActive || triviaMyAnswer === null || triviaPeerAnswer === null) return;
  triviaRoundActive = false;
  const q = TRIVIA_BANK[triviaOrder[triviaIndex]];
  document.querySelectorAll('.trivia-option').forEach((btn, i) => {
    if (i === q.correct) btn.classList.add('correct');
    else if (i === triviaMyAnswer) btn.classList.add('wrong');
  });
  if (triviaMyAnswer === q.correct) triviaMyScore++;
  if (triviaPeerAnswer === q.correct) triviaPeerScore++;
  document.getElementById('trivia-score').textContent = `${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)}`;
  document.getElementById('trivia-next-btn').classList.remove('hidden');
  document.getElementById('trivia-next-btn').textContent = (triviaIndex + 1 < triviaOrder.length) ? 'السؤال التالي' : 'عرض النتيجة';
}

document.getElementById('trivia-next-btn').addEventListener('click', () => {
  const from = triviaIndex;
  broadcastGameState({ type: 'move', game: 'trivia-next', index: from });
  advanceTrivia(from);
});

function advanceTrivia(fromIndex) {
  // لو ضغط الطرفين "التالي" بنفس اللحظة، الرسالة اللي توصل من سؤال سبق وتجاوزناه تُتجاهل (بدل ما نقفز سؤالين)
  if (fromIndex !== undefined && fromIndex !== triviaIndex) return;
  if (triviaIndex + 1 < triviaOrder.length) {
    triviaIndex++;
    loadTriviaQuestion();
  } else {
    showTriviaFinal();
  }
}

function showTriviaFinal() {
  const status = document.getElementById('trivia-question');
  status.textContent = triviaMyScore === triviaPeerScore
    ? `انتهت الأسئلة! تعادلتوا (${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)})`
    : (triviaMyScore > triviaPeerScore
      ? `انتهت الأسئلة! فزت (${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)})`
      : `انتهت الأسئلة! خسرت (${toArabicDigits(triviaMyScore)} - ${toArabicDigits(triviaPeerScore)})`);
  document.getElementById('trivia-progress').textContent = '';
  document.getElementById('trivia-options').classList.add('hidden');
  document.getElementById('trivia-next-btn').classList.add('hidden');
  document.getElementById('trivia-restart-btn').classList.remove('hidden');
}

document.getElementById('trivia-restart-btn').addEventListener('click', () => {
  const order = shuffledTriviaOrder();
  resetTriviaMatch(order);
  broadcastGameState({ type: 'restart', game: 'trivia', layout: order });
});

// ================= خمّن الرقم =================

let ngSecret = null;
let ngGameOver = false;
let ngHistory = [];

function resetNumberGuess() {
  ngSecret = null;
  ngGameOver = false;
  ngHistory = [];
  renderNgLog();
  document.getElementById('ng-restart-btn').classList.add('hidden');
  document.getElementById('ng-guess-area').classList.add('hidden');
  document.getElementById('ng-host-setup').classList.add('hidden');
  document.getElementById('ng-guess-input').disabled = false;
  document.getElementById('ng-guess-btn').disabled = false;
  document.getElementById('ng-guess-input').value = '';
  document.getElementById('ng-secret-input').value = '';
  const status = document.getElementById('ng-status');
  status.classList.remove('win', 'lose', 'tie');
  if (isHost) {
    document.getElementById('ng-host-setup').classList.remove('hidden');
    status.textContent = 'حدد رقمك السري';
  } else {
    status.textContent = 'بانتظار المضيف يجهز رقم سري...';
  }
}

function activateNgGuesserView() {
  document.getElementById('ng-guess-area').classList.remove('hidden');
  document.getElementById('ng-status').textContent = 'خمّن رقم من ١ إلى ١٠٠';
}

document.getElementById('ng-start-btn').addEventListener('click', () => {
  const input = document.getElementById('ng-secret-input');
  const val = Number(input.value);
  if (!Number.isInteger(val) || val < 1 || val > 100) return;
  ngSecret = val;
  input.value = '';
  document.getElementById('ng-host-setup').classList.add('hidden');
  document.getElementById('ng-status').textContent = 'بانتظار تخمين الطرف الآخر...';
  broadcastGameState({ type: 'start', game: 'numberguess' });
});

document.getElementById('ng-guess-btn').addEventListener('click', () => {
  const input = document.getElementById('ng-guess-input');
  const val = Number(input.value);
  if (!Number.isInteger(val) || val < 1 || val > 100 || ngGameOver) return;
  broadcastGameState({ type: 'move', game: 'numberguess', number: val });
  ngHistory.push({ number: val, hint: null });
  renderNgLog();
  document.getElementById('ng-guess-btn').disabled = true;
  document.getElementById('ng-guess-input').disabled = true;
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
    status.textContent = 'الطرف الآخر عرف الرقم!';
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
