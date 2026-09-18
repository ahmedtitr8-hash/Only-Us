// تصادم بسيط: قائمة صناديق AABB (بحدود min/max بالمحورين x/z)، ونحل التصادم محور بمحور
// عشان الشخصية "تنزلق" على جدار بدل ما تتوقف فجأة.
export function resolveCollision(nextX, nextZ, radius, boxes) {
  let x = nextX;
  let z = nextZ;

  for (const b of boxes) {
    const closestX = Math.max(b.minX, Math.min(x, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius && distSq > 1e-9) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      x += dx * push;
      z += dz * push;
    } else if (distSq <= 1e-9) {
      // المركز داخل الصندوق تمامًا (حالة نادرة) — ادفعه لأقرب حافة
      const distToMinX = x - b.minX, distToMaxX = b.maxX - x;
      const distToMinZ = z - b.minZ, distToMaxZ = b.maxZ - z;
      const min = Math.min(distToMinX, distToMaxX, distToMinZ, distToMaxZ);
      if (min === distToMinX) x = b.minX - radius;
      else if (min === distToMaxX) x = b.maxX + radius;
      else if (min === distToMinZ) z = b.minZ - radius;
      else z = b.maxZ + radius;
    }
  }
  return { x, z };
}

export function box(minX, minZ, maxX, maxZ) {
  return { minX, minZ, maxX, maxZ };
}
