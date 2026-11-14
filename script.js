'use strict';

// ==========================================
// CONFIGURACIÓN DEL JUEGO
// ==========================================

const MAX_ATTEMPTS = 6;
const LENGTH = 5;

// Diccionarios
let SOLUTIONS = [];
let ALLOWED_WORDS = new Set();

// Elementos HTML
const board = document.querySelector('#board');
const keyboard = document.querySelector('#keyboard');
const message = document.querySelector('#message');

// Estado del juego
let secret;
let attempt;
let guess;
let finished = true;
let keyStates = {};

// Prioridad de los colores del teclado
const priority = {
  absent: 1,
  present: 2,
  correct: 3
};


// ==========================================
// NORMALIZACIÓN DE PALABRAS
// ==========================================

function normalizeWord(word) {
  return word
    .trim()
    .toUpperCase()
    .replace(/Ñ/g, '\uE000')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\uE000/g, 'Ñ');
}

// ==========================================
// CARGAR DICCIONARIOS
// ==========================================

async function loadDictionary() {

  try {

    const [solutionsResponse, allowedResponse] = await Promise.all([
      fetch('./data/solutions.json'),
      fetch('./data/allowed.json')
    ]);

    if (!solutionsResponse.ok || !allowedResponse.ok) {
      throw new Error('No se pudieron descargar los diccionarios');
    }

    const solutionsData = await solutionsResponse.json();
    const allowedData = await allowedResponse.json();

    // Normalizar y eliminar palabras duplicadas
    SOLUTIONS = [...new Set(
      solutionsData
        .map(normalizeWord)
        .filter(word => word.length === LENGTH && /^[A-ZÑ]+$/.test(word))
    )];

    const allowed = allowedData
      .map(normalizeWord)
      .filter(word => word.length === LENGTH && /^[A-ZÑ]+$/.test(word));

    // Todas las soluciones también deben ser palabras válidas
    ALLOWED_WORDS = new Set([...allowed, ...SOLUTIONS]);

    if (SOLUTIONS.length === 0) {
      throw new Error('El diccionario de soluciones está vacío');
    }

    console.log('Diccionario cargado correctamente');
    console.log('Soluciones:', SOLUTIONS.length);
    console.log('Palabras permitidas:', ALLOWED_WORDS.size);

    startGame();

  } catch (error) {

    console.error('Error cargando diccionarios:', error);

    setMessage('Error al cargar el diccionario.');

  }
}


// ==========================================
// MENSAJES
// ==========================================

function setMessage(text) {
  message.textContent = text;
}


// ==========================================
// INICIAR PARTIDA
// ==========================================

function startGame() {

  if (SOLUTIONS.length === 0) {
    setMessage('El diccionario todavía no está disponible.');
    return;
  }

  // Seleccionar palabra secreta
  secret = SOLUTIONS[Math.floor(Math.random() * SOLUTIONS.length)];

  // Reiniciar variables
  attempt = 0;
  guess = '';
  finished = false;
  keyStates = {};

  // Limpiar tablero y teclado
  board.replaceChildren();
  keyboard.replaceChildren();

  // Crear tablero
  for (let row = 0; row < MAX_ATTEMPTS; row++) {

    const rowEl = document.createElement('div');
    rowEl.className = 'row';

    for (let col = 0; col < LENGTH; col++) {

      const tile = document.createElement('div');
      tile.className = 'tile';

      rowEl.append(tile);
    }

    board.append(rowEl);
  }

  // Crear teclado con Ñ
  const keyboardRows = [
    'QWERTYUIOP',
    'ASDFGHJKLÑ',
    'ZXCVBNM'
  ];

  for (const keys of keyboardRows) {

    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';

    const rowKeys = keys === 'ZXCVBNM'
      ? ['ENTER', ...keys, '⌫']
      : [...keys];

    for (const key of rowKeys) {

      const btn = document.createElement('button');

      btn.type = 'button';
      btn.className = 'key' + (key.length > 1 ? ' wide' : '');
      btn.textContent = key;
      btn.dataset.key = key;

      btn.addEventListener('click', () => handleKey(key));

      rowEl.append(btn);
    }

    keyboard.append(rowEl);
  }

  setMessage('Adivina la palabra de 5 letras en 6 intentos.');
}


// ==========================================
// MOSTRAR LETRAS
// ==========================================

function renderGuess() {

  const tiles = board.children[attempt].children;

  for (let i = 0; i < LENGTH; i++) {
    tiles[i].textContent = guess[i] || '';
  }
}


// ==========================================
// COMPROBAR PALABRA
// ==========================================

function score(word, answer) {

  const result = Array(LENGTH).fill('absent');
  const remaining = {};

  // Primera pasada: letras correctas
  for (let i = 0; i < LENGTH; i++) {

    if (word[i] === answer[i]) {

      result[i] = 'correct';

    } else {

      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }

  // Segunda pasada: letras presentes
  for (let i = 0; i < LENGTH; i++) {

    if (result[i] === 'correct') {
      continue;
    }

    if (remaining[word[i]] > 0) {

      result[i] = 'present';
      remaining[word[i]]--;
    }
  }

  return result;
}


// ==========================================
// ENVIAR INTENTO
// ==========================================

function submitGuess() {

  if (guess.length !== LENGTH) {

    setMessage('Escribe cinco letras.');
    return;
  }

  // Comprobar diccionario
  if (!ALLOWED_WORDS.has(guess)) {

    setMessage('La palabra no está en el diccionario.');
    return;
  }

  // Evaluar intento
  const states = score(guess, secret);
  const tiles = board.children[attempt].children;

  for (let i = 0; i < LENGTH; i++) {

    tiles[i].classList.add(states[i]);

    // Actualizar estado del teclado
    if (
      (priority[states[i]] || 0) >
      (priority[keyStates[guess[i]]] || 0)
    ) {

      keyStates[guess[i]] = states[i];
    }
  }

  // Actualizar colores del teclado
  for (const btn of keyboard.querySelectorAll('[data-key]')) {

    if (keyStates[btn.dataset.key]) {

      btn.classList.add(keyStates[btn.dataset.key]);
    }
  }

  attempt++;

  // Comprobar victoria
  if (guess === secret) {

    finished = true;

    setMessage(
      `¡Correcto! Lo lograste en ${attempt} intento(s).`
    );

  } else if (attempt === MAX_ATTEMPTS) {

    finished = true;

    setMessage(
      `Fin de la partida. La palabra era ${secret}.`
    );

  } else {

    guess = '';

    setMessage(
      `Intento ${attempt + 1} de ${MAX_ATTEMPTS}.`
    );
  }
}


// ==========================================
// GESTIONAR TECLADO
// ==========================================

function handleKey(key) {

  if (finished) {
    return;
  }

  if (key === 'ENTER') {

    submitGuess();
    return;
  }

  if (key === '⌫' || key === 'BACKSPACE') {

    guess = guess.slice(0, -1);

  } else if (/^[A-ZÑ]$/.test(key) && guess.length < LENGTH) {

    guess += key;

  } else {

    return;
  }

  renderGuess();
}


// ==========================================
// TECLADO FÍSICO
// ==========================================

document.addEventListener('keydown', event => {

  if (
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.repeat
  ) {
    return;
  }

  if (event.key === 'Enter') {

    handleKey('ENTER');

  } else if (event.key === 'Backspace') {

    handleKey('BACKSPACE');

  } else if (/^[a-zA-ZñÑ]$/.test(event.key)) {

    handleKey(event.key.toUpperCase());
  }
});


// ==========================================
// BOTÓN NUEVA PARTIDA
// ==========================================

document
  .querySelector('#new-game')
  .addEventListener('click', startGame);


// ==========================================
// INICIALIZAR APLICACIÓN
// ==========================================

loadDictionary();