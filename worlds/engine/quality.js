// تقدير جودة تلقائي (Low/Medium/High) حسب إمكانيات الجهاز، مع إمكانية حفظ اختيار المستخدم يدويًا.
// الهدف: نفس الكود يشتغل بسلاسة على جوال متوسط بدل ما نفترض دايمًا جهاز قوي.
const STORAGE_KEY = 'onlyus_world_quality';

export const QUALITY_PRESETS = {
  low: {
    pixelRatioCap: 1,
    shadows: false,
    shadowMapSize: 512,
    pointLights: false, // نكتفي بإضاءة الشمس + Hemisphere
    postProcessing: false,
  },
  medium: {
    pixelRatioCap: 1.25,
    shadows: true,
    shadowMapSize: 768,
    pointLights: true,
    postProcessing: false,
  },
  high: {
    pixelRatioCap: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    pointLights: true,
    postProcessing: false, // نتركها معطلة افتراضيًا لتفادي كلفة أداء غير ضرورية على الجوال
  },
};

// تقدير بدائي: عدد الأنوية + ذاكرة الجهاز (متاحة بمعظم متصفحات أندرويد، غير متاحة بسفاري/iOS
// فنفترض هناك mid-range احتياطًا بدل ما نفترض دايمًا الأعلى).
function estimateTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory; // undefined على iOS
  if (mem !== undefined) {
    if (mem <= 3 || cores <= 4) return 'low';
    if (mem <= 6) return 'medium';
    return 'high';
  }
  if (cores <= 4) return 'medium'; // احتياطي متحفظ لما ما نقدر نقيس الذاكرة
  return 'high';
}

export function detectQuality() {
  const forced = localStorage.getItem(STORAGE_KEY);
  const tier = forced && QUALITY_PRESETS[forced] ? forced : estimateTier();
  return { tier, preset: QUALITY_PRESETS[tier] };
}

export function setQualityOverride(tier) {
  if (QUALITY_PRESETS[tier]) localStorage.setItem(STORAGE_KEY, tier);
}
