// نظام تفاعل عام: أي غرض بالعالم يسجل نفسه هنا (موقع + نطاق + تسمية الزر + دالة تنفيذ)
// بدون ما يعرف شي عن الشخصية أو الشبكة. إضافة تفاعل جديد لاحقًا = تسجيل عنصر جديد فقط.
export class InteractionSystem {
  constructor(buttonEl) {
    this.items = []; // { position:{x,z}, radius, label, onUse(), isActiveLabel? }
    this.buttonEl = buttonEl;
    this.current = null;
    this.buttonEl.addEventListener('click', () => {
      if (this.current) this.current.onUse();
    });
  }

  register(item) {
    this.items.push(item);
    return item;
  }

  update(playerPos) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const it of this.items) {
      const dx = playerPos.x - it.position.x;
      const dz = playerPos.z - it.position.z;
      const d = Math.hypot(dx, dz);
      if (d <= it.radius && d < nearestDist) {
        nearest = it;
        nearestDist = d;
      }
    }
    if (nearest !== this.current) {
      this.current = nearest;
      if (nearest) {
        this.buttonEl.textContent = typeof nearest.label === 'function' ? nearest.label() : nearest.label;
        this.buttonEl.classList.remove('hidden');
      } else {
        this.buttonEl.classList.add('hidden');
      }
    } else if (nearest) {
      // حدّث النص لو تغيرت الحالة (مثلًا "اجلس" ↔ "قم")
      this.buttonEl.textContent = typeof nearest.label === 'function' ? nearest.label() : nearest.label;
    }
  }
}
