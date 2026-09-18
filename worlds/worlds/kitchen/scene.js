import { box } from '../../engine/collision.js';

// كل عالم يرجّع: { group (كل الموديلات), collisionBoxes, collisionMeshes (للكاميرا), interactables, spawnPoints }
// المطبخ ما يعرف شي عن الشخصية أو الشبكة — بس يوصف المكان.
export function buildKitchen(THREE, interactionSystem) {
  const group = new THREE.Group();
  const collisionBoxes = [];
  const collisionMeshes = [];
  const ROOM = 5.6; // نصف حجم الغرفة تقريبًا

  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.8 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9e0d0, roughness: 0.95 });
  const wallH = 2.9;
  function addWall(x, z, w, d, rotY) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    wall.position.set(x, wallH / 2, z);
    if (rotY) wall.rotation.y = rotY;
    wall.receiveShadow = true;
    wall.castShadow = false;
    group.add(wall);
    collisionMeshes.push(wall);
    const hw = w / 2, hd = d / 2;
    collisionBoxes.push(box(x - hw, z - hd, x + hw, z + hd));
    return wall;
  }
  addWall(0, -ROOM, ROOM * 2, 0.2, 0);
  addWall(0, ROOM, ROOM * 2, 0.2, 0);
  addWall(-ROOM, 0, 0.2, ROOM * 2, 0);
  addWall(ROOM, 0, 0.2, ROOM * 2, 0);

  // نافذة بسيطة (مربع أفتح على الحائط الخلفي) — تجميلية فقط
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x9fd3e8, emissive: 0x2a3f4a, roughness: 0.2, metalness: 0.1 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), windowMat);
  win.position.set(0, 1.7, -ROOM + 0.11);
  group.add(win);

  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xf4ede0, roughness: 0.5 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x2f2f33, roughness: 0.35 });

  // خزائن/كاونتر بطول الحائط اليمين
  function addCounter(x, z, w, d, h, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cabinetMat);
    base.position.y = h / 2;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.05, d + 0.05), counterMat);
    top.position.y = h + 0.025;
    top.castShadow = true;
    g.add(top);
    group.add(g);
    collisionMeshes.push(base);
    const hw = w / 2, hd = d / 2;
    const c = Math.cos(rotY), s = Math.sin(rotY);
    // تقريب مربّع محاذٍ للمحاور كافٍ لهذا المقياس من التدوير (0 أو 90 درجة فقط هنا)
    const ex = Math.abs(hw * c) + Math.abs(hd * s);
    const ez = Math.abs(hw * s) + Math.abs(hd * c);
    collisionBoxes.push(box(x - ex, z - ez, x + ex, z + ez));
    return g;
  }
  addCounter(ROOM - 0.45, -2.6, 0.85, 2.4, 0.9);
  addCounter(ROOM - 0.45, 0.4, 0.85, 1.6, 0.9);

  // ثلاجة (تفاعلية: افتح/سكّر)
  const fridgeGroup = new THREE.Group();
  fridgeGroup.position.set(ROOM - 0.5, 0, 2.4);
  const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xe4e7ea, roughness: 0.35, metalness: 0.4 });
  const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.75, 0.75), fridgeMat);
  fridgeBody.position.y = 0.875;
  fridgeBody.castShadow = true;
  fridgeGroup.add(fridgeBody);
  const fridgeDoor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.7, 0.06), new THREE.MeshStandardMaterial({ color: 0xf3f5f6, roughness: 0.3, metalness: 0.5 }));
  fridgeDoor.position.set(0, 0.875, 0.4);
  fridgeGroup.add(fridgeDoor);
  group.add(fridgeGroup);
  collisionMeshes.push(fridgeBody);
  collisionBoxes.push(box(ROOM - 0.95, 2.02, ROOM - 0.05, 2.78));
  let fridgeOpen = false;
  interactionSystem.register({
    position: { x: fridgeGroup.position.x, z: fridgeGroup.position.z + 0.5 },
    radius: 1.15,
    label: () => (fridgeOpen ? 'سكّر الثلاجة' : 'افتح الثلاجة'),
    onUse: () => {
      fridgeOpen = !fridgeOpen;
      fridgeDoor.rotation.y = fridgeOpen ? -1.15 : 0;
      fridgeDoor.position.x = fridgeOpen ? -0.35 : 0;
      fridgeDoor.position.z = fridgeOpen ? 0.68 : 0.4;
    },
  });

  // موقد (تفاعلي: شغّل/طفّي)
  const stoveGroup = new THREE.Group();
  stoveGroup.position.set(ROOM - 0.45, 0.9, -0.4);
  const stoveTop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.55), new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.4, metalness: 0.6 }));
  stoveGroup.add(stoveTop);
  const burnerLight = new THREE.PointLight(0xff7a3d, 0, 1.4, 2);
  burnerLight.position.set(0, 0.15, 0);
  stoveGroup.add(burnerLight);
  const burnerRing = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.12, 20), new THREE.MeshBasicMaterial({ color: 0x552211 }));
  burnerRing.rotation.x = -Math.PI / 2;
  burnerRing.position.y = 0.032;
  stoveGroup.add(burnerRing);
  group.add(stoveGroup);
  let stoveOn = false;
  interactionSystem.register({
    position: { x: stoveGroup.position.x, z: stoveGroup.position.z + 0.45 },
    radius: 1.0,
    label: () => (stoveOn ? 'طفّي الموقد' : 'شغّل الموقد'),
    onUse: () => {
      stoveOn = !stoveOn;
      burnerLight.intensity = stoveOn ? 1.4 : 0;
      burnerRing.material.color.set(stoveOn ? 0xff5a1f : 0x552211);
    },
  });

  // طاولة وكرسيّان بمنتصف الغرفة
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.55 });
  const table = new THREE.Group();
  table.position.set(-0.6, 0, 0.2);
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 24), woodMat);
  tableTop.position.y = 0.74;
  tableTop.castShadow = true; tableTop.receiveShadow = true;
  table.add(tableTop);
  const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.72, 12), woodMat);
  tableLeg.position.y = 0.36;
  tableLeg.castShadow = true;
  table.add(tableLeg);
  group.add(table);
  collisionMeshes.push(tableTop);
  collisionBoxes.push(box(table.position.x - 0.72, table.position.z - 0.72, table.position.x + 0.72, table.position.z + 0.72));

  const sitPoints = [];
  function addChair(x, z, facingYaw) {
    const chair = new THREE.Group();
    chair.position.set(x, 0, z);
    chair.rotation.y = facingYaw;
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.6 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), seatMat);
    seat.position.y = 0.46;
    seat.castShadow = true;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.06), seatMat);
    back.position.set(0, 0.72, -0.19);
    back.castShadow = true;
    chair.add(back);
    for (const [lx, lz] of [[0.17, 0.17], [-0.17, 0.17], [0.17, -0.17], [-0.17, -0.17]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.46, 8), seatMat);
      leg.position.set(lx, 0.23, lz);
      chair.add(leg);
    }
    group.add(chair);

    const worldSitPos = { x, z: z + Math.sin(facingYaw) * 0.02 };
    const sitPoint = { x, z, yaw: facingYaw };
    sitPoints.push(sitPoint);

    interactionSystem.register({
      position: { x, z },
      radius: 0.95,
      label: () => 'اجلس',
      onUse: () => interactionSystem._sitHandler && interactionSystem._sitHandler(sitPoint, chair),
    });
    return chair;
  }
  addChair(-0.6, 0.95, Math.PI);
  addChair(-0.6, -0.55, 0);

  const spawnPoints = [
    { x: 1.3, z: 1.6, yaw: Math.PI },
    { x: 1.3, z: -1.2, yaw: Math.PI },
  ];

  return { group, collisionBoxes, collisionMeshes, spawnPoints, sitPoints };
}
