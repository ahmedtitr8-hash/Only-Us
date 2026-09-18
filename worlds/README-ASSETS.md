# أصول عالمنا

النسخة الحالية لا تعتمد على مكعبات للشخصية: تستخدم Xbot الحقيقي مع animations من Three.js، ويتم تحميله عند دخول العالم فقط.

الأثاث الأساسي في الغرفة مبني داخل المشهد مع خامات PBR، ويوجد أيضًا كرسي GLB حقيقي من أمثلة Three.js.

## Remote assets
- `https://threejs.org/examples/models/gltf/Xbot.glb`
- `https://threejs.org/examples/models/gltf/SheenChair.glb`

## Offline option
يمكن لاحقًا وضع الملفات محليًا في:
- `worlds/worlds/living-room/assets/characters/Xbot.glb`
- `worlds/worlds/living-room/assets/furniture/SheenChair.glb`
ثم تغيير الروابط في `worlds/characters/character.js` و`worlds/worlds/living-room/scene.js`.

## الأداء
الأصول الحقيقية تُحمّل فقط عند فتح «عالمنا»، ولا تُحمّل مع الموقع الأساسي.
