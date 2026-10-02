/* Internationalization (i18n) Engine for MarketKoro */

import { translations } from './translations.js';

const LANG_KEY = 'marketkoro_lang';
const DEFAULT_LANG = 'bn'; // Primary language is Bangla

export function getStoredLanguage() {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch (e) {
    console.warn('LocalStorage error:', e);
    return null;
  }
}

export function setStoredLanguage(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
}

export function getCurrentLanguage() {
  const stored = getStoredLanguage();
  if (stored === 'bn' || stored === 'en') {
    return stored;
  }
  return DEFAULT_LANG;
}

export function getTranslation(key, lang = getCurrentLanguage()) {
  const langDict = translations[lang] || translations[DEFAULT_LANG];
  if (langDict && langDict[key] !== undefined) {
    return langDict[key];
  }
  // Fallback to English if key missing in Bangla
  if (translations['en'] && translations['en'][key] !== undefined) {
    return translations['en'][key];
  }
  return key; // Return raw key if not found
}

export function applyLanguage(lang) {
  document.documentElement.setAttribute('lang', lang);

  // Translate all elements with data-i18n
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const translation = getTranslation(key, lang);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (el.hasAttribute('placeholder')) {
        el.setAttribute('placeholder', translation);
      }
    } else {
      el.textContent = translation;
    }
  });

  // Update language switcher UI button text
  const langToggleBtn = document.getElementById('lang-toggle-btn');
  if (langToggleBtn) {
    langToggleBtn.textContent = lang === 'bn' ? 'English' : 'বাংলা';
    langToggleBtn.setAttribute('aria-label', lang === 'bn' ? 'Switch to English' : 'বাংলায় পরিবর্তন করুন');
  }
}

export function toggleLanguage() {
  const current = getCurrentLanguage();
  const next = current === 'bn' ? 'en' : 'bn';
  setStoredLanguage(next);
  applyLanguage(next);

  // Dispatch custom event for dynamic components to re-render
  window.dispatchEvent(new CustomEvent('marketkoro:languageChange', { detail: { lang: next } }));
  return next;
}

export function initI18n() {
  const lang = getCurrentLanguage();
  applyLanguage(lang);
}
