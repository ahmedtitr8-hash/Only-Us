// ============================================================
// sw.js — Service Worker لـonlyUs
// الاستراتيجية: "الشبكة أولًا" (network-first) لكل ملفات الموقع نفسه
// (html/css/js/manifest/أيقونات) — يعني كل ما يكون النت شغال، المتصفح
// يروح للسيرفر أول شي ويجيب أحدث نسخة فعليًا ويعرضها فورًا، وبنفس الوقت
// يحفظ نسخة بالكاش بس احتياطًا لحالة انقطاع النت لاحقًا. هذا يحل بالضبط
// مشكلة تطبيقات الـPWA اللي تعلق بنسخة قديمة مخبأة ولا تتحدث - الكاش هنا
// شبكة أمان لوضع "بدون نت" بس، مو مصدر أساسي للمحتوى أبدًا.
//
// الأهم: أي طلب لنطاق خارجي (Firebase/Firestore، PeerJS، يوتيوب، hls.js،
// mpegts.js، الخطوط...) ما نتدخل فيه إطلاقًا - يمر للشبكة مباشرة زي ما
// المتصفح يسويه افتراضيًا. لازم يبقى حي دايمًا (تزامن لحظي)، والتدخل فيه
// بكاش ممكن يكسر الاتصال أو يعرض بيانات قديمة بالغلط.
// ============================================================

const CACHE_NAME = 'onlyus-cache-v1';
// غيّره (v2, v3...) بس لو سويت تغيير جذري بأسماء/مسارات الملفات (مثل تقسيم
// core.js اليوم لعدة ملفات) عشان يضمن مسح أي كاش قديم بأسماء ملفات ما عادت
// موجودة. مو ضروري لتحديث المحتوى العادي - network-first تحت أصلًا يجيب
// الأحدث كل ما يكون النت شغال بغض النظر عن اسم الكاش.

// أقل شي كافي نحفظه وقت التثبيت عشان التطبيق يفتح حتى أول مرة بدون نت
const APP_SHELL = ['./index.html', './manifest.json'];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting(); // نفعّل النسخة الجديدة فورًا بدون ما ننتظر إغلاق كل التبويبات
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()) // نمسك كل التبويبات المفتوحة فورًا بالنسخة الجديدة
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // بس طلبات GET من نفس الموقع - أي شي ثاني (Firebase، PeerJS، يوتيوب، مكتبات
  // الفيديو، الخطوط...) يمر عادي بدون أي تدخل من الـService Worker
  if (req.method !== 'GET' || !isSameOrigin(url)) return;

  event.respondWith(networkFirst(req));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    // نحفظ نسخة بالكاش بالخلفية بس لو الطلب نجح فعلًا (ما نحفظ أخطاء 404 مثلًا)
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    // ما فيه نت - نرجع آخر نسخة محفوظة إن وجدت
    const cached = await caches.match(request);
    if (cached) return cached;
    // ما فيه ولا كاش - لو كان طلب صفحة (تنقّل)، نرجع index.html المحفوظة كحل
    // أخير عشان الصفحة تفتح على الأقل بدل شاشة خطأ بيضاء
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}
