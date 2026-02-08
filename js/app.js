import { dbPromise } from './db.js';
import { initRouter } from './router.js';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  refreshAppData();
  registerServiceWorker();
  setupEventListeners();
  checkStorageQuota();
  initNativeFeatures(); // <--- ПІДКЛЮЧЕНО: ініціалізація датчиків
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
const enableNativeBtn = document.getElementById('enable-native-btn'); // <--- ДОДАНО: кнопка дозволів
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
    !hasPending ? emptyState.classList.remove('hidden') : emptyState.classList.add('hidden');
  }
}

function renderAllLists(movies) {
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
  li.innerHTML = buildMovieTemplate(movie);
  attachMovieActions(li, movie);
  return li;
}

// ТУТ МИ ДОДАЛИ КНОПКУ ЛІТАЧКА ✈
function buildMovieTemplate(movie) {
  const checkIcon = movie.watched ? '✔' : '';
  const checkClass = movie.watched ? 'checked' : '';
  return `
    <div class="movie-content">
        <div class="check-btn ${checkClass}">${checkIcon}</div>
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
}

function attachMovieActions(li, movie) {
  li.querySelector('.check-btn').addEventListener('click', () => toggleStatus(movie));
  li.querySelector('.delete-btn').addEventListener('click', () => deleteMovie(movie.id));
  li.querySelector('.share-btn').addEventListener('click', () => shareMovie(movie.title)); // <--- ПІДКЛЮЧЕНО: Share
}

// --- 3. NATIVE FUNCTIONS LOGIC ---

// 1. WEB SHARE API
async function shareMovie(title) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Netflix Watchlist',
        text: `Подивись цей фільм: "${title}"`,
        url: window.location.href
      });
    } catch (err) {
      console.log('Share failed', err);
    }
  } else {
    alert("Ваш браузер не підтримує поширення.");
  }
}

// 2. DEVICE MOTION (SHAKE)
let lastShakeTime = 0;
function initNativeFeatures() {
  if (!enableNativeBtn) return;
  enableNativeBtn.addEventListener('click', async () => {
    // Сповіщення
    if ('Notification' in window) {
      await Notification.requestPermission();
    }
    // Акселерометр
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission === 'granted') window.addEventListener('devicemotion', handleShake);
    } else {
      window.addEventListener('devicemotion', handleShake);
    }
    enableNativeBtn.style.display = 'none';
  });
}

function handleShake(event) {
  const acc = event.accelerationIncludingGravity;
  if (!acc) return;
  const delta = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
  if (delta > 15) { // Поріг трусіння
    const now = Date.now();
    if (now - lastShakeTime > 2000) {
      lastShakeTime = now;
      const rouletteView = document.getElementById('roulette');
      if (rouletteView && !rouletteView.classList.contains('hidden-view')) {
        startRoulette();
      }
    }
  }
}

// 3. NOTIFICATIONS API
function sendWinnerNotification(movieTitle) {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification('Фільм на вечір обрано! 🍿', {
        body: `Сьогодні дивимось: ${movieTitle}`,
        icon: '/icon192.png',
        vibrate: [200, 100, 200],
        tag: 'winner'
      });
    });
  }
}

// --- 4. ACTIONS ---
async function addMovie(e) {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;
  const newMovie = { id: Date.now(), title, watched: false, createdAt: new Date().toISOString() };
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
  if (confirm('Remove this movie?')) {
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

// --- 5. ROULETTE LOGIC ---
async function startRoulette() {
  const queue = await getPendingMovies();
  if (queue.length === 0) {
    displayRouletteMessage("QUEUE IS EMPTY", "Add movies first!");
    return;
  }
  prepareRouletteUI();
  runShuffleAnimation(queue);
}

async function getPendingMovies() {
  const movies = await dbPromise.getAll();
  return movies.filter(m => !m.watched);
}

function prepareRouletteUI() {
  winnerActions.classList.add('hidden');
  spinBtn.disabled = true;
  spinBtn.textContent = "CHOOSING...";
  rouletteDisplay.classList.add('shuffling');
  rouletteText.style.color = "#e50914";
}

function displayRouletteMessage(main, sub) {
  rouletteText.innerHTML = `${main}<br><small style='font-size: 1rem; opacity: 0.6;'>${sub}</small>`;
  winnerActions.classList.add('hidden');
  spinBtn.textContent = "SPIN THE WHEEL";
}

function runShuffleAnimation(queue) {
  let counter = 0;
  const interval = setInterval(() => {
    const randomTemp = queue[Math.floor(Math.random() * queue.length)];
    rouletteText.textContent = randomTemp.title;
    counter++;
    if (counter >= 20) {
      clearInterval(interval);
      const winner = queue[Math.floor(Math.random() * queue.length)];
      showWinner(winner);
      sendWinnerNotification(winner.title); // <--- ПІДКЛЮЧЕНО: виклик сповіщення
    }
  }, 100);
}

function showWinner(movie) {
  rouletteDisplay.classList.remove('shuffling');
  spinBtn.disabled = false;
  spinBtn.textContent = "SPIN AGAIN";
  rouletteText.textContent = "ENJOY!";
  rouletteText.style.color = "#fff";
  currentWinnerId = movie.id;
  winnerTitle.textContent = movie.title;
  winnerActions.classList.remove('hidden');
}

// --- 6. SETUP ---
function updateStats(movies) {
  const total = movies.length;
  const watched = movies.filter(m => m.watched).length;
  document.getElementById('count-total').textContent = total;
  document.getElementById('count-watched').textContent = watched;
  document.getElementById('count-pending').textContent = total - watched;
}

function setupEventListeners() {
  form.addEventListener('submit', addMovie);
  clearHistoryBtn.addEventListener('click', clearHistory);
  spinBtn.addEventListener('click', startRoulette);
  markWinnerBtn.addEventListener('click', handleMarkWinner);
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.getAttribute('data-target') === 'roulette') resetRouletteUI();
    });
  });
}

function resetRouletteUI() {
  rouletteText.textContent = "Press Spin";
  spinBtn.textContent = "SPIN THE WHEEL";
  winnerActions.classList.add('hidden');
}

async function handleMarkWinner() {
  if (!currentWinnerId) return;
  const movies = await dbPromise.getAll();
  const movie = movies.find(m => m.id === currentWinnerId);
  if (movie) {
    await toggleStatus(movie);
    winnerActions.classList.add('hidden');
    rouletteText.textContent = "WATCHED!";
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW failed', err));
  }
}

async function checkStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const { usage } = await navigator.storage.estimate();
    console.log(`Used: ${(usage / (1024 * 1024)).toFixed(2)} MB`);
  }
}

function sendWinnerNotification(movieTitle) {
  console.log("Спроба надіслати сповіщення для:", movieTitle);

  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      console.log("Service Worker готовий, надсилаю пуш...");
      reg.showNotification('Фільм на вечір обрано! 🍿', {
        body: `Сьогодні дивимось: ${movieTitle}`,
        icon: 'icon192.png', // переконайся, що шлях правильний
        vibrate: [200, 100, 200],
        tag: 'winner'
      });
    }).catch(err => console.error("SW не готовий:", err));
  } else {
    console.log("Дозвіл на сповіщення не надано. Статус:", Notification.permission);
  }
}