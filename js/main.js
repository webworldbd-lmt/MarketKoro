/* Main Application Orchestrator for MarketKoro */

import { initTheme, toggleTheme } from './theme.js';
import { initI18n, toggleLanguage, getCurrentLanguage, getTranslation } from './i18n/i18n.js';
import { categories } from './data/demo-data.js';
import { createProductCard } from './components/product-card.js';
import { createEmptyState } from './components/empty-state.js';
import { showToast } from './components/toast.js';
import { onAuthChanged, getCurrentState } from './auth/auth-service.js';
import { renderHeaderAccountState } from './auth/auth-ui.js';
import { db } from '../config/firebase.js';
import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme and Internationalization
  initTheme();
  initI18n();

  // Bind Theme & Language Switchers
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

  // Initialize Authentication State Sync with Header
  const navAccountItem = document.getElementById('nav-account-item');
  onAuthChanged((state) => {
    renderHeaderAccountState(navAccountItem, state);
  });

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
    renderHeaderAccountState(navAccountItem, getCurrentState());
  });

  // Handle Search Form Action
  const searchForm = document.getElementById('search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = searchForm.querySelector('input');
      if (input && input.value.trim()) {
        showToast(`"${input.value.trim()}" - ${getTranslation('search.placeholder')}`, 'info');
      }
    });
  }
});

function renderCategories() {
  const container = document.getElementById('categories-grid');
  if (!container) return;
  const lang = getCurrentLanguage();
  container.innerHTML = '';

  categories.forEach((cat) => {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <div class="category-icon">${cat.icon}</div>
      <div class="category-name">${lang === 'bn' ? cat.name_bn : cat.name_en}</div>
    `;
    card.addEventListener('click', () => {
      showToast(`${lang === 'bn' ? cat.name_bn : cat.name_en}`, 'info');
    });
    container.appendChild(card);
  });
}

async function fetchRealProducts(isFeatured = false) {
  try {
    const productsRef = collection(db, 'products');
    let q;
    if (isFeatured) {
      q = query(productsRef, where('isFeatured', '==', true), limit(8));
    } else {
      q = query(productsRef, limit(8));
    }
    const snap = await getDocs(q);
    const list = [];
    snap.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    return list;
  } catch (err) {
    // Return empty list if collection doesn't exist yet or offline
    return [];
  }
}

async function renderFeaturedProducts() {
  const container = document.getElementById('featured-products-grid');
  if (!container) return;
  container.innerHTML = '';

  const products = await fetchRealProducts(true);

  if (!products || products.length === 0) {
    container.className = '';
    const emptyState = createEmptyState({
      icon: '✨',
      titleBn: 'এখনো কোনো বিশেষ পণ্য নেই',
      titleEn: 'No featured products yet.',
      subBn: 'খুব শীঘ্রই সেলারদের মানসম্মত পণ্য এখানে স্থান পাবে।',
      subEn: 'Verified seller products will appear here soon.'
    });
    container.appendChild(emptyState);
  } else {
    container.className = 'grid grid-cols-4';
    products.forEach((product) => {
      container.appendChild(createProductCard(product));
    });
  }
}

async function renderPopularProducts() {
  const container = document.getElementById('popular-products-grid');
  if (!container) return;
  container.innerHTML = '';

  const products = await fetchRealProducts(false);

  if (!products || products.length === 0) {
    container.className = '';
    const emptyState = createEmptyState({
      icon: '🔥',
      titleBn: 'কোনো জনপ্রিয় পণ্য পাওয়া যায়নি',
      titleEn: 'No popular products yet.',
      subBn: 'ক্রেতাদের পছন্দের পণ্যসমূহ এখানে দেখা যাবে।',
      subEn: 'Popular customer items will be highlighted here.'
    });
    container.appendChild(emptyState);
  } else {
    container.className = 'grid grid-cols-4';
    products.forEach((product) => {
      container.appendChild(createProductCard(product));
    });
  }
}

async function renderFeaturedSellers() {
  const container = document.getElementById('featured-sellers-grid');
  if (!container) return;
  container.innerHTML = '';

  let stores = [];
  try {
    const storesRef = collection(db, 'stores');
    const snap = await getDocs(query(storesRef, limit(4)));
    snap.forEach((doc) => stores.push({ id: doc.id, ...doc.data() }));
  } catch (e) {
    stores = [];
  }

  if (!stores || stores.length === 0) {
    container.className = '';
    const emptyState = createEmptyState({
      icon: '🏪',
      titleBn: 'কোনো সেলার এখনো পাওয়া যায়নি',
      titleEn: 'No sellers are available yet.',
      subBn: 'বাংলাদেশের বিভিন্ন জেলার নিবন্ধিত সেলারদের স্টোর এখানে দেখা যাবে।',
      subEn: 'Verified multi-vendor stores will appear here soon.'
    });
    container.appendChild(emptyState);
  } else {
    container.className = 'grid grid-cols-4';
    const lang = getCurrentLanguage();
    stores.forEach((seller) => {
      const card = document.createElement('div');
      card.className = 'store-card';
      const loc = lang === 'bn' ? (seller.location_bn || seller.location) : (seller.location_en || seller.location);
      card.innerHTML = `
        <img src="${seller.logo || 'assets/images/placeholder-store.svg'}" alt="${seller.name}" class="store-logo" loading="lazy">
        <div class="store-info">
          <div class="store-name">${seller.name}</div>
          <div class="store-meta">
            📍 ${loc || ''}
          </div>
          <span class="badge badge-primary" style="margin-top: 4px;">✔ ${getTranslation('store.verified')}</span>
        </div>
      `;
      container.appendChild(card);
    });
  }
}
