const BOARD_SIZE = 9;
const MINE_TOTAL = 10;

const boardElement = document.querySelector('#board');
const mineCountElement = document.querySelector('#mineCount');
const timerElement = document.querySelector('#timer');
const statusElement = document.querySelector('#status');
const resetButton = document.querySelector('#resetButton');

let cells = [];
let mines = new Set();
let flags = new Set();
let revealed = new Set();
let timerId = null;
let elapsedSeconds = 0;
let gameState = 'ready';

function cellKey(row, column) {
  return `${row},${column}`;
}

function neighbors(row, column) {
  const result = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (nextRow >= 0 && nextRow < BOARD_SIZE && nextColumn >= 0 && nextColumn < BOARD_SIZE) {
        result.push([nextRow, nextColumn]);
      }
    }
  }
  return result;
}

function placeMines(firstKey) {
  const available = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const key = cellKey(row, column);
      if (key !== firstKey) available.push(key);
    }
  }

  while (mines.size < MINE_TOTAL) {
    const randomIndex = Math.floor(Math.random() * available.length);
    mines.add(available.splice(randomIndex, 1)[0]);
  }
}

function adjacentMineCount(row, column) {
  return neighbors(row, column).filter(([nextRow, nextColumn]) => mines.has(cellKey(nextRow, nextColumn))).length;
}

function startTimer() {
  timerId = setInterval(() => {
    elapsedSeconds += 1;
    timerElement.textContent = String(elapsedSeconds).padStart(3, '0');
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function updateMineCount() {
  mineCountElement.textContent = String(MINE_TOTAL - flags.size).padStart(2, '0');
}

function revealCell(row, column) {
  const key = cellKey(row, column);
  if (revealed.has(key) || flags.has(key)) return;

  revealed.add(key);
  const cell = cells[row][column];
  cell.classList.add('is-open');

  if (mines.has(key)) {
    cell.textContent = 'M';
    cell.classList.add('is-mine', 'is-exploded');
    endGame(false, key);
    return;
  }

  const count = adjacentMineCount(row, column);
  if (count > 0) {
    cell.textContent = count;
    cell.dataset.number = count;
    return;
  }

  neighbors(row, column).forEach(([nextRow, nextColumn]) => revealCell(nextRow, nextColumn));
}

function revealAllMines(explodedKey) {
  mines.forEach((key) => {
    if (key === explodedKey) return;
    const [row, column] = key.split(',').map(Number);
    const cell = cells[row][column];
    cell.textContent = 'M';
    cell.classList.add('is-mine');
  });
}

function endGame(isWin, explodedKey = '') {
  gameState = isWin ? 'won' : 'lost';
  stopTimer();
  if (isWin) {
    statusElement.textContent = '성공! 모든 안전한 칸을 열었습니다.';
    flags = new Set(mines);
    mines.forEach((key) => {
      const [row, column] = key.split(',').map(Number);
      cells[row][column].textContent = 'F';
      cells[row][column].classList.add('is-flagged');
    });
  } else {
    statusElement.textContent = '지뢰를 밟았습니다. 새 게임으로 다시 도전하세요.';
    revealAllMines(explodedKey);
  }
  updateMineCount();
}

function checkWin() {
  if (revealed.size === BOARD_SIZE * BOARD_SIZE - MINE_TOTAL) endGame(true);
}

function handleLeftClick(row, column) {
  if (gameState === 'won' || gameState === 'lost' || flags.has(cellKey(row, column))) return;
  if (gameState === 'ready') {
    placeMines(cellKey(row, column));
    gameState = 'playing';
    statusElement.textContent = '지뢰를 피해 안전한 칸을 모두 열어보세요.';
    startTimer();
  }
  revealCell(row, column);
  checkWin();
}

function handleRightClick(row, column) {
  const key = cellKey(row, column);
  if (gameState === 'won' || gameState === 'lost' || revealed.has(key)) return;
  const cell = cells[row][column];
  if (flags.has(key)) {
    flags.delete(key);
    cell.textContent = '';
    cell.classList.remove('is-flagged');
  } else if (flags.size < MINE_TOTAL) {
    flags.add(key);
    cell.textContent = 'F';
    cell.classList.add('is-flagged');
  }
  updateMineCount();
}

function buildBoard() {
  boardElement.replaceChildren();
  cells = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const rowCells = [];
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${row + 1}행 ${column + 1}열, 닫힌 칸`);
      cell.addEventListener('click', () => handleLeftClick(row, column));
      cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        handleRightClick(row, column);
      });
      boardElement.append(cell);
      rowCells.push(cell);
    }
    cells.push(rowCells);
  }
}

function resetGame() {
  stopTimer();
  mines = new Set();
  flags = new Set();
  revealed = new Set();
  elapsedSeconds = 0;
  gameState = 'ready';
  timerElement.textContent = '000';
  statusElement.textContent = '첫 칸을 열어 게임을 시작하세요.';
  updateMineCount();
  buildBoard();
}

resetButton.addEventListener('click', resetGame);
resetGame();