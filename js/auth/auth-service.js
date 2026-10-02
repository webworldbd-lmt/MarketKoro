/**
 * Authentication Service for MarketKoro
 * Wraps Firebase Authentication & Firestore User Profile logic securely.
 */

import { auth, db } from '../../config/firebase.js';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUserState = null;
let currentUserProfile = null;
let isAuthLoading = true;
const authListeners = new Set();

/**
 * Register listener for Auth & Profile changes
 * @param {Function} callback - Callback function receiving ({ user, profile, loading })
 */
export function onAuthChanged(callback) {
  authListeners.add(callback);
  // Trigger immediately with current state
  callback({ user: currentUserState, profile: currentUserProfile, loading: isAuthLoading });

  return () => {
    authListeners.delete(callback);
  };
}

function notifyAuthListeners() {
  authListeners.forEach((cb) => {
    try {
      cb({ user: currentUserState, profile: currentUserProfile, loading: isAuthLoading });
    } catch (err) {
      console.error("Error in auth listener callback:", err);
    }
  });
}

// Initialize Firebase Auth listener
onAuthStateChanged(auth, async (user) => {
  currentUserState = user;
  if (user) {
    try {
      currentUserProfile = await fetchOrCreateUserProfile(user);
    } catch (error) {
      console.error("Failed to load user profile:", error);
      currentUserProfile = null;
    }
  } else {
    currentUserProfile = null;
  }
  isAuthLoading = false;
  notifyAuthListeners();
});

/**
 * Fetch existing Firestore profile or initialize basic profile
 */
async function fetchOrCreateUserProfile(user, additionalData = {}) {
  if (!user || !user.uid) return null;
  const userRef = doc(db, 'users', user.uid);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data();
    }

    // Default foundation schema for scalable profile
    const newProfile = {
      uid: user.uid,
      fullName: additionalData.fullName || user.displayName || '',
      email: user.email || additionalData.email || '',
      phone: user.phoneNumber || additionalData.phone || '',
      photoURL: user.photoURL || null,
      role: 'customer', // Strictly defaulted to customer
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      // Scalable profile placeholder foundations
      addresses: [],
      wishlist: [],
      cart: [],
      accountSettings: {
        preferredLanguage: 'bn',
        notificationsEnabled: true
      }
    };

    await setDoc(userRef, newProfile);
    return newProfile;
  } catch (err) {
    console.error("Firestore user profile error:", err);
    // Fallback in-memory profile if Firestore is restricted
    return {
      uid: user.uid,
      fullName: additionalData.fullName || user.displayName || 'MarketKoro User',
      email: user.email || '',
      phone: user.phoneNumber || additionalData.phone || '',
      photoURL: user.photoURL || null,
      role: 'customer'
    };
  }
}

/**
 * Register a new customer with Email & Password
 */
export async function registerUserWithEmail({ fullName, email, phone, password }) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Set Auth display name
  if (fullName) {
    await updateProfile(user, { displayName: fullName });
  }

  // Create Firestore profile
  const profile = await fetchOrCreateUserProfile(user, { fullName, email, phone });
  currentUserProfile = profile;
  notifyAuthListeners();
  return { user, profile };
}

/**
 * Login customer with Email & Password
 */
export async function loginUserWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Login or Register with Google Popup
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  const user = userCredential.user;

  const profile = await fetchOrCreateUserProfile(user, {
    fullName: user.displayName,
    email: user.email,
    photoURL: user.photoURL
  });
  currentUserProfile = profile;
  notifyAuthListeners();
  return { user, profile };
}

/**
 * Initialize reCAPTCHA verifier for Phone Auth
 */
export function setupRecaptcha(containerId) {
  if (window.recaptchaVerifier) {
    window.recaptchaVerifier.clear();
  }
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {}
  });
  return window.recaptchaVerifier;
}

/**
 * Send Phone OTP Code
 */
export async function sendPhoneOTP(phoneNumber, appVerifier) {
  const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  return confirmationResult;
}

/**
 * Verify Phone OTP Code
 */
export async function verifyPhoneOTP(confirmationResult, otpCode, fullName = '') {
  const userCredential = await confirmationResult.confirm(otpCode);
  const user = userCredential.user;

  if (fullName && !user.displayName) {
    await updateProfile(user, { displayName: fullName });
  }

  const profile = await fetchOrCreateUserProfile(user, { fullName, phone: user.phoneNumber });
  currentUserProfile = profile;
  notifyAuthListeners();
  return { user, profile };
}

/**
 * Send Password Reset Email
 */
export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Logout User
 */
export async function logoutUser() {
  await signOut(auth);
  currentUserState = null;
  currentUserProfile = null;
  notifyAuthListeners();
}

/**
 * Get current Auth state synchronously
 */
export function getCurrentState() {
  return {
    user: currentUserState,
    profile: currentUserProfile,
    loading: isAuthLoading
  };
}
