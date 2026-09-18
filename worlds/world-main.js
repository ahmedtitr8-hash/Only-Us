import { WORLDS, CHARACTER_COLORS } from './config.js';
import { createRenderer, createScene, addBaseLighting } from './engine/renderer.js';
import { ThirdPersonCamera } from './engine/camera.js';
import { updateMovement } from './engine/movement.js';
import { animateCharacter } from './engine/animation.js';
import { InteractionSystem } from './engine/interaction.js';
import { CharacterController } from './characters/character.js';
import { WorldSync, interpolateRemote } from './network/world-sync.js';
import { Joystick } from './ui/joystick.js';
import { createLoadingOverlay, createCharacterPicker, createInteractButton, createPeerWaitingBadge } from './ui/world-menu.js';
import { detectQuality } from './engine/quality.js';
import { tryLoadHDRI } from './engine/assets-loader.js';

const THREE_URL = 'https://unpkg.com/three@0.160.1/build/three.module.js';
const STORAGE_KEY = 'onlyus_world_character';

let active = null; // نسمح بجلسة عالم واحدة نشطة بنفس الوقت

export async function enterWorld({ container, bridge, worldId = 'living-room' }) {
  if (active) return active;

  const loading = createLoadingOverlay(container, 'جاري تجهيز عالمنا…');
  loading.setProgress(8);

  const THREE = await import(/* webpackIgnore: true */ THREE_URL);
  loading.setProgress(30);

  const { preset: quality } = detectQuality();

  const worldDef = WORLDS.find((w) => w.id === worldId) || WORLDS[0];
  const worldMod = await worldDef.loader();
  loading.setProgress(50);

  const canvas = document.createElement('canvas');
  canvas.className = 'w3d-canvas';
  container.appendChild(canvas);

  const renderer = createRenderer(THREE, canvas, quality);
  const scene = createScene(THREE);
  addBaseLighting(THREE, scene, { quality });

  // HDRI اختياري لكل عالم — إن لم يوجد ملف hdri/room.hdr بمجلد العالم يبقى بلا أثر
  // (تحاول بهدوء وترجع false، والإضاءة الإجرائية أعلاه تفضل تشتغل كما هي).
  tryLoadHDRI(THREE, renderer, scene, `worlds/worlds/${worldDef.id}/assets/hdri/room.hdr`);

  const camRig = new ThirdPersonCamera(THREE, { domElement: canvas, scene });

  const interactBtn = createInteractButton(container);
  const interaction = new InteractionSystem(interactBtn);

  const buildFn = worldMod.buildLivingRoom || worldMod.buildKitchen || worldMod.build;
  const world = await buildFn(THREE, interaction, { renderer, scene, quality });
  scene.add(world.group);
  loading.setProgress(80);

  const joystickZone = document.createElement('div');
  joystickZone.className = 'w3d-joystick-zone';
  container.appendChild(joystickZone);
  const joystick = new Joystick(joystickZone);

  const peerWaiting = createPeerWaitingBadge(container);

  const savedColor = localStorage.getItem(STORAGE_KEY);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camRig.resize(w, h);
  }
  window.addEventListener('resize', resize);

  let disposed = false;
  let localCtrl = null;
  let remoteCtrl = null;
  let myColorId = savedColor || CHARACTER_COLORS[0].id;
  let sync = null;
  let rafId = null;
  let lastT = performance.now();

  function colorFor(id) { return CHARACTER_COLORS.find((c) => c.id === id) || CHARACTER_COLORS[0]; }

  function spawnLocal(colorId) {
    myColorId = colorId;
    localStorage.setItem(STORAGE_KEY, colorId);
    localCtrl = new CharacterController(THREE, colorFor(colorId), bridge.getMyName());
    const sp = world.spawnPoints[bridge.isHost() ? 0 : 1] || world.spawnPoints[0];
    localCtrl.pos.set(sp.x, 0, sp.z);
    localCtrl.yaw = sp.yaw;
    scene.add(localCtrl.mesh);

    interaction._sitHandler = (sitPoint) => {
      if (localCtrl.sitting) {
        localCtrl.sitting = false;
      } else {
        localCtrl.pos.set(sitPoint.x, 0, sitPoint.z);
        localCtrl.yaw = sitPoint.yaw;
        localCtrl.sitting = true;
      }
    };

    sync = new WorldSync(bridge);
    sync.onPeerEnter = (msg) => {
      ensureRemote(msg.color, msg.name);
      peerWaiting.classList.add('hidden');
    };
    sync.onPeerState = (msg) => {
      ensureRemote(msg.color);
      remoteCtrl.target.x = msg.x; remoteCtrl.target.z = msg.z; remoteCtrl.target.yaw = msg.ry;
      remoteCtrl.state = msg.sitting ? 'SITTING' : msg.state;
      remoteCtrl.sitting = !!msg.sitting;
      peerWaiting.classList.add('hidden');
    };
    sync.announceEnter(myColorId);

    resize();
    startLoop();
  }

  function ensureRemote(colorId, name) {
    if (remoteCtrl) return;
    remoteCtrl = new CharacterController(THREE, colorFor(colorId || CHARACTER_COLORS[1].id), name || bridge.getPeerName());
    const sp = world.spawnPoints[bridge.isHost() ? 1 : 0] || world.spawnPoints[1];
    remoteCtrl.pos.set(sp.x, 0, sp.z);
    remoteCtrl.target = { x: sp.x, z: sp.z, yaw: sp.yaw };
    remoteCtrl.yaw = sp.yaw;
    scene.add(remoteCtrl.mesh);
  }

  function startLoop() {
    const tick = (now) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      const yaw = camRig.getForwardYaw();
      const state = updateMovement(THREE, localCtrl, joystick.vector, yaw, world.collisionBoxes, dt);
      localCtrl.state = state;
      localCtrl.applyToMesh();
      localCtrl.tickAnimation(THREE, animateCharacter, dt);

      interaction.update(localCtrl.pos);

      if (remoteCtrl) {
        interpolateRemote(remoteCtrl, dt);
        remoteCtrl.applyToMesh();
        remoteCtrl.tickAnimation(THREE, animateCharacter, dt);
      }

      if (sync) sync.maybeSendState(now, localCtrl, myColorId);

      camRig.update(localCtrl.pos, world.collisionMeshes);
      renderer.render(scene, camRig.camera);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  loading.setProgress(100);
  loading.hide();
  setTimeout(() => loading.remove(), 300);
  createCharacterPicker(container, savedColor, spawnLocal);

  active = {
    exit() {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      joystick.dispose();
      renderer.dispose();
      container.innerHTML = '';
      active = null;
    },
  };
  return active;
}

export function exitWorld() {
  if (active) active.exit();
}
