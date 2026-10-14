/* Main Application Orchestrator for MarketKoro */

import { initTheme, toggleTheme } from './theme.js';
import { initI18n, toggleLanguage, getCurrentLanguage, getTranslation } from './i18n/i18n.js';
import { categories } from './data/demo-data.js';
import { createProductCard } from './components/product-card.js';
import { createEmptyState } from './components/empty-state.js';
import { showToast } from './components/toast.js';
import { onAuthChanged, getCurrentState } from './auth/auth-service.js';
import { renderHeaderAccountState } from './auth/auth-ui.js';
import { openBecomeSellerModal } from './seller/seller-ui.js';
import { db } from '../config/firebase.js';
import { collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Default Fallback Slides when Firestore banners are absent or during network failures
const DEFAULT_HERO_SLIDES = [
  {
    id: 'default-1',
    title_bn: 'বাংলাদেশের নির্ভরযোগ্য মাল্টি-ভেন্ডার মার্কেটপ্লেস',
    title_en: "Bangladesh's Trusted Multi-Vendor Marketplace",
    subtitle_bn: '৬৪ জেলার বিশ্বস্ত স্থানীয় সেলারদের সেরা মানের পণ্য এখন এক জায়গায়।',
    subtitle_en: 'Discover quality products from thousands of verified local sellers across all 64 districts.',
    bg_gradient: 'linear-gradient(135deg, #0F766E 0%, #064E3B 100%)',
    cta1_text_bn: 'পণ্য দেখুন',
    cta1_text_en: 'Explore Products',
    cta1_href: '#featured-products',
    cta2_text_bn: 'বিক্রি শুরু করুন',
    cta2_text_en: 'Start Selling',
    cta2_id: 'hero-become-seller-btn'
  },
  {
    id: 'default-2',
    title_bn: 'দেশীয় হস্তশিল্প ও সেরা ব্রান্ডের সমাহার',
    title_en: 'Handicrafts & Heritage Collection',
    subtitle_bn: 'বাংলাদেশের কৃতি কারিগর ও স্থানীয় বিক্রেতাদের খাঁটি পণ্য কিনুন নিশ্চিন্তে।',
    subtitle_en: 'Shop authentic items directly from artisan makers and trusted local sellers.',
    bg_gradient: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
    cta1_text_bn: 'স্টোরসমূহ দেখুন',
    cta1_text_en: 'Browse Stores',
    cta1_href: '#featured-sellers',
    cta2_text_bn: 'বিক্রি শুরু করুন',
    cta2_text_en: 'Start Selling',
    cta2_id: 'hero-become-seller-btn'
  },
  {
    id: 'default-3',
    title_bn: 'স্মার্ট কেনাকাটা ও দ্রুত ডেলিভারি সুবিধা',
    title_en: 'Smart Shopping with Reliable Delivery',
    subtitle_bn: 'সহজ পেমেন্ট পদ্ধতি ও নির্ভরযোগ্য ডেলিভারি সার্ভিস নিয়ে মার্কেটকোরো আপনার সাথে।',
    subtitle_en: 'Experience seamless payments and fast shipping delivered right to your doorstep.',
    bg_gradient: 'linear-gradient(135deg, #047857 0%, #111827 100%)',
    cta1_text_bn: 'কেনাকাটা করুন',
    cta1_text_en: 'Shop Now',
    cta1_href: '#featured-products',
    cta2_text_bn: 'বিক্রি শুরু করুন',
    cta2_text_en: 'Start Selling',
    cta2_id: 'hero-become-seller-btn'
  }
];

// Hero Banner Slider State
let heroBannerState = {
  loading: true,
  slides: [],
  currentIndex: 0,
  timerId: null
};

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

  // Bind Footer Become Seller Link
  const footerBecomeSellerLink = document.getElementById('footer-become-seller-link');
  if (footerBecomeSellerLink) {
    footerBecomeSellerLink.addEventListener('click', (e) => {
      e.preventDefault();
      const state = getCurrentState();
      openBecomeSellerModal(state.user, state.profile);
    });
  }

  // Render Homepage UI Sections Independently with Loading States
  initHeroBanner();
  renderCategories();
  renderFeaturedProducts();
  renderPopularProducts();
  renderFeaturedSellers();

  // Listen for language change events to re-render dynamic content
  window.addEventListener('marketkoro:languageChange', () => {
    const container = document.getElementById('hero-banner-container');
    if (container && !heroBannerState.loading) {
      renderActiveHeroSlide(container);
    }
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

/**
 * Fetch Hero Banners from Firestore with Retry & Timeout logic.
 * Falls back to DEFAULT_HERO_SLIDES if empty or on persistent error.
 */
async function fetchHeroBanners(retries = 1, timeoutMs = 4000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const bannersRef = collection(db, 'banners');
      const q = query(bannersRef, limit(5));

      const fetchPromise = getDocs(q);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore fetch timeout')), timeoutMs)
      );

      const snap = await Promise.race([fetchPromise, timeoutPromise]);
      const list = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.enabled !== false) {
          list.push({ id: docSnap.id, ...data });
        }
      });

      if (list.length > 0) {
        return list;
      }
      return DEFAULT_HERO_SLIDES;
    } catch (err) {
      console.warn(`[Hero Banner] Fetch attempt ${attempt + 1} failed:`, err.message || err);
      if (attempt === retries) {
        console.error('[Hero Banner] Max retries reached. Falling back to default brand slides.', err);
        return DEFAULT_HERO_SLIDES;
      }
      await new Promise((res) => setTimeout(res, 300));
    }
  }
  return DEFAULT_HERO_SLIDES;
}

/**
 * Render Skeleton Loading State for Hero Banner
 */
function renderHeroBannerSkeleton(container) {
  container.innerHTML = `
    <div class="hero-banner-skeleton">
      <div class="skeleton-pulse skeleton-title"></div>
      <div class="skeleton-pulse skeleton-subtitle"></div>
      <div class="skeleton-pulse skeleton-subtitle-2"></div>
      <div class="skeleton-buttons">
        <div class="skeleton-pulse skeleton-btn"></div>
        <div class="skeleton-pulse skeleton-btn"></div>
      </div>
    </div>
  `;
}

/**
 * Render the current active slide in the Hero Banner
 */
function renderActiveHeroSlide(container) {
  if (!heroBannerState.slides || heroBannerState.slides.length === 0) {
    heroBannerState.slides = DEFAULT_HERO_SLIDES;
  }

  const slide = heroBannerState.slides[heroBannerState.currentIndex % heroBannerState.slides.length];
  const lang = getCurrentLanguage();

  const title = lang === 'bn' ? (slide.title_bn || slide.title || '') : (slide.title_en || slide.title || '');
  const subtitle = lang === 'bn' ? (slide.subtitle_bn || slide.subtitle || '') : (slide.subtitle_en || slide.subtitle || '');
  const cta1Text = lang === 'bn' ? (slide.cta1_text_bn || slide.cta1Text || 'পণ্য দেখুন') : (slide.cta1_text_en || slide.cta1Text || 'Explore Products');
  const cta2Text = slide.cta2_text_bn ? (lang === 'bn' ? slide.cta2_text_bn : slide.cta2_text_en) : (slide.cta2Text || null);

  const bgStyle = slide.image_url ?
    `background: linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(6, 78, 59, 0.9) 100%), url('${slide.image_url}') center/cover no-repeat;` :
    (slide.bg_gradient || 'linear-gradient(135deg, var(--color-primary) 0%, #064E3B 100%)');

  const showControls = heroBannerState.slides.length > 1;

  container.innerHTML = `
    <div class="hero-banner slide-fade-enter" style="${bgStyle}">
      ${slide.image_url ? `<img src="${slide.image_url}" alt="${title}" class="hero-banner-image-bg" loading="eager">` : ''}
      <div class="hero-content">
        <h1 class="hero-title">${title}</h1>
        <p class="hero-subtitle">${subtitle}</p>
        <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
          <a href="${slide.cta1_href || '#featured-products'}" class="btn btn-secondary">${cta1Text}</a>
          ${cta2Text ? `<a href="#become-seller" id="${slide.cta2_id || 'hero-become-seller-btn'}" class="btn btn-outline" style="color: #FFFFFF; border-color: rgba(255,255,255,0.4);">${cta2Text}</a>` : ''}
        </div>
      </div>

      ${showControls ? `
        <div class="hero-slider-nav">
          <button class="hero-nav-btn hero-prev-btn" aria-label="Previous Slide">❮</button>
          <button class="hero-nav-btn hero-next-btn" aria-label="Next Slide">❯</button>
        </div>
        <div class="hero-slider-dots">
          ${heroBannerState.slides.map((_, idx) => `
            <button class="hero-dot ${idx === heroBannerState.currentIndex ? 'active' : ''}" data-index="${idx}" aria-label="Go to slide ${idx + 1}"></button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  // Bind Slider Controls
  if (showControls) {
    const prevBtn = container.querySelector('.hero-prev-btn');
    const nextBtn = container.querySelector('.hero-next-btn');
    const dots = container.querySelectorAll('.hero-dot');

    prevBtn?.addEventListener('click', () => {
      heroBannerState.currentIndex = (heroBannerState.currentIndex - 1 + heroBannerState.slides.length) % heroBannerState.slides.length;
      renderActiveHeroSlide(container);
      resetAutoSlideTimer(container);
    });

    nextBtn?.addEventListener('click', () => {
      heroBannerState.currentIndex = (heroBannerState.currentIndex + 1) % heroBannerState.slides.length;
      renderActiveHeroSlide(container);
      resetAutoSlideTimer(container);
    });

    dots.forEach((dot) => {
      dot.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        if (!isNaN(idx)) {
          heroBannerState.currentIndex = idx;
          renderActiveHeroSlide(container);
          resetAutoSlideTimer(container);
        }
      });
    });
  }

  // Bind Become Seller Modal Trigger
  const becomeSellerBtn = container.querySelector('#hero-become-seller-btn');
  if (becomeSellerBtn) {
    becomeSellerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const state = getCurrentState();
      openBecomeSellerModal(state.user, state.profile);
    });
  }
}

function resetAutoSlideTimer(container) {
  if (heroBannerState.timerId) {
    clearInterval(heroBannerState.timerId);
  }
  if (heroBannerState.slides && heroBannerState.slides.length > 1) {
    heroBannerState.timerId = setInterval(() => {
      heroBannerState.currentIndex = (heroBannerState.currentIndex + 1) % heroBannerState.slides.length;
      renderActiveHeroSlide(container);
    }, 5000);
  }
}

/**
 * Initialize Hero Banner Component
 */
async function initHeroBanner() {
  const container = document.getElementById('hero-banner-container');
  if (!container) return;

  // 1. Show Loading State (Skeleton)
  heroBannerState.loading = true;
  renderHeroBannerSkeleton(container);

  // 2. Fetch Banners Asynchronously with Retry & Timeout Protection
  const slides = await fetchHeroBanners();

  // 3. Update State & Render Slide
  heroBannerState.slides = (slides && slides.length > 0) ? slides : DEFAULT_HERO_SLIDES;
  heroBannerState.loading = false;

  renderActiveHeroSlide(container);
  resetAutoSlideTimer(container);
}

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

function renderProductGridSkeleton(container, count = 4) {
  container.className = 'grid grid-cols-4';
  container.innerHTML = Array.from({ length: count }).map(() => `
    <div class="product-skeleton-card">
      <div class="skeleton-pulse product-skeleton-img"></div>
      <div class="skeleton-pulse product-skeleton-line"></div>
      <div class="skeleton-pulse product-skeleton-line-sm"></div>
    </div>
  `).join('');
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
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    return list;
  } catch (err) {
    console.warn('[Products] Fetch error:', err);
    return [];
  }
}

async function renderFeaturedProducts() {
  const container = document.getElementById('featured-products-grid');
  if (!container) return;

  // Render Section Loading State
  renderProductGridSkeleton(container, 4);

  const products = await fetchRealProducts(true);

  if (!products || products.length === 0) {
    container.className = '';
    const emptyState = createEmptyState({
      icon: '✨',
      titleBn: 'এখনো কোনো পণ্য যোগ করা হয়নি',
      titleEn: 'No products have been added yet.',
      subBn: 'খুব শীঘ্রই অনুমোদিত সেলারদের মানসম্মত পণ্য এখানে দেখা যাবে।',
      subEn: 'Verified seller products will appear here soon.'
    });
    container.appendChild(emptyState);
  } else {
    container.className = 'grid grid-cols-4';
    container.innerHTML = '';
    products.forEach((product) => {
      container.appendChild(createProductCard(product));
    });
  }
}

async function renderPopularProducts() {
  const container = document.getElementById('popular-products-grid');
  if (!container) return;

  // Render Section Loading State
  renderProductGridSkeleton(container, 4);

  const products = await fetchRealProducts(false);

  if (!products || products.length === 0) {
    container.className = '';
    const emptyState = createEmptyState({
      icon: '🔥',
      titleBn: 'এখনো কোনো পণ্য যোগ করা হয়নি',
      titleEn: 'No products have been added yet.',
      subBn: 'ক্রেতাদের পছন্দের জনপ্রিয় পণ্যসমূহ এখানে দেখা যাবে।',
      subEn: 'Popular customer items will be highlighted here.'
    });
    container.appendChild(emptyState);
  } else {
    container.className = 'grid grid-cols-4';
    container.innerHTML = '';
    products.forEach((product) => {
      container.appendChild(createProductCard(product));
    });
  }
}

async function renderFeaturedSellers() {
  const container = document.getElementById('featured-sellers-grid');
  if (!container) return;

  renderProductGridSkeleton(container, 4);

  let stores = [];
  try {
    const storesRef = collection(db, 'stores');
    const snap = await getDocs(query(storesRef, limit(4)));
    snap.forEach((docSnap) => stores.push({ id: docSnap.id, ...docSnap.data() }));
  } catch (e) {
    console.warn('[Stores] Fetch error:', e);
    stores = [];
  }

  if (!stores || stores.length === 0) {
    container.className = '';
    const emptyState = createEmptyState({
      icon: '🏪',
      titleBn: 'কোনো সেলার এখনো পাওয়া যায়নি',
      titleEn: 'No sellers are available yet.',
      subBn: 'বাংলাদেশের বিভিন্ন জেলার অনুমোদিত সেলারদের স্টোর এখানে দেখা যাবে।',
      subEn: 'Verified multi-vendor stores will appear here soon.'
    });
    container.appendChild(emptyState);
  } else {
    container.className = 'grid grid-cols-4';
    container.innerHTML = '';
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
