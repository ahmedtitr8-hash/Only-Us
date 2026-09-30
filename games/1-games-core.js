// ============================================================
// games-core.js
// النواة المشتركة لكل الألعاب: اختيار اللعبة، الرجوع، البث المشترك
// (broadcastGameState/handleRemoteGameState)، toArabicDigits.
// يعتمد على core.js (roomsDb, currentRoomCode, myDeviceId, isHost...).
// لازم يتحمّل *قبل* ملفات الألعاب الفردية (xo.js, rps.js, connect4.js,
// memory.js, trivia-questions.js, trivia.js, compat-questions.js, compat.js,
// wyr-questions.js, wyr.js, whoami-questions.js, whoami.js,
// religious-questions.js, religious.js, fastanswer-questions.js,
// fastanswer.js) لأنها كلها تستخدم دواله (broadcastGameState, toArabicDigits)
// وتُسجَّل بـhandleRemoteGameMove/handleRemoteGameRestart بالأسفل.
// ============================================================

// عناصر مشتركة لكل الألعاب (شاشة الاختيار + غلاف اللوحة + زر الرجوع)
const gamePicker = document.getElementById('game-picker');
const gameChoiceBtns = document.querySelectorAll('.game-choice');
const gameBoardWrap = document.getElementById('game-board-wrap');

let activeGame = null; // 'xo' | 'rps' | 'connect4' | 'memory' | 'trivia' | 'compat' | 'wyr' | 'whoami' | 'religious' | 'fastanswer' | null

// ---------- المرحلة ٣ من خطة نقل التزامن: حركات كل الألعاب عبر Firestore ----------
// حقل واحد rooms/{code}.game يحمل آخر حدث لعبة (بداية/حركة/إعادة تشغيل/خروج) ويُستبدل
// بالكامل كل مرة (مو تراكمي) - نفس فكرة currentVideo بـwatch.js. منطق كل لعبة
// (فوز/خسارة/دور مين) يبقى محسوب بالمتصفح تمامًا زي الحين، يتغيّر بس مصدر استقبال
// حركة الطرف الثاني.
let gameSeq = 0;
// كل طرف يكتب أحداثه بحقل خاص فيه (game_host / game_guest) بدل حقل واحد مشترك:
// لما الاثنين يضغطون بنفس اللحظة (مثل ألعاب "أول واحد يجاوب") الحقل المشترك كان
// يضيّع حدث أحدهم (آخر كاتب يمسح الأول). وكمان نستبدل الحقل كامل (update) بدل
// الدمج (merge) عشان ما تبقى حقول قديمة من حدث سابق ملخبطة بالحدث الجديد.
function myGameFieldName() { return isHost ? 'game_host' : 'game_guest'; }
function peerGameFieldName() { return isHost ? 'game_guest' : 'game_host'; }
function broadcastGameState(patch) {
  if (!currentRoomCode) return;
  gameSeq += 1;
  const payload = Object.assign({}, patch, { updatedBy: myDeviceId, seq: gameSeq });
  const ref = roomsDb.collection('rooms').doc(currentRoomCode);
  const field = myGameFieldName();
  ref.update({ [field]: payload }).catch(() => {
    ref.set({ [field]: payload }, { merge: true }).catch(() => {});
  });
}

// كل حدث يتعالج مرة وحدة بس: مستمع مستند الغرفة يشتغل مع أي تغيير بالمستند (كتابة
// بالشات، المايك...) ويعيد تسليم آخر حدث لعبة كل مرة، وهذا كان يكرر الحركات
// القديمة (سبب تكرار تخمين خمّن الرقم وتلخبط الأدوار). نسجل آخر حدث عالجناه.
let lastGameEventId = null;
function primeGameEvents(data) {
  const ev = data && data[peerGameFieldName()];
  lastGameEventId = ev ? `${ev.updatedBy}:${ev.seq}` : null;
}
function handleRemoteGameStates(data) {
  const ev = data && data[peerGameFieldName()];
  if (!ev) return;
  const id = `${ev.updatedBy}:${ev.seq}`;
  if (id === lastGameEventId) return;
  lastGameEventId = id;
  handleRemoteGameState(ev);
}

// تُنادى لكل حدث جديد من الطرف الثاني، وتوزّع حسب type
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

// ---- أصوات صح/غلط مشتركة (Web Audio API بدون ملفات خارجية - تشتغل أوفلاين) ----
let gamesAudioCtx = null;
function gamesGetAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!gamesAudioCtx) gamesAudioCtx = new Ctx();
  if (gamesAudioCtx.state === 'suspended') gamesAudioCtx.resume();
  return gamesAudioCtx;
}
function gamesPlayTone(freq, duration, type, startDelay, volume) {
  try {
    const ctx = gamesGetAudioCtx();
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
  } catch (e) {}
}
function playCorrectSound() {
  gamesPlayTone(880, 0.16, 'sine', 0, 0.22);
  gamesPlayTone(1320, 0.2, 'sine', 0.12, 0.22);
}
function playWrongSound() {
  gamesPlayTone(220, 0.28, 'square', 0, 0.15);
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
    } else if (game === 'compat') {
      const layout = shuffledCompatOrder();
      broadcastGameState({ type: 'start', game, layout });
      startGame(game, true, layout);
    } else if (game === 'wyr') {
      const layout = shuffledWyrOrder();
      broadcastGameState({ type: 'start', game, layout });
      startGame(game, true, layout);
    } else if (game === 'whoami') {
      const layout = shuffledWhoamiOrder();
      broadcastGameState({ type: 'start', game, layout });
      startGame(game, true, layout);
    } else if (game === 'religious') {
      const layout = shuffledReligiousOrder();
      broadcastGameState({ type: 'start', game, layout });
      startGame(game, true, layout);
    } else if (game === 'fastanswer') {
      const layout = shuffledFastanswerOrder();
      broadcastGameState({ type: 'start', game, layout });
      startGame(game, true, layout);
    } else if (game === 'xo' || game === 'connect4') {
      startGame(game, true);
      broadcastGameState({ type: 'start', game, first: game === 'xo' ? xoFirst : c4First });
    } else {
      broadcastGameState({ type: 'start', game });
      startGame(game, true);
    }
  });
});

// ملاحظة: زر الرجوع من داخل إطار اللعبة انحذف - زر "تغيير الفيديو" بالشريط
// العلوي (change-video-btn) صار وحده اللي يرجّع لقائمة الألعاب أثناء اللعب
// (شوف watch.js: بوضع "نلعب" يستدعي exitToPicker بنفس الطريقة بالضبط)

function startGame(game, iInitiated, layout, first) {
  activeGame = game;
  gamePicker.classList.add('hidden');
  gameBoardWrap.classList.remove('hidden');
  xoBoardEl.classList.toggle('hidden', game !== 'xo');
  rpsBoardEl.classList.toggle('hidden', game !== 'rps');
  document.getElementById('connect4-board').classList.toggle('hidden', game !== 'connect4');
  document.getElementById('memory-board').classList.toggle('hidden', game !== 'memory');
  document.getElementById('trivia-board').classList.toggle('hidden', game !== 'trivia');
  document.getElementById('compat-board').classList.toggle('hidden', game !== 'compat');
  document.getElementById('wyr-board').classList.toggle('hidden', game !== 'wyr');
  document.getElementById('whoami-board').classList.toggle('hidden', game !== 'whoami');
  document.getElementById('religious-board').classList.toggle('hidden', game !== 'religious');
  document.getElementById('fastanswer-board').classList.toggle('hidden', game !== 'fastanswer');

  if (game === 'xo') resetXO(first);
  else if (game === 'rps') resetRpsMatch();
  else if (game === 'connect4') resetConnect4(first);
  else if (game === 'memory') resetMemory(layout);
  else if (game === 'trivia') resetTriviaMatch(layout);
  else if (game === 'compat') resetCompatMatch(layout);
  else if (game === 'wyr') resetWyrMatch(layout);
  else if (game === 'whoami') resetWhoamiMatch(layout);
  else if (game === 'religious') resetReligiousMatch(layout);
  else if (game === 'fastanswer') resetFastanswerMatch(layout);
}

function exitToPicker(sendExit) {
  activeGame = null;
  gameBoardWrap.classList.add('hidden');
  gamePicker.classList.remove('hidden');
  // نمسح حقل اللعبة المشترك بس لو احنا اللي طلعنا فعليًا من داخل اللعبة (مو استقبال
  // خروج الطرف الثاني) - عشان ما تفضل بيانات لعبة قديمة بالمستند تسبب دخول تلقائي
  // غلط للعبة قديمة أول ما نرجع الغرفة مرة ثانية (خصوصًا بالغرفة الدائمة)
  if (sendExit) broadcastGameState({ type: 'exit' });
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
  } else if (msg.game === 'trivia' && msg.idx !== undefined) {
    applyTriviaAttempt('peer', msg.idx);
  } else if (msg.game === 'compat' && msg.answer !== undefined) {
    compatPeerAnswer = msg.answer;
    checkCompatResolve();
  } else if (msg.game === 'compat-next') {
    advanceCompat(msg.index);
  } else if (msg.game === 'wyr' && msg.answer !== undefined) {
    wyrPeerAnswer = msg.answer;
    checkWyrResolve();
  } else if (msg.game === 'wyr-next') {
    advanceWyr(msg.index);
  } else if (msg.game === 'whoami' && msg.answer !== undefined) {
    whoamiPeerAnswer = msg.answer;
    checkWhoamiResolve();
  } else if (msg.game === 'whoami-next') {
    advanceWhoami(msg.index);
  } else if (msg.game === 'religious' && msg.idx !== undefined) {
    applyReligiousAttempt('peer', msg.idx);
  } else if (msg.game === 'fastanswer' && msg.idx !== undefined) {
    applyFastanswerAttempt('peer', msg.idx);
  }
}

function handleRemoteGameRestart(msg) {
  if (msg.game === 'xo') resetXO(msg.first);
  else if (msg.game === 'connect4') resetConnect4(msg.first);
  else if (msg.game === 'memory') resetMemory(msg.layout);
  else if (msg.game === 'trivia') resetTriviaMatch(msg.layout);
  else if (msg.game === 'compat') resetCompatMatch(msg.layout);
  else if (msg.game === 'wyr') resetWyrMatch(msg.layout);
  else if (msg.game === 'whoami') resetWhoamiMatch(msg.layout);
  else if (msg.game === 'religious') resetReligiousMatch(msg.layout);
  else if (msg.game === 'fastanswer') resetFastanswerMatch(msg.layout);
}
