import { dbPromise } from './db.js';
import { initRouter } from './router.js';

document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  refreshAppData();
  registerServiceWorker();
  setupEventListeners();
  requestNotificationPermission();
});

// --- 1. НАТИВНА ФУНКЦІЯ: КАМЕРА (MediaDevices API) ---
async function startCamera() {
  const video = document.getElementById('video-stream');
  const openBtn = document.getElementById('btn-open-camera');
  const takeBtn = document.getElementById('btn-take-photo');
  const preview = document.getElementById('photo-preview');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.style.display = 'block';
    preview.style.display = 'none';
    openBtn.style.display = 'none';
    takeBtn.style.display = 'inline-block';
  } catch (err) {
    alert("Доступ до камери відхилено");
  }
}

function takePhoto() {
  const video = document.getElementById('video-stream');
  const canvas = document.getElementById('photo-canvas');
  const preview = document.getElementById('photo-preview');
  const context = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  preview.src = canvas.toDataURL('image/png');
  preview.style.display = 'block';
  video.style.display = 'none';

  // Зупиняємо камеру
  video.srcObject.getTracks().forEach(track => track.stop());

  document.getElementById('btn-take-photo').style.display = 'none';
  document.getElementById('btn-open-camera').style.display = 'inline-block';
  document.getElementById('btn-open-camera').textContent = "Retake Photo";
}

// --- 2. НАТИВНА ФУНКЦІЯ: СПОВІЩЕННЯ (Notifications API) ---
function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission();
  }
}

function sendPush(title, message) {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body: message,
        icon: 'icon192.png',
        vibrate: [200, 100, 200]
      });
    });
  }
}

// --- 3. НАТИВНА ФУНКЦІЯ: ГЕОЛОКАЦІЯ (Geolocation API) ---
function getLocationAndDisplay() {
  if (!('geolocation' in navigator)) {
    const loc = document.getElementById('location-display');
    const txt = document.getElementById('location-text');
    if (loc && txt) {
      loc.style.display = 'flex';
      txt.textContent = 'Geolocation not supported';
    }
    return;
  }
  const locationDisplay = document.getElementById('location-display');
  const locationText = document.getElementById('location-text');
  if (!locationDisplay || !locationText) return;

  locationDisplay.style.display = 'flex';
  locationText.textContent = 'Getting location...';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      const coords = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
      try {
        const city = await reverseGeocode(latitude, longitude);
        locationText.textContent = city ? `Watching from: ${city}` : `Coordinates: ${coords}`;
      } catch {
        locationText.textContent = `Coordinates: ${coords}`;
      }
    },
    (err) => {
      locationText.textContent = err.code === 1 ? 'Location access denied' : 'Could not get location';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  return data.address?.city || data.address?.town || data.address?.village || null;
}

// --- 4. НАТИВНА ФУНКЦІЯ: ВІБРАЦІЯ (Vibration API) ---
function vibrate(pattern = [200, 100, 200]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// --- 5. НАТИВНА ФУНКЦІЯ: СИНТЕЗ МОВЛЕННЯ (Web Speech API) ---
function speakText(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; // Можна змінити на 'uk-UA', якщо фільми українською
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }
}

// --- ОСНОВНА ЛОГІКА ПРОГРАМИ ---

function setupEventListeners() {
  // Додавання фільму
  document.getElementById('add-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('movie-input');
    if (!input.value) return;

    await dbPromise.add({ id: Date.now(), title: input.value, watched: false });
    vibrate([100]); // haptic feedback
    sendPush("Success!", `Фільм "${input.value}" додано до черги.`);
    input.value = '';
    refreshAppData();
  };

  // Кнопка Enable Sensors — запитує геолокацію та показує локацію в Stats
  document.getElementById('enable-native-btn').onclick = () => {
    getLocationAndDisplay();
    vibrate([100]);
  };

  // Кнопки камери
  document.getElementById('btn-open-camera').onclick = startCamera;
  document.getElementById('btn-take-photo').onclick = takePhoto;

  // Рулетка
  document.getElementById('spin-btn').onclick = async () => {
    const movies = await dbPromise.getAll();
    const queue = movies.filter(m => !m.watched);
    if (queue.length === 0) return;

    const winner = queue[Math.floor(Math.random() * queue.length)];
    const textDisplay = document.getElementById('roulette-text');

    textDisplay.textContent = "Choosing...";
    vibrate([150, 80, 150]); // haptic feedback при натисканні
    setTimeout(() => {
      textDisplay.textContent = winner.title;
      vibrate([200, 100, 200]); // вібрація при виграші

      // ВИКЛИК НАТИВНИХ ФУНКЦІЙ ПРИ ВИГРАШІ
      sendPush("Winner Picked! 🍿", `Tonight's movie: ${winner.title}`);
      speakText(`Tonight we are watching ${winner.title}`);
    }, 1500);
  };
}

async function refreshAppData() {
  const movies = await dbPromise.getAll();
  const list = document.getElementById('movie-list');
  const watchedList = document.getElementById('history-list');
  if (!list || !watchedList) return;

  list.innerHTML = '';
  watchedList.innerHTML = '';

  movies.sort((a, b) => b.id - a.id).forEach(movie => {
    const li = document.createElement('li');
    li.className = 'movie-item';
    li.innerHTML = `
      <div class="movie-content">
        <span class="movie-text">${movie.title}</span>
      </div>
      <button class="delete-btn">✖</button>
    `;

    li.querySelector('.delete-btn').onclick = async () => {
      await dbPromise.delete(movie.id);
      refreshAppData();
    };

    movie.watched ? watchedList.appendChild(li) : list.appendChild(li);
  });
  updateStats(movies);
}

function updateStats(movies) {
  document.getElementById('count-total').textContent = movies.length;
  document.getElementById('count-watched').textContent = movies.filter(m => m.watched).length;
  document.getElementById('count-pending').textContent = movies.filter(m => !m.watched).length;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
}