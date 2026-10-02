/**
 * Seller Dashboard Foundation UI for MarketKoro
 * Enforces access controls for Seller Dashboard and renders approved seller workspace foundation.
 */

import { getTranslation } from '../i18n/i18n.js';
import { createModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { getSellerApplication } from './seller-service.js';
import { openBecomeSellerModal } from './seller-ui.js';

let activeDashboardModalBackdrop = null;

/**
 * Open Seller Dashboard Shell Modal with Access Control Checks
 * @param {Object} user - Auth user
 * @param {Object} profile - User profile document
 */
export async function openSellerDashboard(user, profile) {
  if (activeDashboardModalBackdrop) closeModal(activeDashboardModalBackdrop);

  if (!user) {
    showToast(getTranslation('seller.login_required_msg') || "Please log in to access the Seller Dashboard.", 'warning');
    openBecomeSellerModal(null, null);
    return;
  }

  // Create modal layout shell with loading indicator
  const container = document.createElement('div');
  container.className = 'seller-dashboard-container';
  container.innerHTML = `
    <div class="state-container">
      <div class="loading-spinner"></div>
      <p style="margin-top: var(--space-3); color: var(--color-text-muted);">${getTranslation('common.loading')}</p>
    </div>
  `;

  activeDashboardModalBackdrop = createModal({
    title: getTranslation('seller.dashboard_title') || "Seller Dashboard",
    bodyContent: container
  });

  try {
    const application = await getSellerApplication(user.uid);

    // Access control checks
    if (!application) {
      // Customer with no seller application
      renderAccessDeniedCustomer(container, user, profile);
      return;
    }

    if (application.status === 'pending') {
      renderAccessDeniedPending(container, application);
      return;
    }

    if (application.status === 'rejected') {
      renderAccessDeniedRejected(container, application);
      return;
    }

    if (application.status === 'suspended') {
      renderAccessDeniedSuspended(container, application);
      return;
    }

    // Verified / Approved Seller -> Render Dashboard Foundation
    renderApprovedSellerDashboard(container, application, user, profile);
  } catch (err) {
    console.error("Seller dashboard authorization error:", err);
    container.innerHTML = `
      <div class="state-container">
        <div class="state-icon">⚠️</div>
        <p>${getTranslation('common.error_occurred')}</p>
      </div>
    `;
  }
}

/**
 * Deny access for normal Customer (No application)
 */
function renderAccessDeniedCustomer(container, user, profile) {
  container.innerHTML = `
    <div class="card" style="padding: var(--space-6); text-align: center; background-color: var(--color-bg);">
      <div style="font-size: 3rem; margin-bottom: var(--space-2);">🔒</div>
      <h3 style="margin-bottom: var(--space-2);">${getTranslation('seller.access_denied') || "Seller Access Required"}</h3>
      <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); max-width: 420px; margin: 0 auto var(--space-5);">
        ${getTranslation('seller.customer_access_denied_desc') || "You do not have an active seller account. To start selling on MarketKoro, submit a seller application."}
      </p>

      <button id="apply-seller-now-btn" class="btn btn-primary btn-full" style="margin-bottom: var(--space-3);">
        💼 ${getTranslation('seller.become_seller_title') || "Become a Seller"}
      </button>

      <button id="close-dash-modal-btn" class="btn btn-outline btn-full">
        ${getTranslation('common.close')}
      </button>
    </div>
  `;

  container.querySelector('#apply-seller-now-btn').addEventListener('click', () => {
    closeModal(activeDashboardModalBackdrop);
    openBecomeSellerModal(user, profile);
  });
  container.querySelector('#close-dash-modal-btn').addEventListener('click', () => {
    closeModal(activeDashboardModalBackdrop);
  });
}

/**
 * Deny access for Pending applicant
 */
function renderAccessDeniedPending(container, application) {
  container.innerHTML = `
    <div class="card" style="padding: var(--space-6); text-align: center; background-color: var(--color-bg);">
      <div style="font-size: 3rem; margin-bottom: var(--space-2);">⏳</div>
      <span class="badge badge-secondary" style="align-self: center; margin-bottom: var(--space-3); padding: 4px 12px;">
        ${getTranslation('seller.status_pending') || "Application Pending Review"}
      </span>
      <h3 style="margin-bottom: var(--space-2);">${application.storeName || 'Store'}</h3>
      <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-5);">
        ${getTranslation('seller.pending_dashboard_access_desc') || "Your application is under verification. Dashboard features will be activated automatically once your application is approved."}
      </p>

      <button id="close-dash-pending-btn" class="btn btn-outline btn-full">
        ${getTranslation('common.close')}
      </button>
    </div>
  `;

  container.querySelector('#close-dash-pending-btn').addEventListener('click', () => {
    closeModal(activeDashboardModalBackdrop);
  });
}

/**
 * Deny access for Rejected applicant
 */
function renderAccessDeniedRejected(container, application) {
  container.innerHTML = `
    <div class="card" style="padding: var(--space-6); text-align: center; background-color: var(--color-bg);">
      <div style="font-size: 3rem; margin-bottom: var(--space-2);">❌</div>
      <span class="badge" style="align-self: center; margin-bottom: var(--space-3); padding: 4px 12px; background-color: var(--color-error-bg); color: var(--color-error);">
        ${getTranslation('seller.status_rejected') || "Application Declined"}
      </span>
      <h3 style="margin-bottom: var(--space-2);">${application.storeName || 'Store'}</h3>
      <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-5);">
        ${getTranslation('seller.rejected_dashboard_access_desc') || "Your seller application was not approved. Dashboard access is currently restricted."}
      </p>

      <button id="close-dash-rejected-btn" class="btn btn-outline btn-full">
        ${getTranslation('common.close')}
      </button>
    </div>
  `;

  container.querySelector('#close-dash-rejected-btn').addEventListener('click', () => {
    closeModal(activeDashboardModalBackdrop);
  });
}

/**
 * Deny access for Suspended seller
 */
function renderAccessDeniedSuspended(container, application) {
  container.innerHTML = `
    <div class="card" style="padding: var(--space-6); text-align: center; background-color: var(--color-bg);">
      <div style="font-size: 3rem; margin-bottom: var(--space-2);">🚫</div>
      <span class="badge" style="align-self: center; margin-bottom: var(--space-3); padding: 4px 12px; background-color: var(--color-error-bg); color: var(--color-error);">
        ${getTranslation('seller.status_suspended') || "Account Suspended"}
      </span>
      <h3 style="margin-bottom: var(--space-2);">${application.storeName || 'Store'}</h3>
      <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-5);">
        ${getTranslation('seller.suspended_desc') || "Seller access is suspended. Please contact support."}
      </p>

      <button id="close-dash-suspended-btn" class="btn btn-outline btn-full">
        ${getTranslation('common.close')}
      </button>
    </div>
  `;

  container.querySelector('#close-dash-suspended-btn').addEventListener('click', () => {
    closeModal(activeDashboardModalBackdrop);
  });
}

/**
 * Render Seller Dashboard Shell for Approved Sellers
 */
function renderApprovedSellerDashboard(container, application, user, profile) {
  const storeLogo = application.storeLogo || 'assets/images/placeholder-store.svg';
  const storeBanner = application.storeBanner || '';
  const storeName = application.storeName || 'My Store';
  const storeSlug = application.storeSlug || 'store';
  const division = application.division || 'Bangladesh';

  container.innerHTML = `
    <!-- Store Header Banner Shell -->
    <div style="position: relative; border-radius: var(--radius-lg); overflow: hidden; margin-bottom: var(--space-5); background-color: var(--color-surface); border: 1px solid var(--color-border);">
      ${storeBanner ? `
        <div style="height: 100px; width: 100%; overflow: hidden; background-color: var(--color-bg);">
          <img src="${storeBanner}" alt="Banner" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      ` : `
        <div style="height: 80px; width: 100%; background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);"></div>
      `}

      <div style="padding: var(--space-4); display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; margin-top: ${storeBanner ? '-30px' : '0'};">
        <img src="${storeLogo}" alt="Logo" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 3px solid var(--color-surface); background-color: var(--color-surface);">

        <div style="flex: 1; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
            <h3 style="margin: 0; font-size: var(--font-size-lg);">${storeName}</h3>
            <span class="badge badge-primary" style="background-color: var(--color-success-bg); color: var(--color-success);">✔ ${getTranslation('store.verified')}</span>
          </div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 2px;">
            📍 ${division} • seller.${storeSlug}.marketkoro.com
          </div>
        </div>
      </div>
    </div>

    <!-- Notice Box -->
    <div style="margin-bottom: var(--space-5); padding: var(--space-4); background-color: var(--color-primary-light); border-left: 4px solid var(--color-primary); border-radius: var(--radius-md); font-size: var(--font-size-xs); color: var(--color-text);">
      🚀 <strong>${getTranslation('seller.dashboard_notice_title') || "Seller Dashboard"}</strong>:
      <p style="margin-top: 4px; margin-bottom: 0;">
        ${getTranslation('seller.dashboard_notice_body') || "Your seller account is verified."}
      </p>
    </div>

    <!-- Metric Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-5);">
      <div class="card" style="padding: var(--space-3); text-align: center;">
        <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">${getTranslation('seller.dashboard_products') || "Products"}</div>
        <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); margin-top: 2px;">0</div>
      </div>

      <div class="card" style="padding: var(--space-3); text-align: center;">
        <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">${getTranslation('seller.dashboard_orders') || "Orders"}</div>
        <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); margin-top: 2px;">0</div>
      </div>

      <div class="card" style="padding: var(--space-3); text-align: center;">
        <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">${getTranslation('seller.dashboard_wallet') || "Wallet Balance"}</div>
        <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); margin-top: 2px;">৳ 0</div>
      </div>
    </div>

    <button id="close-dash-approved-btn" class="btn btn-outline btn-full">
      ${getTranslation('common.close')}
    </button>
  `;

  container.querySelector('#close-dash-approved-btn').addEventListener('click', () => {
    closeModal(activeDashboardModalBackdrop);
  });
}
