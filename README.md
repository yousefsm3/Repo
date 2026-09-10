# Wedding AI Face Search Platform — Phase 1 Delivery

## ما تم تسليمه في هذه المرحلة (Architecture + Database)
- `docs/ARCHITECTURE.md` — قرارات الـ Stack والسبب، Pipeline المعالجة، مبدأ Multi-Tenant
- `db/schema.sql` — كامل الـ Database schema مع pgvector و Row-Level Security للعزل بين المصورين، بدون أي MAX_PHOTOS مبرمج
- `src/providers/FaceRecognitionProvider.ts` — واجهة قابلة للتبديل بين AWS Rekognition / InsightFace الذاتي / Google Vision
- `src/providers/CoreProviders.ts` — واجهات Storage / VectorSearch / Payment القابلة للتبديل
- `.env.example` — كل متغيرات البيئة المطلوبة، بدون أي Secret حقيقي
- `docs/COST_ESTIMATE.md` — جدول التكلفة التقديري لـ 1,000 حتى 1,000,000 صورة + مقارنة المزودين

## ما ينقص فعليًا قبل التشغيل الحقيقي
1. **حساب AWS (أو Cloudflare R2)** فعلي بمفاتيح API — بدونه لا يعمل رفع/تخزين الصور فعليًا.
2. **مزود Face Recognition** فعلي (أوصي بالبدء بـ AWS Rekognition لسهولة الدمج) بمفتاح API.
3. **حساب تاجر Moyasar** (أو HyperPay/Tap) لتفعيل الدفع الحقيقي.
4. **مراجعة قانونية سعودية** لسياسة الخصوصية والبيانات البيومترية قبل أي إطلاق تجاري — لم أكتب استشارة قانونية، فقط Placeholder.
5. **دومين فعلي** لو أردتم Custom Domain حقيقي بدل localhost.

## PHASE 2 — Authentication + Multi-Tenant (تم إضافته الآن)

الملفات الجديدة:
- `src/lib/db.ts` — **الأهم أمنيًا**: `withTenantClient()` يضبط `app.tenant_id` في جلسة Postgres قبل أي استعلام، بحيث الـ RLS في `db/schema.sql` يمنع فعليًا رؤية بيانات مستأجر آخر — حتى لو كان هناك خطأ برمجي في الـ route.
- `src/lib/auth.ts` — تشفير كلمات المرور (bcrypt، 12 rounds)، توقيع/تحقق JWT، وإعداد MFA (TOTP) الإجباري لمنطقيًا لحسابات Super Admin.
- `src/lib/rateLimit.ts` — حماية أولية من Brute Force على تسجيل الدخول/التسجيل (ملاحظة: in-memory حاليًا، يجب استبدالها بـ Redis عند تعدد السيرفرات).
- `src/app/api/auth/register/route.ts` — تسجيل مصور جديد: ينشئ Tenant + أول مستخدم بدور `photographer` على خطة Starter تلقائيًا.
- `src/app/api/auth/login/route.ts` — تسجيل الدخول، يفرض MFA لو كان مفعّلًا للحساب، ويضع الجلسة في httpOnly cookie (وليس localStorage، لتفادي XSS).
- `src/middleware.ts` — يفحص الجلسة على كل مسار `/api/*` و `/dashboard/*` (باستثناء صفحات الضيوف `/e/*` و `/kiosk/*` التي تبقى عامة كما يقتضي المنتج)، ويمرر `x-tenant-id` الموثوق من التوكن — **لا يوجد مسار كود واحد يثق بـ tenantId قادم من الـ client مباشرة**.
- `package.json` — الاعتماديات الحقيقية (pg, bcryptjs, jsonwebtoken, otplib, bullmq, sharp...) لتشغيل هذا الكود فعليًا بـ `npm install`.

### كيف تختبره محليًا
```bash
npm install
cp .env.example .env   # ثم عبّئ DATABASE_URL على الأقل
npm run migrate        # ينشئ الجداول من db/schema.sql
npm run dev
curl -X POST localhost:3000/api/auth/register -d '{"businessName":"استوديو تجريبي","email":"a@test.com","password":"12345678901"}' -H 'Content-Type: application/json'
```

### ما ينقص لإكمال الأمان الكامل هنا
- ربط `mfa_secret`/`mfa_enabled` فعليًا عبر endpoint إعداد MFA (لم أُنشئه بعد — يحتاج شاشة عرض QR Code للمشرف).
- استبدال Rate Limiter الحالي (in-memory) بـ Redis عند النشر متعدد السيرفرات.
- إضافة CSRF token للنماذج غير الـ JSON إن استخدمتم Server Actions لاحقًا.

## الخطوة التالية
تبقى المراحل: Events → Upload/Storage → AI Face Pipeline → Vector Search → Guest Selfie Flow → QR → Dashboards → Payments → إلخ. قل "أكمل Phase 3" للمتابعة إلى Events (إنشاء المناسبة + QR + الرابط العام).
