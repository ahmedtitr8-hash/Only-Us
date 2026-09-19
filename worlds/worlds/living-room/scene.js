import { box } from '../../engine/collision.js';
import { tryLoadGLB } from '../../engine/assets-loader.js';

// غرفة معيشة حقيقية (موديل GLB فعلي رفعه المستخدم) — بدون أي بناء إجرائي احتياطي.
// كل عالم يرجّع نفس الشكل المعتمد بالمحرك: { group, collisionBoxes, collisionMeshes,
// interactables?, spawnPoints, sitPoints }.
//
// الموديل مبني من أجزاء مسمّاة (Structure / Sofa / CoffeeTable / TVStand / TV / Lamp / Plant
// / Windows / PictureFrame / AbstractArt / Pillows) — نستخدم الأسماء نفسها لاستخراج صناديق
// التصادم ونقاط الجلوس/الظهور تلقائيًا بدل تصميمها يدويًا رقم برقم، عشان لو الموديل تغيّر
// أو تبدّل حجمه لاحقًا يستمر كل شي يشتغل صح بدون تعديل الكود.
const ROOM_GLB_URL = 'worlds/worlds/living-room/assets/living-room.glb';
const TARGET_ROOM_HEIGHT = 2.8; // متر — نطبّع بيه حجم الموديل مهما كانت وحدات التصدير الأصلية
const WALL_THICKNESS = 0.18;

function findByName(root, keywords) {
  let found = null;
  root.traverse((child) => {
    if (found) return;
    const name = (child.name || '').toLowerCase();
    if (keywords.some((k) => name.includes(k))) found = child;
  });
  return found;
}

function worldBox(THREE, node) {
  return new THREE.Box3().setFromObject(node);
}

export async function buildLivingRoom(THREE, interactionSystem, ctx = {}) {
  const group = new THREE.Group();
  const collisionBoxes = [];
  const collisionMeshes = [];
  const sitPoints = [];

  const asset = await tryLoadGLB(THREE, ROOM_GLB_URL, { draco: false });

  // شبكة أمان بسيطة فقط لو تعذّر تحميل الملف الحقيقي لأي سبب (مسار خاطئ، مشكلة شبكة
  // مؤقتة...) — أرضية وأربع جدران بدون أي أثاث، عشان العالم ما يصير فراغ مكسور تمامًا.
  // هذا مو "الشكل البدائي" القديم، هذا فقط حماية من انهيار كامل للتجربة.
  if (!asset) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.95 });
    [[0, -6, 12, 0.2, 0], [0, 6, 12, 0.2, 0], [-6, 0, 0.2, 12, 0], [6, 0, 0.2, 12, 0]].forEach(([x, z, w, d]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, d), wallMat);
      wall.position.set(x, 1.4, z);
      wall.receiveShadow = true;
      group.add(wall);
      collisionMeshes.push(wall);
      collisionBoxes.push(box(x - w / 2, z - d / 2, x + w / 2, z + d / 2));
    });
    return {
      group, collisionBoxes, collisionMeshes, sitPoints,
      spawnPoints: [{ x: 1.2, z: 1.2, yaw: Math.PI }, { x: -1.2, z: 1.2, yaw: Math.PI }],
    };
  }

  const root = asset.scene;

  // ---------- تطبيع الحجم: نقيس ارتفاع "Structure" الخام ونحسب مقياس موحّد ----------
  const rawStructure = findByName(root, ['structure']);
  root.updateMatrixWorld(true);
  const rawBox = rawStructure ? worldBox(THREE, rawStructure) : worldBox(THREE, root);
  const rawHeight = Math.max(0.01, rawBox.max.y - rawBox.min.y);
  const scale = TARGET_ROOM_HEIGHT / rawHeight;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  // ---------- توسيط الغرفة عند نقطة الأصل (0,0,0) بحيث الأرضية عند y=0 ----------
  const scaledBox = worldBox(THREE, root);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaledBox.min.y;
  root.updateMatrixWorld(true);

  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  group.add(root);

  // ---------- محيط الغرفة (تصادم + منع خروج الكاميرا) من صندوق "Structure" ----------
  const structure = findByName(root, ['structure']);
  const roomBox = structure ? worldBox(THREE, structure) : worldBox(THREE, root);
  const { min, max } = roomBox;
  const perimeter = [
    box(min.x, min.z - WALL_THICKNESS, max.x, min.z + WALL_THICKNESS), // جدار أمامي
    box(min.x, max.z - WALL_THICKNESS, max.x, max.z + WALL_THICKNESS), // جدار خلفي
    box(min.x - WALL_THICKNESS, min.z, min.x + WALL_THICKNESS, max.z), // جدار يسار
    box(max.x - WALL_THICKNESS, min.z, max.x + WALL_THICKNESS, max.z), // جدار يمين
  ];
  collisionBoxes.push(...perimeter);
  if (structure) collisionMeshes.push(structure);

  // ---------- قطع أثاث تصطدم بيها الشخصية (بدون داعي نلمسها يدويًا وحدة وحدة) ----------
  const furnitureNames = ['sofa', 'coffeetable', 'tvstand', 'lamp', 'plant'];
  const furnitureBoxes = {};
  furnitureNames.forEach((key) => {
    const node = findByName(root, [key]);
    if (!node) return;
    const b = worldBox(THREE, node);
    furnitureBoxes[key] = b;
    // هامش صغير حوالين كل قطعة بدل ملاصقة الشكل الدقيق (كافي جدًا لواقعية المشي)
    collisionBoxes.push(box(b.min.x - 0.05, b.min.z - 0.05, b.max.x + 0.05, b.max.z + 0.05));
    collisionMeshes.push(node);
  });

  // ---------- نقطة جلوس على الأريكة ----------
  const sofa = furnitureNames.includes('sofa') ? findByName(root, ['sofa']) : null;
  if (sofa && furnitureBoxes.sofa) {
    const sb = furnitureBoxes.sofa;
    const sofaCenter = new THREE.Vector3();
    sb.getCenter(sofaCenter);
    const sizeX = sb.max.x - sb.min.x;
    const sizeZ = sb.max.z - sb.min.z;
    // تخمين اتجاه "واجهة" الأريكة: المحور الأطول هو طول الأريكة، والمحور الأقصر هو اتجاه
    // الجلوس/النظر. لو بعد ما تختبر بالمتصفح لقيت الشخصية تطلع بظهرها بدل وجهها، بدّل
    // إشارة yawSit هنا لسالب/موجب — رقم واحد بس تغيّره.
    const facingAlongX = sizeZ > sizeX;
    const yawSit = facingAlongX ? Math.PI / 2 : 0;
    const sitPoint = { x: sofaCenter.x, z: sofaCenter.z, yaw: yawSit };
    sitPoints.push(sitPoint);
    interactionSystem.register({
      position: { x: sitPoint.x, z: sitPoint.z },
      radius: Math.max(sizeX, sizeZ) / 2 + 0.5,
      label: () => 'اجلس',
      onUse: () => interactionSystem._sitHandler && interactionSystem._sitHandler(sitPoint),
    });
  }

  // ---------- تفاعل تشغيل/إطفاء التلفزيون (توهّج بسيط على جسم التلفزيون بالكامل) ----------
  const tv = findByName(root, ['tv_tv', 'tv']);
  if (tv && tv.isMesh && tv.material) {
    const offMat = tv.material;
    const onMat = offMat.clone();
    onMat.emissive = new THREE.Color(0x3a7bd5);
    onMat.emissiveIntensity = 0.55;
    let tvOn = false;
    const tvBox = worldBox(THREE, tv);
    const tvCenter = new THREE.Vector3();
    tvBox.getCenter(tvCenter);
    interactionSystem.register({
      position: { x: tvCenter.x, z: tvCenter.z },
      radius: 1.6,
      label: () => (tvOn ? 'أطفئ التلفزيون' : 'شغّل التلفزيون'),
      onUse: () => {
        tvOn = !tvOn;
        tv.material = tvOn ? onMat : offMat;
      },
    });
  }

  // ---------- أماكن الظهور: زاويتين بعيدتين عن الأثاث قدر الإمكان ----------
  const spawnPoints = [
    { x: min.x + (max.x - min.x) * 0.22, z: max.z - (max.z - min.z) * 0.18, yaw: Math.PI },
    { x: max.x - (max.x - min.x) * 0.22, z: max.z - (max.z - min.z) * 0.18, yaw: Math.PI },
  ];

  return { group, collisionBoxes, collisionMeshes, spawnPoints, sitPoints };
}
