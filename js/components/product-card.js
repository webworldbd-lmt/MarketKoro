/* Product Card Renderer Module */

import { getCurrentLanguage, getTranslation } from '../i18n/i18n.js';
import { formatCurrency, formatNumber } from '../utils/formatters.js';
import { showToast } from './toast.js';

export function createProductCard(product) {
  const lang = getCurrentLanguage();
  const card = document.createElement('div');
  card.className = 'card product-card';

  const title = lang === 'bn' ? product.title_bn : product.title_en;
  const category = lang === 'bn' ? product.category_bn : product.category_en;
  const demoLabel = getTranslation('product.demo_tag');
  const addToCartText = getTranslation('product.add_to_cart');

  card.innerHTML = `
    <div class="product-card-img-wrapper">
      <img src="${product.image}" alt="${title}" class="product-card-img" loading="lazy">
      <span class="badge badge-demo" style="position: absolute; top: 8px; right: 8px;">${demoLabel}</span>
    </div>
    <div class="product-card-body">
      <div class="product-card-category">${category}</div>
      <h4 class="product-card-title">${title}</h4>
      <div style="font-size: var(--font-size-xs); color: var(--color-warning); margin-bottom: var(--space-2);">
        ★ ${formatNumber(product.rating, lang)} <span style="color: var(--color-text-muted);">(${formatNumber(product.reviewsCount, lang)} ${getTranslation('product.rating_count')})</span>
      </div>
      <div class="product-card-price-row">
        <span class="product-price">${formatCurrency(product.price, lang)}</span>
        ${product.original_price ? `<span class="product-price-original">${formatCurrency(product.original_price, lang)}</span>` : ''}
      </div>
      <button class="btn btn-primary btn-sm add-to-cart-btn" style="width: 100%; margin-top: var(--space-3);" data-id="${product.id}">
        🛒 ${addToCartText}
      </button>
    </div>
  `;

  const btn = card.querySelector('.add-to-cart-btn');
  btn.addEventListener('click', () => {
    showToast(`${title} - ${getTranslation('product.demo_tag')}: ${addToCartText}`, 'info');
  });

  return card;
}
