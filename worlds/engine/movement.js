import { resolveCollision } from './collision.js';
import { WALK_SPEED, RUN_SPEED, CHARACTER_RADIUS } from '../config.js';

// يحرك شخصية محلية وحدة واحدة بالإطار الحالي، بناءً على متجه الجويستيك وزاوية الكاميرا.
export function updateMovement(THREE, controller, joystickVec, cameraYaw, collisionBoxes, dt) {
  if (controller.sitting) return 'SITTING';

  const mag = Math.min(1, Math.hypot(joystickVec.x, joystickVec.y));
  if (mag < 0.06) {
    return 'IDLE';
  }

  const running = mag > 0.72;
  const speed = running ? RUN_SPEED : WALK_SPEED;

  const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
  const right = new THREE.Vector3(Math.sin(cameraYaw + Math.PI / 2), 0, Math.cos(cameraYaw + Math.PI / 2));

  const move = new THREE.Vector3()
    .addScaledVector(forward, joystickVec.y)
    .addScaledVector(right, joystickVec.x);
  if (move.lengthSq() < 1e-6) return 'IDLE';
  move.normalize().multiplyScalar(speed * dt * mag);

  const targetX = controller.pos.x + move.x;
  const targetZ = controller.pos.z + move.z;
  const resolved = resolveCollision(targetX, targetZ, CHARACTER_RADIUS, collisionBoxes);
  controller.pos.x = resolved.x;
  controller.pos.z = resolved.z;

  const targetYaw = Math.atan2(move.x, move.z);
  controller.faceYaw(targetYaw, dt);

  return running ? 'RUNNING' : 'WALKING';
}
