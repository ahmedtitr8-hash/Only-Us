// إعداد الـ renderer والمشهد والإضاءة الأساسية — بدون أي منطق خاص بعالم معيّن.
// quality اختياري (من quality.js) — لو ما انمرر نستخدم نفس افتراضيات "High" القديمة
// عشان ما نكسر أي استدعاء قديم للدالة.
export function createRenderer(THREE, canvas, quality) {
  const preset = quality || { pixelRatioCap: 1.5, shadows: true, shadowMapSize: 1024 };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  // ملاحظة أداء: نسبة بكسل أعلى من 1.5 على جوال (خصوصًا مع الظلال) تثقّل جدًا بدون
  // فرق واضح بالوضوح على شاشة صغيرة — هذا كان أحد أسباب البطء.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatioCap));
  renderer.shadowMap.enabled = preset.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x100e0a);
  scene.fog = new THREE.Fog(0x100e0a, 10, 24);
  return scene;
}

export function addBaseLighting(THREE, scene, { warm = true, quality } = {}) {
  const preset = quality || { shadows: true, shadowMapSize: 1024, pointLights: true };

  // إضاءة سماء/أرض عامة ناعمة (تحاكي الضوء المرتد من الجدران والسقف)
  const hemi = new THREE.HemisphereLight(0xd9e8ff, 0x2a221a, 0.55);
  scene.add(hemi);

  // "شمس" داخلة من النافذة — مصدر الظلال الرئيسي، حادة نسبيًا وواقعية
  const sun = new THREE.DirectionalLight(warm ? 0xffe9c9 : 0xffffff, 1.6);
  sun.position.set(3.5, 5.5, 2.5);
  sun.castShadow = preset.shadows;
  // حجم خريطة الظل يتبع الجودة المكتشفة (512 منخفض / 768 متوسط / 1024 عالي)
  const shadowSize = preset.shadowMapSize || 1024;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 20;
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -0.0018;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  let fill = null;
  if (preset.pointLights) {
    // ضوء تعبئة دافئ (يقلل حدة الظل المقابل للشمس، زي لمبة سقف) — نطفيه بجودة "منخفض"
    fill = new THREE.PointLight(0xffcf9e, 0.65, 10, 2);
    fill.position.set(-2.2, 2.5, -1.5);
    scene.add(fill);
  }

  // ضوء خلفي/محيطي باهت جدًا يفصل الشخصيات عن خلفية الغرفة الداكنة (Rim light)
  const rim = new THREE.DirectionalLight(0xbcd4ff, 0.28);
  rim.position.set(-4, 3, -4);
  scene.add(rim);

  return { hemi, sun, fill, rim };
}
