/**
 * Seller Dashboard Foundation & Access Control Module for MarketKoro
 * Handles secure seller-only dashboard access, seller identity, overview metrics, and navigation structure.
 */

import { getTranslation } from '../i18n/i18n.js';
import { createModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { openLoginModal } from '../auth/auth-ui.js';
import { getSellerApplication } from './seller-service.js';
import { openBecomeSellerModal } from './seller-ui.js';
import { createEmptyState } from '../components/empty-state.js';

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

    renderApprovedSellerDashboard(root, application, user, profile);
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

/**
 * State 1: Logged-out user
 */
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

/**
 * State 2: Normal Customer (No Seller Application)
 */
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

/**
 * State 3: Pending Applicant
 */
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

/**
 * State 4: Rejected Applicant
 */
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

/**
 * State 5: Suspended Seller
 */
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
   APPROVED SELLER DASHBOARD WORKSPACE (Header, Navigation & Overview)
   ========================================================================== */

function renderApprovedSellerDashboard(container, application, user, profile) {
  const storeLogo = application.storeLogo || 'assets/images/placeholder-store.svg';
  const storeBanner = application.storeBanner || '';
  const storeName = application.storeName || 'My Store';
  const sellerOwnerName = application.fullName || profile?.fullName || user.displayName || 'Seller';
  const storeSlug = application.storeSlug || 'store';
  const division = application.division || 'Bangladesh';
  const district = application.district || '';
  const contactPhone = application.contactPhone || application.phone || '';

  // Calculate real metric values (Defaulting strictly to 0 when empty)
  const productsCount = Number(application.productsCount) || 0;
  const ordersCount = Number(application.ordersCount) || 0;
  const totalSales = Number(application.wallet?.totalSales) || 0;
  const availableBalance = Number(application.wallet?.balance) || 0;

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
  const styleEl = document.createElement('style');
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

  // Tab Switch Event Listeners
  container.querySelectorAll('.seller-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSellerTab = btn.getAttribute('data-tab');
      container.querySelectorAll('.seller-nav-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderSellerTabContent(container.querySelector('#seller-tab-content-area'), activeSellerTab, application, {
        productsCount, ordersCount, totalSales, availableBalance
      });
    });
  });

  // Render initial tab content
  const tabContentArea = container.querySelector('#seller-tab-content-area');
  renderSellerTabContent(tabContentArea, activeSellerTab, application, {
    productsCount, ordersCount, totalSales, availableBalance
  });
}

/**
 * Render Active Tab Content
 */
function renderSellerTabContent(targetEl, tab, application, metrics) {
  targetEl.innerHTML = '';

  if (tab === 'overview') {
    renderOverviewTab(targetEl, application, metrics);
  } else if (tab === 'store') {
    renderStoreTabStructure(targetEl, application);
  } else if (tab === 'products') {
    renderProductsTabStructure(targetEl);
  } else if (tab === 'orders') {
    renderOrdersTabStructure(targetEl);
  } else if (tab === 'earnings') {
    renderEarningsTabStructure(targetEl, metrics);
  } else if (tab === 'withdrawals') {
    renderWithdrawalsTabStructure(targetEl, metrics);
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

    <!-- Metric 3: Total Sales -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #F59E0B;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="seller.dashboard_sales">মোট বিক্রি</span>
        <span style="font-size: 1.5rem;">💳</span>
      </div>
      <div style="font-size: var(--font-size-2xl); font-weight: 700; color: #F59E0B; margin-top: var(--space-1);">
        ৳ ${metrics.totalSales}
      </div>
      <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;">
        সর্বমোট অর্জিত রাজস্ব
      </div>
    </div>

    <!-- Metric 4: Available Balance -->
    <div class="card" style="padding: var(--space-4); border-left: 4px solid #8B5CF6;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: 600;" data-i18n="seller.dashboard_wallet">উত্তোলনযোগ্য ব্যালেন্স</span>
        <span style="font-size: 1.5rem;">🏦</span>
      </div>
      <div style="font-size: var(--font-size-2xl); font-weight: 700; color: #8B5CF6; margin-top: var(--space-1);">
        ৳ ${metrics.availableBalance}
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
 * Navigation Foundations (Structural empty states - Stop Condition #13)
 */
function renderStoreTabStructure(container, application) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-3);" data-i18n="seller.nav_store">
      স্টোর পরিচিতি ও ব্যানার
    </h3>
  `;

  const emptyState = createEmptyState({
    icon: '🏪',
    titleBn: 'স্টোর পরিচিতি ও লোগো ম্যানেজমেন্ট',
    titleEn: 'Store Identity & Branding Structure',
    subBn: 'স্টোরের ব্যানার, লোগো, ডেসক্রিপশন এবং সামাজিক যোগাযোগের লিংক সম্পর্কিত সেটিংস এখানে যুক্ত হবে।',
    subEn: 'Store profile settings, logo, banner, and business contact options foundation is active.'
  });

  card.appendChild(emptyState);
  container.appendChild(card);
}

function renderProductsTabStructure(container) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-3);" data-i18n="seller.nav_products">
      পণ্য ব্যবস্থাপনা (Product Management)
    </h3>
  `;

  const emptyState = createEmptyState({
    icon: '📦',
    titleBn: 'এখনো কোনো পণ্য যোগ করা হয়নি',
    titleEn: 'No products listed yet',
    subBn: 'পরবর্তী ধাপে পণ্য যোগ, স্টক আপডেট ও ক্যাটাগরি নির্বাচনের ফিচার যুক্ত হবে।',
    subEn: 'Product listing, stock management, and pricing controls foundation is ready.'
  });

  card.appendChild(emptyState);
  container.appendChild(card);
}

function renderOrdersTabStructure(container) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-3);" data-i18n="seller.nav_orders">
      অর্ডারসমূহ (Orders Management)
    </h3>
  `;

  const emptyState = createEmptyState({
    icon: '🛒',
    titleBn: 'এখনো কোনো অর্ডার পাওয়া যায়নি',
    titleEn: 'No customer orders yet',
    subBn: 'ক্রেতাদের অর্ডার, ডেলিভারি স্ট্যাটাস এবং ট্র্যাকিং ফিচারের স্ট্রাকচার প্রস্তুত রয়েছে।',
    subEn: 'Customer orders, processing status, and shipment management foundation is ready.'
  });

  card.appendChild(emptyState);
  container.appendChild(card);
}

function renderEarningsTabStructure(container, metrics) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-3);" data-i18n="seller.nav_earnings">
      আয় ও বিক্রি (Earnings & Revenue)
    </h3>
  `;

  const emptyState = createEmptyState({
    icon: '💰',
    titleBn: 'বিক্রি ও আয়ের হিসেব',
    titleEn: 'Earnings & Sales Report',
    subBn: `সর্বমোট বিক্রি: ৳ ${metrics.totalSales}। দৈনিক ও মাসিক আয়ের রিপোর্ট পরবর্তীতে যুক্ত হবে।`,
    subEn: `Total sales: ৳ ${metrics.totalSales}. Detailed revenue analytics foundation is active.`
  });

  card.appendChild(emptyState);
  container.appendChild(card);
}

function renderWithdrawalsTabStructure(container, metrics) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin-bottom: var(--space-3);" data-i18n="seller.nav_withdrawals">
      উত্তোলন (Withdrawals & Payouts)
    </h3>
  `;

  const emptyState = createEmptyState({
    icon: '🏦',
    titleBn: 'ব্যালেন্স উত্তোলন',
    titleEn: 'Withdrawal & Wallet Payouts',
    subBn: `উত্তোলনযোগ্য ব্যালেন্স: ৳ ${metrics.availableBalance}। ব্যাংক ও মোবাইল ব্যাংকিং payout স্ট্রাকচার সক্রিয়।`,
    subEn: `Available balance: ৳ ${metrics.availableBalance}. Bank & mobile banking withdrawal request module is ready.`
  });

  card.appendChild(emptyState);
  container.appendChild(card);
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
