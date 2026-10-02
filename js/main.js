/* Main Application Orchestrator for MarketKoro */

import { initTheme, toggleTheme } from './theme.js';
import { initI18n, toggleLanguage, getCurrentLanguage, getTranslation } from './i18n/i18n.js';
import { demoCategories, demoFeaturedProducts, demoPopularProducts, demoSellers } from './data/demo-data.js';
import { createProductCard } from './components/product-card.js';
import { formatNumber } from './utils/formatters.js';
import { showToast } from './components/toast.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme and Internationalization
  initTheme();
  initI18n();

  // Bind Event Listeners
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      toggleTheme();
    });
  }

  const langToggleBtn = document.getElementById('lang-toggle-btn');
  if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
      toggleLanguage();
    });
  }

  const mobileNavToggleBtn = document.getElementById('mobile-nav-toggle-btn');
  const navbar = document.getElementById('navbar');
  if (mobileNavToggleBtn && navbar) {
    mobileNavToggleBtn.addEventListener('click', () => {
      navbar.classList.toggle('open');
    });
  }

  // Render Homepage UI Sections
  renderCategories();
  renderFeaturedProducts();
  renderPopularProducts();
  renderFeaturedSellers();

  // Listen for language change events to re-render dynamic content
  window.addEventListener('marketkoro:languageChange', () => {
    renderCategories();
    renderFeaturedProducts();
    renderPopularProducts();
    renderFeaturedSellers();
  });

  // Handle Search Form Demo Action
  const searchForm = document.getElementById('search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = searchForm.querySelector('input');
      if (input && input.value.trim()) {
        showToast(`"${input.value.trim()}" - ${getTranslation('product.demo_tag')}`, 'info');
      }
    });
  }
});

function renderCategories() {
  const container = document.getElementById('categories-grid');
  if (!container) return;
  const lang = getCurrentLanguage();
  container.innerHTML = '';

  demoCategories.forEach((cat) => {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <div class="category-icon">${cat.icon}</div>
      <div class="category-name">${lang === 'bn' ? cat.name_bn : cat.name_en}</div>
    `;
    card.addEventListener('click', () => {
      showToast(`${lang === 'bn' ? cat.name_bn : cat.name_en} - ${getTranslation('product.demo_tag')}`, 'info');
    });
    container.appendChild(card);
  });
}

function renderFeaturedProducts() {
  const container = document.getElementById('featured-products-grid');
  if (!container) return;
  container.innerHTML = '';

  demoFeaturedProducts.forEach((product) => {
    container.appendChild(createProductCard(product));
  });
}

function renderPopularProducts() {
  const container = document.getElementById('popular-products-grid');
  if (!container) return;
  container.innerHTML = '';

  demoPopularProducts.forEach((product) => {
    container.appendChild(createProductCard(product));
  });
}

function renderFeaturedSellers() {
  const container = document.getElementById('featured-sellers-grid');
  if (!container) return;
  const lang = getCurrentLanguage();
  container.innerHTML = '';

  demoSellers.forEach((seller) => {
    const card = document.createElement('div');
    card.className = 'store-card';
    const loc = lang === 'bn' ? seller.location_bn : seller.location_en;
    card.innerHTML = `
      <img src="${seller.logo}" alt="${seller.name}" class="store-logo" loading="lazy">
      <div class="store-info">
        <div class="store-name">${seller.name}</div>
        <div class="store-meta">
          📍 ${loc} • ★ ${formatNumber(seller.rating, lang)} (${formatNumber(seller.productsCount, lang)} ${getTranslation('store.products_count')})
        </div>
        <span class="badge badge-primary" style="margin-top: 4px;">✔ ${getTranslation('store.verified')}</span>
      </div>
    `;
    container.appendChild(card);
  });
}
