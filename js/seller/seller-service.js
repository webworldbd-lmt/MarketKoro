/**
 * Seller Service for MarketKoro
 * Handles Firestore CRUD for Seller Applications & Seller Profiles securely.
 */

import { db } from '../../config/firebase.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Convert string to safe store URL slug
 * @param {string} text
 * @returns {string}
 */
export function generateStoreSlug(text) {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Fetch seller application for a given UID
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export async function getSellerApplication(uid) {
  if (!uid) return null;
  try {
    const docRef = doc(db, 'seller_applications', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.error("Error fetching seller application:", err);
    return null;
  }
}

/**
 * Check if a store slug is already registered or applied for
 * @param {string} slug
 * @param {string} currentUid
 * @returns {Promise<boolean>} True if slug is available, false if taken
 */
export async function checkSlugAvailability(slug, currentUid) {
  if (!slug) return false;
  try {
    const q = query(
      collection(db, 'seller_applications'),
      where('storeSlug', '==', slug)
    );
    const querySnap = await getDocs(q);
    let taken = false;
    querySnap.forEach((docSnap) => {
      if (docSnap.id !== currentUid) {
        taken = true;
      }
    });
    return !taken;
  } catch (err) {
    console.error("Error checking slug availability:", err);
    return true; // Allow submission if offline/query restricted
  }
}

/**
 * Submit a new Seller Application
 * @param {string} uid
 * @param {Object} formData
 */
export async function submitSellerApplication(uid, formData) {
  if (!uid) throw new Error("User authentication required.");

  // Check slug uniqueness
  const slug = generateStoreSlug(formData.storeName);
  const isSlugFree = await checkSlugAvailability(slug, uid);
  if (!isSlugFree) {
    throw new Error(`Store name/slug "${slug}" is already registered. Please choose a different store name.`);
  }

  const appRef = doc(db, 'seller_applications', uid);

  const applicationData = {
    uid: uid,
    fullName: formData.fullName || '',
    email: formData.email || '',
    phone: formData.phone || '',
    storeName: formData.storeName || '',
    storeSlug: slug,
    storeDescription: formData.storeDescription || '',
    businessAddress: formData.businessAddress || '',
    division: formData.division || '',
    district: formData.district || '',
    upazila: formData.upazila || '',
    storeLogo: formData.storeLogo || '',
    storeBanner: formData.storeBanner || '',
    socialLinks: {
      facebook: formData.socialLinks?.facebook || '',
      instagram: formData.socialLinks?.instagram || '',
      website: formData.socialLinks?.website || ''
    },
    contactPhone: formData.contactPhone || formData.phone || '',
    status: 'pending', // Initial status strictly pending
    rejectionReason: null,

    // Scalable profile foundation placeholders
    ownerInfo: {
      fullName: formData.fullName || '',
      email: formData.email || '',
      phone: formData.phone || ''
    },
    rating: 0,
    reviewsCount: 0,
    productsCount: 0,
    wallet: {
      balance: 0,
      pendingWithdrawal: 0
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(appRef, applicationData);
  return applicationData;
}

/**
 * Fetch all seller applications (Admin function)
 * @returns {Promise<Array>}
 */
export async function getAllSellerApplications() {
  try {
    const q = collection(db, 'seller_applications');
    const querySnap = await getDocs(q);
    const applications = [];
    querySnap.forEach((docSnap) => {
      applications.push(docSnap.data());
    });
    return applications;
  } catch (err) {
    console.error("Error fetching all applications:", err);
    return [];
  }
}

/**
 * Update Seller Profile (Self-service by approved seller)
 * @param {string} uid
 * @param {Object} updateData
 */
export async function updateSellerProfile(uid, updateData) {
  if (!uid) throw new Error("User authentication required.");

  const appRef = doc(db, 'seller_applications', uid);
  const existingApp = await getSellerApplication(uid);

  if (!existingApp) {
    throw new Error("Seller record not found.");
  }

  // Handle store slug update if requested
  let newSlug = existingApp.storeSlug;
  if (updateData.storeName && updateData.storeSlug) {
    const formattedSlug = generateStoreSlug(updateData.storeSlug);
    if (!formattedSlug) {
      throw new Error("Invalid store slug format.");
    }
    if (formattedSlug !== existingApp.storeSlug) {
      const isAvailable = await checkSlugAvailability(formattedSlug, uid);
      if (!isAvailable) {
        throw new Error(`Store slug "${formattedSlug}" is already taken by another seller.`);
      }
      newSlug = formattedSlug;
    }
  }

  const profilePayload = {
    fullName: updateData.fullName !== undefined ? updateData.fullName : existingApp.fullName,
    phone: updateData.phone !== undefined ? updateData.phone : existingApp.phone,
    storeName: updateData.storeName !== undefined ? updateData.storeName : existingApp.storeName,
    storeSlug: newSlug,
    storeDescription: updateData.storeDescription !== undefined ? updateData.storeDescription : (existingApp.storeDescription || ''),
    businessAddress: updateData.businessAddress !== undefined ? updateData.businessAddress : (existingApp.businessAddress || ''),
    division: updateData.division !== undefined ? updateData.division : (existingApp.division || ''),
    district: updateData.district !== undefined ? updateData.district : (existingApp.district || ''),
    upazila: updateData.upazila !== undefined ? updateData.upazila : (existingApp.upazila || ''),
    storeLogo: updateData.storeLogo !== undefined ? updateData.storeLogo : (existingApp.storeLogo || ''),
    storeBanner: updateData.storeBanner !== undefined ? updateData.storeBanner : (existingApp.storeBanner || ''),
    socialLinks: {
      facebook: updateData.socialLinks?.facebook !== undefined ? updateData.socialLinks.facebook : (existingApp.socialLinks?.facebook || ''),
      instagram: updateData.socialLinks?.instagram !== undefined ? updateData.socialLinks.instagram : (existingApp.socialLinks?.instagram || ''),
      website: updateData.socialLinks?.website !== undefined ? updateData.socialLinks.website : (existingApp.socialLinks?.website || '')
    },
    contactPhone: updateData.contactPhone !== undefined ? updateData.contactPhone : (existingApp.contactPhone || existingApp.phone || ''),
    ownerInfo: {
      fullName: updateData.fullName || existingApp.ownerInfo?.fullName || existingApp.fullName || '',
      email: existingApp.ownerInfo?.email || existingApp.email || '',
      phone: updateData.phone || existingApp.ownerInfo?.phone || existingApp.phone || ''
    },
    updatedAt: serverTimestamp()
  };

  await updateDoc(appRef, profilePayload);

  // Sync basic profile details to user document if modified
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    fullName: profilePayload.fullName,
    phone: profilePayload.phone,
    updatedAt: serverTimestamp()
  }).catch((err) => console.warn("Optional user profile sync warning:", err));

  return profilePayload;
}

/**
 * Fetch Public Approved Seller Store by Slug
 * @param {string} slug
 * @returns {Promise<Object|null>}
 */
export async function getPublicSellerStoreBySlug(slug) {
  if (!slug) return null;
  try {
    const q = query(
      collection(db, 'seller_applications'),
      where('storeSlug', '==', slug),
      where('status', '==', 'approved')
    );
    const querySnap = await getDocs(q);
    let foundStore = null;
    querySnap.forEach((docSnap) => {
      foundStore = docSnap.data();
    });
    return foundStore;
  } catch (err) {
    console.error("Error fetching store by slug:", err);
    return null;
  }
}

/**
 * Fetch Public Approved Seller Store by UID
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export async function getPublicSellerStoreByUid(uid) {
  if (!uid) return null;
  try {
    const docRef = doc(db, 'seller_applications', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === 'approved') {
        return data;
      }
    }
    return null;
  } catch (err) {
    console.error("Error fetching store by uid:", err);
    return null;
  }
}

/**
 * Update Seller Application status & User Role (Admin function)
 * @param {string} targetUid
 * @param {'approved'|'rejected'|'suspended'|'pending'} newStatus
 * @param {string} [rejectionReason]
 */
export async function updateSellerApplicationStatus(targetUid, newStatus, rejectionReason = '') {
  if (!targetUid) throw new Error("Target UID required.");

  const appRef = doc(db, 'seller_applications', targetUid);
  const userRef = doc(db, 'users', targetUid);

  const updateData = {
    status: newStatus,
    updatedAt: serverTimestamp()
  };

  if (newStatus === 'rejected') {
    updateData.rejectionReason = rejectionReason || 'Application did not meet MarketKoro seller guidelines.';
  } else if (newStatus === 'approved') {
    updateData.rejectionReason = null;
  }

  await updateDoc(appRef, updateData);

  // Sync user profile role securely if approved or demoted
  if (newStatus === 'approved') {
    await updateDoc(userRef, {
      role: 'seller',
      updatedAt: serverTimestamp()
    });
  } else if (newStatus === 'rejected' || newStatus === 'suspended') {
    await updateDoc(userRef, {
      role: 'customer',
      updatedAt: serverTimestamp()
    });
  }
}
