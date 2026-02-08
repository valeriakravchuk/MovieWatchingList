import { dbPromise } from './db.js';
import { initRouter } from './router.js';

document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  refreshAppData();
  registerServiceWorker();
  setupEventListeners();
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

  // Зупиняємо камеру (перевірка на null)
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }

  document.getElementById('btn-take-photo').style.display = 'none';
  document.getElementById('btn-open-camera').style.display = 'inline-block';
  document.getElementById('btn-open-camera').textContent = "Retake Photo";
}

// --- 2. НАТИВНА ФУНКЦІЯ: ГЕОЛОКАЦІЯ (Geolocation API) ---
let locationMapInstance = null;

function getLocationAndDisplay() {
  if (!('geolocation' in navigator)) {
    const loc = document.getElementById('location-display');
    const txt = document.getElementById('location-text');
    if (loc && txt) {
      loc.style.display = 'block';
      txt.textContent = 'Geolocation not supported';
    }
    return;
  }
  const locationDisplay = document.getElementById('location-display');
  const locationText = document.getElementById('location-text');
  const mapContainer = document.getElementById('location-map');
  if (!locationDisplay || !locationText || !mapContainer) return;

  locationDisplay.style.display = 'block';
  locationText.textContent = 'Getting location...';
  mapContainer.innerHTML = '';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      let city = null;
      try {
        city = await reverseGeocode(latitude, longitude);
      } catch { /* ignore */ }

      locationText.textContent = city ? `Watching from: ${city}` : `Coordinates: ${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;

      // Переходимо на Stats щоб карта коректно відобразилась
      document.querySelector('[data-target="stats"]')?.click();

      // Невелика затримка для рендеру контейнера
      requestAnimationFrame(() => {
        initMap(latitude, longitude, city);
      });
    },
    (err) => {
      locationText.textContent = err.code === 1 ? 'Location access denied' : 'Could not get location';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function initMap(lat, lon, city) {
  if (typeof L === 'undefined') return;

  if (locationMapInstance) {
    locationMapInstance.remove();
  }

  const mapContainer = document.getElementById('location-map');
  if (!mapContainer) return;

  locationMapInstance = L.map('location-map').setView([lat, lon], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(locationMapInstance);

  const popupText = city || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  L.marker([lat, lon])
    .addTo(locationMapInstance)
    .bindPopup(popupText)
    .openPopup();
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  return data.address?.city || data.address?.town || data.address?.village || null;
}

// --- 3. НАТИВНА ФУНКЦІЯ: СИНТЕЗ МОВЛЕННЯ (Web Speech API) ---
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
    input.value = '';
    refreshAppData();
  };

  // Кнопка Enable Sensors — запитує геолокацію та показує карту в Stats
  document.getElementById('enable-native-btn').onclick = () => getLocationAndDisplay();

  // Очистити історію переглянутих
  document.getElementById('clear-history-btn').onclick = async () => {
    await dbPromise.clearWatched();
    refreshAppData();
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

    // Перебирання фільмів (ефект рулетки)
    const shuffleInterval = setInterval(() => {
      const random = queue[Math.floor(Math.random() * queue.length)];
      textDisplay.textContent = random.title;
    }, 100);

    setTimeout(() => {
      clearInterval(shuffleInterval);
      textDisplay.textContent = winner.title;
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
        ${!movie.watched ? '<button class="check-btn" title="Mark as watched">✔</button>' : ''}
        <span class="movie-text">${movie.title}</span>
      </div>
      <button class="delete-btn">✖</button>
    `;

    if (!movie.watched) {
      li.querySelector('.check-btn').onclick = async () => {
        await dbPromise.update({ ...movie, watched: true });
        refreshAppData();
      };
    }

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