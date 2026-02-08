import { dbPromise } from './db.js';
import { initRouter } from './router.js';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  refreshAppData();
  registerServiceWorker();
  setupEventListeners();
  checkStorageQuota();
  initNativeFeatures();
});

// --- UI Elements ---
const form = document.getElementById('add-form');
const input = document.getElementById('movie-input');
const queueList = document.getElementById('movie-list');
const historyList = document.getElementById('history-list');
const emptyState = document.getElementById('empty-state');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const spinBtn = document.getElementById('spin-btn');
const rouletteText = document.getElementById('roulette-text');
const rouletteDisplay = document.getElementById('roulette-display');
const winnerActions = document.getElementById('winner-actions');
const winnerTitle = document.getElementById('winner-title');
const markWinnerBtn = document.getElementById('mark-winner-watched');
const enableNativeBtn = document.getElementById('enable-native-btn');
let currentWinnerId = null;

// --- 1. DATA FLOW FUNCTIONS ---
async function refreshAppData() {
  try {
    const movies = await dbPromise.getAll();
    const sortedMovies = sortMoviesNewestFirst(movies);
    renderAllLists(sortedMovies);
    updateStats(sortedMovies);
    handleEmptyState(sortedMovies);
  } catch (err) {
    console.error('Data refresh failed:', err);
  }
}

function sortMoviesNewestFirst(movies) {
  return [...movies].sort((a, b) => b.id - a.id);
}

function handleEmptyState(movies) {
  const hasPending = movies.some(m => !m.watched);
  if (emptyState) {
    hasPending ? emptyState.classList.add('hidden') : emptyState.classList.remove('hidden');
  }
}

function renderAllLists(movies) {
  if (!queueList || !historyList) return;
  queueList.innerHTML = '';
  historyList.innerHTML = '';
  movies.forEach(movie => {
    const li = createMovieElement(movie);
    const targetList = movie.watched ? historyList : queueList;
    targetList.appendChild(li);
  });
}

// --- 2. MOVIE ITEM CONSTRUCTION ---
function createMovieElement(movie) {
  const li = document.createElement('li');
  li.className = `movie-item ${movie.watched ? 'watched' : ''}`;
  li.innerHTML = `
    <div class="movie-content">
        <div class="check-btn ${movie.watched ? 'checked' : ''}">${movie.watched ? '✔' : ''}</div>
        <div>
            <div class="movie-text">${escapeHtml(movie.title)}</div>
            <small class="movie-date">${new Date(movie.id).toLocaleDateString()}</small>
        </div>
    </div>
    <div class="movie-btns">
        <button class="share-btn" title="Share">✈</button>
        <button class="delete-btn">✖</button>
    </div>
  `;
  attachMovieActions(li, movie);
  return li;
}

function attachMovieActions(li, movie) {
  li.querySelector('.check-btn').addEventListener('click', () => toggleStatus(movie));
  li.querySelector('.delete-btn').addEventListener('click', () => deleteMovie(movie.id));
  li.querySelector('.share-btn').addEventListener('click', () => shareMovie(movie.title));
}

// --- 3. NATIVE FUNCTIONS ---

async function shareMovie(title) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Watchlist',
        text: `Раджу подивитись: "${title}"`,
        url: window.location.href
      });
    } catch (err) { console.log('Share error', err); }
  } else { alert("Share not supported"); }
}

function initNativeFeatures() {
  if (!enableNativeBtn) return;
  enableNativeBtn.addEventListener('click', async () => {
    try {
      if ('Notification' in window) await Notification.requestPermission();
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        await DeviceMotionEvent.requestPermission();
      }
      window.addEventListener('devicemotion', handleShake);
    } catch (e) { console.log("Sensors init error", e); }
    enableNativeBtn.style.display = 'none';
  });
}

function handleShake(event) {
  const acc = event.accelerationIncludingGravity;
  if (!acc) return;
  const delta = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
  if (delta > 15) {
    const now = Date.now();
    if (now - lastShakeTime > 2000) {
      lastShakeTime = now;
      const rView = document.getElementById('roulette');
      if (rView && !rView.classList.contains('hidden-view')) startRoulette();
    }
  }
}
let lastShakeTime = 0;

function sendWinnerNotification(movieTitle) {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification('Фільм обрано! 🍿', {
        body: `Сьогодні дивимось: ${movieTitle}`,
        icon: 'icon192.png',
        vibrate: [200, 100, 200],
        tag: 'winner'
      });
    });
  }
}

// --- 4. ACTIONS (CRUD) ---
async function addMovie(e) {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  const newMovie = { id: Date.now(), title, watched: false };
  await dbPromise.add(newMovie);
  input.value = '';
  refreshAppData();
}

async function toggleStatus(movie) {
  movie.watched = !movie.watched;
  await dbPromise.update(movie);
  refreshAppData();
}

async function deleteMovie(id) {
  if (confirm('Remove?')) {
    await dbPromise.delete(id);
    refreshAppData();
  }
}

async function clearHistory() {
  const movies = await dbPromise.getAll();
  const watched = movies.filter(m => m.watched);
  await Promise.all(watched.map(m => dbPromise.delete(m.id)));
  refreshAppData();
}

// --- 5. ROULETTE ---
async function startRoulette() {
  const movies = await dbPromise.getAll();
  const queue = movies.filter(m => !m.watched);
  if (queue.length === 0) return;

  winnerActions.classList.add('hidden');
  spinBtn.disabled = true;
  rouletteDisplay.classList.add('shuffling');

  let counter = 0;
  const interval = setInterval(() => {
    rouletteText.textContent = queue[Math.floor(Math.random() * queue.length)].title;
    if (++counter >= 20) {
      clearInterval(interval);
      const winner = queue[Math.floor(Math.random() * queue.length)];
      showWinner(winner);
      sendWinnerNotification(winner.title);
    }
  }, 100);
}

function showWinner(movie) {
  rouletteDisplay.classList.remove('shuffling');
  spinBtn.disabled = false;
  rouletteText.textContent = "ENJOY!";
  currentWinnerId = movie.id;
  winnerTitle.textContent = movie.title;
  winnerActions.classList.remove('hidden');
}

// --- 6. HELPERS ---
function setupEventListeners() {
  if (form) form.addEventListener('submit', addMovie);
  if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearHistory);
  if (spinBtn) spinBtn.addEventListener('click', startRoulette);
  if (markWinnerBtn) markWinnerBtn.addEventListener('click', handleMarkWinner);
}

async function handleMarkWinner() {
  const movies = await dbPromise.getAll();
  const movie = movies.find(m => m.id === currentWinnerId);
  if (movie) {
    await toggleStatus(movie);
    winnerActions.classList.add('hidden');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error(err));
  }
}

async function checkStorageQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage } = await navigator.storage.estimate();
    console.log(`Used: ${(usage / 1024 / 1024).toFixed(2)} MB`);
  }
}