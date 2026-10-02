/* Empty State UI Component Helper */

import { getCurrentLanguage } from '../i18n/i18n.js';

/**
 * Creates a clean, professional empty state card container
 * @param {Object} options
 * @param {string} options.icon - Emoji or SVG icon
 * @param {string} options.titleBn - Title in Bangla
 * @param {string} options.titleEn - Title in English
 * @param {string} [options.subBn] - Subtitle in Bangla
 * @param {string} [options.subEn] - Subtitle in English
 * @param {string} [options.actionTextBn] - Button label in Bangla
 * @param {string} [options.actionTextEn] - Button label in English
 * @param {Function} [options.onAction] - Button click handler
 * @returns {HTMLElement} Empty state HTML element
 */
export function createEmptyState({ icon = '📦', titleBn, titleEn, subBn = '', subEn = '', actionTextBn = '', actionTextEn = '', onAction = null }) {
  const lang = getCurrentLanguage();
  const title = lang === 'bn' ? titleBn : titleEn;
  const sub = lang === 'bn' ? subBn : subEn;
  const actionText = lang === 'bn' ? actionTextBn : actionTextEn;

  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state-card';
  wrapper.style.cssText = `
    width: 100%;
    padding: var(--space-8) var(--space-4);
    text-align: center;
    background-color: var(--color-surface);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
    margin: var(--space-4) 0;
  `;

  wrapper.innerHTML = `
    <div style="font-size: 2.5rem; margin-bottom: var(--space-3); line-height: 1;">${icon}</div>
    <h3 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text); margin-bottom: var(--space-2);">${title}</h3>
    ${sub ? `<p style="font-size: var(--font-size-sm); color: var(--color-text-muted); max-width: 480px; margin: 0 auto var(--space-4);">${sub}</p>` : ''}
    ${actionText ? `<button class="btn btn-outline btn-sm empty-state-btn" style="margin-top: var(--space-2);">${actionText}</button>` : ''}
  `;

  if (actionText && onAction) {
    const btn = wrapper.querySelector('.empty-state-btn');
    if (btn) btn.addEventListener('click', onAction);
  }

  return wrapper;
}
