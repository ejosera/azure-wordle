'use strict';
const WORDS = ['NUBES', 'CLAVE', 'DATOS', 'DISCO', 'REDES', 'CABLE', 'RATON', 'LIBRO', 'PLAYA', 'SALTO', 'CAMPO', 'VERDE', 'NOCHE', 'FRUTA', 'FUEGO', 'PERRO', 'GATOS', 'PIANO', 'BARCO', 'LUNES'];
const MAX_ATTEMPTS = 6;
const LENGTH = 5;
const board = document.querySelector('#board');
const keyboard = document.querySelector('#keyboard');
const message = document.querySelector('#message');
let secret, attempt, guess, finished, keyStates;
const priority = { absent: 1, present: 2, correct: 3 };

function setMessage(text) { message.textContent = text; }
function startGame() {
  secret = WORDS[Math.floor(Math.random() * WORDS.length)];
  attempt = 0; guess = ''; finished = false; keyStates = {};
  board.replaceChildren(); keyboard.replaceChildren();
  for (let row = 0; row < MAX_ATTEMPTS; row++) {
    const rowEl = document.createElement('div'); rowEl.className = 'row';
    for (let col = 0; col < LENGTH; col++) {
      const tile = document.createElement('div'); tile.className = 'tile'; rowEl.append(tile);
    }
    board.append(rowEl);
  }
  for (const keys of ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']) {
    const rowEl = document.createElement('div'); rowEl.className = 'key-row';
    const rowKeys = keys === 'ZXCVBNM' ? ['ENTER', ...keys, '⌫'] : [...keys];
    for (const key of rowKeys) {
      const btn = document.createElement('button'); btn.type = 'button';
      btn.className = 'key' + (key.length > 1 ? ' wide' : '');
      btn.textContent = key; btn.dataset.key = key;
      btn.addEventListener('click', () => handleKey(key)); rowEl.append(btn);
    }
    keyboard.append(rowEl);
  }
  setMessage('Adivina la palabra de 5 letras en 6 intentos.');
}
function renderGuess() {
  const tiles = board.children[attempt].children;
  for (let i = 0; i < LENGTH; i++) tiles[i].textContent = guess[i] || '';
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
    if (remaining[word[i]] > 0) { result[i] = 'present'; remaining[word[i]]--; }
  }
  return result;
}
function submitGuess() {
  if (guess.length !== LENGTH) { setMessage('Escribe cinco letras.'); return; }
  if (!WORDS.includes(guess)) { setMessage('Palabra no incluida en el diccionario de esta demo.'); return; }
  const states = score(guess, secret);
  const tiles = board.children[attempt].children;
  for (let i = 0; i < LENGTH; i++) {
    tiles[i].classList.add(states[i]);
    if ((priority[states[i]] || 0) > (priority[keyStates[guess[i]]] || 0)) keyStates[guess[i]] = states[i];
  }
  for (const btn of keyboard.querySelectorAll('[data-key]')) {
    if (keyStates[btn.dataset.key]) btn.classList.add(keyStates[btn.dataset.key]);
  }
  attempt++;
  if (guess === secret) { finished = true; setMessage(`¡Correcto! Lo lograste en ${attempt} intento(s).`); }
  else if (attempt === MAX_ATTEMPTS) { finished = true; setMessage(`Fin de la partida. La palabra era ${secret}.`); }
  else { guess = ''; setMessage(`Intento ${attempt + 1} de ${MAX_ATTEMPTS}.`); }
}
function handleKey(key) {
  if (finished) return;
  if (key === 'ENTER') { submitGuess(); return; }
  if (key === '⌫' || key === 'BACKSPACE') guess = guess.slice(0, -1);
  else if (/^[A-Z]$/.test(key) && guess.length < LENGTH) guess += key;
  else return;
  renderGuess();
}
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  if (event.key === 'Enter') handleKey('ENTER');
  else if (event.key === 'Backspace') handleKey('BACKSPACE');
  else if (/^[a-zA-Z]$/.test(event.key)) handleKey(event.key.toUpperCase());
});
document.querySelector('#new-game').addEventListener('click', startGame);
startGame();
