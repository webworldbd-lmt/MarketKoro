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

export function formatDate(dateInput, lang = getCurrentLanguage()) {
  if (!dateInput) return '-';
  let date;
  if (dateInput.toDate && typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else {
    date = new Date(dateInput);
  }
  if (isNaN(date.getTime())) return '-';

  const day = formatNumber(date.getDate(), lang);
  const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = lang === 'bn' ? monthNamesBn[date.getMonth()] : monthNamesEn[date.getMonth()];
  const year = formatNumber(date.getFullYear(), lang);

  return lang === 'bn' ? `${day} ${month}, ${year}` : `${month} ${day}, ${year}`;
}
