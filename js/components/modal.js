/* Modal Component Module */

import { getTranslation } from '../i18n/i18n.js';

export function createModal({ title, bodyContent, footerButtons = [] }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('h3');
  titleEl.style.margin = '0';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-outline btn-icon';
  closeBtn.innerHTML = '✕';
  closeBtn.setAttribute('aria-label', getTranslation('common.close'));
  closeBtn.addEventListener('click', () => closeModal(backdrop));

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof bodyContent === 'string') {
    body.innerHTML = bodyContent;
  } else {
    body.appendChild(bodyContent);
  }

  modal.appendChild(header);
  modal.appendChild(body);

  if (footerButtons.length > 0) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footerButtons.forEach((btnConfig) => {
      const btn = document.createElement('button');
      btn.className = `btn ${btnConfig.class || 'btn-outline'}`;
      btn.textContent = btnConfig.text;
      btn.addEventListener('click', () => {
        if (btnConfig.onClick) btnConfig.onClick();
        closeModal(backdrop);
      });
      footer.appendChild(btn);
    });
    modal.appendChild(footer);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal(backdrop);
  });

  // Open modal
  setTimeout(() => backdrop.classList.add('open'), 10);
  return backdrop;
}

export function closeModal(backdrop) {
  backdrop.classList.remove('open');
  setTimeout(() => backdrop.remove(), 250);
}
