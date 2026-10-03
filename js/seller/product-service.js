/**
 * Product Service for MarketKoro
 * Handles Firestore CRUD for Seller Products securely.
 */

import { db } from '../../config/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Generate a clean URL-friendly slug supporting Bangla and English
 * @param {string} text
 * @returns {string}
 */
export function generateProductSlug(text) {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0980-\u09FF\s-]+/g, '') // Keep alphanumeric, spaces, hyphens and Bengali characters
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Escape/Sanitize input string to prevent HTML/script injection
 * @param {string} str
 * @returns {string}
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate product payload
 * @param {Object} data
 */
export function validateProductData(data) {
  const name = (data.name || '').trim();
  if (!name) {
    throw new Error("Product name is required.");
  }
  if (name.length < 2 || name.length > 200) {
    throw new Error("Product name must be between 2 and 200 characters.");
  }

  const price = Number(data.price);
  if (isNaN(price) || price < 0) {
    throw new Error("Product price must be a non-negative number.");
  }

  if (data.compareAtPrice !== undefined && data.compareAtPrice !== null && data.compareAtPrice !== '') {
    const compareAt = Number(data.compareAtPrice);
    if (isNaN(compareAt) || compareAt < 0) {
      throw new Error("Compare-at price must be a non-negative number.");
    }
    if (compareAt > 0 && compareAt < price) {
      throw new Error("Compare-at price cannot be less than regular price.");
    }
  }

  const stockQuantity = Number(data.stockQuantity);
  if (isNaN(stockQuantity) || stockQuantity < 0 || !Number.isInteger(stockQuantity)) {
    throw new Error("Stock quantity must be a non-negative whole integer.");
  }

  if (data.shortDescription && data.shortDescription.length > 500) {
    throw new Error("Short description cannot exceed 500 characters.");
  }

  if (data.description && data.description.length > 5000) {
    throw new Error("Product description cannot exceed 5000 characters.");
  }

  if (data.images && (!Array.isArray(data.images) || data.images.length > 5)) {
    throw new Error("You can upload a maximum of 5 product images.");
  }
}

/**
 * Create a new Product in Firestore
 * @param {string} sellerUid - Authenticated Seller UID
 * @param {Object} productData
 * @param {Object} storeInfo - { storeSlug, storeName }
 * @returns {Promise<Object>}
 */
export async function createProduct(sellerUid, productData, storeInfo = {}) {
  if (!sellerUid) throw new Error("Seller authentication required.");

  validateProductData(productData);

  const productRef = doc(collection(db, 'products'));
  const productId = productRef.id;

  const rawName = productData.name.trim();
  const rawSlug = generateProductSlug(rawName) || `prod-${productId.slice(0, 8)}`;

  const price = Number(productData.price);
  const compareAtPrice = productData.compareAtPrice ? Number(productData.compareAtPrice) : 0;
  const stockQuantity = Number(productData.stockQuantity);

  const newProduct = {
    productId: productId,
    sellerId: sellerUid,
    storeId: sellerUid,
    storeSlug: storeInfo.storeSlug || '',
    storeName: storeInfo.storeName || '',
    name: sanitizeString(rawName),
    slug: rawSlug,
    shortDescription: sanitizeString((productData.shortDescription || '').trim()),
    description: sanitizeString((productData.description || '').trim()),
    categoryId: productData.categoryId || 'uncategorized',
    categoryName: productData.categoryName || 'General',
    price: price,
    compareAtPrice: compareAtPrice,
    stockQuantity: stockQuantity,
    sku: sanitizeString((productData.sku || '').trim()),
    images: Array.isArray(productData.images) ? productData.images : [],
    status: productData.status || 'published', // 'published', 'draft', 'pending'
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(productRef, newProduct);

  // Safely update product count on seller application
  try {
    const sellerAppRef = doc(db, 'seller_applications', sellerUid);
    const sellerSnap = await getDoc(sellerAppRef);
    if (sellerSnap.exists()) {
      const currentCount = Number(sellerSnap.data().productsCount) || 0;
      await updateDoc(sellerAppRef, {
        productsCount: currentCount + 1,
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn("Could not sync productsCount on seller application:", err);
  }

  return newProduct;
}

/**
 * Fetch products belonging strictly to a seller
 * @param {string} sellerUid
 * @returns {Promise<Array>}
 */
export async function getSellerProducts(sellerUid) {
  if (!sellerUid) return [];

  try {
    const q = query(
      collection(db, 'products'),
      where('sellerId', '==', sellerUid)
    );
    const snap = await getDocs(q);
    const products = [];
    snap.forEach((docSnap) => {
      products.push(docSnap.data());
    });

    // Client-side sort by updatedAt / createdAt descending
    products.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
      const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
      return timeB - timeA;
    });

    return products;
  } catch (err) {
    console.error("Error fetching seller products:", err);
    return [];
  }
}

/**
 * Fetch a single product by ID
 * @param {string} productId
 * @returns {Promise<Object|null>}
 */
export async function getProductById(productId) {
  if (!productId) return null;
  try {
    const ref = doc(db, 'products', productId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.error("Error fetching product by ID:", err);
    return null;
  }
}

/**
 * Update a seller product securely
 * @param {string} productId
 * @param {string} sellerUid
 * @param {Object} updateData
 */
export async function updateProduct(productId, sellerUid, updateData) {
  if (!productId || !sellerUid) throw new Error("Invalid request.");

  const productRef = doc(db, 'products', productId);
  const snap = await getDoc(productRef);

  if (!snap.exists()) {
    throw new Error("Product not found.");
  }

  const existingProduct = snap.data();
  if (existingProduct.sellerId !== sellerUid) {
    throw new Error("Unauthorized: You do not own this product.");
  }

  // Merge with existing data for validation
  const mergedForValidation = {
    name: updateData.name !== undefined ? updateData.name : existingProduct.name,
    price: updateData.price !== undefined ? updateData.price : existingProduct.price,
    compareAtPrice: updateData.compareAtPrice !== undefined ? updateData.compareAtPrice : existingProduct.compareAtPrice,
    stockQuantity: updateData.stockQuantity !== undefined ? updateData.stockQuantity : existingProduct.stockQuantity,
    shortDescription: updateData.shortDescription !== undefined ? updateData.shortDescription : existingProduct.shortDescription,
    description: updateData.description !== undefined ? updateData.description : existingProduct.description,
    images: updateData.images !== undefined ? updateData.images : existingProduct.images
  };

  validateProductData(mergedForValidation);

  const rawName = (mergedForValidation.name || '').trim();
  const rawSlug = generateProductSlug(rawName) || existingProduct.slug;

  const payload = {
    name: sanitizeString(rawName),
    slug: rawSlug,
    price: Number(mergedForValidation.price),
    compareAtPrice: mergedForValidation.compareAtPrice ? Number(mergedForValidation.compareAtPrice) : 0,
    stockQuantity: Number(mergedForValidation.stockQuantity),
    categoryId: updateData.categoryId !== undefined ? updateData.categoryId : existingProduct.categoryId,
    categoryName: updateData.categoryName !== undefined ? updateData.categoryName : existingProduct.categoryName,
    sku: updateData.sku !== undefined ? sanitizeString(updateData.sku) : existingProduct.sku,
    shortDescription: sanitizeString(mergedForValidation.shortDescription),
    description: sanitizeString(mergedForValidation.description),
    images: Array.isArray(updateData.images) ? updateData.images : existingProduct.images,
    status: updateData.status !== undefined ? updateData.status : existingProduct.status,
    sellerId: sellerUid, // Ensure ownership field is strictly unchanged
    updatedAt: serverTimestamp()
  };

  await updateDoc(productRef, payload);
  return { ...existingProduct, ...payload };
}

/**
 * Delete a product owned by seller
 * @param {string} productId
 * @param {string} sellerUid
 */
export async function deleteProduct(productId, sellerUid) {
  if (!productId || !sellerUid) throw new Error("Invalid request.");

  const productRef = doc(db, 'products', productId);
  const snap = await getDoc(productRef);

  if (!snap.exists()) {
    throw new Error("Product not found.");
  }

  const existingProduct = snap.data();
  if (existingProduct.sellerId !== sellerUid) {
    throw new Error("Unauthorized: You do not own this product.");
  }

  await deleteDoc(productRef);

  // Decrement productsCount on seller application
  try {
    const sellerAppRef = doc(db, 'seller_applications', sellerUid);
    const sellerSnap = await getDoc(sellerAppRef);
    if (sellerSnap.exists()) {
      const currentCount = Number(sellerSnap.data().productsCount) || 1;
      await updateDoc(sellerAppRef, {
        productsCount: Math.max(0, currentCount - 1),
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn("Could not sync productsCount on seller application:", err);
  }
}

/**
 * Fetch available system categories
 * @returns {Promise<Array>}
 */
export async function getSystemCategories() {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    const categories = [];
    snap.forEach((docSnap) => {
      categories.push({ id: docSnap.id, ...docSnap.data() });
    });
    return categories;
  } catch (err) {
    console.warn("No custom system categories collection found:", err);
    return [];
  }
}
