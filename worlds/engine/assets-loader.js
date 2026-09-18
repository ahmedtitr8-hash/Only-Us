// محمّل أصول حقيقية اختياري: يحاول تحميل GLB/HDRI من مجلد assets/ داخل عالم معيّن.
// لو الملف غير موجود (لسا ما انحط) أو التحميل فشل، يرجّع null بهدوء بدل ما يكسر العالم —
// وبذلك كل مشهد إجرائي (procedural) يفضل يشتغل بشكل طبيعي لحد ما تُضاف أصول حقيقية،
// وبمجرد ما تنحط بالمسار الصحيح تُستخدم تلقائيًا بدون أي تعديل على بقية الملفات.
//
// طريقة الاستخدام داخل أي scene.js:
//   const glb = await tryLoadGLB(THREE, 'worlds/living-room/assets/sofa.glb');
//   if (glb) { group.add(glb.scene); }
//   else { /* ابنِ الأريكة إجرائيًا كخطة بديلة */ }

const THREE_EXAMPLES_BASE = 'https://unpkg.com/three@0.160.1/examples/jsm';

let gltfLoaderPromise = null;
let dracoLoaderPromise = null;
let rgbeLoaderPromise = null;

async function getGLTFLoader() {
  if (!gltfLoaderPromise) {
    gltfLoaderPromise = import(/* webpackIgnore: true */ `${THREE_EXAMPLES_BASE}/loaders/GLTFLoader.js`);
  }
  return gltfLoaderPromise;
}
async function getDRACOLoader() {
  if (!dracoLoaderPromise) {
    dracoLoaderPromise = import(/* webpackIgnore: true */ `${THREE_EXAMPLES_BASE}/loaders/DRACOLoader.js`);
  }
  return dracoLoaderPromise;
}
async function getRGBELoader() {
  if (!rgbeLoaderPromise) {
    rgbeLoaderPromise = import(/* webpackIgnore: true */ `${THREE_EXAMPLES_BASE}/loaders/RGBELoader.js`);
  }
  return rgbeLoaderPromise;
}

// يحمّل GLB واحد (مع دعم ضغط Draco إذا كان الملف مضغوطًا بيه). يرجّع { scene, animations } أو null.
export async function tryLoadGLB(THREE, url, { draco = true } = {}) {
  try {
    const { GLTFLoader } = await getGLTFLoader();
    const loader = new GLTFLoader();
    if (draco) {
      try {
        const { DRACOLoader } = await getDRACOLoader();
        const dracoLoader = new DRACOLoader();
        // نفس مسار draco decoder الرسمي — يعمل فقط لو الملف فعليًا مضغوط بـ Draco
        dracoLoader.setDecoderPath(`${THREE_EXAMPLES_BASE}/libs/draco/`);
        loader.setDRACOLoader(dracoLoader);
      } catch {
        // فشل تجهيز Draco مو سبب كافٍ لإلغاء تحميل GLB غير مضغوط
      }
    }
    const gltf = await new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    return { scene: gltf.scene, animations: gltf.animations || [] };
  } catch (err) {
    // الحالة الطبيعية طول ما الأصل الحقيقي لسا ما انحط بالمشروع — رجّع null بهدوء
    return null;
  }
}

// يحمّل HDRI (.hdr) كبيئة إضاءة/انعكاسات للمشهد. يرجّع true لو نجح، false لو الملف غير موجود.
export async function tryLoadHDRI(THREE, renderer, scene, url) {
  try {
    const { RGBELoader } = await getRGBELoader();
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const hdrTexture = await new Promise((resolve, reject) => {
      new RGBELoader().load(url, resolve, undefined, reject);
    });
    const envMap = pmrem.fromEquirectangular(hdrTexture).texture;
    scene.environment = envMap;
    hdrTexture.dispose();
    pmrem.dispose();
    return true;
  } catch (err) {
    // طبيعي جدًا لو الملف غير موجود بعد (بيئة الإضاءة الحالية تفضل تشتغل بدونه)
    return false;
  }
}

// يحاول Mixamo animation (FBX) لاحقًا لو احتجناه — محجوز للتوسع، غير مستخدم حاليًا
// لأن الشخصية الحالية إجرائية (procedural) وتُحرَّك عبر animation.js وليس عبر Rig حقيقي.
