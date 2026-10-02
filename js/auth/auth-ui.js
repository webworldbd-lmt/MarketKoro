/**
 * Authentication UI & Navigation Component for MarketKoro
 * Handles Login, Register, Google Sign-In, Phone OTP, Password Reset, and Account Navigation.
 */

import { getTranslation } from '../i18n/i18n.js';
import { createModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import {
  registerUserWithEmail,
  loginUserWithEmail,
  loginWithGoogle,
  setupRecaptcha,
  sendPhoneOTP,
  verifyPhoneOTP,
  sendPasswordReset,
  logoutUser
} from './auth-service.js';
import { openBecomeSellerModal } from '../seller/seller-ui.js';
import { openSellerDashboard } from '../seller/seller-dashboard-ui.js';
import { openAdminSellerManagement } from '../seller/admin-seller-ui.js';

let activeAuthModalBackdrop = null;
let currentPhoneConfirmation = null;

/**
 * Open Login Modal
 */
export function openLoginModal() {
  if (activeAuthModalBackdrop) closeModal(activeAuthModalBackdrop);

  const container = document.createElement('div');
  container.className = 'auth-form-container';
  container.innerHTML = `
    <form id="email-login-form" class="auth-form" novalidate>
      <div id="auth-alert" class="auth-alert" style="display: none;"></div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.email')}</label>
        <input type="email" id="login-email" class="form-input" placeholder="${getTranslation('auth.email_placeholder')}" required>
      </div>

      <div class="form-group">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label class="form-label">${getTranslation('auth.password')}</label>
          <a href="#" id="forgot-password-link" class="auth-link">${getTranslation('auth.forgot_password')}</a>
        </div>
        <input type="password" id="login-password" class="form-input" placeholder="${getTranslation('auth.password_placeholder')}" required>
      </div>

      <button type="submit" id="login-submit-btn" class="btn btn-primary btn-full" style="margin-top: var(--space-4);">
        ${getTranslation('auth.login')}
      </button>
    </form>

    <div class="auth-divider">
      <span>${getTranslation('auth.or_divider')}</span>
    </div>

    <div class="auth-social-buttons">
      <button id="google-login-btn" class="btn btn-outline btn-full auth-social-btn">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.41-1.57-5.13-3.72L.97 13.01C2.46 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.87 10.8c-.18-.53-.28-1.1-.28-1.8s.1-1.27.28-1.8L.97 4.99C.35 6.22 0 7.58 0 9s.35 2.78.97 4.01l2.9-2.21z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.46 2.02.97 4.99l2.9 2.21C4.59 5.05 6.62 3.58 9 3.58z"/></svg>
        ${getTranslation('auth.sign_in_google')}
      </button>

      <button id="phone-login-switch-btn" class="btn btn-outline btn-full auth-social-btn" style="margin-top: var(--space-2);">
        📱 ${getTranslation('auth.sign_in_phone')}
      </button>
    </div>

    <div class="auth-footer-text" style="margin-top: var(--space-4); text-align: center; font-size: var(--font-size-sm);">
      ${getTranslation('auth.no_account')} <a href="#" id="switch-to-register" class="auth-link">${getTranslation('auth.register_here')}</a>
    </div>
  `;

  activeAuthModalBackdrop = createModal({
    title: getTranslation('auth.login'),
    bodyContent: container
  });

  // Event handlers
  const loginForm = container.querySelector('#email-login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#login-email').value.trim();
    const password = container.querySelector('#login-password').value;
    const alertEl = container.querySelector('#auth-alert');
    const submitBtn = container.querySelector('#login-submit-btn');

    alertEl.style.display = 'none';

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      showAlert(alertEl, getTranslation('auth.error_invalid_email'));
      return;
    }
    if (!password) {
      showAlert(alertEl, getTranslation('auth.error_password_length'));
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = getTranslation('common.loading');
      await loginUserWithEmail(email, password);
      showToast(getTranslation('auth.login_success'), 'success');
      closeModal(activeAuthModalBackdrop);
    } catch (err) {
      console.error("Login failed:", err);
      submitBtn.disabled = false;
      submitBtn.textContent = getTranslation('auth.login');
      let msg = getTranslation('auth.error_default');
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = getTranslation('auth.error_wrong_password');
      } else if (err.code === 'auth/user-not-found') {
        msg = getTranslation('auth.error_user_not_found');
      }
      showAlert(alertEl, msg);
    }
  });

  container.querySelector('#google-login-btn').addEventListener('click', async () => {
    try {
      await loginWithGoogle();
      showToast(getTranslation('auth.login_success'), 'success');
      closeModal(activeAuthModalBackdrop);
    } catch (err) {
      console.error("Google Auth failed:", err);
      showToast(getTranslation('auth.error_default'), 'error');
    }
  });

  container.querySelector('#phone-login-switch-btn').addEventListener('click', () => {
    openPhoneLoginModal();
  });

  container.querySelector('#forgot-password-link').addEventListener('click', (e) => {
    e.preventDefault();
    openForgotPasswordModal();
  });

  container.querySelector('#switch-to-register').addEventListener('click', (e) => {
    e.preventDefault();
    openRegisterModal();
  });
}

/**
 * Open Customer Registration Modal
 */
export function openRegisterModal() {
  if (activeAuthModalBackdrop) closeModal(activeAuthModalBackdrop);

  const container = document.createElement('div');
  container.className = 'auth-form-container';
  container.innerHTML = `
    <form id="customer-register-form" class="auth-form" novalidate>
      <div id="auth-alert" class="auth-alert" style="display: none;"></div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.full_name')}</label>
        <input type="text" id="reg-fullname" class="form-input" placeholder="${getTranslation('auth.full_name_placeholder')}" required>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.email')}</label>
        <input type="email" id="reg-email" class="form-input" placeholder="${getTranslation('auth.email_placeholder')}" required>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.phone')}</label>
        <input type="tel" id="reg-phone" class="form-input" placeholder="${getTranslation('auth.phone_placeholder')}">
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.password')}</label>
        <input type="password" id="reg-password" class="form-input" placeholder="${getTranslation('auth.password_placeholder')}" required>
        <div id="password-strength-indicator" class="password-strength" style="display: none; margin-top: 4px;">
          <div class="strength-bar"><div class="strength-fill" id="strength-fill"></div></div>
          <span class="strength-text" id="strength-text"></span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.confirm_password')}</label>
        <input type="password" id="reg-confirm-password" class="form-input" placeholder="${getTranslation('auth.confirm_password_placeholder')}" required>
      </div>

      <button type="submit" id="register-submit-btn" class="btn btn-primary btn-full" style="margin-top: var(--space-4);">
        ${getTranslation('auth.register')}
      </button>
    </form>

    <div class="auth-divider">
      <span>${getTranslation('auth.or_divider')}</span>
    </div>

    <div class="auth-social-buttons">
      <button id="google-reg-btn" class="btn btn-outline btn-full auth-social-btn">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.41-1.57-5.13-3.72L.97 13.01C2.46 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.87 10.8c-.18-.53-.28-1.1-.28-1.8s.1-1.27.28-1.8L.97 4.99C.35 6.22 0 7.58 0 9s.35 2.78.97 4.01l2.9-2.21z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.46 2.02.97 4.99l2.9 2.21C4.59 5.05 6.62 3.58 9 3.58z"/></svg>
        ${getTranslation('auth.sign_in_google')}
      </button>
    </div>

    <div class="auth-footer-text" style="margin-top: var(--space-4); text-align: center; font-size: var(--font-size-sm);">
      ${getTranslation('auth.already_have_account')} <a href="#" id="switch-to-login" class="auth-link">${getTranslation('auth.login_here')}</a>
    </div>
  `;

  activeAuthModalBackdrop = createModal({
    title: getTranslation('auth.register'),
    bodyContent: container
  });

  // Password Strength Checker
  const passInput = container.querySelector('#reg-password');
  const strengthInd = container.querySelector('#password-strength-indicator');
  const strengthFill = container.querySelector('#strength-fill');
  const strengthText = container.querySelector('#strength-text');

  passInput.addEventListener('input', () => {
    const val = passInput.value;
    if (!val) {
      strengthInd.style.display = 'none';
      return;
    }
    strengthInd.style.display = 'block';
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;

    if (score === 1) {
      strengthFill.style.width = '33%';
      strengthFill.style.backgroundColor = 'var(--color-error)';
      strengthText.textContent = `${getTranslation('auth.password_strength')}: ${getTranslation('auth.strength_weak')}`;
    } else if (score === 2) {
      strengthFill.style.width = '66%';
      strengthFill.style.backgroundColor = 'var(--color-warning)';
      strengthText.textContent = `${getTranslation('auth.password_strength')}: ${getTranslation('auth.strength_medium')}`;
    } else {
      strengthFill.style.width = '100%';
      strengthFill.style.backgroundColor = 'var(--color-success)';
      strengthText.textContent = `${getTranslation('auth.password_strength')}: ${getTranslation('auth.strength_strong')}`;
    }
  });

  const regForm = container.querySelector('#customer-register-form');
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = container.querySelector('#reg-fullname').value.trim();
    const email = container.querySelector('#reg-email').value.trim();
    const phone = container.querySelector('#reg-phone').value.trim();
    const password = passInput.value;
    const confirmPassword = container.querySelector('#reg-confirm-password').value;
    const alertEl = container.querySelector('#auth-alert');
    const submitBtn = container.querySelector('#register-submit-btn');

    alertEl.style.display = 'none';

    if (!fullName) {
      showAlert(alertEl, getTranslation('auth.error_name_required'));
      return;
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      showAlert(alertEl, getTranslation('auth.error_invalid_email'));
      return;
    }
    if (password.length < 6) {
      showAlert(alertEl, getTranslation('auth.error_password_length'));
      return;
    }
    if (password !== confirmPassword) {
      showAlert(alertEl, getTranslation('auth.error_password_mismatch'));
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = getTranslation('common.loading');
      await registerUserWithEmail({ fullName, email, phone, password });
      showToast(getTranslation('auth.reg_success'), 'success');
      closeModal(activeAuthModalBackdrop);
    } catch (err) {
      console.error("Registration failed:", err);
      submitBtn.disabled = false;
      submitBtn.textContent = getTranslation('auth.register');
      let msg = getTranslation('auth.error_default');
      if (err.code === 'auth/email-already-in-use') {
        msg = getTranslation('auth.error_email_in_use');
      }
      showAlert(alertEl, msg);
    }
  });

  container.querySelector('#google-reg-btn').addEventListener('click', async () => {
    try {
      await loginWithGoogle();
      showToast(getTranslation('auth.reg_success'), 'success');
      closeModal(activeAuthModalBackdrop);
    } catch (err) {
      console.error("Google Auth failed:", err);
      showToast(getTranslation('auth.error_default'), 'error');
    }
  });

  container.querySelector('#switch-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    openLoginModal();
  });
}

/**
 * Open Phone/OTP Authentication Modal
 */
export function openPhoneLoginModal() {
  if (activeAuthModalBackdrop) closeModal(activeAuthModalBackdrop);

  const container = document.createElement('div');
  container.className = 'auth-form-container';
  container.innerHTML = `
    <div id="recaptcha-container"></div>
    <form id="phone-auth-form" class="auth-form" novalidate>
      <div id="auth-alert" class="auth-alert" style="display: none;"></div>

      <div id="phone-step-1">
        <div class="form-group">
          <label class="form-label">${getTranslation('auth.phone')}</label>
          <input type="tel" id="phone-number-input" class="form-input" placeholder="+8801700000000" value="+8801" required>
        </div>

        <button type="button" id="send-otp-btn" class="btn btn-primary btn-full" style="margin-top: var(--space-4);">
          ${getTranslation('auth.send_otp')}
        </button>
      </div>

      <div id="phone-step-2" style="display: none;">
        <div class="form-group">
          <label class="form-label">${getTranslation('auth.enter_otp')}</label>
          <input type="text" id="otp-input" class="form-input" placeholder="123456" maxlength="6" required>
        </div>

        <button type="button" id="verify-otp-btn" class="btn btn-primary btn-full" style="margin-top: var(--space-4);">
          ${getTranslation('auth.verify_otp')}
        </button>

        <button type="button" id="resend-otp-btn" class="btn btn-outline btn-full" style="margin-top: var(--space-2);">
          ${getTranslation('auth.resend_otp')}
        </button>
      </div>
    </form>

    <div class="auth-footer-text" style="margin-top: var(--space-4); text-align: center; font-size: var(--font-size-sm);">
      <a href="#" id="switch-to-email-login" class="auth-link">${getTranslation('auth.sign_in_email')}</a>
    </div>
  `;

  activeAuthModalBackdrop = createModal({
    title: getTranslation('auth.sign_in_phone'),
    bodyContent: container
  });

  const alertEl = container.querySelector('#auth-alert');
  const step1 = container.querySelector('#phone-step-1');
  const step2 = container.querySelector('#phone-step-2');
  const sendOtpBtn = container.querySelector('#send-otp-btn');
  const verifyOtpBtn = container.querySelector('#verify-otp-btn');
  const phoneInput = container.querySelector('#phone-number-input');
  const otpInput = container.querySelector('#otp-input');

  let appVerifier = null;

  sendOtpBtn.addEventListener('click', async () => {
    alertEl.style.display = 'none';
    const phone = phoneInput.value.trim();

    if (!phone || !/^\+8801[3-9]\d{8}$/.test(phone)) {
      showAlert(alertEl, getTranslation('auth.error_invalid_phone'));
      return;
    }

    try {
      sendOtpBtn.disabled = true;
      sendOtpBtn.textContent = getTranslation('common.loading');

      appVerifier = setupRecaptcha('recaptcha-container');
      currentPhoneConfirmation = await sendPhoneOTP(phone, appVerifier);

      step1.style.display = 'none';
      step2.style.display = 'block';
    } catch (err) {
      console.error("Send OTP failed:", err);
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = getTranslation('auth.send_otp');
      showAlert(alertEl, getTranslation('auth.error_default'));
    }
  });

  verifyOtpBtn.addEventListener('click', async () => {
    alertEl.style.display = 'none';
    const otp = otpInput.value.trim();

    if (!otp || otp.length !== 6) {
      showAlert(alertEl, getTranslation('auth.error_otp_invalid'));
      return;
    }

    try {
      verifyOtpBtn.disabled = true;
      verifyOtpBtn.textContent = getTranslation('common.loading');

      await verifyPhoneOTP(currentPhoneConfirmation, otp);
      showToast(getTranslation('auth.login_success'), 'success');
      closeModal(activeAuthModalBackdrop);
    } catch (err) {
      console.error("OTP verification failed:", err);
      verifyOtpBtn.disabled = false;
      verifyOtpBtn.textContent = getTranslation('auth.verify_otp');
      showAlert(alertEl, getTranslation('auth.error_otp_invalid'));
    }
  });

  container.querySelector('#switch-to-email-login').addEventListener('click', (e) => {
    e.preventDefault();
    openLoginModal();
  });
}

/**
 * Open Forgot Password Modal
 */
export function openForgotPasswordModal() {
  if (activeAuthModalBackdrop) closeModal(activeAuthModalBackdrop);

  const container = document.createElement('div');
  container.className = 'auth-form-container';
  container.innerHTML = `
    <form id="forgot-pass-form" class="auth-form" novalidate>
      <div id="auth-alert" class="auth-alert" style="display: none;"></div>

      <div class="form-group">
        <label class="form-label">${getTranslation('auth.email')}</label>
        <input type="email" id="reset-email" class="form-input" placeholder="${getTranslation('auth.email_placeholder')}" required>
      </div>

      <button type="submit" id="reset-submit-btn" class="btn btn-primary btn-full" style="margin-top: var(--space-4);">
        ${getTranslation('auth.reset_password_btn')}
      </button>
    </form>

    <div class="auth-footer-text" style="margin-top: var(--space-4); text-align: center; font-size: var(--font-size-sm);">
      <a href="#" id="back-to-login" class="auth-link">${getTranslation('auth.login_here')}</a>
    </div>
  `;

  activeAuthModalBackdrop = createModal({
    title: getTranslation('auth.forgot_password'),
    bodyContent: container
  });

  const form = container.querySelector('#forgot-pass-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#reset-email').value.trim();
    const alertEl = container.querySelector('#auth-alert');
    const submitBtn = container.querySelector('#reset-submit-btn');

    alertEl.style.display = 'none';

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      showAlert(alertEl, getTranslation('auth.error_invalid_email'));
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = getTranslation('common.loading');
      await sendPasswordReset(email);
      showToast(getTranslation('auth.reset_link_sent'), 'success');
      closeModal(activeAuthModalBackdrop);
    } catch (err) {
      console.error("Reset password failed:", err);
      submitBtn.disabled = false;
      submitBtn.textContent = getTranslation('auth.reset_password_btn');
      showToast(getTranslation('auth.reset_link_sent'), 'success');
      closeModal(activeAuthModalBackdrop);
    }
  });

  container.querySelector('#back-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    openLoginModal();
  });
}

/**
 * Open Basic Profile Overview Modal
 */
export function openProfileModal(user, profile) {
  if (activeAuthModalBackdrop) closeModal(activeAuthModalBackdrop);

  const container = document.createElement('div');
  container.className = 'profile-overview-container';

  const displayName = profile?.fullName || user?.displayName || 'MarketKoro User';
  const email = profile?.email || user?.email || '-';
  const phone = profile?.phone || user?.phoneNumber || '-';
  const role = profile?.role || 'customer';

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: var(--space-4);">
      <div class="profile-avatar-large">
        ${user?.photoURL ? `<img src="${user.photoURL}" alt="Avatar">` : '👤'}
      </div>
      <h3 style="margin-top: var(--space-2); margin-bottom: var(--space-1);">${displayName}</h3>
      <span class="badge badge-primary">${getTranslation(`auth.role_${role}`) || role}</span>
    </div>

    <div class="profile-details-list">
      <div class="profile-detail-item">
        <strong>${getTranslation('auth.email')}:</strong> <span>${email}</span>
      </div>
      <div class="profile-detail-item">
        <strong>${getTranslation('auth.phone')}:</strong> <span>${phone}</span>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-4);">
      <a href="account.html" class="btn btn-primary btn-full" style="text-align: center;">
        ⚙️ ${getTranslation('nav.account')}
      </a>

      ${role === 'seller' ? `
        <button id="profile-seller-dash-btn" class="btn btn-outline btn-full">
          🏪 ${getTranslation('seller.dashboard_btn') || "Go to Seller Dashboard"}
        </button>
      ` : `
        <button id="profile-become-seller-btn" class="btn btn-secondary btn-full">
          💼 ${getTranslation('seller.become_seller_title') || "Become a Seller"}
        </button>
      `}

      ${role === 'admin' ? `
        <button id="profile-admin-mgmt-btn" class="btn btn-outline btn-full" style="border-color: var(--color-primary); color: var(--color-primary);">
          🛡️ ${getTranslation('admin.seller_mgmt_title') || "Admin Seller Management"}
        </button>
      ` : ''}
    </div>

    <button id="modal-logout-btn" class="btn btn-outline btn-full" style="margin-top: var(--space-4); color: var(--color-error); border-color: var(--color-error);">
      ${getTranslation('auth.logout')}
    </button>
  `;

  activeAuthModalBackdrop = createModal({
    title: getTranslation('auth.profile_overview'),
    bodyContent: container
  });

  container.querySelector('#profile-become-seller-btn')?.addEventListener('click', () => {
    closeModal(activeAuthModalBackdrop);
    openBecomeSellerModal(user, profile);
  });

  container.querySelector('#profile-seller-dash-btn')?.addEventListener('click', () => {
    closeModal(activeAuthModalBackdrop);
    openSellerDashboard(user, profile);
  });

  container.querySelector('#profile-admin-mgmt-btn')?.addEventListener('click', () => {
    closeModal(activeAuthModalBackdrop);
    openAdminSellerManagement(user, profile);
  });

  container.querySelector('#modal-logout-btn').addEventListener('click', async () => {
    await logoutUser();
    showToast(getTranslation('auth.logout_success'), 'info');
    closeModal(activeAuthModalBackdrop);
  });
}

function showAlert(element, message) {
  element.textContent = message;
  element.style.display = 'block';
}

/**
 * Update Header Account Button / Navigation state
 */
export function renderHeaderAccountState(accountNavEl, userState) {
  if (!accountNavEl) return;

  const { user, profile, loading } = userState;

  if (loading) {
    accountNavEl.innerHTML = `<span class="loading-spinner" style="width:1rem;height:1rem;"></span>`;
    return;
  }

  if (user) {
    const name = profile?.fullName || user.displayName || 'Account';
    accountNavEl.innerHTML = `
      <a href="account.html" id="header-user-menu-btn" class="nav-link active" aria-label="${name}">
        <span>👤 ${name.split(' ')[0]}</span>
      </a>
    `;
  } else {
    accountNavEl.innerHTML = `
      <a href="#login" id="header-login-btn" class="nav-link" aria-label="Login or Register">
        <span>🔑 ${getTranslation('auth.login')}</span>
      </a>
    `;
    const btn = accountNavEl.querySelector('#header-login-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openLoginModal();
      });
    }
  }
}
