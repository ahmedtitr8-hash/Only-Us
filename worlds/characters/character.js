// شخصية 3D إجرائية (بدون ملف GLB): جسم + رأس + ذراعين برجلين بمفصلين لكل طرف،
// عشان تقدر تمشي/تركض/تجلس بحركة مقنعة. سهل لاحقًا استبدال buildCharacter بموديل GLB
// حقيقي بدون ما تتغير بقية الملفات — بس خلي أسماء الأجزاء (parts) نفسها.
import { fabricTexture, contactShadowTexture, hairTexture } from '../engine/textures.js';

export function buildCharacter(THREE, colorScheme) {
  const { map: shirtMap } = fabricTexture(THREE, colorScheme.shirt, { repeat: 1.5 });
  const { map: pantsMap } = fabricTexture(THREE, colorScheme.pants, { repeat: 1.5 });
  const mat = (hex, rough = 0.75) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.05 });
  // بشرة مطفية طبيعية أقرب للجلد الحقيقي (لمعان خفيف جدًا بس مو سطح بلاستيك لامع)
  const skinMat = new THREE.MeshPhysicalMaterial({ color: colorScheme.skin, roughness: 0.68, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.85 });
  const shirtMat = new THREE.MeshStandardMaterial({ map: shirtMap, roughness: 0.82, metalness: 0.02 });
  const pantsMat = new THREE.MeshStandardMaterial({ map: pantsMap, roughness: 0.85, metalness: 0.02 });
  const shoeMat = mat(0x1c1c1c, 0.45);
  const hairColor = colorScheme.hair || 0x2a1f18;
  const { map: hairMap } = hairTexture(THREE, hairColor);
  const hairMat = new THREE.MeshStandardMaterial({ map: hairMap, roughness: 0.7 });

  const root = new THREE.Group(); // يحمل موقع/دوران الشخصية بالعالم
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // ظل تلامس ناعم أسفل القدمين — يعطي إحساس أن الشخصية واقفة فعليًا على الأرض
  const shadowBlob = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.62),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(THREE), transparent: true, depthWrite: false })
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.005;
  bodyGroup.add(shadowBlob);

  // الجذع
  const torso = new THREE.Group();
  torso.position.y = 0.92;
  bodyGroup.add(torso);
  const torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 10), shirtMat);
  torsoMesh.castShadow = true;
  torso.add(torsoMesh);

  // رقبة (تفصيلة صغيرة تمنع إحساس أن الرأس "عائم" فوق الجسم مباشرة)
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.065, 0.09, 10), skinMat);
  neckMesh.position.y = 0.375;
  neckMesh.castShadow = true;
  torso.add(neckMesh);

  // الرأس
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0);
  torso.add(head);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 16), skinMat);
  headMesh.castShadow = true;
  head.add(headMesh);
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.163, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hairMesh.position.y = 0.03;
  head.add(hairMesh);
  // أذنين — بدونهم الرأس يبان كروي جدًا وغير طبيعي من الجانب
  const earGeo = new THREE.SphereGeometry(0.026, 10, 8);
  const earL = new THREE.Mesh(earGeo, skinMat); earL.position.set(0.15, -0.01, 0); earL.scale.set(0.6, 1, 1); head.add(earL);
  const earR = new THREE.Mesh(earGeo, skinMat); earR.position.set(-0.15, -0.01, 0); earR.scale.set(0.6, 1, 1); head.add(earR);
  // أنف — تفصيلة صغيرة بس تكسر إحساس "الوجه المسطح"
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.045, 8), skinMat);
  nose.position.set(0, -0.015, 0.152);
  nose.rotation.x = Math.PI / 2.1;
  head.add(nose);
  // حواجب — تفصيلة صغيرة تعطي الوجه تعبيرًا وهوية بدل الملامح الفارغة
  const browGeo = new THREE.BoxGeometry(0.05, 0.012, 0.014);
  const browMat = mat(hairColor, 0.9);
  const browL = new THREE.Mesh(browGeo, browMat); browL.position.set(0.06, 0.05, 0.148); browL.rotation.z = 0.08; head.add(browL);
  const browR = new THREE.Mesh(browGeo, browMat); browR.position.set(-0.06, 0.05, 0.148); browR.rotation.z = -0.08; head.add(browR);
  const eyeGeo = new THREE.SphereGeometry(0.016, 8, 8);
  const eyeMat = mat(0x1a1a1a, 0.3);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(0.06, 0.01, 0.145); head.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(-0.06, 0.01, 0.145); head.add(eyeR);
  // خدود بلون خفيف زيادة (يكسر رتابة لون البشرة الموحّد)
  const cheekMat = new THREE.MeshStandardMaterial({ color: colorScheme.skin, roughness: 0.7, transparent: true, opacity: 0.35 });
  const cheekGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const cheekL = new THREE.Mesh(cheekGeo, cheekMat); cheekL.position.set(0.09, -0.03, 0.115); head.add(cheekL);
  const cheekR = new THREE.Mesh(cheekGeo, cheekMat); cheekR.position.set(-0.09, -0.03, 0.115); head.add(cheekR);

  function buildLimb({ upperLen, upperRad, lowerLen, lowerRad, mat: limbMat, endMat, footLike, handLike }) {
    const joint = new THREE.Group(); // كتف أو فخذ (المفصل العلوي)
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(upperRad, upperLen, 3, 8), limbMat);
    upper.position.y = -upperLen / 2 - upperRad;
    upper.castShadow = true;
    joint.add(upper);

    const knee = new THREE.Group(); // كوع أو ركبة (المفصل السفلي)
    knee.position.y = -upperLen - upperRad * 2;
    joint.add(knee);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(lowerRad, lowerLen, 3, 8), endMat || limbMat);
    lower.position.y = -lowerLen / 2 - lowerRad;
    lower.castShadow = true;
    knee.add(lower);

    if (footLike) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.2), shoeMat);
      foot.position.set(0, -lowerLen - lowerRad * 2, 0.05);
      foot.castShadow = true;
      knee.add(foot);
    }
    if (handLike) {
      // يد بسيطة — كف مفلطح صغير أفضل بكثير من "عمود" ذراع بلا نهاية
      const hand = new THREE.Mesh(new THREE.SphereGeometry(lowerRad * 0.95, 10, 8), endMat || limbMat);
      hand.scale.set(0.8, 1, 0.55);
      hand.position.set(0, -lowerLen - lowerRad * 1.7, 0);
      hand.castShadow = true;
      knee.add(hand);
    }
    return { joint, knee };
  }

  const armL = buildLimb({ upperLen: 0.24, upperRad: 0.055, lowerLen: 0.22, lowerRad: 0.048, mat: shirtMat, endMat: skinMat, handLike: true });
  armL.joint.position.set(0.26, 0.14, 0);
  torso.add(armL.joint);
  const armR = buildLimb({ upperLen: 0.24, upperRad: 0.055, lowerLen: 0.22, lowerRad: 0.048, mat: shirtMat, endMat: skinMat, handLike: true });
  armR.joint.position.set(-0.26, 0.14, 0);
  torso.add(armR.joint);

  const legL = buildLimb({ upperLen: 0.32, upperRad: 0.08, lowerLen: 0.3, lowerRad: 0.065, mat: pantsMat, footLike: true });
  legL.joint.position.set(0.11, -0.23, 0);
  torso.add(legL.joint);
  const legR = buildLimb({ upperLen: 0.32, upperRad: 0.08, lowerLen: 0.3, lowerRad: 0.065, mat: pantsMat, footLike: true });
  legR.joint.position.set(-0.11, -0.23, 0);
  torso.add(legR.joint);

  const nameSprite = makeNameSprite(THREE, '');
  nameSprite.position.set(0, 1.62, 0);
  root.add(nameSprite);

  return {
    root,
    parts: {
      root: bodyGroup,
      torso,
      armL: armL.joint, elbowL: armL.knee,
      armR: armR.joint, elbowR: armR.knee,
      legL: legL.joint, kneeL: legL.knee,
      legR: legR.joint, kneeR: legR.knee,
    },
    nameSprite,
  };
}

function makeNameSprite(THREE, text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
  sprite.scale.set(0.9, 0.22, 1);
  sprite.userData.setText = (t) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '600 30px "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, 18, 12, canvas.width - 36, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(t, canvas.width / 2, 32);
    sprite.material.map.needsUpdate = true;
  };
  sprite.userData.setText(text);
  return sprite;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// يلف الحالة (موقع/دوران/حركة) حول موديل الشخصية — تُستخدم للاعب المحلي والبعيد.
export class CharacterController {
  constructor(THREE, colorScheme, name) {
    this.THREE = THREE;
    const built = buildCharacter(THREE, colorScheme);
    this.mesh = built.root;
    this.parts = built.parts;
    this.nameSprite = built.nameSprite;
    this.setName(name);

    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.sitting = false;
    this.state = 'IDLE';
    this._elapsed = Math.random() * 10;

    // للاعب البعيد: أهداف الاستيفاء (Interpolation)
    this.target = { x: 0, z: 0, yaw: 0 };
  }

  setName(name) {
    if (this.nameSprite) this.nameSprite.userData.setText(name || '');
  }

  faceYaw(targetYaw, dt) {
    let diff = targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Math.min(1, dt * 10);
  }

  applyToMesh() {
    this.mesh.position.set(this.pos.x, this.pos.y || 0, this.pos.z);
    this.mesh.rotation.y = this.yaw;
  }

  tickAnimation(THREE, animateCharacter, dt) {
    this._elapsed += dt;
    animateCharacter(THREE, this.parts, this.state, this._elapsed, dt);
  }
}
