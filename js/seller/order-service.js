/**
 * Seller Order Management Service for MarketKoro
 * Handles querying orders belonging to a specific seller, status transition control, and seller subtotal calculations.
 */

import { db } from '../../config/firebase.js';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Controlled State Transitions map for Sellers
 * Defines permitted next statuses based on current order status.
 */
export const ALLOWED_SELLER_STATUS_TRANSITIONS = {
  pending: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['ready_for_delivery', 'shipped', 'cancelled'],
  ready_for_delivery: ['shipped', 'cancelled'],
  shipped: [], // Shipped orders cannot be directly marked as Delivered by sellers (requires courier/admin confirmation)
  delivered: [],
  cancelled: [],
  returned: [],
  refunded: []
};

/**
 * Retrieves all orders containing products belonging to a specific seller.
 * @param {string} sellerUid - The authenticated seller's UID
 * @returns {Promise<Array>} Array of order documents filtered for this seller
 */
export async function getSellerOrders(sellerUid) {
  if (!sellerUid) return [];

  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('sellerIds', 'array-contains', sellerUid));
    const querySnapshot = await getDocs(q);

    const orders = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      orders.push({
        id: docSnap.id,
        ...data,
        // Convert Firestore Timestamps to JS Date if available
        createdAtDate: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date())
      });
    });

    // Sort by createdAt descending (newest first)
    orders.sort((a, b) => (b.createdAtDate || 0) - (a.createdAtDate || 0));

    return orders;
  } catch (err) {
    console.error("Error fetching seller orders:", err);
    throw new Error(err.message || "Failed to load seller orders.");
  }
}

/**
 * Calculates seller-specific items and subtotal from a multi-vendor or single-vendor order.
 * @param {Object} order - The order document
 * @param {string} sellerUid - The authenticated seller's UID
 * @returns {Object} { sellerItems: Array, sellerSubtotal: number, sellerItemCount: number }
 */
export function calculateSellerOrderTotals(order, sellerUid) {
  if (!order || !Array.isArray(order.items) || !sellerUid) {
    return { sellerItems: [], sellerSubtotal: 0, sellerItemCount: 0 };
  }

  const sellerItems = order.items.filter((item) => item.sellerId === sellerUid);

  const sellerSubtotal = sellerItems.reduce((sum, item) => {
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.quantity) || 1;
    const itemSubtotal = Number(item.subtotal) || (itemPrice * itemQty);
    return sum + itemSubtotal;
  }, 0);

  const sellerItemCount = sellerItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  return {
    sellerItems,
    sellerSubtotal,
    sellerItemCount
  };
}

/**
 * Updates order status for a seller, verifying ownership and valid status transitions.
 * @param {string} orderId - Document ID of the order
 * @param {string} sellerUid - Authenticated seller UID
 * @param {string} newStatus - Target order status
 * @returns {Promise<void>}
 */
export async function updateSellerOrderStatus(orderId, sellerUid, newStatus) {
  if (!orderId || !sellerUid || !newStatus) {
    throw new Error("Missing required order update parameters.");
  }

  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error("Order not found.");
  }

  const orderData = orderSnap.data();

  // 1. Verify Ownership
  if (!Array.isArray(orderData.sellerIds) || !orderData.sellerIds.includes(sellerUid)) {
    throw new Error("Unauthorized: You do not have permission to manage this order.");
  }

  const currentStatus = orderData.orderStatus || 'pending';

  // 2. Validate Controlled Status Transition
  const allowedTransitions = ALLOWED_SELLER_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Invalid status transition from '${currentStatus}' to '${newStatus}'.`);
  }

  // 3. Update Order Status
  const updateData = {
    orderStatus: newStatus,
    updatedAt: serverTimestamp()
  };

  // If order has per-seller statuses in multi-vendor tracking
  if (orderData.sellerStatuses) {
    updateData[`sellerStatuses.${sellerUid}`] = newStatus;
  }

  await updateDoc(orderRef, updateData);
}
