// نسيج إجرائي (Canvas) للأسطح — بديل خفيف عن تحميل صور خارجية، يعطي إحساس مواد حقيقية
// (خشب/بلاط/جص/قماش) بدل الألوان المسطحة، مع خرائط Roughness/Normal بسيطة لمزيد من الواقعية.

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return c;
}

function toTexture(THREE, canvas, { repeatX = 1, repeatY = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// -------- أرضية خشب (باركيه) --------
export function woodFloorTextures(THREE, { repeat = 6 } = {}) {
  const size = 512;
  const plankW = size / 4;
  const base = ['#8a5a34', '#96633b', '#7f5230', '#8f5e37'];

  const color = makeCanvas(size);
  const cctx = color.getContext('2d');
  const rough = makeCanvas(size);
  const rctx = rough.getContext('2d');

  for (let i = 0; i < 4; i++) {
    const x = i * plankW;
    cctx.fillStyle = base[i % base.length];
    cctx.fillRect(x, 0, plankW, size);
    rctx.fillStyle = '#9a9a9a';
    rctx.fillRect(x, 0, plankW, size);
    // خطوط ألياف الخشب
    for (let g = 0; g < 26; g++) {
      const gy = Math.random() * size;
      const alpha = 0.05 + Math.random() * 0.08;
      cctx.strokeStyle = `rgba(30,15,5,${alpha})`;
      cctx.lineWidth = 0.6 + Math.random() * 1.1;
      cctx.beginPath();
      cctx.moveTo(x, gy);
      cctx.bezierCurveTo(x + plankW * 0.3, gy + (Math.random() - 0.5) * 10, x + plankW * 0.7, gy + (Math.random() - 0.5) * 10, x + plankW, gy + (Math.random() - 0.5) * 6);
      cctx.stroke();
      rctx.strokeStyle = `rgba(255,255,255,${alpha * 0.6})`;
      rctx.lineWidth = 0.6;
      rctx.stroke();
    }
    // فاصل بين الألواح
    cctx.fillStyle = 'rgba(20,10,5,0.5)';
    cctx.fillRect(x, 0, 2, size);
    rctx.fillStyle = 'rgba(255,255,255,0.4)';
    rctx.fillRect(x, 0, 2, size);
  }
  // خطوط تقسيم أفقية عشوائية (نهايات الألواح)
  for (let j = 0; j < 5; j++) {
    const y = (size / 5) * j + Math.random() * 10;
    cctx.fillStyle = 'rgba(20,10,5,0.35)';
    cctx.fillRect(0, y, size, 1.5);
  }

  const map = toTexture(THREE, color, { repeatX: repeat, repeatY: repeat });
  const roughnessMap = toTexture(THREE, rough, { repeatX: repeat, repeatY: repeat, srgb: false });
  return { map, roughnessMap };
}

// -------- أرضية بلاط مطبخ --------
export function tileFloorTextures(THREE, { repeat = 5 } = {}) {
  const size = 512;
  const color = makeCanvas(size);
  const cctx = color.getContext('2d');
  cctx.fillStyle = '#cfc3ae';
  cctx.fillRect(0, 0, size, size);
  const grout = 6;
  const tile = size / 2;
  for (let yy = 0; yy < 2; yy++) {
    for (let xx = 0; xx < 2; xx++) {
      const shade = 6 + Math.floor(Math.random() * 10);
      cctx.fillStyle = `rgb(${203 + shade}, ${196 + shade}, ${178 + shade})`;
      cctx.fillRect(xx * tile + grout / 2, yy * tile + grout / 2, tile - grout, tile - grout);
      // بقع رخامية خفيفة
      for (let s = 0; s < 10; s++) {
        cctx.strokeStyle = 'rgba(150,140,120,0.15)';
        cctx.lineWidth = 1;
        cctx.beginPath();
        const sx = xx * tile + Math.random() * tile;
        const sy = yy * tile + Math.random() * tile;
        cctx.moveTo(sx, sy);
        cctx.lineTo(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 60);
        cctx.stroke();
      }
    }
  }
  cctx.strokeStyle = 'rgba(90,85,75,0.9)';
  cctx.lineWidth = grout;
  cctx.strokeRect(0, 0, size, size);
  cctx.beginPath(); cctx.moveTo(size / 2, 0); cctx.lineTo(size / 2, size); cctx.stroke();
  cctx.beginPath(); cctx.moveTo(0, size / 2); cctx.lineTo(size, size / 2); cctx.stroke();

  const map = toTexture(THREE, color, { repeatX: repeat, repeatY: repeat });
  return { map };
}

// -------- جدار (جص ناعم بملمس خفيف) --------
export function plasterWallTexture(THREE, { repeat = 2, tint = '#ece4d5' } = {}) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(imgData, 0, 0);
  const map = toTexture(THREE, canvas, { repeatX: repeat, repeatY: repeat });
  return { map };
}

// -------- قماش (قطن بسيط للملابس) --------
export function fabricTexture(THREE, hexColor, { repeat = 2 } = {}) {
  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const c = new THREE.Color(hexColor);
  ctx.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.5;
  for (let y = 0; y < size; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, y, size, 1);
  }
  for (let x = 0; x < size; x += 2) {
    ctx.fillStyle = x % 4 === 0 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(x, 0, 1, size);
  }
  ctx.globalAlpha = 1;
  const map = toTexture(THREE, canvas, { repeatX: repeat, repeatY: repeat });
  return { map };
}

// -------- ووردروب خشب الكاونتر/الطاولة (نفس فكرة الأرضية بمقياس أدق) --------
export function woodGrainTexture(THREE, hexColor, { repeat = 2 } = {}) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const c = new THREE.Color(hexColor);
  ctx.fillStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
  ctx.fillRect(0, 0, size, size);
  for (let g = 0; g < 40; g++) {
    const gy = Math.random() * size;
    ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.07})`;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.bezierCurveTo(size * 0.3, gy + (Math.random() - 0.5) * 8, size * 0.7, gy + (Math.random() - 0.5) * 8, size, gy + (Math.random() - 0.5) * 5);
    ctx.stroke();
  }
  const map = toTexture(THREE, canvas, { repeatX: repeat, repeatY: repeat });
  return { map };
}

// -------- شعر (خطوط تشبه خصل الشعر بدل سطح لدنة موحّد) --------
export function hairTexture(THREE, hexColor, { repeat = 5 } = {}) {
  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const c = new THREE.Color(hexColor);
  const base = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size;
    const dark = Math.random() > 0.5;
    ctx.strokeStyle = dark ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.8 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (Math.random() - 0.5) * 10, size * 0.35, x + (Math.random() - 0.5) * 14, size * 0.7, x + (Math.random() - 0.5) * 8, size);
    ctx.stroke();
  }
  const map = toTexture(THREE, canvas, { repeatX: repeat, repeatY: 1 });
  return { map };
}

// -------- ظل تلامس ناعم أسفل الشخصية (يعطي إحساس أنها "واقفة فعليًا" على الأرض) --------
export function contactShadowTexture(THREE) {
  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.45)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}
