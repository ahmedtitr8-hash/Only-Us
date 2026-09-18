import { box } from '../../engine/collision.js';
import { woodFloorTextures, plasterWallTexture, woodGrainTexture, fabricTexture, rugPatternTexture } from '../../engine/textures.js';
import { tryLoadGLB } from '../../engine/assets-loader.js';

// غرفة معيشة منزلية واقعية — أول عالم فعلي داخل «سوا» (حسب مستند التنفيذ: غرفة واحدة
// ممتازة أولًا قبل أي توسّع). كل عالم يرجّع نفس الشكل المعتمد بالمحرك:
// { group, collisionBoxes, collisionMeshes, interactables?, spawnPoints, sitPoints }
//
// ctx (اختياري): { renderer, scene, quality } — تُستخدم فقط لمحاولة تحميل أصول حقيقية
// (GLB/HDRI) إن وُجدت بمجلد assets/ المجاور. لو ما انحطت بعد، يبني المشهد إجرائيًا
// بنفس الشكل والتصادم بدون أي كسر — وبمجرد إضافة الملفات الحقيقية لاحقًا تُستخدم تلقائيًا.
export async function buildLivingRoom(THREE, interactionSystem, ctx = {}) {
  const group = new THREE.Group();
  const collisionBoxes = [];
  const collisionMeshes = [];
  const ROOM_X = 6.2;
  const ROOM_Z = 5.4;
  const wallH = 2.9;

  // ---------- محاولة أصل حقيقي كامل للغرفة (لو انحط لاحقًا) ----------
  // لو فيه GLB جاهز للغرفة كاملة نستخدمه ونرجع مباشرة بأماكن ظهور/جلوس افتراضية بسيطة.
  const realRoom = await tryLoadGLB(THREE, 'worlds/worlds/living-room/assets/living-room.glb');
  if (realRoom) {
    group.add(realRoom.scene);
    const spawnPoints = [
      { x: 1.6, z: 2.2, yaw: Math.PI },
      { x: -1.6, z: 2.2, yaw: Math.PI },
    ];
    return { group, collisionBoxes, collisionMeshes, spawnPoints, sitPoints: [] };
  }

  // ---------- أرضية باركيه واقعية ----------
  const { map: floorMap, roughnessMap: floorRoughMap } = woodFloorTextures(THREE, { repeat: 7 });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorMap, roughnessMap: floorRoughMap, roughness: 0.6, metalness: 0.02 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_X * 2, ROOM_Z * 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // ---------- سجادة مزخرفة وسط الغرفة ----------
  const { map: rugMap } = rugPatternTexture(THREE, { base: '#7c3f36', border: '#dcc79a' });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshStandardMaterial({ map: rugMap, roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.008, 0.6);
  rug.receiveShadow = true;
  group.add(rug);

  // ---------- سقف ----------
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.95 });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_X * 2, ROOM_Z * 2), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = wallH;
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // ---------- جدران جص دافئة + إفريز أرضي ----------
  const { map: wallMap } = plasterWallTexture(THREE, { repeat: 3.5, tint: '#efe6d6' });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.92 });
  const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });

  function addWall(x, z, w, d, rotY) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    wall.position.set(x, wallH / 2, z);
    if (rotY) wall.rotation.y = rotY;
    wall.receiveShadow = true;
    group.add(wall);
    collisionMeshes.push(wall);
    const hw = w / 2, hd = d / 2;
    collisionBoxes.push(box(x - hw, z - hd, x + hw, z + hd));

    const baseboard = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.11, d + 0.02), baseboardMat);
    baseboard.position.set(x, 0.06, z);
    if (rotY) baseboard.rotation.y = rotY;
    baseboard.receiveShadow = true;
    group.add(baseboard);
    return wall;
  }
  addWall(0, -ROOM_Z, ROOM_X * 2, 0.2, 0);
  addWall(0, ROOM_Z, ROOM_X * 2, 0.2, 0);
  addWall(-ROOM_X, 0, 0.2, ROOM_Z * 2, 0);
  addWall(ROOM_X, 0, 0.2, ROOM_Z * 2, 0);

  // ---------- نافذتان بالجدار الخلفي + ستائر ----------
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 64; skyCanvas.height = 64;
  const skyCtx = skyCanvas.getContext('2d');
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 64);
  skyGrad.addColorStop(0, '#bfe3f7');
  skyGrad.addColorStop(0.55, '#eef5ee');
  skyGrad.addColorStop(1, '#d7ecd0');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 64, 64);
  skyCtx.fillStyle = 'rgba(255,255,255,0.85)';
  skyCtx.beginPath(); skyCtx.ellipse(16, 18, 9, 4.5, 0, 0, Math.PI * 2); skyCtx.fill();
  skyCtx.beginPath(); skyCtx.ellipse(44, 24, 7, 3.5, 0, 0, Math.PI * 2); skyCtx.fill();
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const { map: curtainMap } = fabricTexture(THREE, 0x9a5f47, { repeat: 2 });
  const curtainMat = new THREE.MeshStandardMaterial({ map: curtainMap, roughness: 0.85, side: THREE.DoubleSide });

  function addWindow(x, z, w = 1.5, h = 1.5) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), skyMat);
    glass.position.set(x, 1.5, z - 0.09);
    group.add(glass);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.08), frameMat);
    frame.position.set(x, 1.5, z - 0.06);
    frame.castShadow = true;
    group.add(frame);
    // قضيب تقسيم وسط النافذة (تفصيلة واقعية بسيطة)
    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, 0.03), frameMat);
    mullionV.position.set(x, 1.5, z - 0.085);
    group.add(mullionV);
    const mullionH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.03), frameMat);
    mullionH.position.set(x, 1.5, z - 0.085);
    group.add(mullionH);

    // ستائر جانبية مطوية بشكل خفيف
    for (const side of [-1, 1]) {
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.45, h + 0.5, 8, 1), curtainMat);
      curtain.position.set(x + side * (w / 2 + 0.35), 1.5, z + 0.05);
      // موجة بسيطة بالهندسة تعطي إحساس القماش المطوي بدل سطح مسطح تمامًا
      const posAttr = curtain.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const px = posAttr.getX(i);
        posAttr.setZ(i, Math.sin(px * 14) * 0.03);
      }
      posAttr.needsUpdate = true;
      curtain.geometry.computeVertexNormals();
      curtain.castShadow = true;
      group.add(curtain);
    }
    return z;
  }
  addWindow(-2.4, -ROOM_Z);
  addWindow(2.4, -ROOM_Z);

  const sitPoints = [];

  // ---------- أريكة 3 مقاعد ----------
  const { map: sofaMap } = fabricTexture(THREE, 0x4d6a73, { repeat: 2 });
  const sofaMat = new THREE.MeshStandardMaterial({ map: sofaMap, roughness: 0.85 });
  const cushionMat = new THREE.MeshStandardMaterial({ map: sofaMap, roughness: 0.8 });

  function buildSofa(x, z, yaw) {
    const sofa = new THREE.Group();
    sofa.position.set(x, 0, z);
    sofa.rotation.y = yaw;

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.36, 0.85), sofaMat);
    base.position.y = 0.2;
    base.castShadow = true; base.receiveShadow = true;
    sofa.add(base);

    const back = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 0.22), sofaMat);
    back.position.set(0, 0.66, -0.32);
    back.castShadow = true;
    sofa.add(back);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.85), sofaMat);
      arm.position.set(side * 1.04, 0.44, 0);
      arm.castShadow = true;
      sofa.add(arm);
    }

    // ثلاث وسائد جلوس منفصلة فوق القاعدة — تكسر شكل "الصندوق" وتعطي إحساس أريكة حقيقية
    const seatOffsets = [-0.62, 0, 0.62];
    seatOffsets.forEach((sx) => {
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.78), cushionMat);
      cushion.position.set(sx, 0.44, 0.02);
      cushion.castShadow = true;
      sofa.add(cushion);
      // وسادة زخرفية صغيرة فوق كل مقعد جانبي
      if (sx !== 0) {
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.1), new THREE.MeshStandardMaterial({ color: sx < 0 ? 0xd9a441 : 0xb8563f, roughness: 0.8 }));
        pillow.position.set(sx, 0.62, -0.15);
        pillow.rotation.y = sx < 0 ? 0.3 : -0.3;
        pillow.castShadow = true;
        sofa.add(pillow);
      }

      // نقطة جلوس لكل مقعد: نحوّل موقع الوسادة المحلي (sx, 0.05) لإحداثيات العالم
      // بنفس مصفوفة دوران Three.js حول Y (لازم نفس التحويل المستخدم بصندوق التصادم تحت
      // عشان نقطة الجلوس تطابق فعليًا مكان الوسادة المرسومة، مو معكوسة).
      const localSeatZ = 0.05;
      const sitPoint = {
        x: x + sx * Math.cos(yaw) + localSeatZ * Math.sin(yaw),
        z: z - sx * Math.sin(yaw) + localSeatZ * Math.cos(yaw),
        yaw,
      };
      sitPoints.push(sitPoint);
      interactionSystem.register({
        position: { x: sitPoint.x, z: sitPoint.z },
        radius: 0.9,
        label: () => 'اجلس',
        onUse: () => interactionSystem._sitHandler && interactionSystem._sitHandler(sitPoint),
      });
    });

    group.add(sofa);
    collisionMeshes.push(base);
    // صندوق تصادم يغطي الأريكة كاملة (أبسط وأدق من تتبع كل قطعة)
    const localHalfW = 1.15, localHalfD = 0.5;
    const corners = [
      [-localHalfW, -localHalfD], [localHalfW, -localHalfD], [-localHalfW, localHalfD], [localHalfW, localHalfD],
    ].map(([lx, lz]) => ({
      x: x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
      z: z - lx * Math.sin(yaw) + lz * Math.cos(yaw),
    }));
    const xs = corners.map((c) => c.x), zs = corners.map((c) => c.z);
    collisionBoxes.push(box(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)));

    return sofa;
  }
  buildSofa(0, -3.3, 0);

  // ---------- كرسي GLB حقيقي (SheenChair من أمثلة Three.js) ----------
  // نستخدم أصلًا حقيقيًا بدل إضافة كل الأثاث كمكعبات. إذا فشل التحميل تبقى الأريكة
  // الإجرائية الموجودة أعلاه كخطة أمان، ولا يتعطل العالم.
  const realChair = await tryLoadGLB(THREE, 'https://threejs.org/examples/models/gltf/SheenChair.glb');
  if (realChair) {
    const chair = realChair.scene;
    chair.scale.setScalar(1.35);
    chair.position.set(-2.0, 0, -1.25);
    chair.rotation.y = Math.PI * 0.12;
    chair.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(chair);

    const cp = { x: -1.95, z: -1.2, yaw: Math.PI * 0.12 };
    sitPoints.push(cp);
    interactionSystem.register({
      position: { x: cp.x, z: cp.z },
      radius: 0.85,
      label: () => 'اجلس',
      onUse: () => interactionSystem._sitHandler && interactionSystem._sitHandler(cp),
    });
    collisionBoxes.push(box(-2.55, -1.75, -1.45, -0.75));
  }

  // ---------- طاولة قهوة زجاجية/خشبية بمنتصف السجادة ----------
  const { map: tableWoodMap } = woodGrainTexture(THREE, 0x6b4a30, { repeat: 1 });
  const tableWoodMat = new THREE.MeshStandardMaterial({ map: tableWoodMap, roughness: 0.4 });
  // زجاج بسيط عبر شفافية عادية (بدل transmission الحقيقي) — transmission يكلّف أداء
  // إضافي (يحتاج Render Target مرّة إضافية بكل فريم) وهذا غير مبرر لسطح طاولة صغير على الجوال.
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xdfeef2, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const coffeeTable = new THREE.Group();
  coffeeTable.position.set(0, 0, -0.9);
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.6), glassMat);
  tableTop.position.y = 0.42;
  tableTop.castShadow = true; tableTop.receiveShadow = true;
  coffeeTable.add(tableTop);
  for (const [lx, lz] of [[0.48, 0.24], [-0.48, 0.24], [0.48, -0.24], [-0.48, -0.24]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), tableWoodMat);
    leg.position.set(lx, 0.2, lz);
    leg.castShadow = true;
    coffeeTable.add(leg);
  }
  group.add(coffeeTable);
  collisionMeshes.push(tableTop);
  collisionBoxes.push(box(coffeeTable.position.x - 0.58, coffeeTable.position.z - 0.32, coffeeTable.position.x + 0.58, coffeeTable.position.z + 0.32));

  // ---------- وحدة تلفزيون + تلفزيون تفاعلي (يُشغَّل/يُطفأ) ----------
  const tvUnit = new THREE.Group();
  tvUnit.position.set(0, 0, ROOM_Z - 0.5);
  const unitBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.4), tableWoodMat);
  unitBody.position.y = 0.25;
  unitBody.castShadow = true; unitBody.receiveShadow = true;
  tvUnit.add(unitBody);
  group.add(tvUnit);
  collisionMeshes.push(unitBody);
  collisionBoxes.push(box(tvUnit.position.x - 0.98, tvUnit.position.z - 0.22, tvUnit.position.x + 0.98, tvUnit.position.z + 0.22));

  const screenOffMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.3, metalness: 0.4 });
  const screenOnMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2, metalness: 0.1, emissive: 0x3a7bd5, emissiveIntensity: 0.9 });
  const tvFrameMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.4, metalness: 0.5 });
  const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.05), tvFrameMat);
  tvFrame.position.set(tvUnit.position.x, 0.95, tvUnit.position.z - 0.1);
  tvFrame.castShadow = true;
  group.add(tvFrame);
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.65), screenOffMat);
  tvScreen.position.set(tvUnit.position.x, 0.95, tvUnit.position.z - 0.075);
  group.add(tvScreen);
  const tvStand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.08), tvFrameMat);
  tvStand.position.set(tvUnit.position.x, 0.55, tvUnit.position.z - 0.1);
  group.add(tvStand);

  let tvOn = false;
  interactionSystem.register({
    position: { x: tvUnit.position.x, z: tvUnit.position.z },
    radius: 1.6,
    label: () => (tvOn ? 'أطفئ التلفزيون' : 'شغّل التلفزيون'),
    onUse: () => {
      tvOn = !tvOn;
      tvScreen.material = tvOn ? screenOnMat : screenOffMat;
    },
  });

  // ---------- لمبة أرضية بجانب الأريكة (إضاءة داخلية إضافية خفيفة الكلفة) ----------
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.5, metalness: 0.3 });
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf3e2c4, roughness: 0.6, emissive: 0xffdca0, emissiveIntensity: 0.35 });
  const lamp = new THREE.Group();
  lamp.position.set(-ROOM_X + 0.6, 0, -3.6);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 8), lampMat);
  pole.position.y = 0.68;
  pole.castShadow = true;
  lamp.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 16), lampMat);
  base.position.y = 0.02;
  lamp.add(base);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.26, 16, 1, true), shadeMat);
  shade.position.y = 1.42;
  shade.castShadow = true;
  lamp.add(shade);
  const lampLight = new THREE.PointLight(0xffd9a0, 0.5, 3.5, 2);
  lampLight.position.y = 1.35;
  lamp.add(lampLight);
  group.add(lamp);
  collisionBoxes.push(box(lamp.position.x - 0.2, lamp.position.z - 0.2, lamp.position.x + 0.2, lamp.position.z + 0.2));

  // ---------- لوحة جدارية بسيطة فوق الأريكة (ديكور) ----------
  const artFrameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 });
  const artCanvas = document.createElement('canvas');
  artCanvas.width = 64; artCanvas.height = 48;
  const actx = artCanvas.getContext('2d');
  const artGrad = actx.createLinearGradient(0, 0, 64, 48);
  artGrad.addColorStop(0, '#e8b23d');
  artGrad.addColorStop(1, '#4d6a73');
  actx.fillStyle = artGrad;
  actx.fillRect(0, 0, 64, 48);
  const artTex = new THREE.CanvasTexture(artCanvas);
  artTex.colorSpace = THREE.SRGBColorSpace;
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.6), new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.7 }));
  art.position.set(0, 1.7, -ROOM_Z + 0.11);
  group.add(art);
  const artFrame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.7, 0.04), artFrameMat);
  artFrame.position.set(0, 1.7, -ROOM_Z + 0.13);
  group.add(artFrame);

  // ---------- نبتة زينة بزاوية الغرفة ----------
  const potMat = new THREE.MeshStandardMaterial({ color: 0xb5602f, roughness: 0.8 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.75 });
  const plant = new THREE.Group();
  plant.position.set(ROOM_X - 0.6, 0, -ROOM_Z + 0.6);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.32, 12), potMat);
  pot.position.y = 0.16;
  pot.castShadow = true;
  plant.add(pot);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 6), leafMat);
    const ang = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(ang) * 0.08, 0.6 + Math.random() * 0.15, Math.sin(ang) * 0.08);
    leaf.rotation.z = Math.cos(ang) * 0.35;
    leaf.rotation.x = Math.sin(ang) * 0.35;
    leaf.castShadow = true;
    plant.add(leaf);
  }
  group.add(plant);
  collisionBoxes.push(box(plant.position.x - 0.25, plant.position.z - 0.25, plant.position.x + 0.25, plant.position.z + 0.25));

  // مساحة الحركة الفاضية بين الأريكة والتلفزيون هي أماكن الظهور
  const spawnPoints = [
    { x: 1.6, z: 0.6, yaw: Math.PI },
    { x: -1.6, z: 0.6, yaw: Math.PI },
  ];

  return { group, collisionBoxes, collisionMeshes, spawnPoints, sitPoints };
}
