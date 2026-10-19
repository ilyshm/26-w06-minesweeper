const DIFFICULTIES = {
  beginner: { label: '초급', rows: 9, columns: 9, mines: 10 },
  intermediate: { label: '중급', rows: 16, columns: 16, mines: 40 },
  expert: { label: '상급', rows: 16, columns: 30, mines: 99 },
};
const RECORDS_KEY = 'minesweeper-best-times';

const boardElement = document.querySelector('#board');
const mineCountElement = document.querySelector('#mineCount');
const timerElement = document.querySelector('#timer');
const resetButton = document.querySelector('#resetButton');
const statusElement = document.querySelector('#status');
const difficultyLabel = document.querySelector('#difficultyLabel');
const difficultySelect = document.querySelector('#difficultySelect');
const audioButton = document.querySelector('#audioButton');
const recordsList = document.querySelector('#recordsList');

let difficultyKey = 'beginner';
let difficulty = DIFFICULTIES[difficultyKey];
let board = [];
let mines = new Set();
let flagged = new Set();
let revealed = new Set();
let elapsedSeconds = 0;
let timerId = null;
let gameState = 'ready';
let audioContext = null;
let bgmTimer = null;
let soundEnabled = true;

function getKey(row, column) {
  return `${row},${column}`;
}

function parseKey(key) {
  return key.split(',').map(Number);
}

function getNeighbors(row, column) {
  const result = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (nextRow >= 0 && nextRow < difficulty.rows && nextColumn >= 0 && nextColumn < difficulty.columns) {
        result.push([nextRow, nextColumn]);
      }
    }
  }
  return result;
}

function setFace(face) {
  resetButton.textContent = face;
}

function updateCounters() {
  mineCountElement.textContent = String(difficulty.mines - flagged.size).padStart(3, '0');
  timerElement.textContent = String(elapsedSeconds).padStart(3, '0');
}

function updateDifficultyLabel() {
  difficultyLabel.textContent = `${difficulty.label} ${String(difficulty.columns).padStart(2, '0')} x ${String(difficulty.rows).padStart(2, '0')}`;
  boardElement.setAttribute('aria-label', `${difficulty.label} ${difficulty.columns} x ${difficulty.rows} 지뢰찾기 게임판`);
}

function startTimer() {
  timerId = setInterval(() => {
    elapsedSeconds += 1;
    updateCounters();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function ensureAudio() {
  if (!soundEnabled) return;
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume();
}

function playTone(frequency, duration = .08, type = 'square', volume = .035) {
  if (!soundEnabled) return;
  ensureAudio();
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function startBgm() {
  if (!soundEnabled || bgmTimer) return;
  ensureAudio();
  if (!audioContext) return;
  const melody = [196, 247, 294, 247];
  let noteIndex = 0;
  bgmTimer = setInterval(() => {
    playTone(melody[noteIndex % melody.length], .18, 'sine', .012);
    noteIndex += 1;
  }, 1500);
}

function stopBgm() {
  clearInterval(bgmTimer);
  bgmTimer = null;
}

function toggleAudio() {
  soundEnabled = !soundEnabled;
  audioButton.textContent = soundEnabled ? '🔊 소리 켜짐' : '🔇 소리 꺼짐';
  audioButton.setAttribute('aria-pressed', String(soundEnabled));
  if (soundEnabled) {
    ensureAudio();
    playTone(440);
    if (gameState === 'playing') startBgm();
  } else {
    stopBgm();
  }
}

function placeMines(firstRow, firstColumn) {
  const protectedArea = new Set(getNeighbors(firstRow, firstColumn).map(([row, column]) => getKey(row, column)));
  const candidates = [];
  for (let row = 0; row < difficulty.rows; row += 1) {
    for (let column = 0; column < difficulty.columns; column += 1) {
      const key = getKey(row, column);
      if (!protectedArea.has(key)) candidates.push(key);
    }
  }
  while (mines.size < difficulty.mines) {
    const randomIndex = Math.floor(Math.random() * candidates.length);
    mines.add(candidates.splice(randomIndex, 1)[0]);
  }
}

function countAdjacentMines(row, column) {
  return getNeighbors(row, column).filter(([nextRow, nextColumn]) => mines.has(getKey(nextRow, nextColumn))).length;
}

function markCellAsOpen(row, column, count) {
  const cell = board[row][column];
  cell.classList.add('is-open');
  cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열, 열린 칸${count ? `, 주변 지뢰 ${count}개` : ''}`);
  if (count > 0) {
    cell.textContent = count;
    cell.dataset.number = count;
  }
}

function revealCell(row, column) {
  const key = getKey(row, column);
  if (revealed.has(key) || flagged.has(key)) return;
  revealed.add(key);
  if (mines.has(key)) {
    const mineCell = board[row][column];
    mineCell.textContent = '*';
    mineCell.classList.add('is-open', 'is-mine', 'is-exploded');
    mineCell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열, 폭발한 지뢰`);
    playTone(90, .35, 'sawtooth', .08);
    finishGame(false, key);
    return;
  }
  const count = countAdjacentMines(row, column);
  markCellAsOpen(row, column, count);
  playTone(count ? 300 + count * 45 : 220, .05, 'sine', .018);
  if (count === 0) getNeighbors(row, column).forEach(([nextRow, nextColumn]) => revealCell(nextRow, nextColumn));
}

function revealMines(explodedKey) {
  mines.forEach((key) => {
    if (key === explodedKey) return;
    const [row, column] = parseKey(key);
    const cell = board[row][column];
    cell.textContent = '*';
    cell.classList.add('is-open', 'is-mine');
    cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열, 지뢰`);
  });
}

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveRecord() {
  const records = getRecords();
  const difficultyRecords = Array.isArray(records[difficultyKey]) ? records[difficultyKey] : [];
  difficultyRecords.push(elapsedSeconds);
  records[difficultyKey] = difficultyRecords.sort((first, second) => first - second).slice(0, 5);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  renderRecords();
}

function renderRecords() {
  const records = getRecords()[difficultyKey] || [];
  recordsList.replaceChildren();
  if (records.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = '아직 기록이 없습니다.';
    recordsList.append(emptyItem);
    return;
  }
  records.forEach((time) => {
    const recordItem = document.createElement('li');
    recordItem.textContent = `${String(time).padStart(3, '0')}초`;
    recordsList.append(recordItem);
  });
}

function finishGame(won, explodedKey = '') {
  gameState = won ? 'won' : 'lost';
  stopTimer();
  stopBgm();
  if (won) {
    setFace('😎');
    statusElement.textContent = `축하합니다! ${difficulty.rows * difficulty.columns - difficulty.mines}개의 안전한 타일을 모두 열었습니다.`;
    mines.forEach((key) => {
      flagged.add(key);
      const [row, column] = parseKey(key);
      board[row][column].textContent = '⚑';
      board[row][column].classList.add('is-flagged');
    });
    saveRecord();
    playTone(523, .12, 'sine', .05);
    setTimeout(() => playTone(659, .18, 'sine', .05), 130);
  } else {
    setFace('😵');
    statusElement.textContent = '지뢰를 밟았습니다. 표정 버튼으로 다시 시작하세요.';
    revealMines(explodedKey);
  }
  updateCounters();
}

function checkForWin() {
  if (revealed.size === difficulty.rows * difficulty.columns - difficulty.mines) finishGame(true);
}

function openCell(row, column) {
  const key = getKey(row, column);
  if (gameState === 'won' || gameState === 'lost' || flagged.has(key)) return;
  ensureAudio();
  startBgm();
  if (gameState === 'ready') {
    placeMines(row, column);
    gameState = 'playing';
    statusElement.textContent = '지뢰를 피해 안전한 타일을 모두 열어보세요.';
    startTimer();
  }
  revealCell(row, column);
  checkForWin();
}

function toggleFlag(row, column) {
  const key = getKey(row, column);
  if (gameState === 'won' || gameState === 'lost' || revealed.has(key)) return;
  ensureAudio();
  const cell = board[row][column];
  if (flagged.has(key)) {
    flagged.delete(key);
    cell.textContent = '';
    cell.classList.remove('is-flagged');
    cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열, 닫힌 칸`);
    playTone(260, .06, 'sine', .025);
  } else if (flagged.size < difficulty.mines) {
    flagged.add(key);
    cell.textContent = '⚑';
    cell.classList.add('is-flagged');
    cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열, 깃발 표시`);
    playTone(520, .06, 'sine', .025);
  }
  updateCounters();
}

function buildBoard() {
  boardElement.replaceChildren();
  boardElement.style.setProperty('--columns', difficulty.columns);
  boardElement.style.setProperty('--rows', difficulty.rows);
  boardElement.classList.toggle('is-expert', difficultyKey === 'expert');
  board = [];
  for (let row = 0; row < difficulty.rows; row += 1) {
    const rowCells = [];
    for (let column = 0; column < difficulty.columns; column += 1) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열, 닫힌 칸`);
      let longPressTimer = null;
      let touchFlagged = false;
      cell.addEventListener('click', () => {
        if (touchFlagged) {
          touchFlagged = false;
          return;
        }
        openCell(row, column);
      });
      cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        toggleFlag(row, column);
      });
      cell.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch') return;
        longPressTimer = setTimeout(() => {
          touchFlagged = true;
          toggleFlag(row, column);
        }, 550);
      });
      cell.addEventListener('pointerup', () => clearTimeout(longPressTimer));
      cell.addEventListener('pointercancel', () => clearTimeout(longPressTimer));
      boardElement.append(cell);
      rowCells.push(cell);
    }
    board.push(rowCells);
  }
}

function resetGame() {
  stopTimer();
  mines = new Set();
  flagged = new Set();
  revealed = new Set();
  elapsedSeconds = 0;
  gameState = 'ready';
  setFace('🙂');
  statusElement.textContent = '첫 타일을 열어 게임을 시작하세요.';
  updateDifficultyLabel();
  updateCounters();
  buildBoard();
  renderRecords();
}

difficultySelect.addEventListener('change', () => {
  difficultyKey = difficultySelect.value;
  difficulty = DIFFICULTIES[difficultyKey];
  resetGame();
});
resetButton.addEventListener('click', resetGame);
audioButton.addEventListener('click', toggleAudio);
resetGame();
