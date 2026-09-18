import { CHARACTER_COLORS } from '../config.js';

export function createLoadingOverlay(container, text) {
  const el = document.createElement('div');
  el.className = 'w3d-loading';
  el.innerHTML = `
    <div class="w3d-loading-box">
      <span class="spinner"></span>
      <p class="w3d-loading-text">${text}</p>
      <div class="w3d-progress"><div class="w3d-progress-fill"></div></div>
    </div>`;
  container.appendChild(el);
  return {
    el,
    setProgress(pct) { el.querySelector('.w3d-progress-fill').style.width = Math.round(pct) + '%'; },
    setText(t) { el.querySelector('.w3d-loading-text').textContent = t; },
    hide() { el.classList.add('hidden'); },
    remove() { el.remove(); },
  };
}

// شاشة اختيار الشخصية — تظهر مرة قبل الدخول، والاختيار يُحفظ محليًا (localStorage) بدون قاعدة بيانات.
export function createCharacterPicker(container, savedColorId, onConfirm) {
  const el = document.createElement('div');
  el.className = 'w3d-picker';
  el.innerHTML = `
    <div class="w3d-picker-box">
      <h3>اختر شخصيتك</h3>
      <div class="w3d-color-grid"></div>
      <button class="primary-btn w3d-picker-confirm">ادخل عالمنا</button>
    </div>`;
  container.appendChild(el);

  const grid = el.querySelector('.w3d-color-grid');
  let selected = savedColorId || CHARACTER_COLORS[0].id;

  CHARACTER_COLORS.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'w3d-color-swatch' + (c.id === selected ? ' selected' : '');
    btn.style.background = '#' + c.shirt.toString(16).padStart(6, '0');
    btn.addEventListener('click', () => {
      selected = c.id;
      grid.querySelectorAll('.w3d-color-swatch').forEach((s) => s.classList.remove('selected'));
      btn.classList.add('selected');
    });
    grid.appendChild(btn);
  });

  el.querySelector('.w3d-picker-confirm').addEventListener('click', () => {
    el.remove();
    onConfirm(selected);
  });

  return el;
}

export function createInteractButton(container) {
  const btn = document.createElement('button');
  btn.className = 'w3d-interact-btn hidden';
  container.appendChild(btn);
  return btn;
}

export function createPeerWaitingBadge(container) {
  const el = document.createElement('div');
  el.className = 'w3d-peer-waiting';
  el.textContent = 'بانتظار دخول الطرف الآخر للعالم…';
  container.appendChild(el);
  return el;
}
