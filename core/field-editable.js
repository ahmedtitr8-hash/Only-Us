// حقول الإدخال الحساسة (الاسم، رمز الغرفة، رابط الفيديو...) صارت عناصر
// <div contenteditable> بدل <input type="text">. السبب: نظام الإكمال التلقائي
// بالأندرويد يستهدف عناصر <input> تحديدًا (باعتبارها حقول نموذج)، ويتجاهل أحيانًا
// خصائص autocomplete="off" عمدًا. عنصر <div contenteditable> مو حقل نموذج من
// الأساس، فما يوصله أي اقتراح إكمال تلقائي (موقع/بطاقة/كلمة مرور...) من الأصل.
//
// هذا الملف يوفر الدوال البديلة لـ .value ولمنطق maxlength/inputmode اللي
// كان يوفرها المتصفح تلقائيًا على <input> وصار لازم نطبقها يدويًا هنا.

function getFieldValue(el) {
  if (!el) return '';
  return (el.textContent || '').replace(/\n/g, '');
}

function setFieldValue(el, value) {
  if (!el) return;
  el.textContent = value || '';
}

// numeric: يسمح بالأرقام فقط. maxLength: أقصى عدد أحرف مسموح.
function initEditableField(el, { numeric = false, maxLength = null } = {}) {
  if (!el) return;
  el.setAttribute('contenteditable', 'plaintext-only');
  el.setAttribute('role', 'textbox');
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');

  // بعض المتصفحات (سفاري القديم) ما يدعم plaintext-only، نرجع لـ true العادية
  if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');

  el.addEventListener('input', () => {
    let text = getFieldValue(el);
    if (numeric) text = text.replace(/\D/g, '');
    if (maxLength) text = text.slice(0, maxLength);
    if (text !== getFieldValue(el)) setFieldValue(el, text);
  });

  // منع الإدخال متعدد الأسطر بزر Enter (الحقول دي أصلًا سطر وحيد)
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });

  // لصق نص: نفلتره فورًا بدل ما نعتمد بس على حدث input
  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text);
  });
}

// بديل خاصية .disabled على <input>: عنصر <div> ما عنده هذي الخاصية أصلًا،
// فنعطّل الكتابة والتركيز يدويًا (مع كلاس is-disabled للمظهر).
function setFieldDisabled(el, disabled) {
  if (!el) return;
  el.classList.toggle('is-disabled', !!disabled);
  if (disabled) {
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('tabindex', '-1');
  } else {
    el.setAttribute('contenteditable', el.contentEditable === 'plaintext-only' || document.queryCommandSupported ? 'plaintext-only' : 'true');
    if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
    el.setAttribute('tabindex', '0');
  }
}
