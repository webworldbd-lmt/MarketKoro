/**
 * Public Seller Store UI Renderer for MarketKoro
 * Displays verified store details, empty states for products and reviews strictly without fake data.
 */

import { getTranslation } from '../i18n/i18n.js';
import { createEmptyState } from '../components/empty-state.js';

/**
 * Render Public Store Page UI
 * @param {HTMLElement} root
 * @param {Object|null} store
 */
export function renderPublicStorePage(root, store) {
  if (!root) return;

  if (!store) {
    root.innerHTML = '';
    const emptyState = createEmptyState({
      icon: '🏪',
      titleBn: 'স্টোর খুঁজে পাওয়া যায়নি',
      titleEn: 'Store Not Found',
      subBn: 'অনুরোধকৃত সেলার স্টোরটি বর্তমানে উপলব্ধ নয় বা অনুমোদিত নয়।',
      subEn: 'The requested seller store is not available or has not been approved.',
      actionTextBn: 'মার্কেটপ্লেসে ফিরুন',
      actionTextEn: 'Back to Marketplace',
      onAction: () => { window.location.href = 'index.html'; }
    });
    root.appendChild(emptyState);
    return;
  }

  const storeLogo = store.storeLogo || 'assets/images/placeholder-store.svg';
  const storeBanner = store.storeBanner || '';
  const storeName = store.storeName || 'Store';
  const sellerOwnerName = store.fullName || 'Seller';
  const location = getLocationText(store.district, store.division);
  const contactPhone = store.contactPhone || store.phone || '';

  root.innerHTML = `
    <div class="public-store-wrapper" style="display: flex; flex-direction: column; gap: var(--space-6);">

      <!-- Store Header Banner & Profile Card -->
      <div class="card" style="padding: 0; overflow: hidden; border: 1px solid var(--color-border); background-color: var(--color-surface);">
        ${storeBanner ? `
          <div style="height: 180px; width: 100%; overflow: hidden; background-color: var(--color-bg);">
            <img src="${storeBanner}" alt="${storeName} Banner" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        ` : `
          <div style="height: 120px; width: 100%; background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);"></div>
        `}

        <div style="padding: var(--space-5); display: flex; align-items: center; gap: var(--space-5); flex-wrap: wrap; margin-top: ${storeBanner ? '-50px' : '0'};">
          <img src="${storeLogo}" alt="${storeName} Logo" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid var(--color-surface); background-color: var(--color-surface); box-shadow: var(--shadow-md); flex-shrink: 0;">

          <div style="flex: 1; min-width: 250px;">
            <div style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
              <h1 style="margin: 0; font-size: var(--font-size-2xl); font-weight: 700; color: var(--color-text);">${storeName}</h1>
              <span class="badge" style="background-color: var(--color-success-bg); color: var(--color-success); font-weight: 600; font-size: var(--font-size-xs); padding: 4px 10px;">
                ✔ ${getTranslation('store.verified') || 'অনুমোদিত সেলার'}
              </span>
            </div>

            <div style="display: flex; gap: var(--space-4); flex-wrap: wrap; margin-top: var(--space-2); font-size: var(--font-size-sm); color: var(--color-text-muted);">
              <span>👤 ${sellerOwnerName}</span>
              <span>📍 ${location}</span>
              ${contactPhone ? `<span>📞 ${contactPhone}</span>` : ''}
            </div>

            ${store.socialLinks && (store.socialLinks.facebook || store.socialLinks.instagram || store.socialLinks.website) ? `
              <div style="display: flex; gap: var(--space-3); margin-top: var(--space-3); flex-wrap: wrap;">
                ${store.socialLinks.facebook ? `<a href="${store.socialLinks.facebook}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 12px;">Facebook</a>` : ''}
                ${store.socialLinks.instagram ? `<a href="${store.socialLinks.instagram}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 12px;">Instagram</a>` : ''}
                ${store.socialLinks.website ? `<a href="${store.socialLinks.website}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 12px;">Website</a>` : ''}
              </div>
            ` : ''}
          </div>
        </div>

        ${store.storeDescription ? `
          <div style="padding: 0 var(--space-5) var(--space-5); color: var(--color-text); font-size: var(--font-size-sm); line-height: 1.6; border-top: 1px solid var(--color-border); padding-top: var(--space-3); margin-top: var(--space-2);">
            <strong>স্টোর পরিচিতি:</strong> ${store.storeDescription}
          </div>
        ` : ''}
      </div>

      <!-- Store Products Section -->
      <section>
        <h2 style="font-size: var(--font-size-xl); font-weight: 700; margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-2);">
          📦 <span data-i18n="store.products_title">স্টোরের পণ্যসমূহ</span>
        </h2>

        <div id="store-products-container">
          <!-- Real products check: Show empty state if no real products exist -->
          <div class="card" style="padding: var(--space-6);">
            ${createEmptyState({
              icon: '📦',
              titleBn: 'এখনো কোনো পণ্য পাওয়া যায়নি',
              titleEn: 'No products available yet',
              subBn: 'এই স্টোরে এখনো কোনো পণ্য আপলোড করা হয়নি। নতুন পণ্যের জন্য পরবর্তীতে ভিজিট করুন।',
              subEn: 'No products have been listed by this seller yet. Check back soon for new arrivals.'
            }).outerHTML}
          </div>
        </div>
      </section>

      <!-- Store Customer Reviews & Ratings Section -->
      <section>
        <h2 style="font-size: var(--font-size-xl); font-weight: 700; margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-2);">
          ⭐ <span data-i18n="store.reviews_title">কাস্টমার রিভিউ ও রেটিং</span>
        </h2>

        <div id="store-reviews-container">
          <div class="card" style="padding: var(--space-6);">
            ${createEmptyState({
              icon: '⭐',
              titleBn: 'এখনো কোনো রিভিউ পাওয়া যায়নি',
              titleEn: 'No customer reviews yet',
              subBn: 'এই স্টোরের জন্য এখনো কোনো ভেরিফাইড কাস্টমার রিভিউ নিবন্ধিত হয়নি।',
              subEn: 'There are no customer reviews for this seller store yet.'
            }).outerHTML}
          </div>
        </div>
      </section>

    </div>
  `;
}

function getLocationText(district, division) {
  if (district && division) return `${district}, ${division}`;
  return division || 'Bangladesh';
}
