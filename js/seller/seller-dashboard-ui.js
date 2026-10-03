/**
 * Seller Dashboard Foundation & Access Control Module for MarketKoro
 * Handles secure seller-only dashboard access, seller identity, overview metrics,
 * earnings/commission calculations, withdrawal requests, and navigation structure.
 */

import { getTranslation } from '../i18n/i18n.js';
import { createModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { openLoginModal } from '../auth/auth-ui.js';
import { getSellerApplication, updateSellerProfile, generateStoreSlug, checkSlugAvailability } from './seller-service.js';
import { openBecomeSellerModal } from './seller-ui.js';
import { createEmptyState } from '../components/empty-state.js';
import { uploadImage } from '../utils/image-uploader.js';
import { renderProductsTab } from './seller-product-ui.js';
import { getSellerProducts } from './product-service.js';
import { renderOrdersTab } from './seller-order-ui.js';
import {
  getSellerFinancialSummary,
  getSellerWithdrawalRequests,
  submitWithdrawalRequest,
  getSellerFinancialLedger,
  ALLOWED_PAYOUT_METHODS,
  MINIMUM_WITHDRAWAL_AMOUNT,
  getWithdrawalStatusLabel,
  maskAccountDetails
} from './financial-service.js';

let activeDashboardModalBackdrop = null;
let activeSellerTab = 'overview';

/**
 * Main Standalone Page Handler for seller.html
 * @param {Object} state - { user, profile, loading }
 */
export async function renderSellerDashboardPage(state) {
  const root = document.getElementById('seller-dashboard-root');
  if (!root) return;

  const headerBadge = document.getElementById('seller-header-store-badge');
  if (headerBadge) headerBadge.style.display = 'none';

  const { user, profile, loading } = state;

  if (loading) {
    root.innerHTML = `
      <div style="text-align: center; padding: var(--space-8);">
        <span class="loading-spinner" style="width: 2rem; height: 2rem;"></span>
        <p style="margin-top: var(--space-2); color: var(--color-text-muted);">${getTranslation('common.loading')}</p>
      </div>
    `;
    return;
  }

  // 1. Logged-out User Check
  if (!user) {
    renderUnauthorizedLoggedOut(root);
    return;
  }

  // Fetch trusted Firestore seller application
  try {
    const application = await getSellerApplication(user.uid);

    // Synchronize real products count for approved seller
    if (application && application.status === 'approved') {
      try {
        const realProducts = await getSellerProducts(user.uid);
        application.productsCount = realProducts.length;
      } catch (e) {
        console.warn("Products count fetch warning:", e);
      }
    }

    // 2. Customer with no seller application
    if (!application) {
      renderUnauthorizedCustomer(root, user, profile);
      return;
    }

    // 3. Pending Applicant
    if (application.status === 'pending') {
      renderUnauthorizedPending(root, application);
      return;
    }

    // 4. Rejected Applicant
    if (application.status === 'rejected') {
      renderUnauthorizedRejected(root, application, user, profile);
      return;
    }

    // 5. Suspended Seller
    if (application.status === 'suspended') {
      renderUnauthorizedSuspended(root, application);
      return;
    }

    // 6. Verified & Approved Seller
    if (headerBadge && application.storeName) {
      headerBadge.textContent = application.storeName;
      headerBadge.style.display = 'inline-block';
    }

    await renderApprovedSellerDashboard(root, application, user, profile);
  } catch (err) {
    console.error("Seller dashboard authorization error:", err);
    root.innerHTML = `
      <div style="text-align: center; padding: var(--space-8);">
        <div style="font-size: 3rem; margin-bottom: var(--space-2);">⚠️</div>
        <h3>${getTranslation('common.error_occurred')}</h3>
        <p style="color: var(--color-text-muted);">${err.message || ''}</p>
      </div>
    `;
  }
}

/**
 * Modal Fallback Entry: Open Seller Dashboard in Modal Shell
 * @param {Object} user
 * @param {Object} profile
 */
export async function openSellerDashboard(user, profile) {
  if (activeDashboardModalBackdrop) closeModal(activeDashboardModalBackdrop);

  if (!user) {
    showToast(getTranslation('seller.login_required_msg') || "Please log in to access the Seller Dashboard.", 'warning');
    openLoginModal();
    return;
  }

  const container = document.createElement('div');
  container.className = 'seller-dashboard-container';
  container.innerHTML = `
    <div style="text-align: center; padding: var(--space-8);">
      <span class="loading-spinner" style="width: 2rem; height: 2rem;"></span>
      <p style="margin-top: var(--space-2); color: var(--color-text-muted);">${getTranslation('common.loading')}</p>
    </div>
  `;

  activeDashboardModalBackdrop = createModal({
    title: getTranslation('seller.dashboard_title') || "Seller Dashboard",
    bodyContent: container
  });

  await renderSellerDashboardPage({ user, profile, loading: false });
}

/* ==========================================================================
   UNAUTHORIZED ACCESS STATES (Clean Empty States without exposing seller info)
   ========================================================================== */

function renderUnauthorizedLoggedOut(container) {
  container.innerHTML = '';
  const emptyState = createEmptyState({
    icon: '🔒',
    titleBn: 'লগইন প্রয়োজন',
    titleEn: 'Authentication Required',
    subBn: 'সেলার ড্যাশবোর্ডে প্রবেশ করতে অনুগ্রহ করে প্রথমে আপনার একাউন্টে লগইন করুন।',
    subEn: 'Please log in to your account to access the MarketKoro Seller Dashboard.',
    actionTextBn: getTranslation('auth.login'),
    actionTextEn: getTranslation('auth.login'),
    onAction: () => openLoginModal()
  });
  container.appendChild(emptyState);
}

function renderUnauthorizedCustomer(container, user, profile) {
  container.innerHTML = '';
  const emptyState = createEmptyState({
    icon: '💼',
    titleBn: getTranslation('seller.access_denied') || 'সেলার এক্সেস প্রয়োজন',
    titleEn: getTranslation('seller.access_denied') || 'Seller Access Required',
    subBn: getTranslation('seller.customer_access_denied_desc') || 'আপনার কোনো সক্রিয় সেলার একাউন্ট নেই। মার্কেটকোরোতে পণ্য বিক্রি শুরু করতে সেলার আবেদন করুন।',
    subEn: getTranslation('seller.customer_access_denied_desc') || 'You do not have an active seller account. To start selling on MarketKoro, submit a seller application.',
    actionTextBn: getTranslation('seller.become_seller_title') || 'সেলার হিসেবে যোগ দিন',
    actionTextEn: getTranslation('seller.become_seller_title') || 'Become a Seller',
    onAction: () => openBecomeSellerModal(user, profile)
  });
  container.appendChild(emptyState);
}

function renderUnauthorizedPending(container, application) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding: var(--space-6); text-align: center; max-width: 540px; margin: 0 auto; background-color: var(--color-surface);';

  card.innerHTML = `
    <div style="font-size: 3.5rem; margin-bottom: var(--space-2);">⏳</div>
    <span class="badge badge-secondary" style="margin-bottom: var(--space-3); padding: 4px 12px; font-size: 0.9rem;">
      ${getTranslation('seller.status_pending') || "আবেদন পর্যালোচনায় রয়েছে"}
    </span>
    <h3 style="margin-bottom: var(--space-2);">${application.storeName || 'Store'}</h3>
    <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); line-height: 1.6; margin-bottom: var(--space-5);">
      ${getTranslation('seller.pending_dashboard_access_desc') || "আপনার সেলার আবেদনটি ভেরিফিকেশন টিমের পর্যালোচনায় রয়েছে। আবেদন অনুমোদিত হওয়ার পর ড্যাশবোর্ড সুবিধা স্বয়ংক্রিয়ভাবে সক্রিয় হবে।"}
    </p>

    <a href="index.html" class="btn btn-primary btn-full">
      🏠 ${getTranslation('nav.home') || 'হোমে ফিরুন'}
    </a>
  `;

  container.innerHTML = '';
  container.appendChild(card);
}

function renderUnauthorizedRejected(container, application, user, profile) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding: var(--space-6); text-align: center; max-width: 540px; margin: 0 auto; background-color: var(--color-surface);';

  card.innerHTML = `
    <div style="font-size: 3.5rem; margin-bottom: var(--space-2);">❌</div>
    <span class="badge" style="margin-bottom: var(--space-3); padding: 4px 12px; font-size: 0.9rem; background-color: var(--color-error-bg); color: var(--color-error);">
      ${getTranslation('seller.status_rejected') || "আবেদন বাতিল হয়েছে"}
    </span>
    <h3 style="margin-bottom: var(--space-2);">${application.storeName || 'Store'}</h3>
    <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); line-height: 1.6; margin-bottom: var(--space-4);">
      ${getTranslation('seller.rejected_dashboard_access_desc') || "আপনার সেলার আবেদনটি অনুমোদিত হয়নি। ড্যাশবোর্ড এক্সেস সীমাবদ্ধ রয়েছে।"}
    </p>

    ${application.rejectionReason ? `
      <div style="background-color: var(--color-error-bg); color: var(--color-error); padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); margin-bottom: var(--space-4); text-align: left;">
        <strong>${getTranslation('seller.rejection_reason_label') || 'কারণ'}:</strong> ${application.rejectionReason}
      </div>
    ` : ''}

    <button id="rejected-reapply-btn" class="btn btn-primary btn-full" style="margin-bottom: var(--space-3);">
      🔄 ${getTranslation('seller.reapply_btn') || "পুনরায় আবেদন আপডেট করুন"}
    </button>

    <a href="index.html" class="btn btn-outline btn-full">
      🏠 ${getTranslation('nav.home') || 'হোমে ফিরুন'}
    </a>
  `;

  card.querySelector('#rejected-reapply-btn')?.addEventListener('click', () => {
    openBecomeSellerModal(user, profile);
  });

  container.innerHTML = '';
  container.appendChild(card);
}

function renderUnauthorizedSuspended(container, application) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding: var(--space-6); text-align: center; max-width: 540px; margin: 0 auto; background-color: var(--color-surface);';

  card.innerHTML = `
    <div style="font-size: 3.5rem; margin-bottom: var(--space-2);">🚫</div>
    <span class="badge" style="margin-bottom: var(--space-3); padding: 4px 12px; font-size: 0.9rem; background-color: var(--color-error-bg); color: var(--color-error);">
      ${getTranslation('seller.status_suspended') || "একাউন্ট স্থগিত"}
    </span>
    <h3 style="margin-bottom: var(--space-2);">${application.storeName || 'Store'}</h3>
    <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); line-height: 1.6; margin-bottom: var(--space-5);">
      ${getTranslation('seller.suspended_desc') || "পলিসি লঙ্ঘন বা এডমিন নির্দেশনায় এই সেলার একাউন্টটি স্থগিত রয়েছে। সহায়তার জন্য সাপোর্ট টিমের সাথে যোগাযোগ করুন।"}
    </p>

    <a href="index.html" class="btn btn-outline btn-full">
      🏠 ${getTranslation('nav.home') || 'হোমে ফিরুন'}
    </a>
  `;

  container.innerHTML = '';
  container.appendChild(card);
}

/* ==========================================================================
   APPROVED SELLER DASHBOARD WORKSPACE
   ========================================================================== */

async function renderApprovedSellerDashboard(container, application, user, profile) {
  const storeLogo = application.storeLogo || 'assets/images/placeholder-store.svg';
  const storeBanner = application.storeBanner || '';
  const storeName = application.storeName || 'My Store';
  const sellerOwnerName = application.fullName || profile?.fullName || user.displayName || 'Seller';
  const storeSlug = application.storeSlug || 'store';
  const division = application.division || 'Bangladesh';
  const district = application.district || '';
  const contactPhone = application.contactPhone || application.phone || '';

  // Fetch real financial summary calculated strictly from order & transaction records
  const financialSummary = await getSellerFinancialSummary(user.uid, application.commissionRate);

  const productsCount = Number(application.productsCount) || 0;
  const ordersCount = financialSummary.orderCount || 0;
  const grossSales = financialSummary.grossSales;
  const availableBalance = financialSummary.availableBalance;

  container.innerHTML = `
    <div class="seller-dashboard-layout" style="display: flex; flex-direction: column; gap: var(--space-5);">

      <!-- 1. Seller Identity Banner Card -->
      <div class="card" style="padding: 0; overflow: hidden; border: 1px solid var(--color-border); position: relative;">
        ${storeBanner ? `
          <div style="height: 120px; width: 100%; overflow: hidden; background-color: var(--color-bg);">
            <img src="${storeBanner}" alt="Banner" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        ` : `
          <div style="height: 90px; width: 100%; background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);"></div>
        `}

        <div style="padding: var(--space-5); display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; margin-top: ${storeBanner ? '-40px' : '0'};">
          <img src="${storeLogo}" alt="Logo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 4px solid var(--color-surface); background-color: var(--color-surface); flex-shrink: 0;">

          <div style="flex: 1; min-width: 240px;">
            <div style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
              <h2 style="margin: 0; font-size: var(--font-size-xl); font-weight: 700;">${storeName}</h2>
              <span class="badge" style="background-color: var(--color-success-bg); color: var(--color-success); font-weight: 600;">
                ✔ ${getTranslation('store.verified') || 'অনুমোদিত সেলার'}
              </span>
            </div>

            <div style="display: flex; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-1); font-size: var(--font-size-xs); color: var(--color-text-muted);">
              <span>👤 ${sellerOwnerName}</span>
              <span>📍 ${upazilaLocation(district, division)}</span>
              <span>📞 ${contactPhone}</span>
            </div>

            <div style="margin-top: var(--space-2); font-size: var(--font-size-xs); color: var(--color-primary); font-weight: 600;">
              🌐 seller.${storeSlug}.marketkoro.com
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Seller Dashboard Navigation Bar -->
      <nav class="card" style="padding: var(--space-2); overflow-x: auto;">
        <div style="display: flex; gap: var(--space-2); min-width: max-content;">
          <button class="seller-nav-btn ${activeSellerTab === 'overview' ? 'active' : ''}" data-tab="overview">
            📊 <span data-i18n="seller.nav_overview">সারসংক্ষেপ</span>
          </button>
          <button class="seller-nav-btn ${activeSellerTab === 'store' ? 'active' : ''}" data-tab="store">
            🏪 <span data-i18n="seller.nav_store">স্টোর পরিচিতি</span>
          </button>
          <button class="seller-nav-btn ${activeSellerTab === 'products' ? 'active' : ''}" data-tab="products">
            📦 <span data-i18n="seller.nav_products">পণ্য ব্যবস্থাপনা</span>
          </button>
          <button class="seller-nav-btn ${activeSellerTab === 'orders' ? 'active' : ''}" data-tab="orders">
            🛒 <span data-i18n="seller.nav_orders">অর্ডারসমূহ</span>
          </button>
          <button class="seller-nav-btn ${activeSellerTab === 'earnings' ? 'active' : ''}" data-tab="earnings">
            💰 <span data-i18n="seller.nav_earnings">আয় ও বিক্রি</span>
          </button>
          <button class="seller-nav-btn ${activeSellerTab === 'withdrawals' ? 'active' : ''}" data-tab="withdrawals">
            🏦 <span data-i18n="seller.nav_withdrawals">উত্তোলন</span>
          </button>
          <button class="seller-nav-btn ${activeSellerTab === 'settings' ? 'active' : ''}" data-tab="settings">
            ⚙️ <span data-i18n="seller.nav_settings">সেটিংস</span>
          </button>
        </div>
      </nav>

      <!-- 3. Dashboard View Area -->
      <div id="seller-tab-content-area"></div>

    </div>
  `;

  // Inject tab navigation styles dynamically
  if (!document.getElementById('seller-dashboard-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'seller-dashboard-styles';
    styleEl.textContent = `
      .seller-nav-btn {
        padding: var(--space-2) var(--space-4);
        border: none;
        background: transparent;
        color: var(--color-text);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        border-radius: var(--radius-md);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        transition: all var(--transition-fast);
        white-space: nowrap;
      }
      .seller-nav-btn:hover {
        background-color: var(--color-bg);
      }
      .seller-nav-btn.active {
        background-color: var(--color-primary-light);
        color: var(--color-primary);
        font-weight: var(--font-weight-bold);
      }
    `;
    document.head.appendChild(styleEl);
  }

  // Tab Switch Event Listeners
  container.querySelectorAll('.seller-nav-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      activeSellerTab = btn.getAttribute('data-tab');
      container.querySelectorAll('.seller-nav-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      await renderSellerTabContent(container.querySelector('#seller-tab-content-area'), activeSellerTab, application, user, {
        productsCount, ordersCount, grossSales, availableBalance, financialSummary
      });
    });
  });

  // Render initial tab content
  const tabContentArea = container.querySelector('#seller-tab-content-area');
  await renderSellerTabContent(tabContentArea, activeSellerTab, application, user, {
    productsCount, ordersCount, grossSales, availableBalance, financialSummary
  });
}

/**
 * Render Active Tab Content
 */
async function renderSellerTabContent(targetEl, tab, application, user, metrics) {
  targetEl.innerHTML = '';

  if (tab === 'overview') {
    renderOverviewTab(targetEl, application, metrics);
  } else if (tab === 'store') {
    renderStoreTabStructure(targetEl, application);
  } else if (tab === 'products') {
    renderProductsTabStructure(targetEl, application);
  } else if (tab === 'orders') {
    renderOrdersTabStructure(targetEl, application);
  } else if (tab === 'earnings') {
    await renderEarningsTab(targetEl, application, user);
  } else if (tab === 'withdrawals') {
    await renderWithdrawalsTab(targetEl, application, user);
  } else if (tab === 'settings') {
    renderSettingsTabStructure(targetEl, application);
  }
}

/**
 * Overview Tab: Metrics Cards & Identity Details
 */
function renderOverviewTab(container, application, metrics) {
  const cardGrid = document.createElement('div');
  cardGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-5);';

  cardGrid.innerHTML = `
    <!-- Metric 1: Total Products -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid var(--color-primary);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="seller.dashboard_products">মোট পণ্য</span>
        <span style="font-size: 1.5rem;">📦</span>
      </div>
      <div style="font-size: var(--font-size-2xl); font-weight: 700; color: var(--color-primary); margin-top: var(--space-1);">
        ${metrics.productsCount}
      </div>
      <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;">
        ${metrics.productsCount === 0 ? 'এখনো কোনো পণ্য যোগ করা হয়নি' : 'সক্রিয় পণ্যসমূহ'}
      </div>
    </div>

    <!-- Metric 2: Total Orders -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #10B981;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="seller.dashboard_orders">মোট অর্ডার</span>
        <span style="font-size: 1.5rem;">🛒</span>
      </div>
      <div style="font-size: var(--font-size-2xl); font-weight: 700; color: #10B981; margin-top: var(--space-1);">
        ${metrics.ordersCount}
      </div>
      <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;">
        ${metrics.ordersCount === 0 ? 'এখনো কোনো অর্ডার পাওয়া যায়নি' : 'প্রসেসকৃত অর্ডারসমূহ'}
      </div>
    </div>

    <!-- Metric 3: Gross Sales -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #F59E0B;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="earnings.gross_sales">মোট বিক্রি</span>
        <span style="font-size: 1.5rem;">💳</span>
      </div>
      <div style="font-size: var(--font-size-2xl); font-weight: 700; color: #F59E0B; margin-top: var(--space-1);">
        ৳ ${metrics.grossSales.toLocaleString('en-US')}
      </div>
      <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;">
        ডেলিভারিকৃত অর্ডারের মোট বিক্রি
      </div>
    </div>

    <!-- Metric 4: Available Balance -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #8B5CF6;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="seller.dashboard_wallet">উত্তোলনযোগ্য ব্যালেন্স</span>
        <span style="font-size: 1.5rem;">🏦</span>
      </div>
      <div style="font-size: var(--font-size-2xl); font-weight: 700; color: #8B5CF6; margin-top: var(--space-1);">
        ৳ ${metrics.availableBalance.toLocaleString('en-US')}
      </div>
      <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;">
        উত্তোলনের জন্য প্রস্তুত
      </div>
    </div>
  `;

  container.appendChild(cardGrid);

  // Overview Information Card
  const infoCard = document.createElement('div');
  infoCard.className = 'card';
  infoCard.style.padding = 'var(--space-6)';

  infoCard.innerHTML = `
    <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-3); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2);">
      🏪 স্টোর বিবরণ ও স্ট্যাটাস (Store Details)
    </h3>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4);">
      <div>
        <p style="margin-bottom: var(--space-2);"><strong>স্টোরের নাম:</strong> ${application.storeName || '-'}</p>
        <p style="margin-bottom: var(--space-2);"><strong>স্টোর ইউআরএল:</strong> seller.${application.storeSlug || 'store'}.marketkoro.com</p>
        <p style="margin-bottom: var(--space-2);"><strong>ব্যবসায়িক ঠিকানা:</strong> ${application.businessAddress || '-'}</p>
      </div>

      <div>
        <p style="margin-bottom: var(--space-2);"><strong>সেলার নাম:</strong> ${application.fullName || '-'}</p>
        <p style="margin-bottom: var(--space-2);"><strong>যোগাযোগ ফোন:</strong> ${application.contactPhone || application.phone || '-'}</p>
        <p style="margin-bottom: var(--space-2);"><strong>ইমেইল:</strong> ${application.email || '-'}</p>
      </div>
    </div>

    ${application.storeDescription ? `
      <div style="margin-top: var(--space-4); padding: var(--space-3); background-color: var(--color-bg); border-radius: var(--radius-md);">
        <strong style="font-size: var(--font-size-xs); color: var(--color-text-muted);">স্টোরের বিবরণ:</strong>
        <p style="margin-top: 4px; font-size: var(--font-size-sm);">${application.storeDescription}</p>
      </div>
    ` : ''}
  `;

  container.appendChild(infoCard);
}

/**
 * Store Profile & Management Tab
 */
function renderStoreTabStructure(container, application) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card';
  wrapper.style.padding = 'var(--space-6)';

  const currentLogo = application.storeLogo || 'assets/images/placeholder-store.svg';
  const currentBanner = application.storeBanner || '';
  const currentSlug = application.storeSlug || '';

  wrapper.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-4); margin-bottom: var(--space-5);">
      <div>
        <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin: 0;" data-i18n="seller.nav_store">
          স্টোর পরিচিতি ও সেটিংস (Store Profile & Branding)
        </h3>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;">
          আপনার স্টোরের লোগো, ব্যানার, ঠিকানা ও ব্র্যান্ডিং সম্পর্কিত তথ্য পরিবর্তন করুন।
        </p>
      </div>

      <div style="display: flex; gap: var(--space-2);">
        <a href="store.html?slug=${encodeURIComponent(currentSlug)}" target="_blank" class="btn btn-outline btn-sm">
          👁️ <span data-i18n="seller.view_public_store">পাবলিক স্টোর দেখুন</span>
        </a>
      </div>
    </div>

    <form id="seller-profile-form" style="display: flex; flex-direction: column; gap: var(--space-5);">

      <div style="display: flex; align-items: center; justify-content: space-between; background-color: var(--color-bg); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); border-left: 4px solid var(--color-success);">
        <div>
          <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;">স্টোর স্ট্যাটাস (Store Status)</span>
          <div style="font-weight: 700; color: var(--color-success); font-size: var(--font-size-md);">
            ✔ ${getTranslation('seller.status_approved') || 'অনুমোদিত সেলার (Approved)'}
          </div>
        </div>
        <span class="badge" style="background-color: var(--color-success-bg); color: var(--color-success);">Active</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-5);">

        <div class="card" style="padding: var(--space-4); border: 1px dashed var(--color-border); text-align: center;">
          <label style="font-weight: 600; display: block; margin-bottom: var(--space-2);" data-i18n="seller.store_logo">
            স্টোর লোগো (Square ~500x500)
          </label>
          <div style="position: relative; width: 100px; height: 100px; margin: 0 auto var(--space-3);">
            <img id="seller-logo-preview" src="${currentLogo}" alt="Logo Preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; border: 2px solid var(--color-border); background-color: var(--color-surface);">
          </div>

          <input type="file" id="seller-logo-input" accept="image/jpeg,image/png,image/webp" style="display: none;">
          <button type="button" id="seller-logo-btn" class="btn btn-outline btn-sm" style="width: 100%;">
            🖼️ লোগো আপলোড করুন
          </button>
          <div id="seller-logo-progress" style="display: none; margin-top: var(--space-2); font-size: var(--font-size-xs); color: var(--color-primary);">
            আপলোড হচ্ছে... <span id="seller-logo-percent">0%</span>
          </div>
          <p style="font-size: 11px; color: var(--color-text-muted); margin-top: 6px;">সর্বোচ্চ আকার: ২ মেগাবাইট (JPEG, PNG, WebP)</p>
        </div>

        <div class="card" style="padding: var(--space-4); border: 1px dashed var(--color-border); text-align: center;">
          <label style="font-weight: 600; display: block; margin-bottom: var(--space-2);" data-i18n="seller.store_banner">
            স্টোর ব্যানার (Aspect ratio 3:1)
          </label>
          <div style="height: 100px; width: 100%; margin-bottom: var(--space-3); border-radius: var(--radius-md); overflow: hidden; background-color: var(--color-bg); border: 1px solid var(--color-border);">
            <img id="seller-banner-preview" src="${currentBanner || 'assets/images/placeholder-banner.png'}" alt="Banner Preview" style="width: 100%; height: 100%; object-fit: cover;">
          </div>

          <input type="file" id="seller-banner-input" accept="image/jpeg,image/png,image/webp" style="display: none;">
          <button type="button" id="seller-banner-btn" class="btn btn-outline btn-sm" style="width: 100%;">
            🖼️ ব্যানার আপলোড করুন
          </button>
          <div id="seller-banner-progress" style="display: none; margin-top: var(--space-2); font-size: var(--font-size-xs); color: var(--color-primary);">
            আপলোড হচ্ছে... <span id="seller-banner-percent">0%</span>
          </div>
          <p style="font-size: 11px; color: var(--color-text-muted); margin-top: 6px;">সর্বোচ্চ আকার: ২ মেগাবাইট (JPEG, PNG, WebP)</p>
        </div>

      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4);">

        <div class="form-group">
          <label for="prof-store-name" class="form-label">
            ${getTranslation('seller.store_name') || 'ব্যবসা / স্টোরের নাম'} <span style="color: var(--color-error);">*</span>
          </label>
          <input type="text" id="prof-store-name" class="form-control" value="${application.storeName || ''}" required>
        </div>

        <div class="form-group">
          <label for="prof-store-slug" class="form-label">
            ${getTranslation('seller.store_slug') || 'স্টোর ইউআরএল (Slug)'} <span style="color: var(--color-error);">*</span>
          </label>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">seller.</span>
            <input type="text" id="prof-store-slug" class="form-control" value="${currentSlug}" required>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">.marketkoro.com</span>
          </div>
        </div>

      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4);">

        <div class="form-group">
          <label for="prof-full-name" class="form-label">
            ${getTranslation('auth.full_name') || 'সেলার নাম'} <span style="color: var(--color-error);">*</span>
          </label>
          <input type="text" id="prof-full-name" class="form-control" value="${application.fullName || ''}" required>
        </div>

        <div class="form-group">
          <label for="prof-phone" class="form-label">
            ${getTranslation('auth.phone') || 'যোগাযোগ ফোন নম্বর'} <span style="color: var(--color-error);">*</span>
          </label>
          <input type="tel" id="prof-phone" class="form-control" value="${application.contactPhone || application.phone || ''}" required>
        </div>

      </div>

      <div class="form-group">
        <label for="prof-store-desc" class="form-label">
          ${getTranslation('seller.store_desc') || 'স্টোরের বিবরণ'}
        </label>
        <textarea id="prof-store-desc" class="form-control" rows="3">${application.storeDescription || ''}</textarea>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4);">

        <div class="form-group" style="grid-column: 1 / -1;">
          <label for="prof-business-addr" class="form-label">
            ${getTranslation('seller.business_address') || 'ব্যবসার পূর্ণাঙ্গ ঠিকানা'}
          </label>
          <input type="text" id="prof-business-addr" class="form-control" value="${application.businessAddress || ''}">
        </div>

        <div class="form-group">
          <label for="prof-division" class="form-label">${getTranslation('seller.division') || 'বিভাগ'}</label>
          <input type="text" id="prof-division" class="form-control" value="${application.division || ''}">
        </div>

        <div class="form-group">
          <label for="prof-district" class="form-label">${getTranslation('seller.district') || 'জেলা'}</label>
          <input type="text" id="prof-district" class="form-control" value="${application.district || ''}">
        </div>

        <div class="form-group">
          <label for="prof-upazila" class="form-label">${getTranslation('seller.upazila') || 'উপজেলা / এলাকা'}</label>
          <input type="text" id="prof-upazila" class="form-control" value="${application.upazila || ''}">
        </div>

      </div>

      <div style="border-top: 1px solid var(--color-border); padding-top: var(--space-4);">
        <h4 style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-3);">
          🌐 সোশ্যাল মিডিয়া ও ওয়েবসাইট লিংক (Social Links)
        </h4>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4);">
          <div class="form-group">
            <label for="prof-social-fb" class="form-label">Facebook Page URL</label>
            <input type="url" id="prof-social-fb" class="form-control" placeholder="https://facebook.com/yourstore" value="${application.socialLinks?.facebook || ''}">
          </div>

          <div class="form-group">
            <label for="prof-social-insta" class="form-label">Instagram Profile URL</label>
            <input type="url" id="prof-social-insta" class="form-control" placeholder="https://instagram.com/yourstore" value="${application.socialLinks?.instagram || ''}">
          </div>

          <div class="form-group">
            <label for="prof-social-web" class="form-label">Website URL</label>
            <input type="url" id="prof-social-web" class="form-control" placeholder="https://yourstore.com" value="${application.socialLinks?.website || ''}">
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: var(--space-3); border-top: 1px solid var(--color-border); padding-top: var(--space-4);">
        <button type="submit" id="prof-save-btn" class="btn btn-primary" style="min-width: 180px;">
          💾 <span data-i18n="account.save_changes">পরিবর্তন সংরক্ষণ করুন</span>
        </button>
      </div>

    </form>
  `;

  // Attach Image Upload Triggers
  let updatedLogoUrl = currentLogo;
  let updatedBannerUrl = currentBanner;

  const logoInput = wrapper.querySelector('#seller-logo-input');
  const logoBtn = wrapper.querySelector('#seller-logo-btn');
  const logoPreview = wrapper.querySelector('#seller-logo-preview');
  const logoProgress = wrapper.querySelector('#seller-logo-progress');
  const logoPercent = wrapper.querySelector('#seller-logo-percent');

  logoBtn?.addEventListener('click', () => logoInput.click());
  logoInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      logoProgress.style.display = 'block';
      logoBtn.disabled = true;

      const url = await uploadImage(file, { folder: 'seller_logos' }, (pct) => {
        if (logoPercent) logoPercent.textContent = `${pct}%`;
      });

      updatedLogoUrl = url;
      logoPreview.src = url;
      showToast("লোগো সফলভাবে আপলোড করা হয়েছে।", "success");
    } catch (err) {
      showToast(err.message || "লোগো আপলোড ব্যর্থ হয়েছে।", "error");
    } finally {
      logoProgress.style.display = 'none';
      logoBtn.disabled = false;
    }
  });

  const bannerInput = wrapper.querySelector('#seller-banner-input');
  const bannerBtn = wrapper.querySelector('#seller-banner-btn');
  const bannerPreview = wrapper.querySelector('#seller-banner-preview');
  const bannerProgress = wrapper.querySelector('#seller-banner-progress');
  const bannerPercent = wrapper.querySelector('#seller-banner-percent');

  bannerBtn?.addEventListener('click', () => bannerInput.click());
  bannerInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      bannerProgress.style.display = 'block';
      bannerBtn.disabled = true;

      const url = await uploadImage(file, { folder: 'seller_banners' }, (pct) => {
        if (bannerPercent) bannerPercent.textContent = `${pct}%`;
      });

      updatedBannerUrl = url;
      bannerPreview.src = url;
      showToast("ব্যানার সফলভাবে আপলোড করা হয়েছে।", "success");
    } catch (err) {
      showToast(err.message || "ব্যানার আপলোড ব্যর্থ হয়েছে।", "error");
    } finally {
      bannerProgress.style.display = 'none';
      bannerBtn.disabled = false;
    }
  });

  // Slug Auto-formatting on change
  const slugInput = wrapper.querySelector('#prof-store-slug');
  const storeNameInput = wrapper.querySelector('#prof-store-name');

  storeNameInput?.addEventListener('blur', () => {
    if (slugInput && !slugInput.value.trim()) {
      slugInput.value = generateStoreSlug(storeNameInput.value);
    }
  });

  // Handle Form Submission
  const form = wrapper.querySelector('#seller-profile-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn = wrapper.querySelector('#prof-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="loading-spinner"></span> সংরক্ষন হচ্ছে...`;

    try {
      const storeName = storeNameInput.value.trim();
      const rawSlug = slugInput.value.trim();
      const formattedSlug = generateStoreSlug(rawSlug || storeName);

      const payload = {
        fullName: wrapper.querySelector('#prof-full-name').value.trim(),
        phone: wrapper.querySelector('#prof-phone').value.trim(),
        contactPhone: wrapper.querySelector('#prof-phone').value.trim(),
        storeName: storeName,
        storeSlug: formattedSlug,
        storeDescription: wrapper.querySelector('#prof-store-desc').value.trim(),
        businessAddress: wrapper.querySelector('#prof-business-addr').value.trim(),
        division: wrapper.querySelector('#prof-division').value.trim(),
        district: wrapper.querySelector('#prof-district').value.trim(),
        upazila: wrapper.querySelector('#prof-upazila').value.trim(),
        storeLogo: updatedLogoUrl,
        storeBanner: updatedBannerUrl,
        socialLinks: {
          facebook: wrapper.querySelector('#prof-social-fb').value.trim(),
          instagram: wrapper.querySelector('#prof-social-insta').value.trim(),
          website: wrapper.querySelector('#prof-social-web').value.trim()
        }
      };

      await updateSellerProfile(application.uid, payload);
      showToast(getTranslation('account.profile_updated') || "স্টোর প্রোফাইল তথ্য সফলভাবে সংরক্ষণ করা হয়েছে।", "success");

      // Refresh page view
      const updatedApp = await getSellerApplication(application.uid);
      const root = document.getElementById('seller-dashboard-root');
      if (root && updatedApp) {
        await renderApprovedSellerDashboard(root, updatedApp, { uid: application.uid }, null);
      }
    } catch (err) {
      console.error("Error updating seller profile:", err);
      showToast(err.message || "প্রোফাইল সংরক্ষণ ব্যর্থ হয়েছে।", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `💾 <span data-i18n="account.save_changes">পরিবর্তন সংরক্ষণ করুন</span>`;
    }
  });

  container.appendChild(wrapper);
}

function renderProductsTabStructure(container, application) {
  renderProductsTab(container, application, (newCount) => {
    const prodMetricEl = document.querySelector('[data-i18n="seller.dashboard_products"]')?.closest('.card')?.querySelector('div[style*="font-size: var(--font-size-2xl)"]');
    if (prodMetricEl) {
      prodMetricEl.textContent = newCount;
    }
  });
}

function renderOrdersTabStructure(container, application) {
  renderOrdersTab(container, application);
}

/* ==========================================================================
   STEP 5 METRICS & EARNINGS TAB (Real Data Calculated)
   ========================================================================== */

async function renderEarningsTab(container, application, user) {
  container.innerHTML = `
    <div style="text-align: center; padding: var(--space-8);">
      <span class="loading-spinner" style="width: 2rem; height: 2rem;"></span>
      <p style="margin-top: var(--space-2); color: var(--color-text-muted);">${getTranslation('common.loading')}</p>
    </div>
  `;

  const [summary, ledger] = await Promise.all([
    getSellerFinancialSummary(user.uid, application.commissionRate),
    getSellerFinancialLedger(user.uid)
  ]);

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-5);';

  // 1. Financial Metric Grid Cards
  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4);';

  grid.innerHTML = `
    <!-- Gross Sales -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #3B82F6;">
      <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="earnings.gross_sales">মোট বিক্রি (Gross Sales)</span>
      <div style="font-size: var(--font-size-xl); font-weight: 700; color: #3B82F6; margin-top: 4px;">
        ৳ ${summary.grossSales.toLocaleString('en-US')}
      </div>
      <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
        ${summary.deliveredOrderCount}টি সম্পন্ন অর্ডারের বিক্রি
      </div>
    </div>

    <!-- Platform Commission -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #EF4444;">
      <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="earnings.platform_commission">প্ল্যাটফর্ম কমিশন (৫%)</span>
      <div style="font-size: var(--font-size-xl); font-weight: 700; color: #EF4444; margin-top: 4px;">
        ৳ ${summary.platformCommission.toLocaleString('en-US')}
      </div>
      <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
        কমিশন হার: ${(summary.commissionRateSnapshot * 100).toFixed(1)}% Snapshot
      </div>
    </div>

    <!-- Refunds & Adjustments -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #F59E0B;">
      <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="earnings.refunds_adjustments">ফেরত ও অ্যাডজাস্টমেন্ট</span>
      <div style="font-size: var(--font-size-xl); font-weight: 700; color: #F59E0B; margin-top: 4px;">
        ৳ ${summary.refundsAndAdjustments.toLocaleString('en-US')}
      </div>
      <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
        ক্যানসেল বা রিটার্ন অ্যাডজাস্টমেন্ট
      </div>
    </div>

    <!-- Net Seller Earnings -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #10B981;">
      <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="earnings.net_earnings">সেলার নীট আয় (Net Earnings)</span>
      <div style="font-size: var(--font-size-xl); font-weight: 700; color: #10B981; margin-top: 4px;">
        ৳ ${summary.netEarnings.toLocaleString('en-US')}
      </div>
      <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
        কমিশন ও এডজাস্টমেন্ট পরবর্তী আয়
      </div>
    </div>

    <!-- Pending Unsettled Earnings -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #8B5CF6;">
      <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="earnings.pending_earnings">অপেক্ষমাণ আয় (Pending Earnings)</span>
      <div style="font-size: var(--font-size-xl); font-weight: 700; color: #8B5CF6; margin-top: 4px;">
        ৳ ${summary.pendingEarnings.toLocaleString('en-US')}
      </div>
      <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
        চলমান অর্ডারের আনুমানিক নীট আয়
      </div>
    </div>

    <!-- Available Balance -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid var(--color-primary);">
      <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="earnings.available_balance">উত্তোলনযোগ্য ব্যালেন্স</span>
      <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); margin-top: 4px;">
        ৳ ${summary.availableBalance.toLocaleString('en-US')}
      </div>
      <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
        উত্তোলনের জন্য প্রস্তুত অর্থ
      </div>
    </div>

    <!-- Total Withdrawn -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #6B7280;">
      <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="earnings.total_withdrawn">মোট উত্তোলিত অর্থ</span>
      <div style="font-size: var(--font-size-xl); font-weight: 700; color: #6B7280; margin-top: 4px;">
        ৳ ${summary.totalWithdrawn.toLocaleString('en-US')}
      </div>
      <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
        সফলভাবে পেআউটকৃত মোট অর্থ
      </div>
    </div>
  `;

  wrapper.appendChild(grid);

  // 2. Financial History Ledger Table Card
  const ledgerCard = document.createElement('div');
  ledgerCard.className = 'card';
  ledgerCard.style.padding = 'var(--space-6)';

  ledgerCard.innerHTML = `
    <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2);" data-i18n="earnings.ledger_title">
      আর্থিক লেনদেন ইতিহাস ও স্টেটমেন্ট (Financial Ledger)
    </h3>
  `;

  if (ledger.length === 0) {
    const emptyState = createEmptyState({
      icon: '📊',
      titleBn: getTranslation('earnings.no_transactions_title') || 'কোন আর্থিক তথ্য পাওয়া যায়নি',
      titleEn: getTranslation('earnings.no_transactions_title') || 'No financial records found',
      subBn: getTranslation('earnings.no_transactions_desc') || 'অর্ডার সম্পন্ন হওয়া ও ব্যালেন্স উত্তোলনের ইতিহাস এখানে দেখা যাবে।',
      subEn: getTranslation('earnings.no_transactions_desc') || 'Completed order sales and withdrawal statements will appear here automatically.'
    });
    ledgerCard.appendChild(emptyState);
  } else {
    const tableResp = document.createElement('div');
    tableResp.style.overflowX = 'auto';

    tableResp.innerHTML = `
      <table class="table" style="width: 100%; border-collapse: collapse; font-size: var(--font-size-sm);">
        <thead>
          <tr style="border-bottom: 2px solid var(--color-border); text-align: left; color: var(--color-text-muted);">
            <th style="padding: 10px;">তারিখ</th>
            <th style="padding: 10px;">রেফারেন্স ID</th>
            <th style="padding: 10px;">প্রকার</th>
            <th style="padding: 10px;">বিবরণ</th>
            <th style="padding: 10px; text-align: right;">মোট পরিমাণ</th>
            <th style="padding: 10px; text-align: right;">কমিশন</th>
            <th style="padding: 10px; text-align: right;">নীট পরিমাণ</th>
            <th style="padding: 10px; text-align: center;">স্ট্যাটাস</th>
          </tr>
        </thead>
        <tbody>
          ${ledger.map((item) => `
            <tr style="border-bottom: 1px solid var(--color-border);">
              <td style="padding: 10px; white-space: nowrap;">${item.date.toLocaleDateString('bn-BD')}</td>
              <td style="padding: 10px; font-family: monospace; font-weight: 600;">${item.reference}</td>
              <td style="padding: 10px;">
                <span class="badge ${item.type === 'sale' ? 'badge-primary' : (item.type === 'withdrawal' ? 'badge-secondary' : 'badge-danger')}">
                  ${item.typeLabelBn}
                </span>
              </td>
              <td style="padding: 10px;">${item.description}</td>
              <td style="padding: 10px; text-align: right; font-weight: 600;">৳ ${item.grossAmount.toLocaleString('en-US')}</td>
              <td style="padding: 10px; text-align: right; color: var(--color-error);">৳ ${item.commission.toLocaleString('en-US')}</td>
              <td style="padding: 10px; text-align: right; font-weight: 700; color: ${item.netAmount >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                ৳ ${item.netAmount.toLocaleString('en-US')}
              </td>
              <td style="padding: 10px; text-align: center;">
                <span class="badge badge-outline">${item.statusLabelBn}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    ledgerCard.appendChild(tableResp);
  }

  wrapper.appendChild(ledgerCard);
  container.appendChild(wrapper);
}

/* ==========================================================================
   STEP 6 WITHDRAWAL REQUEST PAGE & FORM
   ========================================================================== */

async function renderWithdrawalsTab(container, application, user) {
  container.innerHTML = `
    <div style="text-align: center; padding: var(--space-8);">
      <span class="loading-spinner" style="width: 2rem; height: 2rem;"></span>
      <p style="margin-top: var(--space-2); color: var(--color-text-muted);">${getTranslation('common.loading')}</p>
    </div>
  `;

  const [summary, requests] = await Promise.all([
    getSellerFinancialSummary(user.uid, application.commissionRate),
    getSellerWithdrawalRequests(user.uid)
  ]);

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-5);';

  // 1. Balance Summary Banner
  const balanceBanner = document.createElement('div');
  balanceBanner.className = 'card';
  balanceBanner.style.cssText = 'padding: var(--space-5); background: linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-surface) 100%); border: 1px solid var(--color-primary-light);';

  balanceBanner.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4);">
      <div>
        <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="earnings.available_balance">
          প্রকৃত উত্তোলনযোগ্য ব্যালেন্স (Available Balance)
        </span>
        <div style="font-size: var(--font-size-2xl); font-weight: 800; color: var(--color-primary); margin-top: 4px;">
          ৳ ${summary.availableBalance.toLocaleString('en-US')}
        </div>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;" data-i18n="withdrawal.min_notice">
          ${getTranslation('withdrawal.min_notice') || 'সর্বনিম্ন উত্তোলন সীমা ৳৫০০। প্রসেসিং সময় ১-৩ কার্যদিবস।'}
        </p>
      </div>

      <div style="display: flex; gap: var(--space-3); flex-wrap: wrap; font-size: var(--font-size-xs);">
        <div style="background-color: var(--color-surface); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <span style="color: var(--color-text-muted);">রিজার্ভকৃত অনুরোধ:</span>
          <strong style="display: block; color: var(--color-warning);">৳ ${summary.pendingWithdrawals.toLocaleString('en-US')}</strong>
        </div>
        <div style="background-color: var(--color-surface); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <span style="color: var(--color-text-muted);">সর্বমোট উত্তোলিত:</span>
          <strong style="display: block; color: var(--color-success);">৳ ${summary.totalWithdrawn.toLocaleString('en-US')}</strong>
        </div>
      </div>
    </div>
  `;

  wrapper.appendChild(balanceBanner);

  // 2. Interactive Withdrawal Form Section
  const formCard = document.createElement('div');
  formCard.className = 'card';
  formCard.style.padding = 'var(--space-6)';

  formCard.innerHTML = `
    <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2);" data-i18n="withdrawal.title">
      ব্যালেন্স উত্তোলন আবেদন (Withdrawal Request)
    </h3>

    <form id="seller-withdrawal-form" style="display: flex; flex-direction: column; gap: var(--space-4);">

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4);">

        <!-- Requested Amount -->
        <div class="form-group">
          <label for="with-amount" class="form-label" data-i18n="withdrawal.requested_amount">
            উত্তোলনের পরিমাণ (৳ BDT) <span style="color: var(--color-error);">*</span>
          </label>
          <input type="number" id="with-amount" class="form-control" min="${MINIMUM_WITHDRAWAL_AMOUNT}" max="${summary.availableBalance}" placeholder="যেমন: ১০০০" required ${summary.availableBalance < MINIMUM_WITHDRAWAL_AMOUNT ? 'disabled' : ''}>
          <small style="font-size: 11px; color: var(--color-text-muted);">সর্বনিম্ন ৳${MINIMUM_WITHDRAWAL_AMOUNT} | সর্বোচ্চ ৳${summary.availableBalance}</small>
        </div>

        <!-- Payout Method -->
        <div class="form-group">
          <label for="with-method" class="form-label" data-i18n="withdrawal.payout_method">
            উত্তোলন মাধ্যম (Payout Method) <span style="color: var(--color-error);">*</span>
          </label>
          <select id="with-method" class="form-control" required ${summary.availableBalance < MINIMUM_WITHDRAWAL_AMOUNT ? 'disabled' : ''}>
            <option value="bkash">বিকাশ (bKash Personal / Merchant)</option>
            <option value="nagad">নগদ (Nagad Personal / Merchant)</option>
            <option value="bank_transfer">ব্যাংক ট্রান্সফার (Bank Transfer)</option>
          </select>
        </div>

      </div>

      <!-- Dynamic Payout Fields Container -->
      <div id="with-dynamic-fields" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4); background-color: var(--color-bg); padding: var(--space-4); border-radius: var(--radius-md);">
        <!-- Injected via JavaScript -->
      </div>

      <!-- Account Holder Name -->
      <div class="form-group">
        <label for="with-holder-name" class="form-label" data-i18n="withdrawal.account_holder">
          একাউন্ট হোল্ডারের নাম <span style="color: var(--color-error);">*</span>
        </label>
        <input type="text" id="with-holder-name" class="form-control" value="${application.fullName || ''}" required ${summary.availableBalance < MINIMUM_WITHDRAWAL_AMOUNT ? 'disabled' : ''}>
      </div>

      <!-- Optional Seller Note -->
      <div class="form-group">
        <label for="with-note" class="form-label" data-i18n="withdrawal.seller_note">
          বিশেষ নোট (ঐচ্ছিক)
        </label>
        <textarea id="with-note" class="form-control" rows="2" placeholder="পেআউট সংক্রান্ত অতিরিক্ত কোনো নির্দেশ থাকলে লিখুন..." ${summary.availableBalance < MINIMUM_WITHDRAWAL_AMOUNT ? 'disabled' : ''}></textarea>
      </div>

      <!-- Submit Button -->
      <div style="display: flex; justify-content: flex-end; margin-top: var(--space-2);">
        <button type="submit" id="with-submit-btn" class="btn btn-primary" style="min-width: 200px;" ${summary.availableBalance < MINIMUM_WITHDRAWAL_AMOUNT ? 'disabled' : ''}>
          💸 <span data-i18n="withdrawal.submit_btn">উত্তোলন আবেদন জমা দিন</span>
        </button>
      </div>

      ${summary.availableBalance < MINIMUM_WITHDRAWAL_AMOUNT ? `
        <div style="background-color: var(--color-warning-bg, #FEF3C7); color: #92400E; padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); text-align: center;">
          ⚠️ আপনার বর্তমান উত্তোলনযোগ্য ব্যালেন্স (৳${summary.availableBalance}) সর্বনিম্ন উত্তোলন সীমার (৳${MINIMUM_WITHDRAWAL_AMOUNT}) নিচে থাকায় নতুন আবেদন গ্রহণযোগ্য নয়।
        </div>
      ` : ''}

    </form>
  `;

  wrapper.appendChild(formCard);

  // Function to render dynamic payment fields based on method selection
  const renderDynamicFields = (method) => {
    const fieldsContainer = formCard.querySelector('#with-dynamic-fields');
    if (!fieldsContainer) return;

    if (method === 'bkash' || method === 'nagad') {
      fieldsContainer.innerHTML = `
        <div class="form-group" style="grid-column: 1 / -1;">
          <label for="with-mobile-num" class="form-label" data-i18n="withdrawal.mobile_number">
            ${method === 'bkash' ? 'বিকাশ (bKash)' : 'নগদ (Nagad)'} একাউন্ট মোবাইল নম্বর <span style="color: var(--color-error);">*</span>
          </label>
          <input type="tel" id="with-mobile-num" class="form-control" value="${application.contactPhone || application.phone || ''}" placeholder="+8801700000000" required ${summary.availableBalance < MINIMUM_WITHDRAWAL_AMOUNT ? 'disabled' : ''}>
        </div>
      `;
    } else if (method === 'bank_transfer') {
      fieldsContainer.innerHTML = `
        <div class="form-group">
          <label for="with-bank-name" class="form-label" data-i18n="withdrawal.bank_name">
            ব্যাংকের নাম <span style="color: var(--color-error);">*</span>
          </label>
          <input type="text" id="with-bank-name" class="form-control" placeholder="যেমন: Dutch-Bangla Bank / BRAC Bank" required ${summary.availableBalance < MINIMUM_WITHDRAWAL_AMOUNT ? 'disabled' : ''}>
        </div>

        <div class="form-group">
          <label for="with-branch-name" class="form-label" data-i18n="withdrawal.branch_name">
            শাখার নাম (Branch)
          </label>
          <input type="text" id="with-branch-name" class="form-control" placeholder="যেমন: Gulshan Branch" ${summary.availableBalance < MINIMUM_WITHDRAWAL_AMOUNT ? 'disabled' : ''}>
        </div>

        <div class="form-group" style="grid-column: 1 / -1;">
          <label for="with-account-num" class="form-label" data-i18n="withdrawal.account_number">
            ব্যাংক একাউন্ট নম্বর <span style="color: var(--color-error);">*</span>
          </label>
          <input type="text" id="with-account-num" class="form-control" placeholder="যেমন: 101151000..." required ${summary.availableBalance < MINIMUM_WITHDRAWAL_AMOUNT ? 'disabled' : ''}>
        </div>
      `;
    }
  };

  const methodSelect = formCard.querySelector('#with-method');
  renderDynamicFields(methodSelect.value);

  methodSelect?.addEventListener('change', (e) => {
    renderDynamicFields(e.target.value);
  });

  // Handle Withdrawal Form Submit
  const form = formCard.querySelector('#seller-withdrawal-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = formCard.querySelector('#with-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="loading-spinner"></span> প্রসেসিং হচ্ছে...`;

    try {
      const amount = Number(formCard.querySelector('#with-amount').value);
      const method = methodSelect.value;
      const accountHolderName = formCard.querySelector('#with-holder-name').value.trim();
      const note = formCard.querySelector('#with-note').value.trim();

      const accountDetails = {};
      if (method === 'bkash' || method === 'nagad') {
        accountDetails.mobileNumber = formCard.querySelector('#with-mobile-num').value.trim();
      } else if (method === 'bank_transfer') {
        accountDetails.bankName = formCard.querySelector('#with-bank-name').value.trim();
        accountDetails.branchName = formCard.querySelector('#with-branch-name').value.trim();
        accountDetails.accountNumber = formCard.querySelector('#with-account-num').value.trim();
      }

      await submitWithdrawalRequest(user.uid, {
        amount,
        payoutMethod: method,
        accountHolderName,
        accountDetails,
        note,
        storeName: application.storeName,
        sellerName: application.fullName
      });

      showToast(getTranslation('withdrawal.success_msg') || "উত্তোলন আবেদন সফলভাবে জমা দেয়া হয়েছে! অনুরোধকৃত অর্থ রিজার্ভ করা হয়েছে।", "success");

      // Re-render Withdrawal Tab Content freshly
      await renderWithdrawalsTab(container, application, user);
    } catch (err) {
      console.error("Error submitting withdrawal request:", err);
      showToast(err.message || "উত্তোলন আবেদন জমা দেওয়া ব্যর্থ হয়েছে।", "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `💸 <span data-i18n="withdrawal.submit_btn">উত্তোলন আবেদন জমা দিন</span>`;
    }
  });

  // 3. Previous Withdrawal Requests Table
  const historyCard = document.createElement('div');
  historyCard.className = 'card';
  historyCard.style.padding = 'var(--space-6)';

  historyCard.innerHTML = `
    <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2);" data-i18n="withdrawal.history_title">
      পূর্ববর্তী উত্তোলন আবেদনসমূহ (Withdrawal History)
    </h3>
  `;

  if (requests.length === 0) {
    const emptyState = createEmptyState({
      icon: '🏦',
      titleBn: getTranslation('withdrawal.no_requests_title') || 'কোন উত্তোলন আবেদন করা হয়নি',
      titleEn: getTranslation('withdrawal.no_requests_title') || 'No withdrawal requests yet',
      subBn: getTranslation('withdrawal.no_requests_desc') || 'উত্তোলনযোগ্য ব্যালেন্স থেকে আবেদন করলে তার স্ট্যাটাস এখানে দেখা যাবে।',
      subEn: getTranslation('withdrawal.no_requests_desc') || 'When you request payout from available balance, history will appear here.'
    });
    historyCard.appendChild(emptyState);
  } else {
    const tableResp = document.createElement('div');
    tableResp.style.overflowX = 'auto';

    tableResp.innerHTML = `
      <table class="table" style="width: 100%; border-collapse: collapse; font-size: var(--font-size-sm);">
        <thead>
          <tr style="border-bottom: 2px solid var(--color-border); text-align: left; color: var(--color-text-muted);">
            <th style="padding: 10px;">আবেদনের তারিখ</th>
            <th style="padding: 10px;">রিকোয়েস্ট ID</th>
            <th style="padding: 10px;">পরিমাণ</th>
            <th style="padding: 10px;">মাধ্যম</th>
            <th style="padding: 10px;">একাউন্ট তথ্য</th>
            <th style="padding: 10px; text-align: center;">স্ট্যাটাস</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map((req) => `
            <tr style="border-bottom: 1px solid var(--color-border);">
              <td style="padding: 10px; white-space: nowrap;">${req.createdAtDate ? req.createdAtDate.toLocaleDateString('bn-BD') : '-'}</td>
              <td style="padding: 10px; font-family: monospace; font-weight: 600;">${req.id.slice(0, 8).toUpperCase()}</td>
              <td style="padding: 10px; font-weight: 700; color: var(--color-primary);">৳ ${Number(req.amount).toLocaleString('en-US')}</td>
              <td style="padding: 10px;">${ALLOWED_PAYOUT_METHODS[req.payoutMethod]?.nameBn || req.payoutMethod}</td>
              <td style="padding: 10px;">
                <div style="font-weight: 600;">${req.accountHolderName}</div>
                <div style="font-size: 11px; color: var(--color-text-muted);">
                  ${req.accountDetails?.accountNumberMasked || maskAccountDetails(req.accountDetails?.mobileNumber || req.accountDetails?.accountNumber)}
                </div>
              </td>
              <td style="padding: 10px; text-align: center;">
                <span class="badge ${req.status === 'paid' ? 'badge-primary' : (req.status === 'rejected' ? 'badge-danger' : 'badge-secondary')}">
                  ${getWithdrawalStatusLabel(req.status, 'bn')}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    historyCard.appendChild(tableResp);
  }

  wrapper.appendChild(historyCard);
  container.appendChild(wrapper);
}

function renderSettingsTabStructure(container, application) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-3);" data-i18n="seller.nav_settings">
      সেটিংস (Store & Account Settings)
    </h3>
  `;

  const emptyState = createEmptyState({
    icon: '⚙️',
    titleBn: 'স্টোর ও একাউন্ট সেটিংস',
    titleEn: 'Store & Account Settings',
    subBn: 'নোটিফিকেশন, ব্যবসায়িক তথ্য পরিবর্তন ও স্টোর প্রাইভেসি সংক্রান্ত সেটিংস মডিউল।',
    subEn: 'Store notifications, profile management, and account settings foundation.'
  });

  card.appendChild(emptyState);
  container.appendChild(card);
}

function upazilaLocation(district, division) {
  if (district && division) return `${district}, ${division}`;
  return division || 'Bangladesh';
}
