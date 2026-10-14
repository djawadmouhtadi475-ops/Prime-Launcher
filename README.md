# Prime Launcher v0.3.5 — أول لانشر عربي لماينكرافت

لانشر ماينكرافت (جافا) لويندوز، مبني بـ Electron (JavaScript). واجهة عصرية بالعربية والإنجليزية.

## التشغيل
```
npm install
npm start
```
(يتطلب Node.js 20+)

## بناء ملف التثبيت .exe
محلياً على ويندوز: `npm run dist` ← تجد `PrimeLauncher-Setup-0.3.5.exe` و `PrimeLauncher-Portable-0.3.5.exe` داخل `dist/`.

### البناء من GitHub مباشرة
1. ارفع هذا المجلد كمستودع على GitHub (فرع `main`).
2. تبويب **Actions** ← *Build Prime Launcher (Windows)* ← **Run workflow**، أو ادفع أي push.
3. تجد الملفات في **Artifacts**.
4. لإصدار رسمي: `git tag v0.3.5 && git push origin v0.3.5` ← يُنشأ **Release** تلقائياً وفيه ملفات الـ exe.

## ما تحتاجه لتفعيل بعض الميزات
- **تسجيل الدخول بمايكروسوفت**: سجّل تطبيقاً مجانياً في Azure (Entra ID) من نوع *Personal Microsoft accounts*، فعّل *Allow public client flows*، وانسخ **Application (client) ID** في الإعدادات ← الحسابات. ولاستخدام خدمات ماينكرافت يجب طلب موافقة Mojang على تطبيقك: https://aka.ms/AppRegInfo
- **CurseForge**: احصل على مفتاح API مجاني من https://console.curseforge.com وضعه في الإعدادات. (Modrinth يعمل بدون مفتاح.)
- **Java**: يُنزَّل تلقائياً (Adoptium) حسب إصدار ماينكرافت، أو حدّد مساراً خاصاً.

## الميزات
شاشة ترحيب أول تشغيل، حساب أوفلاين أو مايكروسوفت، نسخ (Instances) بإصدار واسم وصورة وذاكرة وجافا ودقة خاصة، Vanilla / Fabric / Quilt / Forge / NeoForge، تنزيل مودات وريسورس باك وشيدرز ومودباك من Modrinth و CurseForge (مع تثبيت الاعتماديات في Modrinth)، تفعيل/تعطيل/حذف المودات، العوالم ولقطات الشاشة، إصلاح النسخة، فتح مجلدها، الأخبار والإصدارات من خوادم Mojang، سكنات (رفع مباشر لحساب مايكروسوفت)، سمات: حسب النظام / حسب الوقت / أبيض / داكن / أسود OLED، و8 ألوان تمييز، وأنيميشن.

## حدود معروفة
- ويندوز فقط (x64). Realms غير مدعومة.
- سكنات الحسابات الأوفلاين تُحفظ للمعاينة فقط (ماينكرافت لا يعرضها بدون خادم/مود خاص).
- مودباكات CurseForge التي يمنع مؤلفوها التحميل الخارجي تُسرد ويُطلب تحميلها يدوياً.
- Forge/NeoForge يُثبَّتان عبر مثبّتهما الرسمي (قد يستغرق دقائق أول مرة).

## الاختبارات
`npm test` (المنطق الأساسي بدون إنترنت) و `npm run test:ui` (الواجهة بـ jsdom).

## الحقوق
© GMU Studio — GMU Launcher. جميع الحقوق محفوظة.
مطور الموقع: egyptia26 — مطور التطبيق: djawad1
الموقع: https://primelauncherar.netlify.app/ · Discord: https://discord.gg/Dtwcwhhv4j · YouTube: https://www.youtube.com/@PrimeLauncher
هذا المشروع ليس منتجاً رسمياً من Minecraft ولا ينتمي إلى Mojang أو Microsoft.
