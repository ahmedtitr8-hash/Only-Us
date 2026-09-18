// إعداد الـ renderer والمشهد والإضاءة الأساسية — بدون أي منطق خاص بعالم معيّن.
export function createRenderer(THREE, canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1712);
  scene.fog = new THREE.Fog(0x1a1712, 9, 22);
  return scene;
}

export function addBaseLighting(THREE, scene, { warm = true } = {}) {
  const hemi = new THREE.HemisphereLight(0xfff2df, 0x2a221a, 0.65);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(warm ? 0xffe3bd : 0xffffff, 1.15);
  sun.position.set(3.5, 5.5, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 18;
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.bias = -0.0025;
  scene.add(sun);

  const fill = new THREE.PointLight(0xffcf9e, 0.5, 9, 2);
  fill.position.set(-2.2, 2.3, -1.5);
  scene.add(fill);

  return { hemi, sun, fill };
}
