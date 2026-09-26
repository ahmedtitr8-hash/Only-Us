// ============================================================
// ui-shared.js
// أدوات صغيرة مشتركة بين كل الفئات: إصلاح ارتفاع الشاشة عند ظهور
// لوحة المفاتيح، إذن الإشعارات، الأفاتار بالأحرف الأولى، نسخ رمز
// الغرفة، والمودال العام (تأكيد، بديل confirm() الافتراضي بالمتصفح).
// ============================================================

// ---------- إصلاح ارتفاع الشاشة عند ظهور لوحة المفاتيح (مشكلة شائعة على الجوال) ----------
function applyViewportHeight() {
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.querySelectorAll('.screen').forEach((el) => { el.style.height = vh + 'px'; });
}
window.addEventListener('resize', applyViewportHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', applyViewportHeight);
}
applyViewportHeight();

// ---------- إذن الإشعارات (يُستخدم من core.js عند إنشاء/الدخول لغرفة، ومن permanent.js) ----------
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

// ================= أفاتار بالأحرف الأولى =================

function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 62%, 46%)`;
}
function setAvatar(el, name) {
  const initial = (name || '؟').trim().charAt(0).toUpperCase();
  el.textContent = initial || '؟';
  el.style.background = nameToColor(name || 'x');
  el.classList.remove('avatar-empty');
}

// ================= نسخ الرمز =================

const copyCodeBtn = document.getElementById('copy-code-btn');

function copyRoomCode(btnEl) {
  if (!currentRoomCode) return;
  navigator.clipboard.writeText(currentRoomCode).then(() => {
    btnEl.classList.add('copied');
    setTimeout(() => btnEl.classList.remove('copied'), 1200);
  });
}
copyCodeBtn.addEventListener('click', () => copyRoomCode(copyCodeBtn));

// ================= تأكيد عام (بديل confirm() الافتراضي بالمتصفح) =================
const confirmModal = document.getElementById('confirm-modal');
const confirmModalText = document.getElementById('confirm-modal-text');
const confirmModalOk = document.getElementById('confirm-modal-ok');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');

function showConfirm(message) {
  return new Promise((resolve) => {
    confirmModalText.textContent = message;
    confirmModal.classList.remove('hidden');
    function cleanup(result) {
      confirmModal.classList.add('hidden');
      confirmModalOk.removeEventListener('click', onOk);
      confirmModalCancel.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    confirmModalOk.addEventListener('click', onOk);
    confirmModalCancel.addEventListener('click', onCancel);
  });
}
