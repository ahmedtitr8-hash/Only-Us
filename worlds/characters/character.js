// شخصية 3D إجرائية (بدون ملف GLB): جسم + رأس + ذراعين برجلين بمفصلين لكل طرف،
// عشان تقدر تمشي/تركض/تجلس بحركة مقنعة. سهل لاحقًا استبدال buildCharacter بموديل GLB
// حقيقي بدون ما تتغير بقية الملفات — بس خلي أسماء الأجزاء (parts) نفسها.
export function buildCharacter(THREE, colorScheme) {
  const mat = (hex, rough = 0.75) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.05 });
  const skinMat = mat(colorScheme.skin, 0.6);
  const shirtMat = mat(colorScheme.shirt);
  const pantsMat = mat(colorScheme.pants);
  const shoeMat = mat(0x1c1c1c, 0.5);

  const root = new THREE.Group(); // يحمل موقع/دوران الشخصية بالعالم
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // الجذع
  const torso = new THREE.Group();
  torso.position.y = 0.92;
  bodyGroup.add(torso);
  const torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 10), shirtMat);
  torsoMesh.castShadow = true;
  torso.add(torsoMesh);

  // الرأس
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0);
  torso.add(head);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), skinMat);
  headMesh.castShadow = true;
  head.add(headMesh);
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.163, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x2a1f18, 0.9));
  hairMesh.position.y = 0.03;
  head.add(hairMesh);
  const eyeGeo = new THREE.SphereGeometry(0.016, 8, 8);
  const eyeMat = mat(0x1a1a1a, 0.3);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(0.06, 0.01, 0.145); head.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(-0.06, 0.01, 0.145); head.add(eyeR);

  function buildLimb({ upperLen, upperRad, lowerLen, lowerRad, mat: limbMat, endMat, footLike }) {
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

    let foot = null;
    if (footLike) {
      foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.2), shoeMat);
      foot.position.set(0, -lowerLen - lowerRad * 2, 0.05);
      foot.castShadow = true;
      knee.add(foot);
    }
    return { joint, knee };
  }

  const armL = buildLimb({ upperLen: 0.24, upperRad: 0.055, lowerLen: 0.22, lowerRad: 0.048, mat: shirtMat, endMat: skinMat });
  armL.joint.position.set(0.26, 0.14, 0);
  torso.add(armL.joint);
  const armR = buildLimb({ upperLen: 0.24, upperRad: 0.055, lowerLen: 0.22, lowerRad: 0.048, mat: shirtMat, endMat: skinMat });
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
