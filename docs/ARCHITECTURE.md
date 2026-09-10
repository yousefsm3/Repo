# منصة البحث عن صور الأعراس بالذكاء الاصطناعي — PHASE 1: Architecture + Database

## 1. اختيار الـ Stack (مع الأسباب)

| الطبقة | الاختيار | السبب |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR للـ SEO، دعم ممتاز لـ RTL/i18n، نظام Routing مناسب لصفحات الأحداث الديناميكية `/e/:id` |
| UI | Tailwind CSS | سرعة بناء، سهولة دعم RTL عبر `dir="rtl"` |
| Backend API | Next.js Route Handlers + طبقة Services منفصلة | يبسّط النشر، ويسمح لاحقًا بفصل الـ Workers إلى خدمة مستقلة (NestJS) دون إعادة كتابة منطق الأعمال لأنه معزول في `src/services` |
| Database | PostgreSQL 16 + pgvector | يدعم Multi-Tenant عبر Row-Level Security، ويدعم Vector Search دون الحاجة لقاعدة بيانات منفصلة عند الحجم المتوسط (حتى ~5-10 مليون embedding) |
| Queue | Redis + BullMQ | معياري، يدعم Retry/Backoff/Concurrency لكل Worker |
| Storage | Object Storage abstraction (S3-compatible: AWS S3 أو Cloudflare R2) | التوافق مع S3 API يسمح بتبديل المزود دون تغيير الكود |
| Auth | Auth.js (NextAuth) + Credentials/JWT مخصص للمصورين، Session Token مؤقت للضيوف | يفصل نوعي الجلسات (Tenant users vs Guest ephemeral) |
| AI (Face) | Provider abstraction — راجع `src/providers` | لا نربط النظام بمزود واحد كما طلبت |

## 2. مبدأ Multi-Tenant + Event Isolation

- كل صف في الجداول الحساسة (`events`, `photos`, `faces`, `searches`) يحمل `tenant_id`.
- كل استعلام يمر عبر PostgreSQL Row-Level Security (RLS) يفرض `tenant_id = current_setting('app.tenant_id')`.
- البحث بالوجه يُفلتر إجباريًا بـ `event_id` من الرابط — لا يوجد مسار كود واحد يسمح بالبحث عبر مناسبات متعددة (تم فرضها في `VectorSearchProvider.search()` نفسه، وليس فقط في الواجهة).

## 3. Pipeline المعالجة (Async بالكامل)

```
Upload → S3 (original) → Queue(process-photo) → Worker:
   1) Generate thumbnail + optimized copy (sharp)
   2) Face Detection (FaceRecognitionProvider.detectFaces)
   3) Face Embedding (FaceRecognitionProvider.getEmbedding)
   4) Store embedding in pgvector (VectorSearchProvider.index)
   5) Discard temp optimized copy, keep original + thumbnail
   6) photo.processing_status = 'processed'
```

لا يوجد حد أقصى للصور مبرمج (`MAX_PHOTOS`) — الحد الوحيد الفعلي هو حدود الخطة (`plans.photo_limit`) وهو NULL افتراضيًا = Unlimited، ويُدار من Admin وليس من الكود.

## 4. الخطوات القادمة (Phase 2+)

هذا التسليم يغطي Phase 1 فقط (Architecture + DB) كما رتبت الخطة. الملفات المرفقة:
- `db/schema.sql` — كامل الـ schema
- `src/providers/*.ts` — الواجهات القابلة للتبديل (Face, Storage, Vector, Payment)
- `.env.example`
- `docs/COST_ESTIMATE.md`

عند تأكيدك، أكمل Phase 2 (Auth + Multi-Tenant) ثم Phase 3 (Events) وهكذا حسب ترتيبك، مع تسليم كل مرحلة بنفس الأسلوب: كود حقيقي + شرح + ما ينقصه من مفاتيح API.

## 5. ما تحتاجه فعليًا مني/منك قبل أي نشر تجاري حقيقي
- حساب AWS/Cloudflare R2 فعلي (مفاتيح تُوضع في `.env`)
- مزود Face Recognition فعلي (أوصي أدناه) بحساب ومفتاح API
- بوابة دفع سعودية (Moyasar/HyperPay) بحساب تاجر فعلي
- مراجعة قانونية سعودية للسياسات (لن أدّعي أنها استشارة قانونية)
