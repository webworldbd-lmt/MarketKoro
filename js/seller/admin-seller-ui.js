/**
 * Admin Seller Approval & Management UI for MarketKoro
 * Handles Admin view for reviewing, approving, rejecting, suspending, and reactivating seller applications.
 */

import { getTranslation } from '../i18n/i18n.js';
import { createModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import {
  getAllSellerApplications,
  updateSellerApplicationStatus
} from './seller-service.js';

let activeAdminModalBackdrop = null;

/**
 * Open Admin Seller Approval Management Modal
 * @param {Object} user - Auth user
 * @param {Object} profile - User profile document
 */
export async function openAdminSellerManagement(user, profile) {
  if (activeAdminModalBackdrop) closeModal(activeAdminModalBackdrop);

  // Check admin authorization
  if (!user || profile?.role !== 'admin') {
    showToast(getTranslation('admin.access_denied') || "Admin authorization required.", 'error');
    return;
  }

  const container = document.createElement('div');
  container.className = 'admin-seller-container';
  container.innerHTML = `
    <div class="state-container">
      <div class="loading-spinner"></div>
      <p style="margin-top: var(--space-3); color: var(--color-text-muted);">${getTranslation('common.loading')}</p>
    </div>
  `;

  activeAdminModalBackdrop = createModal({
    title: `🛡️ ${getTranslation('admin.seller_mgmt_title') || "Admin Seller Management"}`,
    bodyContent: container
  });

  await loadAdminSellerApplications(container, user, profile);
}

async function loadAdminSellerApplications(container, user, profile) {
  try {
    const applications = await getAllSellerApplications();

    if (!applications || applications.length === 0) {
      container.innerHTML = `
        <div class="state-container">
          <div class="state-icon">📄</div>
          <h3>${getTranslation('admin.no_applications_title') || "No Seller Applications"}</h3>
          <p style="color: var(--color-text-muted); font-size: var(--font-size-sm);">
            ${getTranslation('admin.no_applications_desc') || "There are currently no real seller applications submitted."}
          </p>
          <button id="close-admin-empty-btn" class="btn btn-outline" style="margin-top: var(--space-4);">
            ${getTranslation('common.close')}
          </button>
        </div>
      `;
      container.querySelector('#close-admin-empty-btn')?.addEventListener('click', () => {
        closeModal(activeAdminModalBackdrop);
      });
      return;
    }

    renderApplicationsList(container, applications, user, profile);
  } catch (err) {
    console.error("Error loading admin seller applications:", err);
    container.innerHTML = `
      <div class="state-container">
        <div class="state-icon">⚠️</div>
        <p>${getTranslation('common.error_occurred')}</p>
      </div>
    `;
  }
}

function renderApplicationsList(container, applications, user, profile) {
  let activeFilter = 'all';

  function filterApps() {
    if (activeFilter === 'all') return applications;
    return applications.filter(app => app.status === activeFilter);
  }

  function renderListContent() {
    const filtered = filterApps();
    const listContainer = container.querySelector('#admin-apps-list');
    if (!listContainer) return;

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: var(--space-6); color: var(--color-text-muted); font-size: var(--font-size-sm);">
          ${getTranslation('common.no_items')}
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(app => `
      <div class="card" style="padding: var(--space-4); margin-bottom: var(--space-3); background-color: var(--color-bg);">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <img src="${app.storeLogo || 'assets/images/placeholder-store.svg'}" alt="Logo" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">
            <div>
              <strong style="font-size: var(--font-size-base);">${app.storeName || 'Store'}</strong>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
                👤 ${app.fullName} • 📍 ${app.division || 'BD'} • 📱 ${app.phone || app.contactPhone || '-'}
              </div>
            </div>
          </div>

          <div>
            ${getStatusBadgeHtml(app.status)}
          </div>
        </div>

        <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3); flex-wrap: wrap; justify-content: flex-end;">
          ${app.status === 'pending' ? `
            <button class="btn btn-primary btn-sm admin-approve-btn" data-uid="${app.uid}">
              ✔ Approve
            </button>
            <button class="btn btn-outline btn-sm admin-reject-btn" data-uid="${app.uid}" style="color: var(--color-error); border-color: var(--color-error);">
              ✖ Reject
            </button>
          ` : ''}

          ${app.status === 'approved' ? `
            <button class="btn btn-outline btn-sm admin-suspend-btn" data-uid="${app.uid}" style="color: var(--color-warning); border-color: var(--color-warning);">
              🚫 Suspend
            </button>
          ` : ''}

          ${app.status === 'rejected' || app.status === 'suspended' ? `
            <button class="btn btn-primary btn-sm admin-reactivate-btn" data-uid="${app.uid}">
              🔄 Reactivate / Approve
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');

    // Bind action listeners
    listContainer.querySelectorAll('.admin-approve-btn').forEach(btn => {
      btn.addEventListener('click', () => handleStatusChange(btn.dataset.uid, 'approved'));
    });
    listContainer.querySelectorAll('.admin-reactivate-btn').forEach(btn => {
      btn.addEventListener('click', () => handleStatusChange(btn.dataset.uid, 'approved'));
    });
    listContainer.querySelectorAll('.admin-suspend-btn').forEach(btn => {
      btn.addEventListener('click', () => handleStatusChange(btn.dataset.uid, 'suspended'));
    });
    listContainer.querySelectorAll('.admin-reject-btn').forEach(btn => {
      btn.addEventListener('click', () => handleRejectPrompt(btn.dataset.uid));
    });
  }

  async function handleStatusChange(targetUid, newStatus, reason = '') {
    try {
      await updateSellerApplicationStatus(targetUid, newStatus, reason);
      showToast(`Seller status updated to "${newStatus}"`, 'success');
      await loadAdminSellerApplications(container, user, profile);
    } catch (err) {
      console.error("Admin status change failed:", err);
      showToast("Failed to update status: " + err.message, 'error');
    }
  }

  function handleRejectPrompt(targetUid) {
    const reason = prompt("Enter public rejection reason (shown to seller):", "Application did not meet MarketKoro seller verification guidelines.");
    if (reason !== null) {
      handleStatusChange(targetUid, 'rejected', reason.trim());
    }
  }

  container.innerHTML = `
    <!-- Filter Tabs -->
    <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2); overflow-x: auto;">
      <button class="btn btn-sm filter-tab-btn btn-primary" data-status="all">All (${applications.length})</button>
      <button class="btn btn-sm filter-tab-btn btn-outline" data-status="pending">Pending (${applications.filter(a => a.status === 'pending').length})</button>
      <button class="btn btn-sm filter-tab-btn btn-outline" data-status="approved">Approved (${applications.filter(a => a.status === 'approved').length})</button>
      <button class="btn btn-sm filter-tab-btn btn-outline" data-status="rejected">Rejected (${applications.filter(a => a.status === 'rejected').length})</button>
      <button class="btn btn-sm filter-tab-btn btn-outline" data-status="suspended">Suspended (${applications.filter(a => a.status === 'suspended').length})</button>
    </div>

    <!-- Applications List -->
    <div id="admin-apps-list" style="max-height: 400px; overflow-y: auto;"></div>

    <button id="close-admin-mgmt-btn" class="btn btn-outline btn-full" style="margin-top: var(--space-4);">
      ${getTranslation('common.close')}
    </button>
  `;

  // Bind filter tab switches
  container.querySelectorAll('.filter-tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.filter-tab-btn').forEach(t => {
        t.className = 'btn btn-sm filter-tab-btn btn-outline';
      });
      tab.className = 'btn btn-sm filter-tab-btn btn-primary';
      activeFilter = tab.dataset.status;
      renderListContent();
    });
  });

  container.querySelector('#close-admin-mgmt-btn').addEventListener('click', () => {
    closeModal(activeAdminModalBackdrop);
  });

  renderListContent();
}

function getStatusBadgeHtml(status) {
  if (status === 'approved') {
    return `<span class="badge" style="background-color: var(--color-success-bg); color: var(--color-success);">Approved</span>`;
  } else if (status === 'pending') {
    return `<span class="badge badge-secondary">Pending</span>`;
  } else if (status === 'rejected') {
    return `<span class="badge" style="background-color: var(--color-error-bg); color: var(--color-error);">Rejected</span>`;
  } else if (status === 'suspended') {
    return `<span class="badge" style="background-color: var(--color-error-bg); color: var(--color-error);">Suspended</span>`;
  }
  return `<span class="badge">${status}</span>`;
}
