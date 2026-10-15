# سيرفر سكنات للاعبين الأوفلاين

ماينكرافت لا يعرض سكنات الحسابات الأوفلاين لأنه ما عنده من يسأله عن السكن. الحل: مود **CustomSkinLoader** عند اللاعبين + سيرفر يستضيف ملفات السكن (PNG). كل لاعب يحمّل سكن غيره بالاسم، فيرى الجميع السكنات.

## الطريقة 1 (الأسهل): استضافة ملفات ثابتة — مجانية
1. أنشئ مجلد `skins/` على أي استضافة ثابتة (موقعك على Netlify، أو GitHub Pages، أو Supabase Storage).
2. ضع فيه السكنات باسم اللاعب: `skins/Steve.png` (64×64 أو 64×32) واختيارياً الكيب في `capes/Steve.png`.
3. عند كل لاعب: ثبّت المود **CustomSkinLoader** (Modrinth) على نسخة Fabric/Quilt/Forge/NeoForge، ثم عدّل `CustomSkinLoader/CustomSkinLoader.json` داخل مجلد النسخة:
```json
{
  "enable": true,
  "loadlist": [
    { "name": "PrimeSkins", "type": "Legacy", "checkPNG": true,
      "skin": "https://primelauncherar.netlify.app/skins/{USERNAME}.png",
      "cape": "https://primelauncherar.netlify.app/capes/{USERNAME}.png" },
    { "name": "Mojang", "type": "MojangAPI" }
  ]
}
```
(تحقق من صيغة الإعداد في وثائق المود لإصدارك.) ملاحظة: اسم الملف حساس لحالة الأحرف على Netlify، فاستخدم نفس اسم اللاعب بالضبط.

## الطريقة 2: رفع السكنات من موقعك عبر Supabase (تربطها بحسابات موقعك)
شغّل هذا في SQL Editor — يعمل Bucket عام، ويسمح لكل مستخدم مسجّل برفع/استبدال ملف باسم لاعبه فقط:
```sql
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('offline-skins','offline-skins',true,204800,array['image/png'])
on conflict (id) do update set public=true;

drop policy if exists "own skin write" on storage.objects;
create policy "own skin write" on storage.objects for all to authenticated
  using (bucket_id='offline-skins' and storage.filename(name) = (select username||'.png' from profiles where id=auth.uid()))
  with check (bucket_id='offline-skins' and storage.filename(name) = (select username||'.png' from profiles where id=auth.uid()));
```
رابط السكن يصير: `https://<مشروعك>.supabase.co/storage/v1/object/public/offline-skins/{USERNAME}.png` — ضعه في حقل `skin` في إعداد CustomSkinLoader أعلاه. (يمكن إضافة زر "ارفع سكنك" في موقعك لاحقاً.)

## الطريقة 3: سيرفر سكنات كامل (حسابات + رفع من الويب)
شغّل **Drasl** (خفيف) أو **Blessing Skin Server** على VPS/Docker، ويعملان بنظام Yggdrasil مع **authlib-injector**؛ يسجّل اللاعب ويرفع سكنه من الويب. يتطلب أن يدعم اللانشر حسابات Yggdrasil (غير موجود في 0.3.7 — يمكن إضافته).
