const BOARD_SIZE = 9;
const MINE_COUNT = 10;

const boardElement = document.querySelector('#board');
const mineCountElement = document.querySelector('#mineCount');
const timerElement = document.querySelector('#timer');
const resetButton = document.querySelector('#resetButton');
const statusElement = document.querySelector('#status');

let board = [];
let mines = new Set();
let flagged = new Set();
let revealed = new Set();
let elapsedSeconds = 0;
let timerId = null;
let gameState = 'ready';

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
      if (nextRow >= 0 && nextRow < BOARD_SIZE && nextColumn >= 0 && nextColumn < BOARD_SIZE) {
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
  mineCountElement.textContent = String(MINE_COUNT - flagged.size).padStart(3, '0');
  timerElement.textContent = String(elapsedSeconds).padStart(3, '0');
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

function placeMines(firstRow, firstColumn) {
  const protectedArea = new Set(getNeighbors(firstRow, firstColumn).map(([row, column]) => getKey(row, column)));
  const candidates = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const key = getKey(row, column);
      if (!protectedArea.has(key)) candidates.push(key);
    }
  }

  while (mines.size < MINE_COUNT) {
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
    finishGame(false, key);
    return;
  }

  const count = countAdjacentMines(row, column);
  markCellAsOpen(row, column, count);
  if (count === 0) {
    getNeighbors(row, column).forEach(([nextRow, nextColumn]) => revealCell(nextRow, nextColumn));
  }
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

function finishGame(won, explodedKey = '') {
  gameState = won ? 'won' : 'lost';
  stopTimer();
  if (won) {
    setFace('😎');
    statusElement.textContent = '축하합니다! 지뢰가 없는 71개의 타일을 모두 열었습니다.';
    mines.forEach((key) => {
      flagged.add(key);
      const [row, column] = parseKey(key);
      board[row][column].textContent = '⚑';
      board[row][column].classList.add('is-flagged');
    });
  } else {
    setFace('😵');
    statusElement.textContent = '지뢰를 밟았습니다. 표정 버튼으로 다시 시작하세요.';
    revealMines(explodedKey);
  }
  updateCounters();
}

function checkForWin() {
  if (revealed.size === BOARD_SIZE * BOARD_SIZE - MINE_COUNT) finishGame(true);
}

function openCell(row, column) {
  const key = getKey(row, column);
  if (gameState === 'won' || gameState === 'lost' || flagged.has(key)) return;

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

  const cell = board[row][column];
  if (flagged.has(key)) {
    flagged.delete(key);
    cell.textContent = '';
    cell.classList.remove('is-flagged');
    cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열, 닫힌 칸`);
  } else if (flagged.size < MINE_COUNT) {
    flagged.add(key);
    cell.textContent = '⚑';
    cell.classList.add('is-flagged');
    cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열, 깃발 표시`);
  }
  updateCounters();
}

function buildBoard() {
  boardElement.replaceChildren();
  board = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const rowCells = [];
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열, 닫힌 칸`);
      cell.addEventListener('click', () => openCell(row, column));
      cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        toggleFlag(row, column);
      });
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
  statusElement.textContent = '표정 버튼을 누르거나 첫 칸을 열어 게임을 시작하세요.';
  updateCounters();
  buildBoard();
}

resetButton.addEventListener('click', resetGame);
resetGame();