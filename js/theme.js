/* Theme System for MarketKoro */

const THEME_KEY = 'marketkoro_theme';

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (e) {
    console.warn('LocalStorage access error:', e);
    return null;
  }
}

export function setStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

export function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getCurrentTheme() {
  const stored = getStoredTheme();
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return getSystemTheme();
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    toggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  }
}

export function toggleTheme() {
  const current = getCurrentTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setStoredTheme(next);
  applyTheme(next);
  return next;
}

export function initTheme() {
  const theme = getCurrentTheme();
  applyTheme(theme);

  // Listen for system theme changes if user has no explicit preference
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!getStoredTheme()) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}
