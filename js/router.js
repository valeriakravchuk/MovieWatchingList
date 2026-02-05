
export function initRouter() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');

  // Initialize navigation by setting up event listeners
  setupNavigation(navButtons, views);
}

/**
 * Attaches click event listeners to all navigation buttons.
 * Each button triggers a view change based on its 'data-target' attribute.
 */
function setupNavigation(navButtons, views) {
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-target');

      updateActiveButton(navButtons, e.target);
      switchView(views, targetId);
    });
  });
}

/**
 * Updates the visual state of navigation buttons.
 * Removes 'active' class from all buttons and applies it to the current one.
 */
function updateActiveButton(buttons, currentButton) {
  buttons.forEach(btn => btn.classList.remove('active'));
  currentButton.classList.add('active');
}

/**
 * Manages the visibility of different application sections (views).
 */
function switchView(views, targetId) {
  views.forEach(view => {
    if (view.id === targetId) {
      showView(view);
    } else {
      hideView(view);
    }
  });
}

/**
 * Small helper function to display a view.
 */
function showView(view) {
  view.classList.remove('hidden-view');
  view.classList.add('active-view');
}

/**
 * Small helper function to hide a view.
 */
function hideView(view) {
  view.classList.remove('active-view');
  view.classList.add('hidden-view');
}