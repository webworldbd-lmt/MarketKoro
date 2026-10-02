/**
 * Seller UI & Application Modal for MarketKoro
 * Handles "Become a Seller" view, registration form, image upload, duplicate check, and status views.
 */

import { getTranslation } from '../i18n/i18n.js';
import { createModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { openLoginModal } from '../auth/auth-ui.js';
import {
  getSellerApplication,
  submitSellerApplication,
  generateStoreSlug
} from './seller-service.js';
import { uploadImage, validateImageFile } from '../utils/image-uploader.js';

let activeSellerModalBackdrop = null;

// Divisions of Bangladesh
const BANGLADESH_DIVISIONS = [
  'Dhaka', 'Chattogram', 'Rajshahi', 'Khulna',
  'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh'
];

/**
 * Main Entry: Open Become a Seller Modal or Status View
 * @param {Object} user - Firebase Auth User
 * @param {Object} profile - User Profile Document
 */
export async function openBecomeSellerModal(user, profile) {
  if (activeSellerModalBackdrop) closeModal(activeSellerModalBackdrop);

  if (!user) {
    showToast(getTranslation('seller.login_required_msg') || "Please log in first to apply as a seller.", 'warning');
    openLoginModal();
    return;
  }

  // Create modal layout shell with loading state
  const container = document.createElement('div');
  container.className = 'seller-app-container';
  container.innerHTML = `
    <div class="state-container">
      <div class="loading-spinner"></div>
      <p style="margin-top: var(--space-3); color: var(--color-text-muted);">${getTranslation('common.loading')}</p>
    </div>
  `;

  activeSellerModalBackdrop = createModal({
    title: getTranslation('seller.become_seller_title') || "Become a Seller",
    bodyContent: container
  });

  try {
    const application = await getSellerApplication(user.uid);

    if (application) {
      renderApplicationStatusView(container, application, user, profile);
    } else {
      renderRegistrationForm(container, user, profile);
    }
  } catch (err) {
    console.error("Error loading seller status:", err);
    container.innerHTML = `
      <div class="state-container">
        <div class="state-icon">⚠️</div>
        <p>${getTranslation('common.error_occurred')}</p>
      </div>
    `;
  }
}

/**
 * Render Application Status View (Pending, Approved, Rejected, Suspended)
 */
function renderApplicationStatusView(container, application, user, profile) {
  const status = application.status || 'pending';
  const storeName = application.storeName || 'My Store';
  const storeSlug = application.storeSlug || '';
  const rejectionReason = application.rejectionReason || '';

  if (status === 'pending') {
    container.innerHTML = `
      <div class="card" style="padding: var(--space-6); text-align: center; background-color: var(--color-bg);">
        <div style="font-size: 3rem; margin-bottom: var(--space-2);">⏳</div>
        <span class="badge badge-secondary" style="align-self: center; margin-bottom: var(--space-3); padding: 4px 12px; font-size: 0.9rem;">
          ${getTranslation('seller.status_pending') || "Application Pending Review"}
        </span>
        <h3 style="margin-bottom: var(--space-2);">${storeName}</h3>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); max-width: 440px; margin: 0 auto var(--space-4);">
          ${getTranslation('seller.pending_desc') || "Your seller application has been submitted and is currently being reviewed by the MarketKoro Verification Team. Verification usually takes 24-48 business hours."}
        </p>

        <div class="profile-details-list" style="margin-bottom: var(--space-4); text-align: left;">
          <div class="profile-detail-item">
            <strong>${getTranslation('seller.store_name') || "Store Name"}:</strong> <span>${storeName}</span>
          </div>
          <div class="profile-detail-item">
            <strong>${getTranslation('seller.store_slug') || "Store Slug"}:</strong> <span>seller.${storeSlug || 'marketkoro'}</span>
          </div>
          <div class="profile-detail-item">
            <strong>${getTranslation('seller.division') || "Division"}:</strong> <span>${application.division || '-'}</span>
          </div>
        </div>

        <button id="close-status-modal-btn" class="btn btn-outline btn-full">
          ${getTranslation('common.close')}
        </button>
      </div>
    `;
    container.querySelector('#close-status-modal-btn').addEventListener('click', () => {
      closeModal(activeSellerModalBackdrop);
    });
  } else if (status === 'approved') {
    container.innerHTML = `
      <div class="card" style="padding: var(--space-6); text-align: center; background-color: var(--color-bg);">
        <div style="font-size: 3rem; margin-bottom: var(--space-2);">🎉</div>
        <span class="badge badge-primary" style="align-self: center; margin-bottom: var(--space-3); padding: 4px 12px; font-size: 0.9rem; background-color: var(--color-success-bg); color: var(--color-success);">
          ✔ ${getTranslation('seller.status_approved') || "Verified Seller"}
        </span>
        <h3 style="margin-bottom: var(--space-2);">${storeName}</h3>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-5);">
          ${getTranslation('seller.approved_desc') || "Congratulations! Your MarketKoro Seller Application is approved. You can now access your Seller Dashboard."}
        </p>

        <button id="open-dashboard-btn" class="btn btn-primary btn-full" style="margin-bottom: var(--space-3);">
          🏪 ${getTranslation('seller.dashboard_btn') || "Go to Seller Dashboard"}
        </button>

        <button id="close-approved-modal-btn" class="btn btn-outline btn-full">
          ${getTranslation('common.close')}
        </button>
      </div>
    `;
    container.querySelector('#open-dashboard-btn').addEventListener('click', () => {
      closeModal(activeSellerModalBackdrop);
      window.location.href = 'seller.html';
    });
    container.querySelector('#close-approved-modal-btn').addEventListener('click', () => {
      closeModal(activeSellerModalBackdrop);
    });
  } else if (status === 'rejected') {
    container.innerHTML = `
      <div class="card" style="padding: var(--space-6); text-align: center; background-color: var(--color-bg);">
        <div style="font-size: 3rem; margin-bottom: var(--space-2);">❌</div>
        <span class="badge" style="align-self: center; margin-bottom: var(--space-3); padding: 4px 12px; font-size: 0.9rem; background-color: var(--color-error-bg); color: var(--color-error);">
          ${getTranslation('seller.status_rejected') || "Application Declined"}
        </span>
        <h3 style="margin-bottom: var(--space-2);">${storeName}</h3>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-4);">
          ${getTranslation('seller.rejected_desc') || "Unfortunately, your seller application was not approved at this time."}
        </p>

        ${rejectionReason ? `
          <div style="background-color: var(--color-error-bg); color: var(--color-error); padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--font-size-xs); margin-bottom: var(--space-4); text-align: left;">
            <strong>${getTranslation('seller.rejection_reason_label') || "Reason"}:</strong> ${rejectionReason}
          </div>
        ` : ''}

        <button id="reapply-seller-btn" class="btn btn-primary btn-full" style="margin-bottom: var(--space-3);">
          🔄 ${getTranslation('seller.reapply_btn') || "Update & Resubmit Application"}
        </button>

        <button id="close-rejected-modal-btn" class="btn btn-outline btn-full">
          ${getTranslation('common.close')}
        </button>
      </div>
    `;
    container.querySelector('#reapply-seller-btn').addEventListener('click', () => {
      renderRegistrationForm(container, user, profile, application);
    });
    container.querySelector('#close-rejected-modal-btn').addEventListener('click', () => {
      closeModal(activeSellerModalBackdrop);
    });
  } else if (status === 'suspended') {
    container.innerHTML = `
      <div class="card" style="padding: var(--space-6); text-align: center; background-color: var(--color-bg);">
        <div style="font-size: 3rem; margin-bottom: var(--space-2);">🚫</div>
        <span class="badge" style="align-self: center; margin-bottom: var(--space-3); padding: 4px 12px; font-size: 0.9rem; background-color: var(--color-error-bg); color: var(--color-error);">
          ${getTranslation('seller.status_suspended') || "Account Suspended"}
        </span>
        <h3 style="margin-bottom: var(--space-2);">${storeName}</h3>
        <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-4);">
          ${getTranslation('seller.suspended_desc') || "This seller account has been suspended due to policy violations or admin restrictions. Please contact MarketKoro merchant support for details."}
        </p>

        <button id="close-suspended-modal-btn" class="btn btn-outline btn-full">
          ${getTranslation('common.close')}
        </button>
      </div>
    `;
    container.querySelector('#close-suspended-modal-btn').addEventListener('click', () => {
      closeModal(activeSellerModalBackdrop);
    });
  }
}

/**
 * Render Seller Registration Form
 */
function renderRegistrationForm(container, user, profile, existingData = null) {
  const defaultFullName = existingData?.fullName || profile?.fullName || user?.displayName || '';
  const defaultEmail = existingData?.email || profile?.email || user?.email || '';
  const defaultPhone = existingData?.phone || profile?.phone || user?.phoneNumber || '';

  container.innerHTML = `
    <div style="margin-bottom: var(--space-4); padding: var(--space-3); background-color: var(--color-primary-light); border-radius: var(--radius-md); font-size: var(--font-size-xs); color: var(--color-primary-hover);">
      ℹ️ <strong>${getTranslation('seller.guidelines_title') || "Seller Application Guidelines"}</strong>:
      ${getTranslation('seller.guidelines_text') || "Submit real business details. Once submitted, MarketKoro admins will review your store application. Access is granted only after approval."}
    </div>

    <form id="seller-registration-form" class="auth-form" novalidate>
      <div id="seller-alert" class="auth-alert" style="display: none;"></div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.full_name')} *</label>
        <input type="text" id="seller-fullname" class="form-input" value="${defaultFullName}" required>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.email')} *</label>
        <input type="email" id="seller-email" class="form-input" value="${defaultEmail}" required>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.phone')} *</label>
        <input type="tel" id="seller-phone" class="form-input" placeholder="+8801700000000" value="${defaultPhone}" required>
      </div>

      <hr style="border: 0; border-top: 1px solid var(--color-border); margin: var(--space-4) 0;">

      <div class="form-group">
        <label class="form-label">${getTranslation('seller.store_name') || "Business / Store Name"} *</label>
        <input type="text" id="seller-store-name" class="form-input" placeholder="${getTranslation('seller.store_name_placeholder') || "e.g., Tangail Weavers"}" value="${existingData?.storeName || ''}" required>
        <small id="slug-preview-text" style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 2px;">
          Identifier: <span id="slug-preview" style="font-weight: 600;">${existingData?.storeSlug || 'store-name'}</span>
        </small>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('seller.store_desc') || "Store Description"}</label>
        <textarea id="seller-store-desc" class="form-input" rows="3" placeholder="${getTranslation('seller.store_desc_placeholder') || "Describe your products and store..."}">${existingData?.storeDescription || ''}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('seller.business_address') || "Business Address"} *</label>
        <input type="text" id="seller-address" class="form-input" placeholder="House/Shop no, Road, Area" value="${existingData?.businessAddress || ''}" required>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-3);">
        <div class="form-group">
          <label class="form-label">${getTranslation('seller.division') || "Division"} *</label>
          <select id="seller-division" class="form-input" required>
            <option value="">${getTranslation('seller.select_division') || "Select Division"}</option>
            ${BANGLADESH_DIVISIONS.map(div => `
              <option value="${div}" ${existingData?.division === div ? 'selected' : ''}>${div}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">${getTranslation('seller.district') || "District"} *</label>
          <input type="text" id="seller-district" class="form-input" placeholder="e.g. Dhaka" value="${existingData?.district || ''}" required>
        </div>

        <div class="form-group">
          <label class="form-label">${getTranslation('seller.upazila') || "Upazila/Area"} *</label>
          <input type="text" id="seller-upazila" class="form-input" placeholder="e.g. Mirpur" value="${existingData?.upazila || ''}" required>
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid var(--color-border); margin: var(--space-4) 0;">

      <!-- Store Logo Upload -->
      <div class="form-group">
        <label class="form-label">${getTranslation('seller.store_logo') || "Store Logo"} (Max 2MB, JPEG/PNG/WebP)</label>
        <input type="file" id="seller-logo-file" class="form-input" accept="image/jpeg,image/png,image/webp">
        <div id="logo-preview-container" style="margin-top: var(--space-2); display: flex; align-items: center; gap: var(--space-2);">
          ${existingData?.storeLogo ? `<img src="${existingData.storeLogo}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">` : ''}
        </div>
      </div>

      <!-- Store Banner Upload -->
      <div class="form-group">
        <label class="form-label">${getTranslation('seller.store_banner') || "Store Banner"} (Max 2MB, JPEG/PNG/WebP)</label>
        <input type="file" id="seller-banner-file" class="form-input" accept="image/jpeg,image/png,image/webp">
        <div id="banner-preview-container" style="margin-top: var(--space-2);">
          ${existingData?.storeBanner ? `<img src="${existingData.storeBanner}" style="width: 100%; height: 60px; border-radius: var(--radius-md); object-fit: cover;">` : ''}
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid var(--color-border); margin: var(--space-4) 0;">

      <!-- Social & Contact -->
      <div class="form-group">
        <label class="form-label">${getTranslation('seller.social_facebook') || "Facebook Page URL"}</label>
        <input type="url" id="seller-facebook" class="form-input" placeholder="https://facebook.com/yourstore" value="${existingData?.socialLinks?.facebook || ''}">
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('seller.contact_phone') || "Seller Contact Number"}</label>
        <input type="tel" id="seller-contact-phone" class="form-input" placeholder="+8801..." value="${existingData?.contactPhone || defaultPhone}">
      </div>

      <button type="submit" id="seller-submit-btn" class="btn btn-primary btn-full" style="margin-top: var(--space-4);">
        📝 ${getTranslation('seller.submit_app_btn') || "Submit Seller Application"}
      </button>
    </form>
  `;

  // Store Name Slug Live Preview Event
  const storeNameInput = container.querySelector('#seller-store-name');
  const slugPreviewEl = container.querySelector('#slug-preview');

  storeNameInput.addEventListener('input', () => {
    const slug = generateStoreSlug(storeNameInput.value);
    slugPreviewEl.textContent = slug || 'store-name';
  });

  // Handle Form Submission
  const form = container.querySelector('#seller-registration-form');
  const alertEl = container.querySelector('#seller-alert');
  const submitBtn = container.querySelector('#seller-submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertEl.style.display = 'none';

    const fullName = container.querySelector('#seller-fullname').value.trim();
    const email = container.querySelector('#seller-email').value.trim();
    const phone = container.querySelector('#seller-phone').value.trim();
    const storeName = storeNameInput.value.trim();
    const storeDescription = container.querySelector('#seller-store-desc').value.trim();
    const businessAddress = container.querySelector('#seller-address').value.trim();
    const division = container.querySelector('#seller-division').value;
    const district = container.querySelector('#seller-district').value.trim();
    const upazila = container.querySelector('#seller-upazila').value.trim();
    const logoFile = container.querySelector('#seller-logo-file').files[0];
    const bannerFile = container.querySelector('#seller-banner-file').files[0];
    const facebook = container.querySelector('#seller-facebook').value.trim();
    const contactPhone = container.querySelector('#seller-contact-phone').value.trim();

    // Validations
    if (!fullName || !email || !phone || !storeName || !businessAddress || !division || !district || !upazila) {
      alertEl.textContent = getTranslation('seller.error_required_fields') || "Please fill in all required fields marked with *.";
      alertEl.style.display = 'block';
      return;
    }

    if (logoFile) {
      const val = validateImageFile(logoFile);
      if (!val.valid) {
        alertEl.textContent = `Logo Image Error: ${val.error}`;
        alertEl.style.display = 'block';
        return;
      }
    }

    if (bannerFile) {
      const val = validateImageFile(bannerFile);
      if (!val.valid) {
        alertEl.textContent = `Banner Image Error: ${val.error}`;
        alertEl.style.display = 'block';
        return;
      }
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = getTranslation('common.loading');

      let logoUrl = existingData?.storeLogo || '';
      let bannerUrl = existingData?.storeBanner || '';

      if (logoFile) {
        logoUrl = await uploadImage(logoFile);
      }
      if (bannerFile) {
        bannerUrl = await uploadImage(bannerFile);
      }

      const applicationData = {
        fullName,
        email,
        phone,
        storeName,
        storeDescription,
        businessAddress,
        division,
        district,
        upazila,
        storeLogo: logoUrl,
        storeBanner: bannerUrl,
        socialLinks: { facebook },
        contactPhone
      };

      const resultApp = await submitSellerApplication(user.uid, applicationData);

      showToast(getTranslation('seller.submitted_success_msg') || "Seller application submitted successfully!", 'success');

      renderApplicationStatusView(container, resultApp, user, profile);
    } catch (err) {
      console.error("Seller registration error:", err);
      submitBtn.disabled = false;
      submitBtn.textContent = getTranslation('seller.submit_app_btn') || "Submit Seller Application";
      alertEl.textContent = err.message || getTranslation('common.error_occurred');
      alertEl.style.display = 'block';
    }
  });
}
