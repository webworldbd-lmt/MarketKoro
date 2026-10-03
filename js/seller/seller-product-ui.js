/**
 * Seller Product Management UI Component for MarketKoro
 * Handles rendering the seller product table/cards, search/filters,
 * Add/Edit Product modal with Cloudinary upload, and safe delete flow.
 */

import { getTranslation } from '../i18n/i18n.js';
import { createModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { createEmptyState } from '../components/empty-state.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { uploadImage } from '../utils/image-uploader.js';
import {
  getSellerProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getSystemCategories,
  generateProductSlug
} from './product-service.js';

let activeProductModal = null;
let currentProductsList = [];
let filteredProductsList = [];

/**
 * Render the Product Management section in Seller Dashboard
 * @param {HTMLElement} container
 * @param {Object} sellerApplication
 * @param {Function} [onProductChange] - Optional callback to refresh dashboard metrics
 */
export async function renderProductsTab(container, sellerApplication, onProductChange = null) {
  if (!container || !sellerApplication) return;

  container.innerHTML = `
    <div class="card" style="padding: var(--space-6);">
      <!-- Header Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-5);">
        <div>
          <h3 style="font-size: var(--font-size-lg); font-weight: 700; margin: 0;" data-i18n="seller.nav_products">
            পণ্য ব্যবস্থাপনা (Product Management)
          </h3>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;">
            আপনার স্টোরের পণ্য তালিকা দেখুন, নতুন পণ্য যোগ করুন, তথ্য আপডেট বা ডিলিট করুন।
          </p>
        </div>

        <button id="add-product-btn" class="btn btn-primary">
          ➕ <span data-i18n="seller.add_product_btn">নতুন পণ্য যোগ করুন</span>
        </button>
      </div>

      <!-- Search & Filters Bar -->
      <div style="display: flex; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-5); background-color: var(--color-bg); padding: var(--space-3); border-radius: var(--radius-md);">
        <!-- Search Field -->
        <div style="flex: 2; min-width: 200px;">
          <input type="text" id="prod-search-input" class="form-control" placeholder="পণ্যের নাম দিয়ে খুঁজুন..." style="height: 38px; font-size: var(--font-size-xs);">
        </div>

        <!-- Filter by Status -->
        <div style="flex: 1; min-width: 130px;">
          <select id="prod-status-filter" class="form-control" style="height: 38px; font-size: var(--font-size-xs);">
            <option value="all">সকল স্ট্যাটাস</option>
            <option value="published">Published (প্রকাশিত)</option>
            <option value="draft">Draft (খসড়া)</option>
            <option value="pending">Pending (পর্যালোচনায়)</option>
          </select>
        </div>

        <!-- Filter by Stock -->
        <div style="flex: 1; min-width: 130px;">
          <select id="prod-stock-filter" class="form-control" style="height: 38px; font-size: var(--font-size-xs);">
            <option value="all">সকল স্টক</option>
            <option value="in_stock">ইন স্টক (In Stock)</option>
            <option value="low_stock">কম স্টক (Low Stock)</option>
            <option value="out_of_stock">স্টক নেই (Out of Stock)</option>
          </select>
        </div>
      </div>

      <!-- Products List Root Container -->
      <div id="seller-products-list-root">
        <div style="text-align: center; padding: var(--space-8);">
          <span class="loading-spinner" style="width: 2rem; height: 2rem;"></span>
          <p style="margin-top: var(--space-2); color: var(--color-text-muted);">${getTranslation('common.loading')}</p>
        </div>
      </div>
    </div>
  `;

  // Attach Add Product Button Event
  const addBtn = container.querySelector('#add-product-btn');
  addBtn?.addEventListener('click', () => {
    openAddEditProductModal(sellerApplication, null, async () => {
      await refreshProductsList(container, sellerApplication, onProductChange);
    });
  });

  // Load Initial Products
  await refreshProductsList(container, sellerApplication, onProductChange);

  // Attach Search & Filter Listeners
  const searchInput = container.querySelector('#prod-search-input');
  const statusFilter = container.querySelector('#prod-status-filter');
  const stockFilter = container.querySelector('#prod-stock-filter');

  const applyFilters = () => {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const statusVal = statusFilter ? statusFilter.value : 'all';
    const stockVal = stockFilter ? stockFilter.value : 'all';

    filteredProductsList = currentProductsList.filter((item) => {
      // Search check
      const matchSearch = !query || item.name.toLowerCase().includes(query) || (item.categoryName && item.categoryName.toLowerCase().includes(query)) || (item.sku && item.sku.toLowerCase().includes(query));

      // Status check
      const matchStatus = statusVal === 'all' || item.status === statusVal;

      // Stock check
      const stockQty = Number(item.stockQuantity) || 0;
      let matchStock = true;
      if (stockVal === 'in_stock') matchStock = stockQty > 5;
      else if (stockVal === 'low_stock') matchStock = stockQty >= 1 && stockQty <= 5;
      else if (stockVal === 'out_of_stock') matchStock = stockQty === 0;

      return matchSearch && matchStatus && matchStock;
    });

    renderProductsView(container.querySelector('#seller-products-list-root'), filteredProductsList, sellerApplication, onProductChange);
  };

  searchInput?.addEventListener('input', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
  stockFilter?.addEventListener('change', applyFilters);
}

/**
 * Fetch and refresh seller products
 */
async function refreshProductsList(container, sellerApplication, onProductChange) {
  const listRoot = container.querySelector('#seller-products-list-root');
  if (!listRoot) return;

  try {
    currentProductsList = await getSellerProducts(sellerApplication.uid);
    filteredProductsList = [...currentProductsList];

    if (onProductChange) onProductChange(currentProductsList.length);

    renderProductsView(listRoot, filteredProductsList, sellerApplication, onProductChange);
  } catch (err) {
    console.error("Error loading seller products:", err);
    listRoot.innerHTML = `
      <div style="text-align: center; padding: var(--space-6); color: var(--color-error);">
        ⚠️ পণ্য লোড করতে ব্যর্থ হয়েছে। (${err.message || ''})
      </div>
    `;
  }
}

/**
 * Render Product Table/Cards View
 */
function renderProductsView(rootEl, products, sellerApplication, onProductChange) {
  if (!rootEl) return;

  // Empty State Check
  if (!products || products.length === 0) {
    rootEl.innerHTML = '';
    const emptyState = createEmptyState({
      icon: '📦',
      titleBn: 'কোনো পণ্য পাওয়া যায়নি',
      titleEn: 'No products found',
      subBn: 'আপনার স্টোরে এখনো কোনো পণ্য যোগ করা হয়নি অথবা ফিল্টারের সাথে মিলছে না।',
      subEn: 'No products listed yet or none match your search filters.',
      actionTextBn: '➕ নতুন পণ্য যোগ করুন',
      actionTextEn: '➕ Add Product',
      onAction: () => {
        openAddEditProductModal(sellerApplication, null, async () => {
          const mainContainer = rootEl.closest('.card')?.parentElement || rootEl.parentElement;
          await refreshProductsList(mainContainer, sellerApplication, onProductChange);
        });
      }
    });
    rootEl.appendChild(emptyState);
    return;
  }

  // Render Table / Card Layout
  const wrapper = document.createElement('div');
  wrapper.className = 'table-container';

  wrapper.innerHTML = `
    <table class="table" style="width: 100%; border-collapse: collapse; font-size: var(--font-size-xs);">
      <thead>
        <tr style="border-bottom: 2px solid var(--color-border); text-align: left;">
          <th style="padding: var(--space-3);">পণ্য (Product)</th>
          <th style="padding: var(--space-3);">ক্যাটাগরি</th>
          <th style="padding: var(--space-3);">মূল্য (Price)</th>
          <th style="padding: var(--space-3);">স্টক (Stock)</th>
          <th style="padding: var(--space-3);">স্ট্যাটাস</th>
          <th style="padding: var(--space-3);">আপডেট তারিখ</th>
          <th style="padding: var(--space-3); text-align: right;">অ্যাকশন (Actions)</th>
        </tr>
      </thead>
      <tbody id="prod-table-body">
      </tbody>
    </table>
  `;

  const tbody = wrapper.querySelector('#prod-table-body');

  products.forEach((prod) => {
    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom: 1px solid var(--color-border); align-items: center;';

    const primaryImg = (prod.images && prod.images.length > 0) ? prod.images[0] : 'assets/images/placeholder-product.svg';
    const stockQty = Number(prod.stockQuantity) || 0;

    // Determine stock status badge
    let stockBadge = `<span class="badge" style="background-color: var(--color-success-bg); color: var(--color-success);">ইন স্টক (${stockQty})</span>`;
    if (stockQty === 0) {
      stockBadge = `<span class="badge" style="background-color: var(--color-error-bg); color: var(--color-error);">স্টক নেই (0)</span>`;
    } else if (stockQty <= 5) {
      stockBadge = `<span class="badge" style="background-color: #FEF3C7; color: #D97706;">কম স্টক (${stockQty})</span>`;
    }

    // Determine product status badge
    let statusBadge = `<span class="badge badge-primary">Published</span>`;
    if (prod.status === 'draft') {
      statusBadge = `<span class="badge badge-secondary">Draft</span>`;
    } else if (prod.status === 'pending') {
      statusBadge = `<span class="badge" style="background-color: #FEF3C7; color: #D97706;">Pending</span>`;
    }

    const updatedDateStr = prod.updatedAt ? formatDate(prod.updatedAt) : (prod.createdAt ? formatDate(prod.createdAt) : '-');

    tr.innerHTML = `
      <td style="padding: var(--space-3);">
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <img src="${primaryImg}" alt="${prod.name}" style="width: 48px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--color-border); flex-shrink: 0;">
          <div>
            <div style="font-weight: 700; color: var(--color-text); font-size: var(--font-size-xs); line-height: 1.4;">${prod.name}</div>
            ${prod.sku ? `<div style="font-size: 11px; color: var(--color-text-muted);">SKU: ${prod.sku}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="padding: var(--space-3); color: var(--color-text-muted);">${prod.categoryName || 'General'}</td>
      <td style="padding: var(--space-3);">
        <div style="font-weight: 700; color: var(--color-primary);">${formatCurrency(prod.price)}</div>
        ${prod.compareAtPrice > prod.price ? `<del style="font-size: 11px; color: var(--color-text-muted);">${formatCurrency(prod.compareAtPrice)}</del>` : ''}
      </td>
      <td style="padding: var(--space-3);">${stockBadge}</td>
      <td style="padding: var(--space-3);">${statusBadge}</td>
      <td style="padding: var(--space-3); color: var(--color-text-muted); font-size: 11px;">${updatedDateStr}</td>
      <td style="padding: var(--space-3); text-align: right;">
        <div style="display: flex; justify-content: flex-end; gap: var(--space-2);">
          <button class="btn btn-outline btn-sm edit-prod-btn" style="padding: 4px 8px; font-size: 11px;" title="সম্পাদনা করুন">
            ✏️
          </button>
          <button class="btn btn-outline btn-sm delete-prod-btn" style="padding: 4px 8px; font-size: 11px; color: var(--color-error); border-color: var(--color-error);" title="মুছে ফেলুন">
            🗑️
          </button>
        </div>
      </td>
    `;

    // Edit Product Trigger
    tr.querySelector('.edit-prod-btn')?.addEventListener('click', () => {
      openAddEditProductModal(sellerApplication, prod, async () => {
        const mainContainer = rootEl.closest('.card')?.parentElement || rootEl.parentElement;
        await refreshProductsList(mainContainer, sellerApplication, onProductChange);
      });
    });

    // Delete Product Trigger
    tr.querySelector('.delete-prod-btn')?.addEventListener('click', () => {
      confirmDeleteProduct(prod, sellerApplication, async () => {
        const mainContainer = rootEl.closest('.card')?.parentElement || rootEl.parentElement;
        await refreshProductsList(mainContainer, sellerApplication, onProductChange);
      });
    });

    tbody.appendChild(tr);
  });

  rootEl.innerHTML = '';
  rootEl.appendChild(wrapper);
}

/**
 * Open Add or Edit Product Modal Form
 * @param {Object} sellerApplication
 * @param {Object|null} productToEdit
 * @param {Function} onSaveSuccess
 */
export async function openAddEditProductModal(sellerApplication, productToEdit = null, onSaveSuccess = null) {
  const isEdit = !!productToEdit;
  const isCategoriesAvailable = false; // Categories architecture check

  // Fetch real categories if present
  let categories = [];
  try {
    categories = await getSystemCategories();
  } catch (e) {}

  let uploadedImages = isEdit && Array.isArray(productToEdit.images) ? [...productToEdit.images] : [];

  const formContainer = document.createElement('div');
  formContainer.style.maxHeight = '75vh';
  formContainer.style.overflowY = 'auto';
  formContainer.style.paddingRight = '4px';

  formContainer.innerHTML = `
    <form id="product-modal-form" style="display: flex; flex-direction: column; gap: var(--space-4);">

      <!-- Product Name & Slug -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4);">
        <div class="form-group">
          <label for="prod-form-name" class="form-label">
            পণ্যের নাম (Product Name) <span style="color: var(--color-error);">*</span>
          </label>
          <input type="text" id="prod-form-name" class="form-control" value="${isEdit ? productToEdit.name : ''}" placeholder="যেমন: নতুন সুতি শাড়ি" required>
        </div>

        <div class="form-group">
          <label for="prod-form-slug" class="form-label">
            পণ্যের ইউআরএল (Product Slug)
          </label>
          <input type="text" id="prod-form-slug" class="form-control" value="${isEdit ? productToEdit.slug : ''}" placeholder="auto-generated-slug">
        </div>
      </div>

      <!-- Category & SKU -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4);">
        <div class="form-group">
          <label for="prod-form-category" class="form-label">
            ক্যাটাগরি (Category) <span style="color: var(--color-error);">*</span>
          </label>
          <select id="prod-form-category" class="form-control">
            ${categories.length > 0 ? categories.map(c => `
              <option value="${c.id}" ${isEdit && productToEdit.categoryId === c.id ? 'selected' : ''}>${c.name}</option>
            `).join('') : `
              <option value="general">General (সাধারণ)</option>
            `}
          </select>
          ${categories.length === 0 ? `
            <p style="font-size: 11px; color: var(--color-text-muted); margin-top: 4px;">
              💡 কোনো কাস্টম ক্যাটাগরি যুক্ত না থাকায় সাধারণ ক্যাটাগরি ব্যবহার করা হচ্ছে।
            </p>
          ` : ''}
        </div>

        <div class="form-group">
          <label for="prod-form-sku" class="form-label">SKU / পণ্য কোড</label>
          <input type="text" id="prod-form-sku" class="form-control" value="${isEdit ? (productToEdit.sku || '') : ''}" placeholder="e.g. MK-PROD-001">
        </div>
      </div>

      <!-- Pricing & Stock -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-4);">
        <div class="form-group">
          <label for="prod-form-price" class="form-label">
            বিক্রয় মূল্য (Price ৳) <span style="color: var(--color-error);">*</span>
          </label>
          <input type="number" id="prod-form-price" class="form-control" min="0" step="1" value="${isEdit ? productToEdit.price : ''}" placeholder="0" required>
        </div>

        <div class="form-group">
          <label for="prod-form-compare-price" class="form-label">পূর্বের মূল্য (Compare Price ৳)</label>
          <input type="number" id="prod-form-compare-price" class="form-control" min="0" step="1" value="${isEdit && productToEdit.compareAtPrice ? productToEdit.compareAtPrice : ''}" placeholder="0">
        </div>

        <div class="form-group">
          <label for="prod-form-stock" class="form-label">
            স্টক পরিমাণ (Stock Qty) <span style="color: var(--color-error);">*</span>
          </label>
          <input type="number" id="prod-form-stock" class="form-control" min="0" step="1" value="${isEdit ? productToEdit.stockQuantity : '10'}" required>
        </div>

        <div class="form-group">
          <label for="prod-form-status" class="form-label">স্ট্যাটাস (Status)</label>
          <select id="prod-form-status" class="form-control">
            <option value="published" ${isEdit && productToEdit.status === 'published' ? 'selected' : ''}>Published (সক্রিয়)</option>
            <option value="draft" ${isEdit && productToEdit.status === 'draft' ? 'selected' : ''}>Draft (খসড়া)</option>
          </select>
        </div>
      </div>

      <!-- Image Upload Section -->
      <div class="card" style="padding: var(--space-4); border: 1px dashed var(--color-border); background-color: var(--color-bg);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
          <label class="form-label" style="margin: 0; font-weight: 700;">
            📸 পণ্যের ছবি (Product Images - Max 5)
          </label>
          <span id="prod-img-counter" style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
            ${uploadedImages.length}/5 টি ছবি
          </span>
        </div>

        <!-- Image Previews Container -->
        <div id="prod-img-preview-grid" style="display: flex; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-3);">
        </div>

        <!-- File Upload Button & Progress -->
        <input type="file" id="prod-img-file-input" accept="image/jpeg,image/png,image/webp" multiple style="display: none;">
        <button type="button" id="prod-img-upload-btn" class="btn btn-outline btn-sm" ${uploadedImages.length >= 5 ? 'disabled' : ''}>
          🖼️ নতুন ছবি আপলোড করুন
        </button>
        <div id="prod-img-upload-progress" style="display: none; margin-top: var(--space-2); font-size: var(--font-size-xs); color: var(--color-primary);">
          ছবি আপলোড হচ্ছে... <span id="prod-img-upload-pct">0%</span>
        </div>
        <p style="font-size: 11px; color: var(--color-text-muted); margin-top: 6px;">
          সর্বোচ্চ ফাইল সাইজ: ২ মেগাবাইট প্রতি ছবি (JPEG, PNG, WebP)। প্রথম ছবিটি মূল কভার ছবি হিসেবে প্রদর্শিত হবে।
        </p>
      </div>

      <!-- Descriptions -->
      <div class="form-group">
        <label for="prod-form-short-desc" class="form-label">সংক্ষিপ্ত বিবরণ (Short Description)</label>
        <textarea id="prod-form-short-desc" class="form-control" rows="2" placeholder="পণ্যের সংক্ষেপ বিবরণ...">${isEdit && productToEdit.shortDescription ? productToEdit.shortDescription : ''}</textarea>
      </div>

      <div class="form-group">
        <label for="prod-form-desc" class="form-label">বিস্তারিত বিবরণ (Full Description)</label>
        <textarea id="prod-form-desc" class="form-control" rows="4" placeholder="পণ্যের ফিচার, মেটেরিয়াল, সাইজ ও বিস্তারিত তথ্য...">${isEdit && productToEdit.description ? productToEdit.description : ''}</textarea>
      </div>

      <!-- Submit Actions -->
      <div style="display: flex; justify-content: flex-end; gap: var(--space-3); border-top: 1px solid var(--color-border); padding-top: var(--space-4);">
        <button type="button" id="prod-form-cancel-btn" class="btn btn-outline">
          বাতিল করুন
        </button>
        <button type="submit" id="prod-form-submit-btn" class="btn btn-primary" style="min-width: 140px;">
          💾 ${isEdit ? 'আপডেট করুন' : 'পণ্য যোগ করুন'}
        </button>
      </div>

    </form>
  `;

  activeProductModal = createModal({
    title: isEdit ? `পণ্যের তথ্য সম্পাদনা (${productToEdit.name})` : "নতুন পণ্য যোগ করুন (Add New Product)",
    bodyContent: formContainer
  });

  // Render Image Previews Handler
  const previewGrid = formContainer.querySelector('#prod-img-preview-grid');
  const imgCounter = formContainer.querySelector('#prod-img-counter');
  const uploadBtn = formContainer.querySelector('#prod-img-upload-btn');
  const fileInput = formContainer.querySelector('#prod-img-file-input');
  const progressEl = formContainer.querySelector('#prod-img-upload-progress');
  const pctEl = formContainer.querySelector('#prod-img-upload-pct');

  const updateImageGrid = () => {
    if (!previewGrid) return;
    previewGrid.innerHTML = '';

    if (imgCounter) imgCounter.textContent = `${uploadedImages.length}/5 টি ছবি`;
    if (uploadBtn) uploadBtn.disabled = uploadedImages.length >= 5;

    uploadedImages.forEach((url, idx) => {
      const box = document.createElement('div');
      box.style.cssText = 'position: relative; width: 70px; height: 70px; border-radius: var(--radius-sm); overflow: hidden; border: 2px solid ' + (idx === 0 ? 'var(--color-primary)' : 'var(--color-border)') + ';';

      box.innerHTML = `
        <img src="${url}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">
        ${idx === 0 ? '<span style="position: absolute; bottom: 0; left: 0; right: 0; background: var(--color-primary); color: white; font-size: 9px; text-align: center;">মূল ছবি</span>' : ''}
        <button type="button" class="remove-img-btn" style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
      `;

      box.querySelector('.remove-img-btn')?.addEventListener('click', () => {
        uploadedImages.splice(idx, 1);
        updateImageGrid();
      });

      previewGrid.appendChild(box);
    });
  };

  updateImageGrid();

  // Handle File Input Selection & Cloudinary Upload
  uploadBtn?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (uploadedImages.length + files.length > 5) {
      showToast("আপনি সর্বোচ্চ ৫টি ছবি রাখতে পারবেন।", "warning");
      return;
    }

    uploadBtn.disabled = true;
    progressEl.style.display = 'block';

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (pctEl) pctEl.textContent = `${Math.round(((i + 1) / files.length) * 100)}%`;

        const url = await uploadImage(file, { folder: 'seller_products' });
        uploadedImages.push(url);
      }
      showToast("ছবি সফলভাবে আপলোড হয়েছে।", "success");
      updateImageGrid();
    } catch (err) {
      showToast(err.message || "ছবি আপলোড ব্যর্থ হয়েছে।", "error");
    } finally {
      progressEl.style.display = 'none';
      uploadBtn.disabled = uploadedImages.length >= 5;
      fileInput.value = '';
    }
  });

  // Slug Auto Generator
  const nameInput = formContainer.querySelector('#prod-form-name');
  const slugInput = formContainer.querySelector('#prod-form-slug');

  nameInput?.addEventListener('input', () => {
    if (!isEdit || !slugInput.value.trim()) {
      slugInput.value = generateProductSlug(nameInput.value);
    }
  });

  // Cancel Button
  formContainer.querySelector('#prod-form-cancel-btn')?.addEventListener('click', () => {
    closeModal(activeProductModal);
  });

  // Submit Handler
  const form = formContainer.querySelector('#product-modal-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = formContainer.querySelector('#prod-form-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="loading-spinner"></span> সংরক্ষণ হচ্ছে...`;

    try {
      const selectedCategoryEl = formContainer.querySelector('#prod-form-category');
      const selectedCategoryName = selectedCategoryEl ? selectedCategoryEl.options[selectedCategoryEl.selectedIndex]?.text : 'General';

      const payload = {
        name: nameInput.value.trim(),
        slug: slugInput.value.trim() || generateProductSlug(nameInput.value),
        price: Number(formContainer.querySelector('#prod-form-price').value),
        compareAtPrice: Number(formContainer.querySelector('#prod-form-compare-price').value || 0),
        stockQuantity: Number(formContainer.querySelector('#prod-form-stock').value || 0),
        categoryId: selectedCategoryEl ? selectedCategoryEl.value : 'general',
        categoryName: selectedCategoryName,
        sku: formContainer.querySelector('#prod-form-sku').value.trim(),
        shortDescription: formContainer.querySelector('#prod-form-short-desc').value.trim(),
        description: formContainer.querySelector('#prod-form-desc').value.trim(),
        status: formContainer.querySelector('#prod-form-status').value,
        images: uploadedImages
      };

      if (isEdit) {
        await updateProduct(productToEdit.productId, sellerApplication.uid, payload);
        showToast("পণ্য সফলভাবে আপডেট করা হয়েছে।", "success");
      } else {
        await createProduct(sellerApplication.uid, payload, {
          storeSlug: sellerApplication.storeSlug,
          storeName: sellerApplication.storeName
        });
        showToast("নতুন পণ্য সফলভাবে তৈরি করা হয়েছে।", "success");
      }

      closeModal(activeProductModal);
      if (onSaveSuccess) await onSaveSuccess();
    } catch (err) {
      console.error("Product save error:", err);
      showToast(err.message || "পণ্য সংরক্ষণ ব্যর্থ হয়েছে।", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `💾 ${isEdit ? 'আপডেট করুন' : 'পণ্য যোগ করুন'}`;
    }
  });
}

/**
 * Confirm and Delete Product Safely
 */
function confirmDeleteProduct(product, sellerApplication, onDeleteSuccess) {
  const container = document.createElement('div');
  container.style.padding = 'var(--space-2)';

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: var(--space-4);">
      <div style="font-size: 3rem; margin-bottom: var(--space-2);">⚠️</div>
      <h3 style="margin-bottom: var(--space-2);">পণ্য মুছে ফেলার নিশ্চয়তা</h3>
      <p style="color: var(--color-text-muted); font-size: var(--font-size-sm); line-height: 1.6;">
        আপনি কি সত্যি <strong>"${product.name}"</strong> পণ্যটি আপনার স্টোর থেকে স্থায়ীভাবে মুছে ফেলতে চান?
      </p>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-5);">
      <button type="button" id="confirm-del-cancel-btn" class="btn btn-outline">
        বাতিল করুন
      </button>
      <button type="button" id="confirm-del-action-btn" class="btn btn-primary" style="background-color: var(--color-error); border-color: var(--color-error);">
        🗑️ মুছে ফেলুন
      </button>
    </div>
  `;

  const deleteModal = createModal({
    title: "পণ্য ডিলিট নিশ্চিতকরণ",
    bodyContent: container
  });

  container.querySelector('#confirm-del-cancel-btn')?.addEventListener('click', () => {
    closeModal(deleteModal);
  });

  container.querySelector('#confirm-del-action-btn')?.addEventListener('click', async () => {
    const actionBtn = container.querySelector('#confirm-del-action-btn');
    actionBtn.disabled = true;
    actionBtn.innerHTML = `<span class="loading-spinner"></span> মোছা হচ্ছে...`;

    try {
      await deleteProduct(product.productId, sellerApplication.uid);
      showToast("পণ্যটি সফলভাবে মুছে ফেলা হয়েছে।", "success");
      closeModal(deleteModal);
      if (onDeleteSuccess) await onDeleteSuccess();
    } catch (err) {
      console.error("Delete product error:", err);
      showToast(err.message || "পণ্য মুছতে ব্যর্থ হয়েছে।", "error");
      actionBtn.disabled = false;
      actionBtn.innerHTML = `🗑️ মুছে ফেলুন`;
    }
  });
}
