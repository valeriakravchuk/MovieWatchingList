# Netflix Style Watchlist PWA

A Progressive Web Application (PWA) for managing a movie watchlist. Built using pure JavaScript (Vanilla JS), CSS3, and HTML5.

---

## Native Device Functions  
**Requirement: minimum 2 native device functions**

The application uses **3 native device APIs**:

| # | API | Implementation | Usage |
|---|-----|----------------|-------|
| 1 | **MediaDevices API** (Camera) | `navigator.mediaDevices.getUserMedia({ video: true })` | Profile photo in the *Stats* tab (“Change Photo” → video stream → canvas → photo) |
| 2 | **Geolocation API** | `navigator.geolocation.getCurrentPosition()` | Click **Enable Sensors** → fetch location → map with marker (Leaflet + OpenStreetMap) in *Stats* |
| 3 | **Web Speech API** | `SpeechSynthesisUtterance`, `speechSynthesis.speak()` | Spoken announcement of the selected movie title after **Spin the Wheel** |

### Implementation Details
- **Geolocation** uses `getCurrentPosition()` with `enableHighAccuracy`
- Reverse geocoding via **Nominatim** to retrieve the city name
- Interactive map rendered using **Leaflet** with **OpenStreetMap** tiles

---

## Features
- **Add Movies** – Add titles to your *Queue* using an immersive dark-themed UI
- **Track Status** – Mark movies as watched (automatically moved to *History*)
- **Movie Roulette (Shuffle)** – Interactive **Spin the Wheel** feature to randomly select a movie  
  Includes neon effects and animations
- **Statistics Dashboard** – Displays total, watched, and pending movies
- **Persistence** – All data stored in **IndexedDB** for reliable offline usage
- **PWA Support** – Fully offline-capable via Service Worker and installable on mobile/desktop
- **Routing** – 4 distinct views: *Queue*, *History*, *Stats*, *Shuffle*

---

## Technologies
- **HTML5** – Semantic structure
- **CSS3** – Flexbox, Grid, CSS Variables, Keyframe Animations, Glassmorphism, Neon Glows
- **JavaScript (ES6+)** – Async/Await, Modules, DOM Manipulation
- **IndexedDB** – Persistent local storage (LocalStorage not used)
- **Service Worker** – Manual App Shell caching
- **Google Fonts** – Bebas Neue & Roboto (cinematic typography)

---

## Caching Strategies & Justification

A **Decision Tree–based caching strategy** was manually implemented inside the Service Worker (no external libraries), as demonstrated during class lectures.

### 1. Static Assets → `Cache First`
**Files:** CSS, JS, Fonts  
**Why:**  
These assets define the app’s appearance and logic and rarely change. Loading them from cache ensures instant startup and better performance.

### 2. HTML Documents → `Network First`
**Why:**  
Users should always receive the most recent version of the app. When offline, the cached HTML is used as a fallback.

### 3. Images → `Stale-While-Revalidate`
**Why:**  
Images are heavy but non-critical. Cached images are shown immediately (fast LCP), while updated versions are fetched in the background if available.

### 4. Storage Management
- Uses `navigator.storage.estimate()` to monitor storage quota usage on the user’s device

---

## Design Decisions
- **Netflix-Inspired Theme** – Dark background (`#141414`) with red accents (`#E50914`)
- **Micro-interactions** – Hover effects, spring animations, pulse effects on buttons
- **Responsive Design** – Mobile-first layout that scales smoothly to desktop screens

---

## How to Run the Project
1. Host the files on a server (**HTTPS required for PWA**), e.g. using **Live Server** in VS Code
2. Open the browser and navigate to the app URL
3. Open **DevTools → Application → Service Workers** to verify the worker is active
4. Add movies and try the **Shuffle** feature to see animations

---

## How to Test Offline Functionality
1. Open the application **online** (localhost or HTTPS) and wait for full load
2. Add several movies — data is stored in **IndexedDB**
3. Open **DevTools → Application → Service Workers**  
   Ensure status is **activated**
4. Open **DevTools → Network** → enable **Offline**
5. Refresh the page (F5) — the app should load from cache
6. Verify:
   - Movies are displayed
   - New movies can be added
   - Movies can be marked as watched
   - Roulette still works
7. **Note:** The geolocation map requires an internet connection (OpenStreetMap tiles)

---

## Author
Netflix Style Watchlist PWA — academic project demonstrating PWA, native device APIs, offline caching strategies, and modern frontend architecture.
