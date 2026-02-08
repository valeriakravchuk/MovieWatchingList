import { dbPromise } from './db.js';
import { initRouter } from './router.js';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  refreshAppData();
  registerServiceWorker();
  setupEventListeners();
  checkStorageQuota();
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
let currentWinnerId = null;

// --- 1. DATA FLOW FUNCTIONS ---

// Main function to refresh UI data
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

// Sorting function: Newest first
function sortMoviesNewestFirst(movies) {
  return [...movies].sort((a, b) => b.id - a.id);
}

// Handle empty state visibility
function handleEmptyState(movies) {
  const hasPending = movies.some(m => !m.watched);
  if (!hasPending) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }
}

// Function, which renders both lists
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

// Template for movie item
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
    <button class="delete-btn">✖</button>
  `;
}

// Function to attach event listeners to movie item buttons
function attachMovieActions(li, movie) {
  li.querySelector('.check-btn').addEventListener('click', () => toggleStatus(movie));
  li.querySelector('.delete-btn').addEventListener('click', () => deleteMovie(movie.id));
}

// --- 3. NATIVE FUNCTIONS LOGIC ---

// 1. WEB SHARE API
async function shareMovie(title) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Movie Suggestion',
        text: `Let's watch "${title}" tonight!`,
        url: window.location.href
      });
    } catch (err) {
      console.log('Share failed or cancelled');
    }
  } else {
    alert("Sharing is not supported on this browser.");
  }
}

// 2. DEVICE MOTION (SHAKE TO SHUFFLE)
let lastShakeTime = 0;
function initNativeFeatures() {
  // Запит дозволів (важливо для iOS та нових Android)
  enableNativeBtn.addEventListener('click', async () => {
    // Для сповіщень
    if ('Notification' in window) {
      await Notification.requestPermission();
    }

    // Для акселерометра
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
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

  const threshold = 15; // Чутливість трусіння
  const delta = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);

  if (delta > threshold) {
    const now = Date.now();
    if (now - lastShakeTime > 2000) { // Захист від подвійного спрацювання
      lastShakeTime = now;
      // Тільки якщо ми на сторінці рулетки
      if (!document.getElementById('roulette').classList.contains('hidden-view')) {
        startRoulette();
      }
    }
  }
}

// 3. NOTIFICATIONS API
function sendWinnerNotification(movieTitle) {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('Movie Roulette Winner! 🍿', {
        body: `Tonight we are watching: ${movieTitle}`,
        icon: 'icon192.png',
        badge: 'icon192.png',
        vibrate: [200, 100, 200],
        tag: 'roulette-winner'
      });
    });
  }
}


// --- 3. ACTIONS (CRUD) ---

async function addMovie(e) {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;

  const newMovie = {
    id: Date.now(),
    title: title,
    watched: false,
    createdAt: new Date().toISOString()
  };

  await dbPromise.add(newMovie);
  input.value = '';
  refreshAppData();
}
// watched / unwatched
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

  //Promise.all to delete all watched movies
  await Promise.all(watched.map(m => dbPromise.delete(m.id)));
  refreshAppData();
}

// --- 4. ROULETTE LOGIC ---

async function startRoulette() {
  const queue = await getPendingMovies();

  if (queue.length === 0) {
    displayRouletteMessage("QUEUE IS EMPTY", "Add movies first!");
    return;
  }

  prepareRouletteUI();
  runShuffleAnimation(queue);
}

// Get all pending (not watched) movies
async function getPendingMovies() {
  const movies = await dbPromise.getAll();
  return movies.filter(m => !m.watched);
}

// Prepare UI for shuffling
function prepareRouletteUI() {
  winnerActions.classList.add('hidden');
  spinBtn.disabled = true;
  spinBtn.textContent = "CHOOSING...";
  rouletteDisplay.classList.add('shuffling');
  rouletteText.style.color = "#e50914";
}

// Manage messages during roulette
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
      showWinner(queue[Math.floor(Math.random() * queue.length)]);
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

// --- 5. HELPERS & SETUP ---

function updateStats(movies) {
  const total = movies.length;
  const watched = movies.filter(m => m.watched).length;

  document.getElementById('count-total').textContent = total;
  document.getElementById('count-watched').textContent = watched;
  document.getElementById('count-pending').textContent = total - watched;
}
// For buttons
function setupEventListeners() {
  form.addEventListener('submit', addMovie);
  clearHistoryBtn.addEventListener('click', clearHistory);
  spinBtn.addEventListener('click', startRoulette);

  markWinnerBtn.addEventListener('click', handleMarkWinner);

  // Reset roulette UI on navigation
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