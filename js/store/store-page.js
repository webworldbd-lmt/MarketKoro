/**
 * Public Seller Store Page Controller for MarketKoro
 * Handles URL query parameters (?slug=... or ?uid=...), loads approved seller store, and initializes theme & i18n.
 */

import { initTheme, toggleTheme } from '../theme.js';
import { initI18n, toggleLanguage } from '../i18n/i18n.js';
import { getPublicSellerStoreBySlug, getPublicSellerStoreByUid } from '../seller/seller-service.js';
import { renderPublicStorePage } from './store-ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Theme & i18n
  initTheme();
  initI18n();

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  const langToggleBtn = document.getElementById('lang-toggle-btn');
  if (langToggleBtn) langToggleBtn.addEventListener('click', toggleLanguage);

  const root = document.getElementById('store-page-root');
  if (!root) return;

  // Extract query params
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  const uid = urlParams.get('uid');

  let storeData = null;

  try {
    if (slug) {
      storeData = await getPublicSellerStoreBySlug(slug);
    } else if (uid) {
      storeData = await getPublicSellerStoreByUid(uid);
    }

    renderPublicStorePage(root, storeData);
  } catch (err) {
    console.error("Error loading public seller store:", err);
    renderPublicStorePage(root, null);
  }

  // Re-render on language toggle
  window.addEventListener('marketkoro:languageChange', () => {
    renderPublicStorePage(root, storeData);
  });
});
