/* Formatting helpers for Currency (৳ / BDT) and Numbers */

import { getCurrentLanguage } from '../i18n/i18n.js';

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaDigits(numberStr) {
  return String(numberStr).replace(/\d/g, (digit) => BANGLA_DIGITS[parseInt(digit, 10)]);
}

export function formatNumber(number, lang = getCurrentLanguage()) {
  const formatted = new Intl.NumberFormat('en-IN').format(number);
  if (lang === 'bn') {
    return toBanglaDigits(formatted);
  }
  return formatted;
}

export function formatCurrency(amount, lang = getCurrentLanguage()) {
  const formattedAmount = formatNumber(amount, lang);
  if (lang === 'bn') {
    return `৳ ${formattedAmount}`;
  }
  return `৳ ${formattedAmount} BDT`;
}
