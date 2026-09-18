import { resolveCollision } from './collision.js';
import { WALK_SPEED, RUN_SPEED, CHARACTER_RADIUS } from '../config.js';

// يحرك شخصية محلية وحدة واحدة بالإطار الحالي، بناءً على متجه الجويستيك وزاوية الكاميرا.
// ملاحظة أداء: نستخدم أرقام عادية بدل THREE.Vector3 هنا لأن هذي الدالة تشتغل كل فريم —
// إنشاء كائنات Vector3 جديدة كل فريم يثقّل على الـ Garbage Collector ويسبب تقطيع بالحركة.
export function updateMovement(THREE, controller, joystickVec, cameraYaw, collisionBoxes, dt) {
  if (controller.sitting) return 'SITTING';

  const mag = Math.min(1, Math.hypot(joystickVec.x, joystickVec.y));
  if (mag < 0.06) {
    return 'IDLE';
  }

  const running = mag > 0.72;
  const speed = running ? RUN_SPEED : WALK_SPEED;

  const fx = Math.sin(cameraYaw), fz = Math.cos(cameraYaw);
  // ملاحظة: اتجاه "اليمين" الصحيح هو دوران "الأمام" بمقدار -90° وليس +90° —
  // كان هذا مقلوبًا وهو سبب مشكلة "اروح يمين يروح يسار".
  const rx = Math.sin(cameraYaw - Math.PI / 2), rz = Math.cos(cameraYaw - Math.PI / 2);

  let mx = fx * joystickVec.y + rx * joystickVec.x;
  let mz = fz * joystickVec.y + rz * joystickVec.x;
  const len = Math.hypot(mx, mz);
  if (len < 1e-6) return 'IDLE';
  const scale = (speed * dt * mag) / len;
  mx *= scale; mz *= scale;

  const targetX = controller.pos.x + mx;
  const targetZ = controller.pos.z + mz;
  const resolved = resolveCollision(targetX, targetZ, CHARACTER_RADIUS, collisionBoxes);
  controller.pos.x = resolved.x;
  controller.pos.z = resolved.z;

  const targetYaw = Math.atan2(mx, mz);
  controller.faceYaw(targetYaw, dt);

  return running ? 'RUNNING' : 'WALKING';
}
