/**
 * Seller Financial, Commission & Withdrawal Service for MarketKoro
 *
 * Implements seller earnings calculations, platform commission snapshot logic,
 * derived available balance computation, financial ledger queries, and withdrawal request processing.
 */

import { db } from '../../config/firebase.js';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getSellerOrders, calculateSellerOrderTotals } from './order-service.js';

// Global configurable default platform commission rate (5%)
export const DEFAULT_PLATFORM_COMMISSION_RATE = 0.05;

// Minimum withdrawal threshold in BDT (৳)
export const MINIMUM_WITHDRAWAL_AMOUNT = 500;

// Permitted withdrawal payout methods
export const ALLOWED_PAYOUT_METHODS = {
  bkash: { id: 'bkash', nameBn: 'বিকাশ (bKash)', nameEn: 'bKash', type: 'mobile' },
  nagad: { id: 'nagad', nameBn: 'নগদ (Nagad)', nameEn: 'Nagad', type: 'mobile' },
  bank_transfer: { id: 'bank_transfer', nameBn: 'ব্যাংক ট্রান্সফার (Bank Transfer)', nameEn: 'Bank Transfer', type: 'bank' }
};

/**
 * Calculates comprehensive financial metrics for a seller based on verified Firestore records.
 *
 * @param {string} sellerUid - Authenticated seller UID
 * @param {number} [customCommissionRate] - Optional custom platform commission rate (defaults to 0.05)
 * @returns {Promise<Object>} Financial metrics summary
 */
export async function getSellerFinancialSummary(sellerUid, customCommissionRate = DEFAULT_PLATFORM_COMMISSION_RATE) {
  if (!sellerUid) {
    return createEmptyFinancialSummary();
  }

  const commissionRate = typeof customCommissionRate === 'number' && customCommissionRate >= 0
    ? customCommissionRate
    : DEFAULT_PLATFORM_COMMISSION_RATE;

  try {
    // 1. Fetch all real orders belonging to this seller
    const orders = await getSellerOrders(sellerUid);

    let grossSales = 0;
    let totalCommission = 0;
    let totalRefunds = 0;
    let netEarnings = 0;
    let pendingEarnings = 0;

    orders.forEach((order) => {
      const { sellerSubtotal } = calculateSellerOrderTotals(order, sellerUid);
      const orderStatus = order.orderStatus || 'pending';

      // Check for per-seller specific order status if present
      const sellerSpecificStatus = order.sellerStatuses && order.sellerStatuses[sellerUid]
        ? order.sellerStatuses[sellerUid]
        : orderStatus;

      // Calculate order commission rate (use stored snapshot or fallback to system rate)
      const orderCommissionRate = typeof order.commissionRate === 'number'
        ? order.commissionRate
        : commissionRate;

      const calculatedCommission = sellerSubtotal * orderCommissionRate;

      if (sellerSpecificStatus === 'delivered') {
        // Settled & Delivered Orders
        grossSales += sellerSubtotal;
        totalCommission += calculatedCommission;

        const orderRefund = Number(order.sellerRefunds?.[sellerUid]) || 0;
        totalRefunds += orderRefund;

        const orderNet = sellerSubtotal - calculatedCommission - orderRefund;
        netEarnings += Math.max(0, orderNet);
      } else if (['pending', 'confirmed', 'processing', 'ready_for_delivery', 'shipped'].includes(sellerSpecificStatus)) {
        // Unsettled / Pending Orders
        const estimatedNet = sellerSubtotal - calculatedCommission;
        pendingEarnings += Math.max(0, estimatedNet);
      } else if (['returned', 'refunded'].includes(sellerSpecificStatus)) {
        // Explicitly refunded/returned orders
        const refundAmt = Number(order.sellerRefunds?.[sellerUid]) || sellerSubtotal;
        totalRefunds += refundAmt;
      }
    });

    // 2. Fetch withdrawal requests to compute reserved pending amount and total paid amount
    const withdrawals = await getSellerWithdrawalRequests(sellerUid);

    let pendingWithdrawals = 0; // Reserved funds (pending, under_review, approved, processing)
    let totalWithdrawn = 0;      // Fully paid withdrawals

    withdrawals.forEach((req) => {
      const amt = Number(req.amount) || 0;
      const status = req.status || 'pending';

      if (['pending', 'under_review', 'approved', 'processing'].includes(status)) {
        pendingWithdrawals += amt;
      } else if (status === 'paid') {
        totalWithdrawn += amt;
      }
    });

    // 3. Compute Available Balance (Net Earnings - Paid Withdrawals - Pending Reserved Withdrawals)
    const availableBalance = Math.max(0, netEarnings - totalWithdrawn - pendingWithdrawals);

    return {
      sellerUid,
      grossSales,
      platformCommission: totalCommission,
      refundsAndAdjustments: totalRefunds,
      netEarnings,
      pendingEarnings,
      availableBalance,
      pendingWithdrawals,
      totalWithdrawn,
      commissionRateSnapshot: commissionRate,
      orderCount: orders.length,
      deliveredOrderCount: orders.filter(o => o.orderStatus === 'delivered').length
    };
  } catch (err) {
    console.error("Error calculating seller financial summary:", err);
    return createEmptyFinancialSummary(sellerUid);
  }
}

/**
 * Fallback / Empty Financial Summary structure
 */
function createEmptyFinancialSummary(sellerUid = '') {
  return {
    sellerUid,
    grossSales: 0,
    platformCommission: 0,
    refundsAndAdjustments: 0,
    netEarnings: 0,
    pendingEarnings: 0,
    availableBalance: 0,
    pendingWithdrawals: 0,
    totalWithdrawn: 0,
    commissionRateSnapshot: DEFAULT_PLATFORM_COMMISSION_RATE,
    orderCount: 0,
    deliveredOrderCount: 0
  };
}

/**
 * Retrieves withdrawal requests for a seller from Firestore
 *
 * @param {string} sellerUid - Authenticated seller UID
 * @returns {Promise<Array>} List of withdrawal request documents
 */
export async function getSellerWithdrawalRequests(sellerUid) {
  if (!sellerUid) return [];

  try {
    const q = query(
      collection(db, 'withdrawal_requests'),
      where('sellerUid', '==', sellerUid)
    );
    const snap = await getDocs(q);

    const requests = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      requests.push({
        id: docSnap.id,
        ...data,
        createdAtDate: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date())
      });
    });

    // Sort newest first
    requests.sort((a, b) => (b.createdAtDate || 0) - (a.createdAtDate || 0));
    return requests;
  } catch (err) {
    console.error("Error fetching withdrawal requests:", err);
    return [];
  }
}

/**
 * Submits a new withdrawal request for an approved seller with atomic balance reservation checks.
 *
 * @param {string} sellerUid - Authenticated seller UID
 * @param {Object} payload - { amount, payoutMethod, accountHolderName, accountDetails, note, storeName, sellerName }
 * @returns {Promise<Object>} Created withdrawal request record
 */
export async function submitWithdrawalRequest(sellerUid, payload) {
  if (!sellerUid) {
    throw new Error("Authentication required.");
  }

  const requestedAmount = Number(payload.amount);
  if (isNaN(requestedAmount) || requestedAmount < MINIMUM_WITHDRAWAL_AMOUNT) {
    throw new Error(`Minimum withdrawal amount is ৳${MINIMUM_WITHDRAWAL_AMOUNT}.`);
  }

  const method = payload.payoutMethod;
  if (!ALLOWED_PAYOUT_METHODS[method]) {
    throw new Error("Please select a valid payout method (bKash, Nagad, or Bank Transfer).");
  }

  if (!payload.accountHolderName || !payload.accountHolderName.trim()) {
    throw new Error("Account holder name is required.");
  }

  if (!payload.accountDetails || typeof payload.accountDetails !== 'object') {
    throw new Error("Payout account details are required.");
  }

  if (ALLOWED_PAYOUT_METHODS[method].type === 'mobile' && !payload.accountDetails.mobileNumber) {
    throw new Error("Mobile wallet phone number is required.");
  }

  if (ALLOWED_PAYOUT_METHODS[method].type === 'bank') {
    if (!payload.accountDetails.bankName || !payload.accountDetails.accountNumber) {
      throw new Error("Bank name and account number are required for bank transfer.");
    }
  }

  // 1. Fetch real-time fresh financial summary to verify genuinely available balance
  const summary = await getSellerFinancialSummary(sellerUid);

  if (requestedAmount > summary.availableBalance) {
    throw new Error(`Insufficient available balance. Your current withdrawable balance is ৳${summary.availableBalance}.`);
  }

  // 2. Build secure withdrawal request record
  const requestData = {
    sellerUid,
    sellerName: payload.sellerName || '',
    storeName: payload.storeName || '',
    amount: requestedAmount,
    payoutMethod: method,
    accountHolderName: payload.accountHolderName.trim(),
    accountDetails: {
      ...payload.accountDetails,
      accountNumberMasked: maskAccountDetails(payload.accountDetails.mobileNumber || payload.accountDetails.accountNumber)
    },
    sellerNote: (payload.note || '').trim(),
    status: 'pending', // Strictly initialized as pending
    availableBalanceAtRequest: summary.availableBalance,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'withdrawal_requests'), requestData);

  return {
    id: docRef.id,
    ...requestData,
    createdAtDate: new Date()
  };
}

/**
 * Builds a financial history ledger combining delivered orders, refunds, and withdrawal requests.
 *
 * @param {string} sellerUid - Authenticated seller UID
 * @returns {Promise<Array>} Sorted transaction entries
 */
export async function getSellerFinancialLedger(sellerUid) {
  if (!sellerUid) return [];

  try {
    const [orders, withdrawals] = await Promise.all([
      getSellerOrders(sellerUid),
      getSellerWithdrawalRequests(sellerUid)
    ]);

    const ledger = [];

    // Add delivered orders & sales entries
    orders.forEach((order) => {
      const { sellerSubtotal } = calculateSellerOrderTotals(order, sellerUid);
      const status = order.sellerStatuses?.[sellerUid] || order.orderStatus || 'pending';
      const orderCommissionRate = order.commissionRate || DEFAULT_PLATFORM_COMMISSION_RATE;
      const commission = sellerSubtotal * orderCommissionRate;
      const net = sellerSubtotal - commission;

      if (status === 'delivered') {
        ledger.push({
          id: `order-${order.id}`,
          date: order.createdAtDate || new Date(),
          reference: order.id.slice(0, 8).toUpperCase(),
          type: 'sale',
          typeLabelBn: 'পণ্য বিক্রি (Earned)',
          typeLabelEn: 'Product Sale',
          description: `Order #${order.id.slice(0, 8)} (${order.items?.length || 1} items)`,
          grossAmount: sellerSubtotal,
          commission: commission,
          netAmount: net,
          status: 'completed',
          statusLabelBn: 'সম্পন্ন',
          statusLabelEn: 'Completed'
        });
      } else if (['returned', 'refunded'].includes(status)) {
        ledger.push({
          id: `refund-${order.id}`,
          date: order.createdAtDate || new Date(),
          reference: order.id.slice(0, 8).toUpperCase(),
          type: 'refund',
          typeLabelBn: 'ফেরত/অ্যাডজাস্টমেন্ট',
          typeLabelEn: 'Refund/Adjustment',
          description: `Order #${order.id.slice(0, 8)} return adjustment`,
          grossAmount: -sellerSubtotal,
          commission: 0,
          netAmount: -sellerSubtotal,
          status: 'adjusted',
          statusLabelBn: 'অ্যাডজাস্টকৃত',
          statusLabelEn: 'Adjusted'
        });
      }
    });

    // Add withdrawal request entries
    withdrawals.forEach((req) => {
      ledger.push({
        id: `withdrawal-${req.id}`,
        date: req.createdAtDate || new Date(),
        reference: req.id.slice(0, 8).toUpperCase(),
        type: 'withdrawal',
        typeLabelBn: 'ব্যালেন্স উত্তোলন',
        typeLabelEn: 'Withdrawal',
        description: `Payout via ${ALLOWED_PAYOUT_METHODS[req.payoutMethod]?.nameEn || req.payoutMethod}`,
        grossAmount: -req.amount,
        commission: 0,
        netAmount: -req.amount,
        status: req.status || 'pending',
        statusLabelBn: getWithdrawalStatusLabel(req.status, 'bn'),
        statusLabelEn: getWithdrawalStatusLabel(req.status, 'en')
      });
    });

    // Sort newest first
    ledger.sort((a, b) => b.date - a.date);

    return ledger;
  } catch (err) {
    console.error("Error building financial ledger:", err);
    return [];
  }
}

/**
 * Utility to mask account / phone numbers for privacy
 * @param {string} accNo
 * @returns {string}
 */
export function maskAccountDetails(accNo) {
  if (!accNo || typeof accNo !== 'string') return '****';
  const str = accNo.trim();
  if (str.length <= 4) return '****';
  const visibleStart = str.slice(0, 3);
  const visibleEnd = str.slice(-4);
  const maskedMiddle = '*'.repeat(Math.max(2, str.length - 7));
  return `${visibleStart}${maskedMiddle}${visibleEnd}`;
}

/**
 * Returns localized label for withdrawal status
 */
export function getWithdrawalStatusLabel(status, lang = 'bn') {
  const labels = {
    pending: { bn: 'অপেক্ষমাণ (Pending)', en: 'Pending' },
    under_review: { bn: 'পর্যালোচনায় (Under Review)', en: 'Under Review' },
    approved: { bn: 'অনুমোদিত (Approved)', en: 'Approved' },
    processing: { bn: 'প্রসেসিং (Processing)', en: 'Processing' },
    paid: { bn: 'পরিশোধিত (Paid)', en: 'Paid' },
    rejected: { bn: 'বাতিল (Rejected)', en: 'Rejected' },
    cancelled: { bn: 'বাতিলকৃত (Cancelled)', en: 'Cancelled' }
  };

  return labels[status]?.[lang] || status || 'Pending';
}
