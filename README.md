# Netflix Style Watchlist PWA

A progressive web application (PWA) to manage a movie watchlist. Created with pure JavaScript (Vanilla JS), CSS3, and HTML5.

## Features
- **Add Movies**: Add titles to your "Queue" with an immersive dark-themed UI.
- **Track Status**: Mark movies as watched (moves to "History").
- **Movie Roulette (Shuffle)**: An interactive "Spin the Wheel" feature to randomly pick a movie from your queue. Includes neon visual effects and animations.
- **Statistics**: Visual dashboard showing total, watched, and pending movies.
- **Persistence**: All data is stored in **IndexedDB** (Storage API) for robust offline data management.
- **PWA Capable**: Works offline via Service Worker caching and is installable on mobile/desktop.
- **Routing**: 4 distinct views (Queue, History, Stats, Shuffle) with smooth transitions.

## Technologies
- **HTML5**: Semantic structure.
- **CSS3**: Flexbox, Grid, CSS Variables, Keyframe Animations, Glassmorphism effects, Neon Glows.
- **JavaScript (ES6+)**: Async/Await, Modules, DOM Manipulation.
- **IndexedDB**: For persistent local storage (No LocalStorage used).
- **Service Worker**: Manual implementation for caching App Shell.
- **Google Fonts**: Bebas Neue & Roboto for cinematic typography.

## Caching Strategies & Justification
I implemented a **Decision Tree** based caching strategy within the Service Worker manually (no libraries), as demonstrated in class lectures.

1.  **Static Assets (CSS, JS, Fonts) -> `Cache First`**
    *   *Why:* These files define the app's look and logic. They rarely change. Loading them from cache ensures the app opens instantly (Performance metric).
    
2.  **HTML Documents -> `Network First`**
    *   *Why:* We always want the user to see the latest version of the app structure. If they are offline, we fall back to the cached version.

3.  **Images -> `Stale-While-Revalidate`**
    *   *Why:* Images are non-critical but heavy. We show the cached version immediately (fast LCP), but update it in the background if it changed on the server.

4.  **Storage Management**
    *   Implemented `navigator.storage.estimate()` to monitor quota usage on the user's device.

## Design Decisions
- **Netflix-Inspired Theme**: Dark background (`#141414`) with strong red accents (`#E50914`).
- **Micro-interactions**: Hover effects on movie cards, "spring" animations for checkboxes, and pulse effects for buttons.
- **Responsive Layout**: Mobile-first approach that adapts to desktop screens.

## How to Run
1. Host the files on a server (HTTPS required for PWA) or (e.g., Lr use a local development serveive Server in VS Code).
2. Open the browser and navigate to the URL.
3. Open DevTools -> Application -> Service Workers to see the worker active.
4. Add movies and try the **Shuffle** feature to see the animations.