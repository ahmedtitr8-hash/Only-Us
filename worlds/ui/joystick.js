// جويستيك افتراضي بسيط: قاعدة ثابتة أسفل يسار الشاشة + مقبض يتحرك بحدود دائرة،
// ويرجع متجه (x, y) بين -1 و1 (y = أمام).
export class Joystick {
  constructor(container) {
    this.vector = { x: 0, y: 0 };
    this._active = false;
    this._pointerId = null;
    this._center = { x: 0, y: 0 };
    this._radius = 46;

    this.base = document.createElement('div');
    this.base.className = 'w3d-joystick';
    this.knob = document.createElement('div');
    this.knob.className = 'w3d-joystick-knob';
    this.base.appendChild(this.knob);
    container.appendChild(this.base);

    this.base.addEventListener('pointerdown', (e) => this._start(e));
    window.addEventListener('pointermove', (e) => this._move(e));
    window.addEventListener('pointerup', (e) => this._end(e));
    window.addEventListener('pointercancel', (e) => this._end(e));
  }

  _start(e) {
    this._active = true;
    this._pointerId = e.pointerId;
    const r = this.base.getBoundingClientRect();
    this._center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    this._move(e);
    e.preventDefault();
  }

  _move(e) {
    if (!this._active || e.pointerId !== this._pointerId) return;
    let dx = e.clientX - this._center.x;
    let dy = e.clientY - this._center.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this._radius) { dx = (dx / dist) * this._radius; dy = (dy / dist) * this._radius; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.vector.x = dx / this._radius;
    this.vector.y = -dy / this._radius; // فوق = أمام
  }

  _end(e) {
    if (e.pointerId !== this._pointerId) return;
    this._active = false;
    this._pointerId = null;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.vector.x = 0; this.vector.y = 0;
  }

  dispose() {
    this.base.remove();
  }
}
