// كاميرا Third Person: تدور حول الشخصية بالسحب باللمس/الماوس، وتقترب تلقائيًا لو دخلت داخل جدار.
export class ThirdPersonCamera {
  constructor(THREE, { domElement, scene }) {
    this.THREE = THREE;
    this.dom = domElement;
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);

    this.theta = Math.PI; // دوران أفقي حول الشخصية
    this.phi = 1.15; // زاوية ميل رأسية (radians من الأعلى)
    this.minPhi = 0.55;
    this.maxPhi = 1.5;
    this.distance = 4.2;
    this.minDistance = 1.4;
    this.maxDistance = 6.5;

    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._raycaster = new THREE.Raycaster();

    this._bindInput();
  }

  _bindInput() {
    const dom = this.dom;
    const start = (x, y) => { this._dragging = true; this._lastX = x; this._lastY = y; };
    const move = (x, y) => {
      if (!this._dragging) return;
      const dx = x - this._lastX;
      const dy = y - this._lastY;
      this._lastX = x; this._lastY = y;
      this.theta -= dx * 0.0068;
      this.phi = Math.min(this.maxPhi, Math.max(this.minPhi, this.phi - dy * 0.0055));
    };
    const end = () => { this._dragging = false; };

    dom.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.w3d-joystick, .w3d-interact-btn')) return;
      start(e.clientX, e.clientY);
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    dom.addEventListener('wheel', (e) => {
      this.distance = Math.min(this.maxDistance, Math.max(this.minDistance, this.distance + e.deltaY * 0.0025));
    }, { passive: true });
  }

  resize(width, height) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  update(targetPos, collisionMeshes) {
    const THREE = this.THREE;
    const head = new THREE.Vector3(targetPos.x, targetPos.y + 1.5, targetPos.z);

    const sinPhi = Math.sin(this.phi);
    const dir = new THREE.Vector3(
      sinPhi * Math.sin(this.theta),
      Math.cos(this.phi),
      sinPhi * Math.cos(this.theta)
    );

    let dist = this.distance;
    if (collisionMeshes && collisionMeshes.length) {
      this._raycaster.set(head, dir);
      this._raycaster.far = this.distance;
      const hits = this._raycaster.intersectObjects(collisionMeshes, false);
      if (hits.length) dist = Math.max(0.8, hits[0].distance - 0.25);
    }

    const camPos = head.clone().addScaledVector(dir, dist);
    this.camera.position.copy(camPos);
    this.camera.lookAt(head);
  }

  // اتجاه "الأمام" الحالي للكاميرا (للتحكم بالحركة النسبية للكاميرا)
  getForwardYaw() {
    return this.theta + Math.PI;
  }
}
