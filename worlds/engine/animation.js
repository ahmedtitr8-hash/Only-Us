// تحريك إجرائي بسيط (بدون Rig/ملفات Animation): نلف مفاصل الأكتاف/الأرجل بدالة جيبية
// حسب الحالة الحالية، ونعمل Lerp سلس بين الحالات حتى ما تصير قفزة مفاجئة بالحركة.
export function animateCharacter(THREE, parts, state, elapsed, dt) {
  const p = parts;
  const lerp = THREE.MathUtils.lerp;

  let legSwing = 0, armSwing = 0, bob = 0, kneeBend = 0, elbowBend = 0.15;
  let targetHip = 0;

  if (state === 'WALKING' || state === 'RUNNING') {
    const speedMul = state === 'RUNNING' ? 2.1 : 1.15;
    const t = elapsed * 7 * speedMul;
    legSwing = Math.sin(t) * (state === 'RUNNING' ? 0.75 : 0.5);
    armSwing = -legSwing * 0.85;
    bob = Math.abs(Math.sin(t)) * (state === 'RUNNING' ? 0.09 : 0.045);
    kneeBend = Math.max(0, Math.sin(t + Math.PI / 2)) * (state === 'RUNNING' ? 0.9 : 0.55);
  } else if (state === 'IDLE') {
    const t = elapsed * 1.4;
    bob = Math.sin(t) * 0.015;
    armSwing = Math.sin(t) * 0.04;
  } else if (state === 'SITTING') {
    targetHip = 1;
  }

  const hipT = p._hipBlend = lerp(p._hipBlend || 0, targetHip, 1 - Math.pow(0.001, dt));

  // وقوف/جلوس: عند الجلوس نلف الفخذ للأمام والركبة للخلف كأنها جالسة على كرسي
  const sitHipAngle = lerp(0, -Math.PI / 2, hipT);
  const sitKneeAngle = lerp(0, Math.PI / 2, hipT);

  p.legL.rotation.x = sitHipAngle + legSwing * (1 - hipT);
  p.legR.rotation.x = sitHipAngle - legSwing * (1 - hipT);
  p.kneeL.rotation.x = sitKneeAngle + kneeBend * (1 - hipT);
  p.kneeR.rotation.x = sitKneeAngle + kneeBend * (1 - hipT);

  p.armL.rotation.x = lerp(armSwing, 0.25, hipT);
  p.armR.rotation.x = lerp(-armSwing, 0.25, hipT);
  p.elbowL.rotation.x = elbowBend;
  p.elbowR.rotation.x = elbowBend;

  p.torso.position.y = lerp(0.92 + bob, 0.5, hipT);
  p.root.position.y = lerp(0, -0.4, hipT);
}
