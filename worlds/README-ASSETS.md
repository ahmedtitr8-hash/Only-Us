# أصول عالمنا

الشخصية: تُحمَّل Xbot الحقيقية من Three.js examples مع animations جاهزة (walk/run/idle/sit)،
ويوجد fallback إجرائي بسيط جدًا فقط لو تعذّر تحميلها (مشكلة شبكة مؤقتة).

الغرفة (سوا): موديل GLB حقيقي واحد كامل — `worlds/worlds/living-room/assets/living-room.glb` —
يحتوي الغرفة بالكامل (هيكل + أثاث). لا يوجد أي بناء إجرائي للغرفة نفسها بعد اليوم؛ كل
صناديق التصادم ونقاط الجلوس/الظهور تُستخرج تلقائيًا وقت التشغيل من أسماء أجزاء الموديل
(Structure, Sofa, CoffeeTable, TVStand, TV, Lamp, Plant, Windows, PictureFrame,
AbstractArt, Pillows) — راجع `worlds/worlds/living-room/scene.js`.

## Remote assets
- `https://threejs.org/examples/models/gltf/Xbot.glb` (الشخصية)

## Local assets
- `worlds/worlds/living-room/assets/living-room.glb` (الغرفة كاملة)

## مهم جدًا: خريطة الاستيراد (Import Map)
`GLTFLoader`/`DRACOLoader`/`RGBELoader` (من `three/examples/jsm`) تحتوي داخلها على
`import ... from 'three'`. بدون `<script type="importmap">` بـ `index.html` يربط الاسم
"three" بنفس رابط نسخة three.js المستخدمة، هذا الاستيراد يفشل بصمت في كل مرة، ويرجع
`tryLoadGLB` دايمًا `null` بدون أي خطأ واضح بالواجهة — يعني الأصول الحقيقية (الشخصية
والغرفة) ما تشتغل أبدًا رغم إن الكود صحيح. الـ import map مضافة الآن بأول `<head>`.

## الأداء
الموديل يوزن ~9 ميجابايت ويتحمّل فقط لما يفتح المستخدم «سوا» (lazy)، مو مع تحميل
الموقع الأساسي. المقياس الحقيقي للموديل يُطبَّع تلقائيًا وقت التشغيل (نقيس ارتفاع
جزء "Structure" الخام ونحسب مقياس موحّد يطلعه لارتفاع غرفة واقعي)، فمهما كانت وحدات
تصدير الموديل الأصلية النتيجة تفضل صحيحة بدون تعديل يدوي.
