// قائمة العوالم المتاحة. أضف عالمًا جديدًا هنا بدون لمس بقية المحرك.
// حسب مستند التنفيذ: غرفة واحدة ممتازة أولًا قبل أي توسّع — لذلك "غرفة المعيشة" هي
// العالم الافتراضي الوحيد المتاح حاليًا داخل «سوا»، والمطبخ محفوظ (متوفر=false) بدل حذفه.
export const WORLDS = [
  {
    id: 'living-room',
    name: 'غرفة المعيشة',
    available: true,
    loader: () => import('./worlds/living-room/scene.js'),
  },
  { id: 'kitchen', name: 'المطبخ', available: false, loader: () => import('./worlds/kitchen/scene.js') },
  { id: 'cafe', name: 'الكافيه', available: false },
  { id: 'rooftop', name: 'السطح', available: false },
  { id: 'camping', name: 'التخييم', available: false },
];

export const CHARACTER_COLORS = [
  { id: 'red', shirt: 0xe0524a, pants: 0x2b2f3a, skin: 0xf2c9a0 },
  { id: 'blue', shirt: 0x3f7ed1, pants: 0x24262f, skin: 0xe7b98f },
  { id: 'green', shirt: 0x4caf7d, pants: 0x2f2b26, skin: 0xf6d3ab },
  { id: 'purple', shirt: 0x8b5fc7, pants: 0x22232b, skin: 0xd9a877 },
  { id: 'yellow', shirt: 0xe8b23d, pants: 0x2c2c2c, skin: 0xf0c299 },
  { id: 'teal', shirt: 0x2fb6b0, pants: 0x262a2c, skin: 0xc98f65 },
];

export const NETWORK_SEND_HZ = 12; // معدل إرسال حالة الشخصية بالثانية
export const CHARACTER_RADIUS = 0.32;
export const WALK_SPEED = 1.7;
export const RUN_SPEED = 3.3;
