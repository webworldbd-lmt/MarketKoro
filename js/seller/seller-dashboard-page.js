/**
 * Seller Dashboard Page Controller for MarketKoro
 * Initializes Theme, i18n, Header, and delegates authorization & workspace rendering to seller-dashboard-ui.js.
 */

import { initTheme, toggleTheme } from '../theme.js';
import { initI18n, toggleLanguage, getTranslation } from '../i18n/i18n.js';
import { onAuthChanged, getCurrentState, logoutUser } from '../auth/auth-service.js';
import { renderSellerDashboardPage } from './seller-dashboard-ui.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme and Internationalization
  initTheme();
  initI18n();

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  const langToggleBtn = document.getElementById('lang-toggle-btn');
  if (langToggleBtn) langToggleBtn.addEventListener('click', toggleLanguage);

  // Sync Auth State with Page
  onAuthChanged((state) => {
    updateHeaderAccount(state);
    renderSellerDashboardPage(state);
  });

  // Re-render dynamic elements on language switch
  window.addEventListener('marketkoro:languageChange', () => {
    const state = getCurrentState();
    updateHeaderAccount(state);
    renderSellerDashboardPage(state);
  });
});

function updateHeaderAccount(state) {
  const accountItem = document.getElementById('seller-header-account-item');
  if (!accountItem) return;

  const { user, profile } = state;

  if (user) {
    const name = profile?.fullName || user.displayName || 'Account';
    accountItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: var(--space-2);">
        <a href="account.html" class="btn btn-outline btn-sm">👤 ${name.split(' ')[0]}</a>
        <button id="seller-page-logout-btn" class="btn btn-outline btn-sm" style="color: var(--color-error); border-color: var(--color-error); padding: 4px 10px;">🚪</button>
      </div>
    `;

    const logoutBtn = accountItem.querySelector('#seller-page-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await logoutUser();
        window.location.reload();
      });
    }
  } else {
    accountItem.innerHTML = `
      <a href="account.html" class="btn btn-outline btn-sm" data-i18n="auth.login">
        🔑 ${getTranslation('auth.login') || 'লগইন'}
      </a>
    `;
  }
}
