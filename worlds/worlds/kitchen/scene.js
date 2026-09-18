import { box } from '../../engine/collision.js';
import { tileFloorTextures, plasterWallTexture, woodGrainTexture, fabricTexture } from '../../engine/textures.js';

// كل عالم يرجّع: { group (كل الموديلات), collisionBoxes, collisionMeshes (للكاميرا), interactables, spawnPoints }
// المطبخ ما يعرف شي عن الشخصية أو الشبكة — بس يوصف المكان.
export function buildKitchen(THREE, interactionSystem) {
  const group = new THREE.Group();
  const collisionBoxes = [];
  const collisionMeshes = [];
  const ROOM = 5.6; // نصف حجم الغرفة تقريبًا
  const wallH = 2.9;

  // ---------- أرضية بلاط واقعية ----------
  const { map: tileMap } = tileFloorTextures(THREE, { repeat: 6 });
  const floorMat = new THREE.MeshStandardMaterial({ map: tileMap, roughness: 0.55, metalness: 0.04 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // ---------- سقف (يقفل الحس البصري للغرفة ويحمل لمبة السقف) ----------
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.95 });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = wallH;
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // ---------- جدران بملمس جص ناعم + إفريز أرضي (Baseboard) ----------
  const { map: wallMap } = plasterWallTexture(THREE, { repeat: 3 });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.92 });
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });

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

    // إفريز خشبي أبيض بطول قاعدة الجدار — تفصيلة صغيرة ترفع الواقعية كثير
    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.11, d + 0.02), baseboardMat);
    baseboard.position.set(x, 0.06, z);
    if (rotY) baseboard.rotation.y = rotY;
    baseboard.receiveShadow = true;
    group.add(baseboard);
    return wall;
  }
  addWall(0, -ROOM, ROOM * 2, 0.2, 0);
  addWall(0, ROOM, ROOM * 2, 0.2, 0);
  addWall(-ROOM, 0, 0.2, ROOM * 2, 0);
  addWall(ROOM, 0, 0.2, ROOM * 2, 0);

  // ---------- نافذة واقعية: زجاج بتدرّج سماء + برواز + قضبان تقسيم ----------
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 64; skyCanvas.height = 64;
  const skyCtx = skyCanvas.getContext('2d');
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 64);
  skyGrad.addColorStop(0, '#bfe3f7');
  skyGrad.addColorStop(0.55, '#e8f3ee');
  skyGrad.addColorStop(1, '#cfe8c9');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 64, 64);
  skyCtx.fillStyle = 'rgba(255,255,255,0.85)';
  skyCtx.beginPath(); skyCtx.ellipse(18, 20, 10, 5, 0, 0, Math.PI * 2); skyCtx.fill();
  skyCtx.beginPath(); skyCtx.ellipse(42, 14, 8, 4, 0, 0, Math.PI * 2); skyCtx.fill();
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;

  const winGroup = new THREE.Group();
  winGroup.position.set(0, 1.7, -ROOM + 0.1);
  const winGlassMat = new THREE.MeshStandardMaterial({ map: skyTex, roughness: 0.15, metalness: 0, emissive: 0xffffff, emissiveMap: skyTex, emissiveIntensity: 0.35 });
  const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), winGlassMat);
  winGroup.add(winGlass);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.06), frameMat);
  frameTop.position.set(0, 0.585, 0.02); winGroup.add(frameTop);
  const frameBottom = frameTop.clone(); frameBottom.position.y = -0.585; winGroup.add(frameBottom);
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.06), frameMat);
  frameL.position.set(-0.815, 0, 0.02); winGroup.add(frameL);
  const frameR = frameL.clone(); frameR.position.x = 0.815; winGroup.add(frameR);
  const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.1, 0.03), frameMat);
  mullionV.position.z = 0.03; winGroup.add(mullionV);
  const mullionH = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.035, 0.03), frameMat);
  mullionH.position.z = 0.03; winGroup.add(mullionH);
  group.add(winGroup);
  // ضوء نهار خفيف يدخل فعليًا من مكان النافذة
  const windowLight = new THREE.PointLight(0xdcefff, 0.35, 6, 2);
  windowLight.position.set(0, 1.7, -ROOM + 1.2);
  group.add(windowLight);

  // ---------- لمبة سقف معلّقة (تجميلية + مصدر إضاءة داخلية) ----------
  const lampGroup = new THREE.Group();
  lampGroup.position.set(1.1, wallH, 1.2);
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.55, 6), cordMat);
  cord.position.y = -0.275;
  lampGroup.add(cord);
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2f2b26, roughness: 0.5, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.22, 20, 1, true), shadeMat);
  shade.position.y = -0.62;
  shade.castShadow = true;
  lampGroup.add(shade);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffdf9e, emissiveIntensity: 1.6, roughness: 0.4 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), bulbMat);
  bulb.position.y = -0.68;
  lampGroup.add(bulb);
  const lampLight = new THREE.PointLight(0xffdca8, 0.9, 6.5, 2);
  lampLight.position.y = -0.68;
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(512, 512);
  lampGroup.add(lampLight);
  group.add(lampGroup);

  // ---------- خزائن/كاونتر بطول الحائط اليمين ----------
  const { map: counterWoodMap } = woodGrainTexture(THREE, 0xd8c9ad, { repeat: 1.4 });
  const cabinetMat = new THREE.MeshStandardMaterial({ map: counterWoodMap, roughness: 0.55 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.22, metalness: 0.12 });

  function addCounter(x, z, w, d, h, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cabinetMat);
    base.position.y = h / 2;
    base.castShadow = true; base.receiveShadow = true;
    g.add(base);
    // مقابض الأدراج — تفصيلة صغيرة تكسر ملل السطح الأملس
    for (let hx = -w / 2 + 0.14; hx < w / 2; hx += 0.4) {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.3, metalness: 0.8 }));
      handle.rotation.z = Math.PI / 2;
      handle.position.set(hx, h * 0.35, d / 2 + 0.015);
      g.add(handle);
    }
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

  // خزائن معلّقة فوق الكاونتر (تفصيلة تضيف عمق للمطبخ)
  const upperCabinetMat = new THREE.MeshStandardMaterial({ map: counterWoodMap, roughness: 0.55 });
  const upperCabinet = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 2.3), upperCabinetMat);
  upperCabinet.position.set(ROOM - 0.68, 2.05, -2.6);
  upperCabinet.castShadow = true; upperCabinet.receiveShadow = true;
  group.add(upperCabinet);

  // ثلاجة (تفاعلية: افتح/سكّر) — ستانلس ستيل واقعي أكثر
  const fridgeGroup = new THREE.Group();
  fridgeGroup.position.set(ROOM - 0.5, 0, 2.4);
  const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xd8dde1, roughness: 0.28, metalness: 0.65 });
  const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.75, 0.75), fridgeMat);
  fridgeBody.position.y = 0.875;
  fridgeBody.castShadow = true;
  fridgeGroup.add(fridgeBody);
  const fridgeDoor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.7, 0.06), new THREE.MeshStandardMaterial({ color: 0xeef1f3, roughness: 0.22, metalness: 0.7 }));
  fridgeDoor.position.set(0, 0.875, 0.4);
  fridgeGroup.add(fridgeDoor);
  const fridgeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.25, metalness: 0.85 }));
  fridgeHandle.position.set(-0.36, 0.875, 0.44);
  fridgeGroup.add(fridgeHandle);
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
      fridgeHandle.position.x = fridgeOpen ? -0.71 : -0.36;
      fridgeHandle.position.z = fridgeOpen ? 0.98 : 0.44;
      fridgeHandle.rotation.y = fridgeOpen ? -1.15 : 0;
    },
  });

  // موقد (تفاعلي: شغّل/طفّي)
  const stoveGroup = new THREE.Group();
  stoveGroup.position.set(ROOM - 0.45, 0.9, -0.4);
  const stoveTop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.55), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.25, metalness: 0.5 }));
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

  // ---------- طاولة وكرسيّان بمنتصف الغرفة ----------
  const { map: tableWoodMap } = woodGrainTexture(THREE, 0x8a5a34, { repeat: 1 });
  const woodMat = new THREE.MeshStandardMaterial({ map: tableWoodMap, roughness: 0.45 });
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

  // طبق ووعاء فواكه بسيط فوق الطاولة — تفصيلة حياة صغيرة
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.35 });
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), bowlMat);
  bowl.position.set(table.position.x, 0.775, table.position.z);
  bowl.castShadow = true; bowl.receiveShadow = true;
  group.add(bowl);
  const fruitColors = [0xd6432c, 0xe8b23d, 0x6fae3f];
  fruitColors.forEach((clr, i) => {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshStandardMaterial({ color: clr, roughness: 0.4 }));
    const ang = (i / fruitColors.length) * Math.PI * 2;
    fruit.position.set(table.position.x + Math.cos(ang) * 0.06, 0.85, table.position.z + Math.sin(ang) * 0.06);
    fruit.castShadow = true;
    group.add(fruit);
  });

  const { map: chairFabricMap } = fabricTexture(THREE, 0x4a4038, { repeat: 1.5 });
  const sitPoints = [];
  function addChair(x, z, facingYaw) {
    const chair = new THREE.Group();
    chair.position.set(x, 0, z);
    chair.rotation.y = facingYaw;
    const seatMat = new THREE.MeshStandardMaterial({ map: chairFabricMap, roughness: 0.75 });
    const woodChairMat = new THREE.MeshStandardMaterial({ map: tableWoodMap, roughness: 0.5 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), seatMat);
    seat.position.y = 0.46;
    seat.castShadow = true;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.06), seatMat);
    back.position.set(0, 0.72, -0.19);
    back.castShadow = true;
    chair.add(back);
    for (const [lx, lz] of [[0.17, 0.17], [-0.17, 0.17], [0.17, -0.17], [-0.17, -0.17]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.46, 8), woodChairMat);
      leg.position.set(lx, 0.23, lz);
      chair.add(leg);
    }
    group.add(chair);

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
