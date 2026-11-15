'use strict';

const MAX_ATTEMPTS = 6;
const LENGTH = 5;
const TIME_ZONE = 'Europe/Madrid';
const DAILY_STORAGE_PREFIX = 'azure-wordle-daily-v2:';
const board = document.querySelector('#board');
const keyboard = document.querySelector('#keyboard');
const message = document.querySelector('#message');
const shareButton = document.querySelector('#share-whatsapp');
const dayInfo = document.querySelector('#day-info');
const newGameButton = document.querySelector('#new-game');
const dailyButton = document.querySelector('#daily-mode');
const freeButton = document.querySelector('#free-mode');
const priority = { absent: 1, present: 2, correct: 3 };

let solutions = [];
let allowedWords = new Set();
let dictionaryVersion = '';
let mode = 'daily';
let dayId = '';
let secret = '';
let attempt = 0;
let guess = Array(LENGTH).fill('');
let selectedColumn = 0;
let finished = true;
let history = [];
let keyStates = {};

function normalizeWord(value) {
  return value.trim().toUpperCase()
    .replace(/Ñ/g, '\uE000')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\uE000/g, 'Ñ');
}

function validWord(word) {
  return /^[A-ZÑ]{5}$/.test(word);
}

// La fecha civil de Madrid, con cambio a las 06:00, sin depender del huso del dispositivo.
function madridDayId(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(now).filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
  let date = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) < 6) {
    const previous = new Date(`${date}T12:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    date = previous.toISOString().slice(0, 10);
  }
  return date;
}

// Hash estable: misma fecha + mismo diccionario => misma palabra para todos.
function hashText(text) {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function dailyWord(id) {
  return solutions[hashText(`wordle:${id}:${dictionaryVersion}`) % solutions.length];
}

function setMessage(text) {
  message.textContent = text;
}

function storageKey() {
  return `${DAILY_STORAGE_PREFIX}${dictionaryVersion}:${dayId}`;
}

function saveDaily() {
  if (mode !== 'daily') return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ history, guess: guess.join('') }));
  } catch (error) {
    console.warn('No se pudo guardar el progreso:', error);
  }
}

function restoreDaily() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    if (!saved || !Array.isArray(saved.history)) return;
    const restored = saved.history.map(item => String(item));
    if (restored.length > MAX_ATTEMPTS || restored.some(word => !validWord(word) || !allowedWords.has(word))) return;
    // No aceptar jugadas posteriores a una victoria.
    const winAt = restored.indexOf(secret);
    if (winAt !== -1 && winAt !== restored.length - 1) return;
    history = restored;
    finished = winAt !== -1 || history.length === MAX_ATTEMPTS;
    const pending = typeof saved.guess === 'string' ? saved.guess : '';
    if (!finished && /^[A-ZÑ ]{0,5}$/.test(pending)) {
      guess = Array.from({ length: LENGTH }, (_, i) => pending[i] === ' ' ? '' : (pending[i] || ''));
      selectedColumn = Math.min(Math.max(pending.trimEnd().length, 0), LENGTH - 1);
    }
  } catch (error) {
    console.warn('No se pudo restaurar el progreso:', error);
  }
}

function buildBoard() {
  board.replaceChildren();
  for (let row = 0; row < MAX_ATTEMPTS; row++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'row';
    for (let col = 0; col < LENGTH; col++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.col = String(col);
      tile.addEventListener('click', () => selectTile(row, col));
      rowEl.append(tile);
    }
    board.append(rowEl);
  }
}

function buildKeyboard() {
  keyboard.replaceChildren();
  const rows = [
    [...'QWERTYUIOP'],
    [...'ASDFGHJKLÑ'],
    ['ENTER', ...'ZXCVBNM', '⌫']
  ];
  for (const keys of rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';
    for (const key of keys) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'key' + (key.length > 1 ? ' wide' : '');
      button.textContent = key;
      button.dataset.key = key;
      button.addEventListener('click', () => handleKey(key));
      rowEl.append(button);
    }
    keyboard.append(rowEl);
  }
}

function score(word, answer) {
  const result = Array(LENGTH).fill('absent');
  const remaining = {};
  for (let i = 0; i < LENGTH; i++) {
    if (word[i] === answer[i]) result[i] = 'correct';
    else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < LENGTH; i++) {
    if (result[i] === 'correct') continue;
    if (remaining[word[i]] > 0) {
      result[i] = 'present';
      remaining[word[i]]--;
    }
  }
  return result;
}

function paintAttempt(rowIndex, word) {
  const states = score(word, secret);
  const tiles = board.children[rowIndex].children;
  for (let i = 0; i < LENGTH; i++) {
    tiles[i].textContent = word[i];
    tiles[i].classList.add(states[i]);
    if ((priority[states[i]] || 0) > (priority[keyStates[word[i]]] || 0)) {
      keyStates[word[i]] = states[i];
    }
  }
}

function paintKeyboard() {
  for (const button of keyboard.querySelectorAll('[data-key]')) {
    button.classList.remove('correct', 'present', 'absent');
    if (keyStates[button.dataset.key]) button.classList.add(keyStates[button.dataset.key]);
  }
}

function selectTile(row, col) {
  checkDayChange();
  if (finished || row !== attempt || !solutions.length) return;
  selectedColumn = col;
  renderGuess();
}

function renderGuess() {
  board.querySelectorAll('.tile').forEach(tile => {
    tile.classList.remove('selected', 'editable');
    tile.removeAttribute('aria-current');
  });
  if (finished || attempt >= MAX_ATTEMPTS) return;
  const tiles = board.children[attempt].children;
  for (let i = 0; i < LENGTH; i++) {
    tiles[i].textContent = guess[i] || '';
    tiles[i].classList.add('editable');
    if (i === selectedColumn) {
      tiles[i].classList.add('selected');
      tiles[i].setAttribute('aria-current', 'true');
    }
  }
}

function updateStatus() {
  if (history.includes(secret)) setMessage(`¡Correcto! Lo lograste en ${history.length} intento(s).`);
  else if (finished) setMessage(`Fin de la partida. La palabra era ${secret}.`);
  else setMessage(`Intento ${attempt + 1} de ${MAX_ATTEMPTS}.`);
}

// ==========================================
// COMPARTIR RESULTADOS POR WHATSAPP
// ==========================================

// Correspondencia entre estados y emojis
const SHARE_EMOJI = {
    correct: '🟩',
    present: '🟨',
    absent: '⬛'
};

// Construir el mensaje que compartiremos
function buildShareText() {

    // No compartir partidas sin terminar
    if (!finished || !history.length) {
        return '';
    }

    // Comprobar si el jugador ha ganado
    const won = history.includes(secret);

    // Identificar la modalidad
    const title = mode === 'daily'
        ? `🟩 Azure Wordle 📅\n${dayId}`
        : '🟩 Azure Wordle 🎮 Partida libre';

    // Mensaje según el resultado
    const outcome = won
        ? `🎉 ¡Lo he conseguido en ${history.length}/6 intentos!`
        : '😔 ¡Esta vez no lo he conseguido! 0/6';

    // Construir el tablero utilizando emojis
    const grid = history.map(word => {

        // Evaluar el intento
        const states = score(word, secret);

        // Convertir estados en emojis
        return states.map(state => SHARE_EMOJI[state]).join('');

    }).join('\n');

    // Mensaje final
    return `${title}

${outcome}

${grid}

🎮 Juega en http://wordle.letteria.es`;
}

// Abrir WhatsApp con el mensaje preparado
function shareOnWhatsApp() {

    const text = buildShareText();

    if (!text) {
        return;
    }

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
}

function redraw() {

    buildBoard();
    buildKeyboard();

    keyStates = {};

    history.forEach((word, index) => {
        paintAttempt(index, word);
    });

    attempt = history.length;

    paintKeyboard();
    renderGuess();
    updateStatus();

    // Mostrar WhatsApp únicamente cuando termine la partida
    shareButton.hidden = !finished || history.length === 0;
}

function startGame() {
  if (!solutions.length) return;
  history = [];
  guess = Array(LENGTH).fill('');
  selectedColumn = 0;
  finished = false;
  if (mode === 'daily') {
    dayId = madridDayId();
    secret = dailyWord(dayId);
    restoreDaily();
    dayInfo.textContent = `Desafío diario: ${dayId} · Cambia a las 06:00 (Madrid)`;
  } else {
    secret = solutions[Math.floor(Math.random() * solutions.length)];
    dayInfo.textContent = 'Modo libre · Partidas ilimitadas';
  }
  newGameButton.hidden = mode !== 'free';
  dailyButton.setAttribute('aria-pressed', String(mode === 'daily'));
  freeButton.setAttribute('aria-pressed', String(mode === 'free'));
  redraw();
}

function checkDayChange() {
  if (mode === 'daily' && solutions.length && madridDayId() !== dayId) startGame();
}

function submitGuess() {
  if (guess.some(letter => !letter)) return setMessage('Completa las cinco casillas.');
  const word = guess.join('');
  if (!allowedWords.has(word)) return setMessage('La palabra no está en el diccionario.');
  history.push(word);
  finished = word === secret || history.length === MAX_ATTEMPTS;
  guess = Array(LENGTH).fill('');
  selectedColumn = 0;
  saveDaily();
  redraw();
}

function handleKey(key) {
  checkDayChange();
  if (finished || !solutions.length) return;
  if (key === 'ENTER') return submitGuess();
  if (key === '⌫' || key === 'BACKSPACE') {
    if (guess[selectedColumn]) {
      guess[selectedColumn] = '';
    } else if (selectedColumn > 0) {
      selectedColumn--;
      guess[selectedColumn] = '';
    }
  } else if (key === 'ARROWLEFT') {
    selectedColumn = Math.max(0, selectedColumn - 1);
  } else if (key === 'ARROWRIGHT') {
    selectedColumn = Math.min(LENGTH - 1, selectedColumn + 1);
  } else if (/^[A-ZÑ]$/.test(key)) {
    guess[selectedColumn] = key;
    if (selectedColumn < LENGTH - 1) selectedColumn++;
  } else return;
  saveDaily();
  renderGuess();
}

document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  if (event.key === 'Enter') handleKey('ENTER');
  else if (event.key === 'Backspace') handleKey('BACKSPACE');
  else if (event.key === 'ArrowLeft') { event.preventDefault(); handleKey('ARROWLEFT'); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); handleKey('ARROWRIGHT'); }
  else if (/^[a-zA-ZñÑ]$/.test(event.key)) handleKey(event.key.toUpperCase());
});

shareButton.addEventListener('click', shareOnWhatsApp);
newGameButton.addEventListener('click', () => { if (mode === 'free') startGame(); });
dailyButton.addEventListener('click', () => { mode = 'daily'; startGame(); });
freeButton.addEventListener('click', () => { mode = 'free'; startGame(); });
setInterval(checkDayChange, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDayChange(); });

async function loadDictionary() {
  try {
    const [solutionsResponse, allowedResponse] = await Promise.all([
      fetch('./data/solutions.json'), fetch('./data/allowed.json')
    ]);
    if (!solutionsResponse.ok || !allowedResponse.ok) throw new Error('No se pudieron descargar los diccionarios');
    const solutionsData = await solutionsResponse.json();
    const allowedData = await allowedResponse.json();
    if (!Array.isArray(solutionsData) || !Array.isArray(allowedData)) throw new Error('Formato de diccionario incorrecto');
    solutions = [...new Set(solutionsData.map(normalizeWord).filter(validWord))];
    allowedWords = new Set([...allowedData.map(normalizeWord).filter(validWord), ...solutions]);
    if (!solutions.length) throw new Error('No hay soluciones');
    // Huella del contenido y orden: si cambia la lista, se crea una nueva versión diaria.
    dictionaryVersion = hashText(solutions.join('|')).toString(16);
    console.log(`Soluciones: ${solutions.length}; permitidas: ${allowedWords.size}; versión: ${dictionaryVersion}`);
    startGame();
  } catch (error) {
    console.error(error);
    setMessage('Error al cargar el diccionario.');
  }
}

loadDictionary();

// ==========================================
// CUENTA ATRÁS WORDLE DIARIO
// ==========================================

const MADRID_TIMEZONE = 'Europe/Madrid';

function getMadridDateParts(date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: MADRID_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);

    return Object.fromEntries(
        parts
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, Number(part.value)])
    );
}

function getNextWordleTime(now = new Date()) {
    const madrid = getMadridDateParts(now);

    // Fecha del próximo cambio: hoy a las 06:00,
    // o mañana si ya hemos pasado esa hora.
    const targetDay = new Date(Date.UTC(
        madrid.year,
        madrid.month - 1,
        madrid.day + (madrid.hour >= 6 ? 1 : 0)
    ));

    const year = targetDay.getUTCFullYear();
    const month = String(targetDay.getUTCMonth() + 1).padStart(2, '0');
    const day = String(targetDay.getUTCDate()).padStart(2, '0');

    const targetDate = `${year}-${month}-${day}`;

    // Buscar el instante UTC correspondiente a las 06:00
    // de Madrid. Esto contempla CET y CEST.
    const approximateUTC = Date.UTC(
        year,
        targetDay.getUTCMonth(),
        targetDay.getUTCDate(),
        6
    );

    const approximateParts = getMadridDateParts(
        new Date(approximateUTC)
    );

    const madridOffsetHours = approximateParts.hour - 6;

    return new Date(
        approximateUTC - madridOffsetHours * 60 * 60 * 1000
    );
}

function updateCountdown() {
    const countdown = document.querySelector('#countdown');

    if (!countdown) return;

    const now = new Date();
    const nextWordle = getNextWordleTime(now);

    const remainingSeconds = Math.max(
        0,
        Math.ceil((nextWordle - now) / 1000)
    );

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    countdown.textContent = [
        hours,
        minutes,
        seconds
    ].map(value => String(value).padStart(2, '0')).join(':');
}

// Actualizar inmediatamente
updateCountdown();

// Actualizar cada segundo
setInterval(updateCountdown, 1000);