// شخصيات عالمنا: موديل GLB حقيقي مع حركات جاهزة، مع fallback إجرائي فقط إذا تعذر تحميل الأصل.
// الأصل الأساسي: Xbot من أمثلة Three.js. لا توجد وجوه حقيقية.
import { fabricTexture, contactShadowTexture, hairTexture } from '../engine/textures.js';
import { tryLoadGLB } from '../engine/assets-loader.js';

const REAL_CHARACTER_URL = 'https://threejs.org/examples/models/gltf/Xbot.glb';

function buildFallbackCharacter(THREE, colorScheme) {
  const { map: shirtMap } = fabricTexture(THREE, colorScheme.shirt, { repeat: 1.5 });
  const { map: pantsMap } = fabricTexture(THREE, colorScheme.pants, { repeat: 1.5 });
  const mat = (hex, rough = 0.75) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.05 });
  const skinMat = new THREE.MeshPhysicalMaterial({ color: colorScheme.skin, roughness: 0.68, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.85 });
  const shirtMat = new THREE.MeshStandardMaterial({ map: shirtMap, roughness: 0.82, metalness: 0.02 });
  const pantsMat = new THREE.MeshStandardMaterial({ map: pantsMap, roughness: 0.85, metalness: 0.02 });
  const shoeMat = mat(0x1c1c1c, 0.45);
  const hairColor = colorScheme.hair || 0x2a1f18;
  const { map: hairMap } = hairTexture(THREE, hairColor);
  const hairMat = new THREE.MeshStandardMaterial({ map: hairMap, roughness: 0.7 });

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: contactShadowTexture(THREE), transparent: true, depthWrite: false }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.005; bodyGroup.add(shadowBlob);

  const torso = new THREE.Group(); torso.position.y = 0.92; bodyGroup.add(torso);
  const torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 10), shirtMat); torsoMesh.castShadow = true; torso.add(torsoMesh);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.065, 0.09, 10), skinMat); neckMesh.position.y = 0.375; neckMesh.castShadow = true; torso.add(neckMesh);
  const head = new THREE.Group(); head.position.set(0, 0.5, 0); torso.add(head);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 16), skinMat); headMesh.castShadow = true; head.add(headMesh);
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.163, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat); hairMesh.position.y = 0.03; head.add(hairMesh);

  function buildLimb({ upperLen, upperRad, lowerLen, lowerRad, mat: limbMat, endMat, footLike, handLike }) {
    const joint = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(upperRad, upperLen, 3, 8), limbMat); upper.position.y = -upperLen / 2 - upperRad; upper.castShadow = true; joint.add(upper);
    const knee = new THREE.Group(); knee.position.y = -upperLen - upperRad * 2; joint.add(knee);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(lowerRad, lowerLen, 3, 8), endMat || limbMat); lower.position.y = -lowerLen / 2 - lowerRad; lower.castShadow = true; knee.add(lower);
    if (footLike) { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.2), shoeMat); foot.position.set(0, -lowerLen - lowerRad * 2, 0.05); foot.castShadow = true; knee.add(foot); }
    if (handLike) { const hand = new THREE.Mesh(new THREE.SphereGeometry(lowerRad * 0.95, 10, 8), endMat || limbMat); hand.scale.set(0.8, 1, 0.55); hand.position.set(0, -lowerLen - lowerRad * 1.7, 0); hand.castShadow = true; knee.add(hand); }
    return { joint, knee };
  }
  const armL = buildLimb({ upperLen: 0.24, upperRad: 0.055, lowerLen: 0.22, lowerRad: 0.048, mat: shirtMat, endMat: skinMat, handLike: true }); armL.joint.position.set(0.26, 0.14, 0); torso.add(armL.joint);
  const armR = buildLimb({ upperLen: 0.24, upperRad: 0.055, lowerLen: 0.22, lowerRad: 0.048, mat: shirtMat, endMat: skinMat, handLike: true }); armR.joint.position.set(-0.26, 0.14, 0); torso.add(armR.joint);
  const legL = buildLimb({ upperLen: 0.32, upperRad: 0.08, lowerLen: 0.3, lowerRad: 0.065, mat: pantsMat, footLike: true }); legL.joint.position.set(0.11, -0.23, 0); torso.add(legL.joint);
  const legR = buildLimb({ upperLen: 0.32, upperRad: 0.08, lowerLen: 0.3, lowerRad: 0.065, mat: pantsMat, footLike: true }); legR.joint.position.set(-0.11, -0.23, 0); torso.add(legR.joint);

  const nameSprite = makeNameSprite(THREE, ''); nameSprite.position.set(0, 1.62, 0); root.add(nameSprite);
  return { root, parts: { root: bodyGroup, torso, armL: armL.joint, elbowL: armL.knee, armR: armR.joint, elbowR: armR.knee, legL: legL.joint, kneeL: legL.knee, legR: legR.joint, kneeR: legR.knee }, nameSprite };
}

async function loadRealCharacter(THREE, colorScheme) {
  const gltf = await tryLoadGLB(THREE, REAL_CHARACTER_URL, { draco: true });
  if (!gltf) return null;
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3(); box.getSize(size);
  const targetHeight = 1.78;
  if (size.y > 0) model.scale.setScalar(targetHeight / size.y);
  model.position.y = 0;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m || !m.clone) return;
        const n = String(m.name || o.name || '').toLowerCase();
        const clone = m.clone();
        if (n.includes('shirt') || n.includes('top') || n.includes('upper')) clone.color?.setHex(colorScheme.shirt);
        if (n.includes('pants') || n.includes('trouser') || n.includes('lower')) clone.color?.setHex(colorScheme.pants);
        o.material = Array.isArray(o.material) ? mats.map((x) => x === m ? clone : x) : clone;
      });
    }
  });
  return { model, animations: gltf.animations || [] };
}

export class CharacterController {
  constructor(THREE, colorScheme, name) {
    this.THREE = THREE;
    const fallback = buildFallbackCharacter(THREE, colorScheme);
    this.mesh = fallback.root;
    this.parts = fallback.parts;
    this.nameSprite = fallback.nameSprite;
    this.setName(name);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.sitting = false;
    this.state = 'IDLE';
    this._elapsed = Math.random() * 10;
    this.target = { x: 0, z: 0, yaw: 0 };
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;
    this._realReady = false;
    this._loadReal(THREE, colorScheme).catch(() => {});
  }

  async _loadReal(THREE, colorScheme) {
    const loaded = await loadRealCharacter(THREE, colorScheme);
    if (!loaded || !this.mesh.parent) return;
    const old = this.mesh;
    const root = new THREE.Group();
    root.add(loaded.model);
    if (this.nameSprite) root.add(this.nameSprite);
    root.position.copy(old.position); root.rotation.copy(old.rotation);
    if (old.parent) old.parent.add(root);
    old.parent?.remove(old);
    this.mesh = root;
    this.parts = null;
    this.mixer = new THREE.AnimationMixer(loaded.model);
    for (const clip of loaded.animations) this.actions[String(clip.name).toLowerCase()] = this.mixer.clipAction(clip);
    this._realReady = true;
    this._playRealState(true);
  }

  setName(name) { if (this.nameSprite) this.nameSprite.userData.setText(name || ''); }

  faceYaw(targetYaw, dt) {
    let diff = targetYaw - this.yaw; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Math.min(1, dt * 10);
  }

  applyToMesh() { this.mesh.position.set(this.pos.x, this.pos.y || 0, this.pos.z); this.mesh.rotation.y = this.yaw; }

  _findAction(kind) {
    const keys = Object.keys(this.actions);
    const patterns = kind === 'walk' ? ['walk', 'walking'] : kind === 'run' ? ['run', 'running'] : kind === 'sit' ? ['sit', 'sitting'] : kind === 'stand' ? ['stand', 'standing'] : ['idle', 'idle_'];
    return keys.find((k) => patterns.some((p) => k.includes(p))) || keys.find((k) => k.includes('idle')) || keys[0];
  }

  _playRealState(force = false) {
    if (!this.mixer) return;
    const kind = this.sitting || this.state === 'SITTING' ? 'sit' : this.state === 'RUNNING' ? 'run' : this.state === 'WALKING' ? 'walk' : 'idle';
    const key = this._findAction(kind);
    if (!key || (!force && this.currentAction === key)) return;
    const next = this.actions[key];
    if (this.currentAction && this.actions[this.currentAction]) this.actions[this.currentAction].fadeOut(0.18);
    next.reset().fadeIn(0.18).play();
    this.currentAction = key;
  }

  tickAnimation(THREE, animateCharacter, dt) {
    this._elapsed += dt;
    if (this.mixer) { this._playRealState(); this.mixer.update(dt); }
    else if (this.parts) animateCharacter(THREE, this.parts, this.state, this._elapsed, dt);
  }
}

function makeNameSprite(THREE, text) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
  sprite.scale.set(0.9, 0.22, 1);
  sprite.userData.setText = (t) => { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.font = '600 30px "IBM Plex Sans Arabic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(ctx, 18, 12, canvas.width - 36, 40, 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(t, canvas.width / 2, 32); sprite.material.map.needsUpdate = true; };
  sprite.userData.setText(text); return sprite;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
