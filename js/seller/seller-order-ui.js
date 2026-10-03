/**
 * Seller Order UI Component for MarketKoro
 * Manages Seller Order List, Search, Filters, Order Details Modal, and Controlled Status Updates.
 */

import { getTranslation, getCurrentLanguage } from '../i18n/i18n.js';
import { createEmptyState } from '../components/empty-state.js';
import { showToast } from '../components/toast.js';
import { createModal, closeModal } from '../components/modal.js';
import {
  getSellerOrders,
  calculateSellerOrderTotals,
  updateSellerOrderStatus,
  ALLOWED_SELLER_STATUS_TRANSITIONS
} from './order-service.js';

let currentSellerOrders = [];
let activeSearchQuery = '';
let activeStatusFilter = 'all';

/**
 * Main Entry: Renders the Seller Orders Workspace Tab inside Seller Dashboard
 * @param {HTMLElement} container - Target container element
 * @param {Object} application - Seller application document containing uid, storeName, etc.
 */
export async function renderOrdersTab(container, application) {
  if (!container || !application) return;

  const sellerUid = application.uid;

  // 1. Initial Outer Shell Setup
  container.innerHTML = `
    <div class="seller-orders-wrapper card" style="padding: var(--space-6);">

      <!-- Header & Action Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-5); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-4);">
        <div>
          <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin: 0;" data-i18n="seller.orders_title">
            অর্ডারসমূহ (Orders Management)
          </h3>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;" data-i18n="seller.orders_subtitle">
            আপনার স্টোরের কাস্টমার অর্ডারসমূহ ট্র্যাক করুন এবং ডেলিভারি স্ট্যাটাস আপডেট করুন।
          </p>
        </div>

        <button id="refresh-orders-btn" class="btn btn-outline btn-sm">
          🔄 <span data-i18n="common.refresh">রিফ্রেশ</span>
        </button>
      </div>

      <!-- Search & Filter Controls -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-5);">

        <!-- Order Search Bar -->
        <div class="form-group" style="margin: 0;">
          <input type="text" id="order-search-input" class="form-control" placeholder="অর্ডার আইডি বা কাস্টমারের নাম দিয়ে খুঁজুন..." value="${activeSearchQuery}">
        </div>

        <!-- Order Status Filter -->
        <div class="form-group" style="margin: 0;">
          <select id="order-status-filter" class="form-control">
            <option value="all">সকল স্ট্যাটাস (All Statuses)</option>
            <option value="pending">পেন্ডিং (Pending)</option>
            <option value="confirmed">কনফার্মড (Confirmed)</option>
            <option value="processing">প্রসেসিং (Processing)</option>
            <option value="ready_for_delivery">ডেলিভারির জন্য প্রস্তুত (Ready for Delivery)</option>
            <option value="shipped">শিপড (Shipped)</option>
            <option value="delivered">ডেলিভার্ড (Delivered)</option>
            <option value="cancelled">বাতিলকৃত (Cancelled)</option>
            <option value="returned">রিটার্নকৃত (Returned)</option>
            <option value="refunded">রিফান্ডকৃত (Refunded)</option>
          </select>
        </div>

      </div>

      <!-- Orders List Container -->
      <div id="seller-orders-list-root">
        <div style="text-align: center; padding: var(--space-8);">
          <span class="loading-spinner" style="width: 2rem; height: 2rem;"></span>
          <p style="margin-top: var(--space-2); color: var(--color-text-muted);">${getTranslation('common.loading')}</p>
        </div>
      </div>

    </div>
  `;

  const searchInput = container.querySelector('#order-search-input');
  const filterSelect = container.querySelector('#order-status-filter');
  const refreshBtn = container.querySelector('#refresh-orders-btn');
  const listRoot = container.querySelector('#seller-orders-list-root');

  if (filterSelect) filterSelect.value = activeStatusFilter;

  // Load Real Orders from Firestore
  const loadOrders = async () => {
    try {
      listRoot.innerHTML = `
        <div style="text-align: center; padding: var(--space-8);">
          <span class="loading-spinner" style="width: 2rem; height: 2rem;"></span>
          <p style="margin-top: var(--space-2); color: var(--color-text-muted);">${getTranslation('common.loading')}</p>
        </div>
      `;

      currentSellerOrders = await getSellerOrders(sellerUid);
      renderFilteredOrdersList(listRoot, sellerUid, loadOrders);
    } catch (err) {
      console.error("Seller orders load error:", err);
      listRoot.innerHTML = `
        <div style="text-align: center; padding: var(--space-6);">
          <div style="font-size: 2.5rem; margin-bottom: var(--space-2);">⚠️</div>
          <h4>অর্ডার লোড করা সম্ভব হয়নি</h4>
          <p style="color: var(--color-text-muted); font-size: var(--font-size-sm);">${err.message || ''}</p>
          <button id="retry-orders-btn" class="btn btn-outline btn-sm" style="margin-top: var(--space-3);">আবার চেষ্টা করুন</button>
        </div>
      `;
      listRoot.querySelector('#retry-orders-btn')?.addEventListener('click', loadOrders);
    }
  };

  // Attach Filter Listeners
  searchInput?.addEventListener('input', (e) => {
    activeSearchQuery = e.target.value.trim().toLowerCase();
    renderFilteredOrdersList(listRoot, sellerUid, loadOrders);
  });

  filterSelect?.addEventListener('change', (e) => {
    activeStatusFilter = e.target.value;
    renderFilteredOrdersList(listRoot, sellerUid, loadOrders);
  });

  refreshBtn?.addEventListener('click', loadOrders);

  await loadOrders();
}

/**
 * Renders filtered order list or empty state
 */
function renderFilteredOrdersList(listContainer, sellerUid, onRefresh) {
  listContainer.innerHTML = '';

  // Filter orders according to active search query and status filter
  let filtered = currentSellerOrders.filter((order) => {
    // Status Filter
    if (activeStatusFilter !== 'all' && order.orderStatus !== activeStatusFilter) {
      return false;
    }

    // Search Query
    if (activeSearchQuery) {
      const orderIdStr = (order.id || '').toLowerCase();
      const customerNameStr = (order.customerName || order.shippingAddress?.fullName || '').toLowerCase();
      const customerPhoneStr = (order.customerPhone || order.shippingAddress?.phone || '').toLowerCase();

      const matchId = orderIdStr.includes(activeSearchQuery);
      const matchName = customerNameStr.includes(activeSearchQuery);
      const matchPhone = customerPhoneStr.includes(activeSearchQuery);

      if (!matchId && !matchName && !matchPhone) return false;
    }

    return true;
  });

  // Strict Rule: If no real orders exist, show clean empty state
  if (filtered.length === 0) {
    const emptyState = createEmptyState({
      icon: '🛒',
      titleBn: 'এখনো কোনো অর্ডার পাওয়া যায়নি',
      titleEn: 'No orders yet',
      subBn: activeSearchQuery || activeStatusFilter !== 'all'
        ? 'আপনার ফিল্টারের সাথে মিলে এমন কোনো অর্ডার পাওয়া যায়নি।'
        : 'আপনার ক্রেতাদের থেকে অর্ডার আসার পর এখানে দেখতে পাবেন।',
      subEn: activeSearchQuery || activeStatusFilter !== 'all'
        ? 'No orders match your search or filter criteria.'
        : 'Orders from your customers will appear here.'
    });
    listContainer.appendChild(emptyState);
    return;
  }

  // Render List of Orders
  const grid = document.createElement('div');
  grid.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-4);';

  filtered.forEach((order) => {
    const card = renderSellerOrderCard(order, sellerUid, onRefresh);
    grid.appendChild(card);
  });

  listContainer.appendChild(grid);
}

/**
 * Creates an individual Order Card element
 */
function renderSellerOrderCard(order, sellerUid, onRefresh) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-md); background-color: var(--color-surface);';

  const { sellerItems, sellerSubtotal, sellerItemCount } = calculateSellerOrderTotals(order, sellerUid);

  const displayDate = order.createdAtDate
    ? order.createdAtDate.toLocaleString(getCurrentLanguage() === 'bn' ? 'bn-BD' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : '-';

  const orderIdDisplay = `#${(order.id || 'ORDER').slice(-8).toUpperCase()}`;
  const customerName = order.shippingAddress?.fullName || order.customerName || 'Customer';
  const customerPhone = order.shippingAddress?.phone || order.customerPhone || '-';
  const district = order.shippingAddress?.district || '';
  const division = order.shippingAddress?.division || '';

  const statusBadge = getOrderStatusBadgeHtml(order.orderStatus || 'pending');
  const paymentBadge = getPaymentStatusBadgeHtml(order.paymentStatus || 'pending', order.paymentMethod);

  // Products Preview (First 2 seller items)
  const itemsPreviewHtml = sellerItems.slice(0, 2).map((item) => `
    <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px dashed var(--color-border);">
      <img src="${item.productImage || 'assets/images/placeholder.svg'}" alt="${item.productName || 'Product'}" style="width: 48px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--color-border); flex-shrink: 0;">
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: var(--font-size-sm); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${item.productName || 'Product'}
        </div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
          ৳ ${item.price || 0} × ${item.quantity || 1} = <strong>৳ ${item.subtotal || ((item.price || 0) * (item.quantity || 1))}</strong>
        </div>
      </div>
    </div>
  `).join('');

  const moreItemsCount = sellerItems.length > 2 ? sellerItems.length - 2 : 0;

  card.innerHTML = `
    <!-- Top Row: Order ID, Date, Badges -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3);">
      <div>
        <div style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
          <span style="font-weight: 700; font-size: var(--font-size-md); color: var(--color-primary);">${orderIdDisplay}</span>
          ${statusBadge}
          ${paymentBadge}
        </div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;">
          📅 ${displayDate}
        </div>
      </div>

      <!-- Seller Subtotal -->
      <div style="text-align: right;">
        <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">সেলার আইটেম সাবটোটাল</span>
        <div style="font-weight: 700; font-size: var(--font-size-lg); color: var(--color-primary);">
          ৳ ${sellerSubtotal}
        </div>
        <span style="font-size: 11px; color: var(--color-text-muted);">${sellerItemCount} টি আইটেম</span>
      </div>
    </div>

    <!-- Middle Grid: Items Preview & Customer Info -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-3);">

      <!-- Items Column -->
      <div>
        <div style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 4px;">
          অর্ডারকৃত পণ্যসমূহ (${sellerItems.length})
        </div>
        ${itemsPreviewHtml}
        ${moreItemsCount > 0 ? `
          <div style="font-size: var(--font-size-xs); color: var(--color-primary); font-weight: 600; margin-top: 4px;">
            + আরও ${moreItemsCount} টি পণ্য
          </div>
        ` : ''}
      </div>

      <!-- Delivery Customer Column -->
      <div style="background-color: var(--color-bg); padding: var(--space-3); border-radius: var(--radius-sm); font-size: var(--font-size-xs);">
        <div style="font-weight: 700; color: var(--color-text); margin-bottom: 4px;">
          📍 ডেলিভারি তথ্য (Recipient)
        </div>
        <p style="margin: 2px 0; font-weight: 600; color: var(--color-text);">${customerName}</p>
        <p style="margin: 2px 0; color: var(--color-text-muted);">📞 ${customerPhone}</p>
        <p style="margin: 2px 0; color: var(--color-text-muted);">${district ? `${district}, ${division}` : 'Bangladesh'}</p>
      </div>

    </div>

    <!-- Bottom Actions Row -->
    <div style="display: flex; justify-content: flex-end; align-items: center; gap: var(--space-2); border-top: 1px solid var(--color-border); padding-top: var(--space-3);">
      <button class="btn btn-outline btn-sm view-details-btn" style="min-width: 120px;">
        👁️ विवरण দেখুন
      </button>
    </div>
  `;

  card.querySelector('.view-details-btn')?.addEventListener('click', () => {
    openOrderDetailsModal(order, sellerUid, onRefresh);
  });

  return card;
}

/**
 * Opens Order Details Modal for fulfillment, details inspection, and status management.
 */
export function openOrderDetailsModal(order, sellerUid, onRefresh) {
  const { sellerItems, sellerSubtotal, sellerItemCount } = calculateSellerOrderTotals(order, sellerUid);

  const displayDate = order.createdAtDate
    ? order.createdAtDate.toLocaleString(getCurrentLanguage() === 'bn' ? 'bn-BD' : 'en-US', {
        dateStyle: 'full',
        timeStyle: 'short'
      })
    : '-';

  const orderIdDisplay = `#${(order.id || 'ORDER').toUpperCase()}`;
  const currentStatus = order.orderStatus || 'pending';
  const shipping = order.shippingAddress || {};

  const modalContainer = document.createElement('div');
  modalContainer.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-4); max-width: 650px;';

  // Allowed transitions
  const allowedNextStatuses = ALLOWED_SELLER_STATUS_TRANSITIONS[currentStatus] || [];

  modalContainer.innerHTML = `
    <!-- Top Order Info Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2); background-color: var(--color-bg); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md);">
      <div>
        <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">অর্ডার নম্বর:</span>
        <div style="font-weight: 700; font-size: var(--font-size-md); color: var(--color-primary);">${orderIdDisplay}</div>
        <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">📅 ${displayDate}</div>
      </div>

      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
        ${getOrderStatusBadgeHtml(currentStatus)}
        ${getPaymentStatusBadgeHtml(order.paymentStatus || 'pending', order.paymentMethod)}
      </div>
    </div>

    <!-- Seller Products Section -->
    <div class="card" style="padding: var(--space-4); border: 1px solid var(--color-border);">
      <h4 style="font-size: var(--font-size-sm); font-weight: 700; margin-bottom: var(--space-3); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2);">
        📦 আপনার পণ্যসমূহ (Items for Fulfillment - ${sellerItemCount})
      </h4>

      <div style="display: flex; flex-direction: column; gap: var(--space-3);">
        ${sellerItems.map((item) => `
          <div style="display: flex; align-items: center; gap: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px dashed var(--color-border);">
            <img src="${item.productImage || 'assets/images/placeholder.svg'}" alt="${item.productName || 'Product'}" style="width: 56px; height: 56px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--color-border); background: var(--color-bg);">
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; font-size: var(--font-size-sm);">${item.productName || 'Product'}</div>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 2px;">
                মূল্য snapshot: ৳ ${item.price || 0} | পরিমাণ: ${item.quantity || 1}
              </div>
            </div>
            <div style="font-weight: 700; font-size: var(--font-size-sm); color: var(--color-primary);">
              ৳ ${item.subtotal || ((item.price || 0) * (item.quantity || 1))}
            </div>
          </div>
        `).join('')}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-3); padding-top: var(--space-2); font-weight: 700;">
        <span>সেলার সাবটোটাল (Seller Subtotal):</span>
        <span style="font-size: var(--font-size-lg); color: var(--color-primary);">৳ ${sellerSubtotal}</span>
      </div>
    </div>

    <!-- Customer Shipping & Fulfillment Information -->
    <div class="card" style="padding: var(--space-4); border: 1px solid var(--color-border);">
      <h4 style="font-size: var(--font-size-sm); font-weight: 700; margin-bottom: var(--space-3); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-2);">
        📍 ডেলিভারি ঠিকানা ও প্রাপকের তথ্য (Fulfillment Address)
      </h4>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-3); font-size: var(--font-size-sm);">
        <div>
          <strong style="color: var(--color-text-muted); font-size: var(--font-size-xs);">প্রাপকের নাম:</strong>
          <p style="margin-top: 2px; font-weight: 600;">${shipping.fullName || order.customerName || 'Customer'}</p>
        </div>

        <div>
          <strong style="color: var(--color-text-muted); font-size: var(--font-size-xs);">যোগাযোগ ফোন:</strong>
          <p style="margin-top: 2px; font-weight: 600;">📞 ${shipping.phone || order.customerPhone || '-'}</p>
        </div>

        <div style="grid-column: 1 / -1;">
          <strong style="color: var(--color-text-muted); font-size: var(--font-size-xs);">পূর্ণাঙ্গ ঠিকানা:</strong>
          <p style="margin-top: 2px;">
            ${shipping.detailedAddress || '-'}, ${shipping.upazila || ''}, ${shipping.district || ''}, ${shipping.division || ''} ${shipping.postalCode ? `- ${shipping.postalCode}` : ''}
          </p>
        </div>
      </div>
    </div>

    <!-- Order Status Management Section -->
    <div class="card" style="padding: var(--space-4); border: 1px solid var(--color-border); background-color: var(--color-surface);">
      <h4 style="font-size: var(--font-size-sm); font-weight: 700; margin-bottom: var(--space-3);">
        ⚙️ অর্ডার স্ট্যাটাস পরিবর্তন (Order Status Management)
      </h4>

      ${allowedNextStatuses.length > 0 ? `
        <form id="update-order-status-form" style="display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap;">
          <select id="new-status-select" class="form-control" style="flex: 1; min-width: 200px;" required>
            <option value="">-- পরবর্তী স্ট্যাটাস নির্বাচন করুন --</option>
            ${allowedNextStatuses.map((st) => `
              <option value="${st}">${getLabelForStatus(st)}</option>
            `).join('')}
          </select>

          <button type="submit" id="save-status-btn" class="btn btn-primary" style="min-width: 140px;">
            💾 স্ট্যাটাস আপডেট
          </button>
        </form>
      ` : `
        <div style="background-color: var(--color-bg); padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); color: var(--color-text-muted);">
          ${currentStatus === 'shipped'
            ? 'ℹ️ অর্ডারটি শিপমেন্ট করা হয়েছে। কুরিয়ার ট্র্যাকিং বা কাস্টমার ডেলিভারি নিশ্চিতকরণের মাধ্যমে এডমিন/কুরিয়ার স্ট্যাটাস ডেলিভার্ড সম্পন্ন করবে।'
            : 'ℹ️ এই অর্ডারের বর্তমান স্ট্যাটাসটি চূড়ান্ত (Terminal State)। পরবর্তীতে আর পরিবর্তন সম্ভব নয়।'}
        </div>
      `}
    </div>
  `;

  const backdrop = createModal({
    title: `অর্ডার বিবরণ (${orderIdDisplay})`,
    bodyContent: modalContainer
  });

  // Handle Order Status Update
  const statusForm = modalContainer.querySelector('#update-order-status-form');
  statusForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const select = modalContainer.querySelector('#new-status-select');
    const saveBtn = modalContainer.querySelector('#save-status-btn');
    const targetStatus = select?.value;

    if (!targetStatus) {
      showToast("অনুগ্রহ করে একটি পরবর্তী স্ট্যাটাস নির্বাচন করুন।", "warning");
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="loading-spinner"></span> আপডেট হচ্ছে...`;

      await updateSellerOrderStatus(order.id, sellerUid, targetStatus);

      showToast("অর্ডার স্ট্যাটাস সফলভাবে আপডেট করা হয়েছে।", "success");
      closeModal(backdrop);

      if (typeof onRefresh === 'function') {
        await onRefresh();
      }
    } catch (err) {
      console.error("Status update error:", err);
      showToast(err.message || "স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।", "error");
      saveBtn.disabled = false;
      saveBtn.innerHTML = `💾 স্ট্যাটাস আপডেট`;
    }
  });
}

/**
 * Helper: Generates Order Status Badge HTML
 */
function getOrderStatusBadgeHtml(status) {
  const map = {
    pending: { label: 'পেন্ডিং', bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
    confirmed: { label: 'কনফার্মড', bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
    processing: { label: 'প্রসেসিং', bg: 'var(--color-primary-light)', color: 'var(--color-primary)' },
    ready_for_delivery: { label: 'ডেলিভারির জন্য প্রস্তুত', bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
    shipped: { label: 'শিপড', bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
    delivered: { label: 'ডেলিভার্ড', bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    cancelled: { label: 'বাতিলকৃত', bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
    returned: { label: 'রিটার্নকৃত', bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
    refunded: { label: 'রিফান্ডকৃত', bg: 'var(--color-error-bg)', color: 'var(--color-error)' }
  };

  const item = map[status] || { label: status, bg: 'var(--color-bg)', color: 'var(--color-text)' };

  return `<span class="badge" style="background-color: ${item.bg}; color: ${item.color}; font-weight: 600;">${item.label}</span>`;
}

/**
 * Helper: Generates Payment Status Badge HTML
 */
function getPaymentStatusBadgeHtml(status, method) {
  const methodLabel = method === 'cod' ? 'COD' : (method || 'Payment');

  const map = {
    pending: { label: `পেন্ডিং (${methodLabel})`, bg: 'var(--color-bg)', color: 'var(--color-text-muted)' },
    paid: { label: `পরিশোধিত (${methodLabel})`, bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    cod: { label: `ক্যাশ অন ডেলিভারি`, bg: 'var(--color-info-bg)', color: 'var(--color-info)' },
    failed: { label: `ব্যর্থ (${methodLabel})`, bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
    refunded: { label: `রিফান্ডকৃত (${methodLabel})`, bg: 'var(--color-error-bg)', color: 'var(--color-error)' }
  };

  const item = map[status] || { label: `${status} (${methodLabel})`, bg: 'var(--color-bg)', color: 'var(--color-text-muted)' };

  return `<span class="badge" style="background-color: ${item.bg}; color: ${item.color}; border: 1px solid var(--color-border); font-size: 11px;">💳 ${item.label}</span>`;
}

function getLabelForStatus(status) {
  const map = {
    confirmed: 'কনফার্ম করুন (Confirmed)',
    processing: 'প্রসেসিং এ পাঠান (Processing)',
    ready_for_delivery: 'ডেলিভারির জন্য প্রস্তুত (Ready for Delivery)',
    shipped: 'শিপড হিসেবে চিহ্নিত করুন (Shipped)',
    cancelled: 'অর্ডার বাতিল করুন (Cancelled)'
  };
  return map[status] || status;
}
