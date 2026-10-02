/**
 * Customer Account Dashboard Module for MarketKoro
 * Manages Profile, Address Book, Wishlist, Orders, Reviews, Notifications & Settings
 */

import { initTheme, toggleTheme } from '../theme.js';
import { initI18n, toggleLanguage, getCurrentLanguage, getTranslation } from '../i18n/i18n.js';
import { onAuthChanged, getCurrentState, logoutUser } from '../auth/auth-service.js';
import { openLoginModal } from '../auth/auth-ui.js';
import { createEmptyState } from '../components/empty-state.js';
import { showToast } from '../components/toast.js';
import { db } from '../../config/firebase.js';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let activeTab = 'profile';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initI18n();

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  const langToggleBtn = document.getElementById('lang-toggle-btn');
  if (langToggleBtn) langToggleBtn.addEventListener('click', toggleLanguage);

  const mobileNavToggleBtn = document.getElementById('mobile-nav-toggle-btn');
  const navbar = document.getElementById('navbar');
  if (mobileNavToggleBtn && navbar) {
    mobileNavToggleBtn.addEventListener('click', () => navbar.classList.toggle('open'));
  }

  onAuthChanged((state) => {
    renderAccountDashboard(state);
  });

  window.addEventListener('marketkoro:languageChange', () => {
    renderAccountDashboard(getCurrentState());
  });
});

export function renderAccountDashboard(state) {
  const root = document.getElementById('account-root');
  if (!root) return;

  const { user, profile, loading } = state;

  if (loading) {
    root.innerHTML = `
      <div style="text-align: center; padding: var(--space-8);">
        <span class="loading-spinner" style="width: 2rem; height: 2rem;"></span>
        <p style="margin-top: var(--space-2);">${getTranslation('common.loading')}</p>
      </div>
    `;
    return;
  }

  if (!user) {
    root.innerHTML = '';
    const emptyState = createEmptyState({
      icon: '🔒',
      titleBn: 'লগইন প্রয়োজন',
      titleEn: 'Authentication Required',
      subBn: 'আপনার একাউন্ট তথ্য ও ফিচারসমূহ ব্যবহার করতে অনুগ্রহ করে লগইন করুন।',
      subEn: 'Please log in to view and manage your profile, addresses, orders, and wishlist.',
      actionTextBn: getTranslation('auth.login'),
      actionTextEn: getTranslation('auth.login'),
      onAction: () => openLoginModal()
    });
    root.appendChild(emptyState);
    return;
  }

  // User is authenticated
  const lang = getCurrentLanguage();
  const displayName = profile?.fullName || user.displayName || 'MarketKoro Customer';
  const roleText = profile?.role ? getTranslation(`auth.role_${profile.role}`) || profile.role : getTranslation('auth.role_customer');

  root.innerHTML = `
    <div class="account-layout" style="display: grid; grid-template-columns: 260px 1fr; gap: var(--space-6);">

      <!-- Sidebar Navigation -->
      <aside class="account-sidebar card" style="padding: var(--space-4); height: fit-content;">
        <div style="text-align: center; margin-bottom: var(--space-4); padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-border);">
          <div class="profile-avatar-large" style="width: 64px; height: 64px; margin: 0 auto var(--space-2); border-radius: 50%; background: var(--color-primary-light); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; overflow: hidden;">
            ${user.photoURL ? `<img src="${user.photoURL}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">` : '👤'}
          </div>
          <h3 style="font-size: var(--font-size-md); font-weight: var(--font-weight-bold);">${displayName}</h3>
          <span class="badge badge-primary" style="margin-top: 4px;">${roleText}</span>
        </div>

        <nav class="account-menu">
          <button class="account-menu-item ${activeTab === 'profile' ? 'active' : ''}" data-tab="profile">
            👤 <span data-i18n="account.tab_profile">ব্যক্তিগত তথ্য</span>
          </button>
          <button class="account-menu-item ${activeTab === 'addresses' ? 'active' : ''}" data-tab="addresses">
            📍 <span data-i18n="account.tab_addresses">ঠিকানা (Addresses)</span>
          </button>
          <button class="account-menu-item ${activeTab === 'wishlist' ? 'active' : ''}" data-tab="wishlist">
            ❤️ <span data-i18n="account.tab_wishlist">Wishlist</span>
          </button>
          <button class="account-menu-item ${activeTab === 'orders' ? 'active' : ''}" data-tab="orders">
            📦 <span data-i18n="account.tab_orders">অর্ডারসমূহ</span>
          </button>
          <button class="account-menu-item ${activeTab === 'reviews' ? 'active' : ''}" data-tab="reviews">
            ⭐ <span data-i18n="account.tab_reviews">রিভিউ</span>
          </button>
          <button class="account-menu-item ${activeTab === 'notifications' ? 'active' : ''}" data-tab="notifications">
            🔔 <span data-i18n="account.tab_notifications">নোটিফিকেশন</span>
          </button>
          <button class="account-menu-item ${activeTab === 'settings' ? 'active' : ''}" data-tab="settings">
            ⚙️ <span data-i18n="account.tab_settings">সেটিংস</span>
          </button>
          <button id="account-logout-btn" class="account-menu-item text-error" style="color: var(--color-error); width: 100%; margin-top: var(--space-4);">
            🚪 <span data-i18n="auth.logout">লগআউট</span>
          </button>
        </nav>
      </aside>

      <!-- Main Account View Area -->
      <section class="account-main-content" id="account-tab-content">
        <!-- Tab view content dynamically loaded -->
      </section>

    </div>
  `;

  // Dynamic CSS overrides
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .account-menu-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-3) var(--space-3);
      border: none;
      background: transparent;
      color: var(--color-text);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      border-radius: var(--radius-md);
      cursor: pointer;
      text-align: left;
      transition: background-color var(--transition-fast);
      margin-bottom: var(--space-1);
    }
    .account-menu-item:hover {
      background-color: var(--color-bg);
    }
    .account-menu-item.active {
      background-color: var(--color-primary-light);
      color: var(--color-primary);
      font-weight: var(--font-weight-bold);
    }
    @media (max-width: 768px) {
      .account-layout {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(styleEl);

  // Tab switcher click listener
  root.querySelectorAll('.account-menu-item[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab');
      renderAccountDashboard(state);
    });
  });

  const logoutBtn = root.querySelector('#account-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logoutUser();
      showToast(getTranslation('auth.logout_success'), 'info');
    });
  }

  // Render specific tab content
  const tabContentEl = root.querySelector('#account-tab-content');
  if (tabContentEl) {
    renderTabContent(tabContentEl, activeTab, user, profile);
  }
}

function renderTabContent(container, tab, user, profile) {
  container.innerHTML = '';

  if (tab === 'profile') {
    renderProfileTab(container, user, profile);
  } else if (tab === 'addresses') {
    renderAddressesTab(container, user, profile);
  } else if (tab === 'wishlist') {
    renderWishlistTab(container);
  } else if (tab === 'orders') {
    renderOrdersTab(container);
  } else if (tab === 'reviews') {
    renderReviewsTab(container);
  } else if (tab === 'notifications') {
    renderNotificationsTab(container);
  } else if (tab === 'settings') {
    renderSettingsTab(container, user, profile);
  }
}

function renderProfileTab(container, user, profile) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h2 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3);" data-i18n="account.profile_title">
      ${getTranslation('account.profile_title') || 'ব্যক্তিগত তথ্য (Personal Information)'}
    </h2>

    <form id="profile-edit-form" class="auth-form" style="max-width: 600px;">
      <div id="profile-alert" class="auth-alert" style="display: none;"></div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.full_name')}</label>
        <input type="text" id="prof-fullName" class="form-input" value="${profile?.fullName || user.displayName || ''}" required>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.email')}</label>
        <input type="email" class="form-input" value="${user.email || ''}" disabled style="opacity: 0.7; cursor: not-allowed;">
        <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);" data-i18n="account.email_non_editable">ইমেইল পরিবর্তনযোগ্য নয়</span>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.phone')}</label>
        <input type="tel" id="prof-phone" class="form-input" value="${profile?.phone || user.phoneNumber || ''}" placeholder="+8801700000000">
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('account.photo_url') || 'প্রোফাইল ছবি লিংক (Photo URL)'}</label>
        <input type="url" id="prof-photoURL" class="form-input" value="${profile?.photoURL || user.photoURL || ''}" placeholder="https://example.com/photo.jpg">
      </div>

      <button type="submit" id="save-profile-btn" class="btn btn-primary" style="margin-top: var(--space-4);">
        💾 ${getTranslation('account.save_changes') || 'পরিবর্তন সংরক্ষণ করুন'}
      </button>
    </form>
  `;

  container.appendChild(card);

  const form = card.querySelector('#profile-edit-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = card.querySelector('#prof-fullName').value.trim();
    const phone = card.querySelector('#prof-phone').value.trim();
    const photoURL = card.querySelector('#prof-photoURL').value.trim();
    const alertEl = card.querySelector('#profile-alert');
    const btn = card.querySelector('#save-profile-btn');

    alertEl.style.display = 'none';

    if (!fullName) {
      alertEl.textContent = getTranslation('auth.error_name_required');
      alertEl.style.display = 'block';
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = getTranslation('common.loading');

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        fullName,
        phone,
        photoURL: photoURL || null,
        updatedAt: serverTimestamp()
      });

      showToast(getTranslation('account.profile_updated') || 'প্রোফাইল সফলভাবে আপডেট করা হয়েছে।', 'success');
      const snap = await getDoc(userRef);
      renderAccountDashboard({ user, profile: snap.data(), loading: false });
    } catch (err) {
      console.error("Profile update error:", err);
      btn.disabled = false;
      btn.textContent = getTranslation('account.save_changes') || 'পরিবর্তন সংরক্ষণ করুন';
      alertEl.textContent = getTranslation('common.error_occurred');
      alertEl.style.display = 'block';
    }
  });
}

async function renderAddressesTab(container, user, profile) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3); flex-wrap: wrap; gap: var(--space-2);">
      <h2 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold);" data-i18n="account.addresses_title">
        ${getTranslation('account.addresses_title') || 'আমার ঠিকানাসমূহ (Delivery Addresses)'}
      </h2>
      <button id="add-address-btn" class="btn btn-primary btn-sm">
        ➕ ${getTranslation('account.add_new_address') || 'নতুন ঠিকানা যোগ করুন'}
      </button>
    </div>

    <div id="addresses-list-container">
      <div style="text-align: center; padding: var(--space-4);">
        <span class="loading-spinner"></span>
      </div>
    </div>
  `;

  container.appendChild(card);

  const listContainer = card.querySelector('#addresses-list-container');

  const loadAddresses = async () => {
    try {
      const addressesRef = collection(db, 'users', user.uid, 'addresses');
      const snap = await getDocs(addressesRef);
      const addresses = [];
      snap.forEach((d) => addresses.push({ id: d.id, ...d.data() }));

      listContainer.innerHTML = '';

      if (addresses.length === 0) {
        const emptyState = createEmptyState({
          icon: '📍',
          titleBn: 'কোনো সংরক্ষিত ঠিকানা নেই',
          titleEn: 'No saved addresses yet.',
          subBn: 'পণ্য দ্রুত ডেলিভারির জন্য আপনার স্থায়ী বা অস্থায়ী ঠিকানা সংরক্ষণ করুন।',
          subEn: 'Save your delivery addresses for seamless checkout.'
        });
        listContainer.appendChild(emptyState);
      } else {
        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4);';

        addresses.forEach((addr) => {
          const item = document.createElement('div');
          item.className = 'card';
          item.style.padding = 'var(--space-4)';
          item.style.border = '1px solid var(--color-border)';

          item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-2);">
              <span class="badge badge-secondary">${addr.label || 'Home'}</span>
              <div style="display: flex; gap: 4px;">
                <button class="btn btn-outline btn-sm edit-addr-btn" data-id="${addr.id}" style="padding: 2px 8px; font-size: var(--font-size-xs);">✏️</button>
                <button class="btn btn-outline btn-sm delete-addr-btn" data-id="${addr.id}" style="color: var(--color-error); border-color: var(--color-error); padding: 2px 8px; font-size: var(--font-size-xs);">🗑️</button>
              </div>
            </div>
            <h4 style="font-weight: var(--font-weight-bold);">${addr.fullName || user.displayName || 'Recipient'}</h4>
            <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-top: 4px;">📞 ${addr.phone}</p>
            <p style="font-size: var(--font-size-sm); margin-top: 8px;">
              ${addr.detailedAddress}, ${addr.upazila}, ${addr.district}, ${addr.division} ${addr.postalCode ? `- ${addr.postalCode}` : ''}
            </p>
          `;

          item.querySelector('.edit-addr-btn').addEventListener('click', () => {
            openAddressFormModal(user, loadAddresses, addr);
          });

          item.querySelector('.delete-addr-btn').addEventListener('click', async () => {
            if (confirm(getTranslation('account.confirm_delete_addr') || 'আপনি কি এই ঠিকানাটি মুছে ফেলতে চান?')) {
              await deleteDoc(doc(db, 'users', user.uid, 'addresses', addr.id));
              showToast(getTranslation('account.addr_deleted') || 'ঠিকানা মুছে ফেলা হয়েছে।', 'info');
              loadAddresses();
            }
          });

          grid.appendChild(item);
        });

        listContainer.appendChild(grid);
      }
    } catch (err) {
      console.error("Error loading addresses:", err);
      listContainer.innerHTML = `<p style="color: var(--color-error);">${getTranslation('common.error_occurred')}</p>`;
    }
  };

  await loadAddresses();

  card.querySelector('#add-address-btn').addEventListener('click', () => {
    openAddressFormModal(user, loadAddresses, null);
  });
}

function openAddressFormModal(user, onSuccess, existingAddr = null) {
  const isEdit = !!existingAddr;
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = `
    <form id="address-add-form" class="auth-form">
      <div class="form-group">
        <label class="form-label">${getTranslation('account.addr_label') || 'ঠিকানার ধরন (Label)'}</label>
        <select id="addr-label" class="form-input">
          <option value="Home" ${existingAddr?.label === 'Home' ? 'selected' : ''}>হোম (Home)</option>
          <option value="Office" ${existingAddr?.label === 'Office' ? 'selected' : ''}>অফিস (Office)</option>
          <option value="Other" ${existingAddr?.label === 'Other' ? 'selected' : ''}>অন্যান্য (Other)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.full_name')}</label>
        <input type="text" id="addr-fullName" class="form-input" value="${existingAddr?.fullName || user.displayName || ''}" required>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.phone')}</label>
        <input type="tel" id="addr-phone" class="form-input" value="${existingAddr?.phone || ''}" placeholder="+8801700000000" required>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
        <div class="form-group">
          <label class="form-label">বিভাগ (Division)</label>
          <input type="text" id="addr-division" class="form-input" value="${existingAddr?.division || ''}" placeholder="ঢাকা" required>
        </div>
        <div class="form-group">
          <label class="form-label">জেলা (District)</label>
          <input type="text" id="addr-district" class="form-input" value="${existingAddr?.district || ''}" placeholder="ঢাকা" required>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
        <div class="form-group">
          <label class="form-label">উপজেলা/থানা (Upazila/Area)</label>
          <input type="text" id="addr-upazila" class="form-input" value="${existingAddr?.upazila || ''}" placeholder="ধানমন্ডি" required>
        </div>
        <div class="form-group">
          <label class="form-label">পোস্টাল কোড (Postal Code)</label>
          <input type="text" id="addr-postalCode" class="form-input" value="${existingAddr?.postalCode || ''}" placeholder="১২০৯">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">বিস্তারিত ঠিকানা (Detailed Address)</label>
        <textarea id="addr-detailed" class="form-input" rows="3" placeholder="বাসা/রোড/ফ্ল্যাট নম্বর..." required>${existingAddr?.detailedAddress || ''}</textarea>
      </div>

      <button type="submit" id="save-addr-btn" class="btn btn-primary btn-full" style="margin-top: var(--space-4);">
        ${isEdit ? (getTranslation('account.update_address') || 'ঠিকানা হালনাগাদ করুন') : (getTranslation('account.save_address') || 'ঠিকানা সংরক্ষণ করুন')}
      </button>
    </form>
  `;

  import('../components/modal.js').then(({ createModal, closeModal }) => {
    const backdrop = createModal({
      title: isEdit ? (getTranslation('account.edit_address') || 'ঠিকানা সম্পাদনা') : (getTranslation('account.add_new_address') || 'নতুন ঠিকানা যোগ করুন'),
      bodyContent: modalContainer
    });

    modalContainer.querySelector('#address-add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = modalContainer.querySelector('#save-addr-btn');
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = getTranslation('common.loading');

        const addrData = {
          label: modalContainer.querySelector('#addr-label').value,
          fullName: modalContainer.querySelector('#addr-fullName').value.trim(),
          phone: modalContainer.querySelector('#addr-phone').value.trim(),
          division: modalContainer.querySelector('#addr-division').value.trim(),
          district: modalContainer.querySelector('#addr-district').value.trim(),
          upazila: modalContainer.querySelector('#addr-upazila').value.trim(),
          postalCode: modalContainer.querySelector('#addr-postalCode').value.trim(),
          detailedAddress: modalContainer.querySelector('#addr-detailed').value.trim(),
          updatedAt: serverTimestamp()
        };

        if (isEdit) {
          const addrDocRef = doc(db, 'users', user.uid, 'addresses', existingAddr.id);
          await updateDoc(addrDocRef, addrData);
        } else {
          addrData.createdAt = serverTimestamp();
          const addressesRef = collection(db, 'users', user.uid, 'addresses');
          await addDoc(addressesRef, addrData);
        }

        showToast(getTranslation('account.addr_added') || 'ঠিকানা সফলভাবে সংরক্ষিত হয়েছে।', 'success');
        closeModal(backdrop);
        onSuccess();
      } catch (err) {
        console.error("Save address error:", err);
        saveBtn.disabled = false;
        saveBtn.textContent = getTranslation('account.save_address') || 'ঠিকানা সংরক্ষণ করুন';
        showToast(getTranslation('common.error_occurred'), 'error');
      }
    });
  });
}

function renderWishlistTab(container) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h2 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3);" data-i18n="account.tab_wishlist">
      ${getTranslation('account.tab_wishlist') || 'Wishlist'}
    </h2>
  `;

  const emptyState = createEmptyState({
    icon: '❤️',
    titleBn: 'আপনার Wishlist এখনো খালি',
    titleEn: 'Your wishlist is empty.',
    subBn: 'আপনার পছন্দের পণ্যগুলো পরবর্তীতে কেনাকাটার জন্য সংরক্ষণ করুন।',
    subEn: 'Explore marketplace products and click the heart icon to save items here.'
  });

  card.appendChild(emptyState);
  container.appendChild(card);
}

function renderOrdersTab(container) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h2 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3);" data-i18n="account.tab_orders">
      ${getTranslation('account.tab_orders') || 'আমার অর্ডারসমূহ (Orders)'}
    </h2>
  `;

  const emptyState = createEmptyState({
    icon: '📦',
    titleBn: 'কোনো অর্ডার পাওয়া যায়নি',
    titleEn: 'No orders found.',
    subBn: 'আপনি এখনো কোনো অর্ডার করেননি। পণ্য অর্ডার করার পর এখানে দেখতে পাবেন।',
    subEn: 'Your past and active order statuses will appear here.'
  });

  card.appendChild(emptyState);
  container.appendChild(card);
}

function renderReviewsTab(container) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h2 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3);" data-i18n="account.tab_reviews">
      ${getTranslation('account.tab_reviews') || 'আমার রিভিউসমূহ (My Reviews)'}
    </h2>
  `;

  const emptyState = createEmptyState({
    icon: '⭐',
    titleBn: 'এখনো কোনো রিভিউ নেই',
    titleEn: 'No reviews yet.',
    subBn: 'ক্রয়কৃত পণ্যের অভিজ্ঞতা শেয়ার করতে পরে রিভিউ দিন।',
    subEn: 'You have not reviewed any products yet.'
  });

  card.appendChild(emptyState);
  container.appendChild(card);
}

function renderNotificationsTab(container) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h2 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3);" data-i18n="account.tab_notifications">
      ${getTranslation('account.tab_notifications') || 'নোটিফিকেশন (Notifications)'}
    </h2>
  `;

  const emptyState = createEmptyState({
    icon: '🔔',
    titleBn: 'কোনো নোটিফিকেশন নেই',
    titleEn: 'No notifications.',
    subBn: 'আপনার অর্ডারের সর্বশেষ আপডেট এবং অফারের তথ্য এখানে আসবে।',
    subEn: 'Order updates and account alerts will be notified here.'
  });

  card.appendChild(emptyState);
  container.appendChild(card);
}

function renderSettingsTab(container, user, profile) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = 'var(--space-6)';

  card.innerHTML = `
    <h2 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); padding-bottom: var(--space-3);" data-i18n="account.tab_settings">
      ${getTranslation('account.tab_settings') || 'একাউন্ট সেটিংস (Account Settings)'}
    </h2>

    <div style="display: flex; flex-direction: column; gap: var(--space-4); max-width: 500px;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3); background: var(--color-bg); border-radius: var(--radius-md);">
        <div>
          <strong>🌐 ${getTranslation('account.preferred_lang') || 'পছন্দনীয় ভাষা (Language)'}</strong>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Bangla / English</p>
        </div>
        <button id="settings-lang-toggle" class="btn btn-outline btn-sm">
          ${getCurrentLanguage() === 'bn' ? 'English' : 'বাংলা'}
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3); background: var(--color-bg); border-radius: var(--radius-md);">
        <div>
          <strong>🌙 ${getTranslation('account.theme') || 'থিম (Theme)'}</strong>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Light / Dark Mode</p>
        </div>
        <button id="settings-theme-toggle" class="btn btn-outline btn-sm">
          Toggle Theme
        </button>
      </div>
    </div>
  `;

  container.appendChild(card);

  card.querySelector('#settings-lang-toggle').addEventListener('click', toggleLanguage);
  card.querySelector('#settings-theme-toggle').addEventListener('click', toggleTheme);
}
