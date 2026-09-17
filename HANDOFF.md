# Qafzly Backend – Developer Handoff Document

**Date:** September 17, 2026
**Prepared by:** Senior Backend Engineer
**Status:** ✅ Sprint 12 Complete – Backend Ready for UAT & Community Integration
**Next Sprint:** Sprint 13 – Recommendation Refinement, Bulk Enrollment, Deployment Config

---

## 1. Project Overview

Qafzly is a gamified EdTech platform targeting Arabic-speaking learners. This repository contains the backend API built with **Node.js, TypeScript, Express, Prisma, PostgreSQL, and Redis**.

The API follows a **services → controllers → routes** architecture for clean separation of concerns.

**Current status:** Feature-complete for MVP. **452 unit tests + 80 integration tests passing.** Awaiting AWS Solution Architect for staging deployment (S3 avatars, SES production access, CI/CD).

---

## 2. Current State

### ✅ Sprint 12 – Security Hardening, Community Contract & Test Expansion (Completed September 17, 2026)

This sprint closed the frontend's Task #7 (Community) contract requirements, delivered the server-side security fix deferred from Sprint 11, expanded the test suite dramatically, and eliminated a class of query-parameter bugs across the codebase.

#### 2.1 Server-Side Answer Evaluation (Security)

**The vulnerability:** `completeSlide` and `completeCheckpoint` accepted `isCorrect` / `completed` booleans directly from the request body. A motivated student could send `isCorrect: true` via DevTools for every quiz slide and earn full XP.

**The fix:** Answer correctness is now computed **server-side** by a new module `src/services/answerEvaluation.service.ts`.

- **New module** with `evaluateSlideAnswer(slide, answer)` and `evaluateCheckpointSubmission(submission)`
- **Arabic normalization** for FILL_BLANK: strips tashkeel, normalizes alef variants (أ إ آ → ا), yeh variants (ى ئ → ي), teh marbuta (ة → ه), tatweel — this is critical because Arabic learners type with and without diacritics interchangeably
- **Per-type evaluators:**
  - `INFO` → always passes
  - `QUIZ` → `{ index }` compared against `slide.correctIndex`
  - `TRUE_FALSE` → `{ value }` compared against `slide.correctAnswer`
  - `FILL_BLANK` → `{ text }` normalized and checked against `slide.acceptedAnswersJson[]`
  - `DRAG_DROP` → `{ items: [{ label, correctZone }] }` compared order-insensitively
- **API contract change (breaking):**
  - Slide complete body is now `{ answer }` only. `isCorrect` is rejected with `400` by `.strict()` Zod validation.
  - Checkpoint complete body is now `{ selfReflectionAnswer }` only. `completed` is rejected with `400`.
  - Response includes the computed `isCorrect` so the frontend gets immediate feedback.

Files touched: `src/services/answerEvaluation.service.ts` (new), `src/services/slide.service.ts`, `src/services/quest.service.ts`, `src/utils/validators/slide.schema.ts`, `src/utils/validators/questCheckpoint.schema.ts`, `src/controllers/slide.controller.ts`, `src/controllers/quest.controller.ts`.

#### 2.2 Lesson-Completion XP + Warm-Up XP

**Lesson-completion XP:**
- New `Lesson.completionXpAward` field (default `10`)
- `POST /progress/lessons/:lessonId` with `completed: true` awards this XP **once per user per lesson** — idempotent (repeat completions don't re-award)
- Non-blocking — failures are logged, never propagate to the response

**Warm-up XP endpoint:**
- New endpoint: `POST /lessons/:lessonId/warmup/complete`
- Request body: `{ "answer": "الكمبيوتر" }`
- Server evaluates against `Lesson.warmUpJson.answerAr` using the same Arabic normalization as FILL_BLANK
- First submission only — duplicate → `400 تم إكمال تمرين الإحماء بالفعل`
- Wrong answer marks `warmUpCompleted: true` but awards `0 XP` (no second chance — matches slide behavior)
- New field `LessonProgress.warmUpCompletedAt` tracks completion

Files touched: `prisma/schema.prisma`, `src/services/progress.service.ts`, `src/controllers/progress.controller.ts`, `src/routes/progress.routes.ts`, `src/utils/validators/progress.schema.ts`.

#### 2.3 Parent Dashboard Contract Fixes

**Three coordinated fixes** to unblock the frontend's Task #5 (Parent Dashboard):

- **`POST /parents/me/children`** now accepts either `childId` (uuid) **or** `email`. Exactly one required. The email path resolves to a `STUDENT` user.
- **`GET + PUT /parents/me/children/:childId/settings`** now return a **flat shape** `{ lockOverrideEnabled, customLockDurationHours }` regardless of whether a `ChildSettings` row exists. Previously returned the full DB record when it existed and a slim object when it didn't — breaking the frontend's rendering.
- **`GET /parents/me/billing`** now aggregates purchases from the parent **and all linked children**. Each purchase includes `user: { id, fullName, email }` so the UI can show who paid. The `subscriptions` key is gone — the `Subscription` model was deprecated.

**Subscription model deprecation:**
- Removed `Subscription` from `prisma/schema.prisma` and its relation on `User`
- Migration `20260916140547_deprecate_subscription` drops the table
- `admin.service.ts > getUserById` no longer includes the subscriptions relation
- `Enrollment.expiresAt` is now the single source of truth for subscription windows

Files touched: `src/services/parent.service.ts`, `src/controllers/parent.controller.ts`, `src/utils/validators/parent.schema.ts`, `prisma/schema.prisma`, `src/services/admin.service.ts`.

#### 2.4 Community Contract Fixes (Task #7)

Six coordinated changes to align the community API with the frontend's Task #7 contract.

| # | Change | Impact |
|---|--------|--------|
| 1 | **`user` → `author`** rename in all post/comment responses | Matches industry norms; new helper `toAuthor()` in `forum.service.ts` |
| 2 | **`userVote`** added to posts list, post detail, comments | Per-user vote state (`'up' \| 'down' \| null`). Batched subquery — no N+1. |
| 3 | **`postCount`** added to `GET /forum/categories` | Only counts published, non-deleted posts |
| 4 | **Comment duplication fix** | `getComments` was missing `parentCommentId: null` filter on the top-level query — replies appeared both nested AND at top level |
| 5 | **Create responses now include relations** | `createPost` and `addComment` refetch with `author`/`category` to match list shape |
| 6 | **Deterministic sort tie-breaker** | `listPosts` uses `[{ sortBy }, { createdAt: 'desc' }]` — stable ordering across identical requests |

**Also fixed:**
- **`GET /paths/:id` and `GET /forum/posts/:id`** now use `optionalAuth`. The admin-bypass logic in their controllers was dead code — `req.user` was always `undefined`.
- **Inactive forum categories** now filtered by default. Pass `?isActive=false` for admin views.

Files touched: `src/services/forum.service.ts` (rewritten), `src/controllers/forum.controller.ts` (some functions), `src/routes/forum.routes.ts`, `src/routes/path.routes.ts`.

#### 2.5 Forum Reporting

New `ForumReport` model + report endpoints + moderation queue rewrite.

- **`POST /forum/posts/:id/report`** and **`POST /forum/comments/:id/report`** — new endpoints
- Reasons: `spam`, `harassment`, `inappropriate`, `misinformation`, `off-topic`, `other`
- Duplicate report → `409`; self-report → `400`
- Post reports increment the post's `flaggedCount` in a transaction
- **Moderation queue rewrite:** `GET /admin/forum/reports` now returns `ForumReport` objects with embedded `reporter`, `post`, and `comment` — previously returned raw posts with a `flaggedCount > 0` filter. The queue now shows "who reported what".
- `POST /admin/forum/reports/:id/resolve` marks the report resolved and decrements the post's `flaggedCount`

Migration: `20260915101558_add_forum_reports`.

Files touched: `prisma/schema.prisma` (ForumReport model + 2 back-relations), `src/services/forum.service.ts`, `src/services/moderation.service.ts` (rewritten), `src/controllers/moderation.controller.ts`, `src/utils/validators/forum.schema.ts` (added report schemas).

#### 2.6 Boolean Query Parameter Bug Class

**The bug:** `z.coerce.boolean()` in Zod v4 does `Boolean(value)` under the hood. `Boolean('false')` is `true` because `'false'` is a non-empty string. So `?isFeatured=false` silently returned `isFeatured: true` results. Same bug existed in three places:
- `path.schema.ts` (`isFeatured`)
- `module.schema.ts` (`isPublished`)
- `notification.schema.ts` (`isRead`, `isArchived`, `isDismissed` — a slightly different manifestation)

**The fix:** shared helper `src/utils/validators/booleanQuery.ts`:

```typescript
export const optionalBooleanQuery = z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => {
        if (v === undefined) return undefined;
        if (typeof v === 'boolean') return v;
        return v === 'true';
    });
```

Preserves three distinct cases:
- `'true'` → `true`
- `'false'` → `false`
- omitted → `undefined` (no filter applied)

**Do not use** `z.coerce.boolean()`. **Do not use** `.optional().transform(v => v === 'true')` — Zod runs the transform on `undefined`, silently turning omitted params into `false` and adding unintended filters.

Files touched: `src/utils/validators/booleanQuery.ts` (new), `path.schema.ts`, `module.schema.ts`, `notification.schema.ts`.

#### 2.7 Boss Battle Badge Persistence + Retry Rename

- **Four tier badges now persist** as real `UserBadge` rows on boss battle submission:
  - `أسطورة المدينة` / City Legend (≥80%)
  - `محارب المدينة` / City Warrior (≥60%)
  - `متدرب المدينة` / City Trainee (≥40%)
  - `مش هستسلم` / Won't Give Up (<40%)
- Previously the badge name was only echoed in the response and never saved — a broken feature. Now `badgesEarned` and `GET /gamification/me/badges` are consistent.
- **Retry tier label renamed** from `حاول تاني` ("try again") to `مش هستسلم` ("won't give up"). The old label promised retry, but the backend blocks resubmission via a unique constraint. The rename removes the false promise.
- **Seed update:** the seeded boss battle now has **5 questions** (was 3). With 3 questions, the trainee tier (40–59%) was mathematically unreachable — no score landed in that band. All four tiers are now reachable.

Files touched: `src/services/bossBattle.service.ts`, `prisma/seed.ts`.

#### 2.8 Search Branch Coverage

`search.service.ts` was at 61.9% branch coverage (100% statements). Now at **100% statements + 100% branches**.

- Added ~20 branch tests covering: empty `q`, short queries (< 3 chars), filter-only queries, all filter combinations, empty count row, pagination boundaries
- All four types (`path`/`forum`/`user`/omitted) exercised
- Language parameter branches covered

File: `src/services/__tests__/search.service.test.ts` (rewritten).

#### 2.9 Integration Test Expansion

Went from **22 integration tests** (9 files) to **80 integration tests** (18 files).

**New files:**
- `slides.test.ts` — list, complete (new contract), access via preview, `isCorrect` rejection
- `checkpoints.test.ts` — list, complete, next-checkpoint logic, `completed` rejection
- `bossBattle.test.ts` — get, submit, all four tiers, badge awarding, duplicate rejection
- `recharge.test.ts` — status endpoint, XP multiplier within boost window
- `notifications.test.ts` — list, unread count, mark read, archive, dismiss, delete, device register
- `parent.test.ts` — link by id, link by email, list, progress, settings, overview, billing aggregation
- `moderation.test.ts` — reports list, resolve, hide/unhide post + comment
- `certificates.test.ts` — auto-issue on path completion, public verify, list, download, revoke admin
- `forumReport.test.ts` — report post, duplicate prevention, self-report prevention, admin list + resolve

#### 2.10 Seed Data Expansion

- **Paid published path** added for payment-flow testing: `مقدمة إلى البرمجة بلغة بايثون` (150 EGP, published, with a preview lesson)
- **Forum content** added (previously zero):
  - 5 categories — أسئلة عامة، مشاكل تقنية، نقاشات، إعلانات، اقتراحات
  - 8 posts (3 authored by `test-student@qafzly.com`)
  - 13 comments (10 top-level + 3 nested replies), 2 marked as best answers
  - 15 votes distributed across posts and comments
- **Boss battle now has 5 questions** (was 3) so all four tiers are reachable
- **Lesson 1** now has:
  - Real public YouTube video IDs (were `youtube_id_1` / `youtube_id_2` placeholders)
  - `lockDurationHours: 0` (was 12) so the frontend can click through without waiting during testing
  - `completionXpAward: 10`

Files touched: `prisma/seed.ts`.

#### 2.11 Test Counts

| Suite | Before Sprint 12 | After Sprint 12 |
|-------|------------------|-----------------|
| Unit | 361 | **452** |
| Integration | 22 | **80** |
| Total | 383 | **532** |

Service-layer coverage improved for `search.service.ts` (100% branches) and held steady elsewhere. New coverage: `answerEvaluation.service.ts` (~79%), `forum.service.ts` (88.65% statements — the response-shape helpers add untested paths that are covered indirectly by integration tests).

---

### ✅ Sprint 11 – UAT & Bug Fixing (Completed September 12, 2026)

This sprint closed all remaining gaps between backend behavior and frontend/PM expectations, plus fixed production-blocking bugs discovered by the new integration test suite.

#### 2.1 Integration Test Infrastructure

- **Isolated Docker setup** (`docker-compose.test.yml`) — dedicated Postgres on port `5434`, Redis on `6380`, fully separate from dev
- **`jest.integration.config.js`** with `setupFiles` + `setupFilesAfterEnv` hooks
- **Dedicated `.env.test`** (git-ignored) — full template in `README.md`
- **22 integration tests passing** across 9 files: auth, user, enrollment, progress, gamification, payments, forum, search, health
- **Scripts added:** `test:integration`, `test:integration:up`, `test:integration:migrate`, `test:integration:down`
- Single-command flow: `npm run test:integration` starts containers, applies migrations, seeds, runs suite, tears down

#### 2.2 Critical Production Fixes

Each of these was a genuine UAT blocker found only by running end-to-end HTTP tests.

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| 1 | `/enrollments` returned 404 for every path | Router not mounted in `src/routes/index.ts` | Added `router.use('/enrollments', enrollmentRoutes)` |
| 2 | `/moderation` mount broken | Missing leading slash in mount path | Added the slash |
| 3 | `/payment` vs `/payments` mismatch | Base mount was singular | Renamed to `/payments` |
| 4 | Auth refresh failed with `Bad "options.expiresIn"` | Decoded refresh token (with `exp`/`iat`) passed to `generateAccessToken` | Rebuild payload as `{ userId, email, role }` before signing |
| 5 | Search returned 500 `Failed to deserialize column of type 'tsvector'` | `SELECT *` in raw SQL hit `Unsupported` columns | Explicit column selection + `plainto_tsquery(${q}::regconfig)` |

#### 2.3 Redis-Backed Rate Limiter

Replaced the in-memory limiter with a Redis sliding-window implementation.

- **Factory pattern** — `createRateLimiter({ windowMs, max, keyPrefix, keyGenerator, skipOnError })`
- **Key strategy** — authenticated requests key by `userId` (CGNAT-friendly for Egyptian mobile carriers); anonymous key by IP
- **Auth limiter preserved** — 10 req/min per IP per endpoint
- **General limiter** — `RATE_LIMIT_MAX_REQUESTS` (default 100) per `RATE_LIMIT_WINDOW_MS` (default 60s)
- **Fail-open on Redis outage** — configurable via `RATE_LIMIT_FAIL_OPEN` (default `true`)
- **Headers on every response** — `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, plus `Retry-After` on 429
- **Health checks and `/api-docs` excluded** — moved before the limiter in `app.ts`
- **6 unit tests** covering under-limit, over-limit, user-key, and both fail modes

Files: `src/middleware/rateLimiter.ts` (rewritten), `src/middleware/authRateLimiter.ts` (rewritten to use factory), `src/app.ts` (middleware order).

#### 2.4 Payment Expiration Cron + Graceful Shutdown + Health Split

- **`src/jobs/paymentExpiry.job.ts`** — flips `PENDING → EXPIRED` for requests past `expiresAt`, every 5 min
  - Redis lock (`cron:payment_expiry:lock`, 55s TTL) for multi-instance leader election
  - Fail-open on Redis outage (idempotent `updateMany` with status filter)
  - `startPaymentExpiryJob()` / `stopPaymentExpiryJob()` lifecycle with `unref()` so it doesn't block exit
  - 6 unit tests
- **Graceful shutdown in `src/index.ts`** — SIGTERM/SIGINT → stop cron → drain HTTP → close Prisma + Redis → 15s force-exit timer → `unhandledRejection` + `uncaughtException` handlers
- **Health split**:
  - `/health/live` — always 200 (process alive)
  - `/health/ready` — 200 if Postgres + Redis reachable, 503 otherwise
  - `/health` — backwards-compat alias for `/health/live`

#### 2.5 Idempotency-Key on `POST /payments/requests`

- **`src/middleware/idempotency.ts`** — reusable factory
- **Optional** `Idempotency-Key` header (backwards compatible)
- **24h cache** of 2xx responses per `(userId, key)` in Redis
- **`SET NX` in-flight marker** — concurrent same-key requests get `409`
- **Error responses not cached** — the in-flight lock is released so clients can retry
- **Fail-open on Redis unavailability** — consistent with rate limiter decision
- **8 unit tests** + Swagger header documented

#### 2.6 AWS SES Migration (SendGrid Removed)

- **`src/config/sesClient.ts`** — `SESClient` from `@aws-sdk/client-ses` + `sendSesEmail` helper
- **`sendEmail` is now non-throwing** — critical bug fix. Email failures no longer cascade into 500s on payment request creation, activation, rejection, password reset, etc.
- **Sandbox mode** — no domain verification yet; empty `AWS_ACCESS_KEY_ID` triggers a `[DEV] Would send email to ...` short-circuit
- **Removed:** `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `@sendgrid/mail` dependency
- **Added:** `SES_FROM_EMAIL`

#### 2.7 Preview Lesson Access Control (Freemium Tier)

- **`src/middleware/optionalAuth.ts`** — attaches `req.user` if token present, does not reject if absent
- **Access rule** (`determineLessonAccess` in `lesson.service`):
  1. `isPreview: true` → open to everyone (including anonymous)
  2. Active enrollment in parent path → accessible
  3. Admin → bypass
  4. Otherwise → `403 يجب الاشتراك في هذه الدورة للوصول إلى الدرس`
- **`GET /lessons`** — always lists all published lessons, but each carries `isAccessible: boolean` (single path-level query, no N+1)
- **`GET /lessons/:id`** — enforces access; response includes `access.reason` (`'preview' | 'enrolled' | 'admin'`)
- **10 unit tests** + manual verification (anon 403, child1 200)

#### 2.8 Certificate Generation

- **New model `Certificate`** — `(userId, pathId)` unique, `certificateCode` (Base32, unambiguous alphabet), `metadata` snapshot, `revokedAt`, `revokedReason`
- **Auto-issue** — hooked into `progress.service.ts` after every `completed: true` lesson. Idempotent, non-blocking, best-effort
- **PDF generation** — A4 landscape via `pdfkit` + Noto Naskh Arabic + `arabic-persian-reshaper` (Arabic shaping + glyph reversal)
- **Storage abstraction** — `certificateStorage.service.ts` (local `uploads/certificates/` today, S3 swap later)
- **6 endpoints**:
  - `GET /certificates/me`
  - `GET /certificates/verify/:code` (public, no auth)
  - `GET /certificates/:id`
  - `GET /certificates/:id/download`
  - `POST /certificates/admin/issue`
  - `POST /certificates/admin/:id/revoke`
- **Email template** — Arabic, RTL, gold-branded
- **15 unit tests** + Swagger

#### 2.9 Frontend Student Dashboard Fixes

Response shapes now match the Student Dashboard spec exactly.

| Endpoint | Change |
|----------|--------|
| `GET /gamification/me` | Returns `totalXp`, `currentLevelXp`, `nextLevelXp`, `rank`, `badges[]` with `nameAr` + `nameEn`. Previously returned raw Prisma shape. |
| `GET /gamification/me/streak` | Adds `lastActivityDate` (derived from latest completion) |
| `GET /gamification/daily-quests` | Renamed `xpReward` → `xpAward`. Added `titleAr`, `descriptionAr` explicitly. |
| `GET /enrollments/me/enrollments` | Adds computed `progress` (0-100), `currentLesson` object, `pathTitleAr`/`pathTitleEn`, `featuredImage`, `difficulty` |
| `GET /gamification/leaderboard?scope=global` | Adds `userId`, `level` per entry — enables frontend highlight |

**Auto-streak**: `progress.service.ts` now updates streak on `completed: true` lessons per spec §3.4. Non-blocking (failures logged).

**`Badge.nameEn`** added to schema — additive migration.

**Seed additions**: `test-student@qafzly.com` (XP 1250, Level 5) + 5 leaderboard fillers (XP 2500–400).

**Level formula changed** — see §6.

#### 2.10 Migration History Rebasing

- **The problem**: the pre-existing `20260911150633_add_search_vector_columns` migration actually **dropped** the tsvector columns and indexes it claimed to add. Subsequent `migrate dev` runs generated broken migrations. This is a **confirmed, still-open Prisma bug** — [#24496](https://github.com/prisma/prisma/issues/24496) and [#15654](https://github.com/prisma/prisma/issues/15654).
- **The fix**: rebased migration history to a single baseline `20260911203608_initial_schema` that includes the tsvector columns + indexes as raw SQL. Added a follow-up `20260911212808_add_badge_name_en`.
- **The rule**: **Never run bare `npx prisma migrate dev`**. Always:
  1. `npx prisma migrate dev --create-only --name <desc>`
  2. Audit the generated `migration.sql` and strip any `DROP DEFAULT` on search vectors, any `DROP COLUMN "search_vector_*"`, and any `DROP INDEX "idx_(paths|forum_posts|users)_*"` lines
  3. `npm run check:migrations` — fails if any forbidden pattern is present
  4. `npx prisma migrate deploy`
- **`scripts/check-migrations.js`** — Node script, runs in CI or manually
- **`npm run check:migrations`** — npm script
- **`CONTRIBUTING.md` §7** — full workflow documented

#### 2.11 Test Counts

| Suite | Before Sprint 11 | After Sprint 11 |
|-------|------------------|-----------------|
| Unit | 306 | **361** |
| Integration | 0 | **22** |
| Total | 306 | **383** |

Service-layer coverage remains ~93% statements. New coverage: `jobs/paymentExpiry.job.ts` (93%), `middleware/rateLimiter.ts` (97%), `middleware/idempotency.ts` (94%), `services/certificate.service.ts` (70%), `services/certificatePdf.service.ts` (16% — mostly PDF rendering), `services/certificateStorage.service.ts` (40%).

---

### ✅ Sprints 1–10 — Previously Completed

*(Historical record. Full detail preserved for reference.)*

#### Project Foundation

- Full folder structure, middleware, utilities, configuration.
- Docker Compose for local PostgreSQL and Redis.
- Prisma schema with all core models (users, paths, progress, gamification, community, payments, notifications, child settings, enhanced content models).
- Seed script (`prisma/seed.ts`) extended with sample data for all features.

#### Sprint 1 – Authentication

- Endpoints: register, login, refresh, logout, forgot password, reset password.
- Redis-backed rate limiting and account lockout.
- JWT access/refresh tokens with refresh tokens stored in Redis.
- Bcrypt password hashing (12 rounds).
- Arabic error messages.
- Unit tests: 12/12 passing, 94.25% statement coverage.

#### Sprint 2 – User Management

- Self-profile endpoints (GET, PUT, PATCH, DELETE `/users/me`).
- Privacy settings (GET/PUT `/users/me/privacy`).
- Avatar upload/removal (Multer, local storage).
- Admin user management (list, detail, update, suspend/activate, change role).
- Database schema extended with `displayName`, `timezone`, `lastLoginAt`, `privacySettings`.
- New middleware: `authorize.ts` for role-based access.
- New utilities: `upload.ts` for Multer configuration.
- New services: `user.service.ts`, `admin.service.ts`.
- New controllers: `user.controller.ts`, `admin.controller.ts`.
- New routes: `user.routes.ts`, `admin.routes.ts`.
- New validators: `user.schema.ts`, `admin.schema.ts`.
- Unit tests: 31 total (12 auth + 19 user/admin), service layer coverage 83.33%.

#### Sprint 3 – Path Core

- **Categories**: full CRUD (admin) + public listing/detail.
- **Paths**: CRUD (admin), public listing with filters, admin listing including unpublished, publish/unpublish.
- **Modules**: CRUD (admin), list by path (public/private), detail with lessons.
- **Lessons**: CRUD (admin), list by module, detail with quiz questions.
- **Enrollment**: enroll/unenroll, list user enrollments, list path enrollments (admin).
- **Progress**: update lesson progress, get path progress summary.
- Swagger UI fully documented with all endpoints.
- Seed script extended with realistic test data.
- Unit tests: 86 passing (services layer), coverage ~91% statements.

#### Sprint 4 – Gamification

- **Profile**: current user gamification profile (XP, level, badges, rank).
- **XP & Levels**: XP history, level definitions (50 levels).
- **Badges**: all badges, my badges, user badges.
- **Leaderboards**: global and path-specific.
- **Streaks**: current streak info and streak freeze endpoint.
- **Daily Quests**: active quests and completion.
- New service: `gamification.service.ts`.
- New controller: `gamification.controller.ts`.
- New route: `gamification.routes.ts`.
- New validators: `gamification.schema.ts`.
- Unit tests: **113 passing**, service layer coverage **92.81%**.
- Gamification service coverage: **100% statements, 90.24% branches**.

#### Sprint 5 – Manual Payments (MVP)

- **Payment Requests**: user can create a payment request for a path and receive clear payment instructions (Vodafone Cash & InstaPay numbers, reference code).
- **User Tracking**: user can list their requests and mark a payment as sent.
- **Admin Management**: admin can list all requests with filters, activate a request (creates enrollment and purchase, sends confirmation email), or reject with reason.
- **Email Notifications**: payment instructions, activation confirmation, rejection email templates (Arabic).
- New model `PaymentRequest` and enum `PaymentRequestStatus` added to Prisma schema.
- New service: `payment.service.ts`.
- New controller: `payment.controller.ts`.
- New route: `payment.routes.ts`.
- New validators: `payment.schema.ts`.
- Unit tests: **144 passing** (up from 120), service layer coverage **94.05%**.
- Payment service coverage: **100% statements, 90.9% branches**.

#### Sprint 6 – Community Features

- **Forum Categories**: list categories with pagination/search.
- **Forum Posts**: full CRUD with filters, soft delete, view count, pinning/locking (future).
- **Comments**: CRUD with reply support, soft delete.
- **Voting**: polymorphic voting on posts and comments with toggle logic.
- **Best Answer**: post owner can mark a comment as best answer; sets post as solved.
- **Search**: search posts by title/content.
- **Moderation**: admin endpoints to list reports (flagged posts), resolve reports, hide/unhide posts and comments.
- New models: `ForumCategory`, `ForumPost`, `ForumComment`, `ForumVote`, and enums `ForumPostStatus`, `ForumCommentStatus`.
- New services: `forum.service.ts`, `moderation.service.ts`.
- New controllers: `forum.controller.ts`, `moderation.controller.ts`.
- New routes: `forum.routes.ts`, `moderation.routes.ts`.
- New validators: `forum.schema.ts`.
- Unit tests: **190 passing** (up from 144), service layer coverage **93.2%**.
- Forum service coverage: **87.95% statements, 75.2% branches**.
- Moderation service coverage: **100% statements, 100% branches**.

#### Sprint 7 – Notifications

- **User Endpoints**: list notifications with filters, unread count, mark as read, mark all as read, archive, dismiss, delete, device register/unregister.
- **Admin Endpoints**: send system notification to all users or specific users.
- **Email Integration**: SendGrid-based email notifications (notification-specific email template). **Migrated to AWS SES in Sprint 11.**
- **Push Notifications**: placeholder for Firebase Cloud Messaging (logged, not yet sent).
- **Models Upgraded**: `Notification` model expanded to include `senderId`, `link`, `iconUrl`, `imageUrl`, `metadata`, `isArchived`, `isDismissed`, `channelsSent`, `readAt`, `dismissedAt`. `DeviceToken` model expanded with `deviceToken`, `deviceType`, `deviceId`, `deviceModel`, `osVersion`, `appVersion`, `isActive`, `lastUsedAt`. New `NotificationTemplate` model added.
- New service: `notification.service.ts`.
- New controller: `notification.controller.ts`.
- New route: `notification.routes.ts` (replaced placeholder).
- New validators: `notification.schema.ts`.
- Unit tests: **219 passing** (up from 190), notification service coverage **>99% statements, >93% branches**.
- Overall service layer coverage: **93.38% statements**.

#### Sprint 8 – Search & Recommendations

- **Global Search**: search across paths, forum posts, and users with relevance ranking.
- **Path Search**: filters by category, difficulty, price range.
- **Forum Search**: filters by category and path.
- **User Search**: by name, display name, email.
- **Recommendations**:
  - Personalized path recommendations based on user's enrollment history.
  - Popular paths (by enrollment count).
  - Trending paths (recent enrollment activity, last 30 days).
  - Related paths ("because you took") using co-enrollment.
- **Database**: Added generated `tsvector` columns (`search_vector_ar`, `search_vector_en`) and GIN indexes on `paths` and `forum_posts`. Added trigram indexes on `users.fullName`, `users.email`, `paths.title`, `forum_posts.title`.
- New services: `search.service.ts`, `recommendation.service.ts`.
- New controllers: `search.controller.ts`, `recommendation.controller.ts`.
- New routes: `search.routes.ts`, `recommendation.routes.ts`.
- New validators: `search.schema.ts`, `recommendation.schema.ts`.
- Unit tests: **231 passing** (up from 219).
- Search service coverage: **100% statements, 59.52% branches, 100% functions**.
- Recommendation service coverage: **97.36% statements, 88.88% branches, 100% functions**.
- Overall service layer coverage: **93.77% statements, 82.67% branches, 94.89% functions**.

#### Sprint 9 – Parent-Child, Lesson Expansion, Lock, PDF Delivery

- **User Roles**: Removed `INSTRUCTOR`; roles now `STUDENT`, `PARENT`, `ADMIN`.
- **Parent-Child Relationships**: Self-referential `User` relation (`parentId`, `children`). New `ChildSettings` model (lock override enabled, custom lock duration).
- **Parent Endpoints**:
  - `POST /parents/me/children` – link child
  - `GET /parents/me/children` – list children
  - `DELETE /parents/me/children/:childId` – unlink
  - `GET /parents/me/children/:childId/progress` – progress summary
  - `GET /parents/me/children/:childId/performance` – quiz scores & challenges
  - `GET /parents/me/children/:childId/time-tracking` – time spent
  - `GET /parents/me/children/:childId/settings` – get settings
  - `PUT /parents/me/children/:childId/settings` – update settings
  - `GET /parents/me/overview` – aggregate info
  - `GET /parents/me/billing` – subscription/purchase history
- **Lesson Structure Expansion**: Added fields to `Lesson` model: `overviewVideoUrl`, `pdfUrl`, `explanatoryVideoUrl`, `slidesJson`, `challengeDescription`, `challengeType`, `challengeData`, `lockDurationHours`.
- **12-Hour Lock**: Implemented lock logic based on previous lesson completion and lock duration. Parent override can disable or adjust. Added endpoint `GET /lessons/:id/lock-status`.
- **PDF Delivery**: Added `PDF` signed URL endpoint `GET /lessons/:id/pdf-url` (S3 signed URL with 5-min expiry).
- **YouTube Validation**: Utility `extractYouTubeId` created and enforced in lesson schema.
- New services: `parent.service.ts`, `pdf.service.ts`, `s3.service.ts`.
- New controllers: `parent.controller.ts`.
- New routes: `parent.routes.ts`.
- New validators: `parent.schema.ts`.
- Unit tests: **252 passing** (up from 231).
- Parent service coverage: **98.3% statements, 95.83% branches**.
- Lesson service coverage: **95.38% statements, 82.92% branches**.
- Overall service layer coverage: **93.78% statements, 82.18% branches, 95.33% functions**.

#### Sprint 10 – Enhanced Content Structure (Slides, Mini-Quests, Boss Battle, Recharge)

- **New Models**:
  - `Slide` with `SlideType` enum (`INFO`, `QUIZ`, `DRAG_DROP`, `TRUE_FALSE`, `FILL_BLANK`)
  - `QuestCheckpoint` for mini-quests
  - `BossBattle` and `BossBattleQuestion` for boss battles
  - `UserSlideProgress`, `UserQuestProgress`, `UserBossBattleProgress` for tracking
- **New Fields on `Lesson`**: `warmUpJson`, `miniQuestJson`, `rechargeMessageAr/En`, `rechargeXpBoost`, `rechargeBoostMultiplier`, `rechargeBoostWindowHours`.
- **New Services**: `slide.service.ts`, `quest.service.ts`, `bossBattle.service.ts`, `recharge.service.ts`.
- **New Controllers/Routes/Validators**: corresponding files for slides, quests, boss battles, and recharge.
- **Endpoints**:
  - Slides CRUD + complete: `POST/GET/PUT/DELETE /lessons/:lessonId/slides...`
  - Quest checkpoints CRUD + complete: `POST/GET/PUT/DELETE /lessons/:lessonId/checkpoints...`
  - Boss battle CRUD + submit: `GET/POST/PUT/DELETE /modules/:moduleId/boss-battle...`
  - Recharge status: `GET /lessons/:id/recharge-status`
- **XP Recharge**: base XP multiplied by `rechargeBoostMultiplier` if within boost window after previous lesson completion. Victory bonus not multiplied.
- **Tests**: added comprehensive tests for slide, quest, bossBattle, recharge services.
- Overall test count increased to **306+ passing**, service layer coverage remains >90%.

---

## 3. How to Run the Project

### Prerequisites
- Node.js v20 LTS
- Docker Desktop
- Git

### Setup Steps

```bash
# 1. Clone the repository
git clone <repository-url>
cd qafzly-backend

# 2. Install dependencies
npm install

# 3. Copy .env.example to .env and adjust values (if needed)
cp .env.example .env

# 4. Start local infrastructure (PostgreSQL on port 5433, Redis on 6379)
docker-compose up -d

# 5. Apply database migrations
#    ⚠️ Use `migrate deploy`, NOT bare `migrate dev` — see §6 (Prisma bug)
npx prisma migrate deploy

# 6. Seed the database (admin, parent, children, test student, leaderboard
#    fillers, categories, paths, modules, lessons, slides, checkpoints,
#    boss battle, forum content, enrollment, progress, badges, quests)
npx ts-node prisma/seed.ts

# 7. Start the development server
npm run dev
```

The API will be available at `http://localhost:3000/v1`.
Health checks: `GET /health/live` (liveness) and `GET /health/ready` (readiness).
Swagger UI: `http://localhost:3000/api-docs`.

### Verify the setup

```bash
npx tsc --noEmit            # expect silent
npm test -- --coverage      # expect 452 passing
npm run test:integration    # expect 80 passing (Docker required)
```

---

## 4. Architecture Overview

```
src/
├── index.ts                 # Entry point: connects DB/Redis, starts server,
│                            # starts background jobs, wires graceful shutdown
├── app.ts                   # Express app setup (middleware, health checks,
│                            # rate limiter, routes, Swagger, static files)
├── config/
│   ├── env.ts               # Zod-validated environment
│   ├── database.ts          # Prisma client singleton
│   ├── redis.ts             # Redis client singleton
│   ├── sesClient.ts         # AWS SES client + sendSesEmail helper         [S11]
│   ├── logger.ts            # Pino logger
│   └── swagger.ts           # OpenAPI 3.0 definition (all endpoints)
├── middleware/
│   ├── authenticate.ts      # JWT verification
│   ├── optionalAuth.ts      # Attaches req.user if token present          [S11]
│   ├── authorize.ts         # Role-based access
│   ├── errorHandler.ts      # Central error handler
│   ├── validate.ts          # Express 5 compatible (Object.defineProperty)
│   ├── rateLimiter.ts       # Redis factory + general instance             [S11]
│   ├── authRateLimiter.ts   # Uses factory, 10/min per IP per endpoint     [S11]
│   └── idempotency.ts       # Idempotency-Key middleware                   [S11]
├── utils/
│   ├── asyncHandler.ts
│   ├── AppError.ts
│   ├── apiResponse.ts
│   ├── token.ts
│   ├── upload.ts            # Multer config for avatar (local storage)
│   ├── uploadPdf.ts         # Multer config for PDF (memory)
│   ├── youtube.ts
│   └── validators/          # Zod schemas
│       ├── booleanQuery.ts                   # Shared optional-boolean helper [S12]
│       ├── auth.schema.ts
│       ├── user.schema.ts
│       ├── admin.schema.ts
│       ├── category.schema.ts
│       ├── path.schema.ts                    # Uses optionalBooleanQuery    [S12]
│       ├── module.schema.ts                  # Uses optionalBooleanQuery    [S12]
│       ├── lesson.schema.ts
│       ├── enrollment.schema.ts
│       ├── progress.schema.ts                # + completeWarmUpSchema       [S12]
│       ├── gamification.schema.ts
│       ├── payment.schema.ts
│       ├── forum.schema.ts                   # + report schemas             [S12]
│       ├── notification.schema.ts            # Uses optionalBooleanQuery    [S12]
│       ├── search.schema.ts
│       ├── recommendation.schema.ts
│       ├── parent.schema.ts                  # + email link + flat settings [S12]
│       ├── slide.schema.ts                   # + .strict() on complete      [S12]
│       ├── questCheckpoint.schema.ts         # + .strict() on complete      [S12]
│       ├── bossBattle.schema.ts
│       └── certificate.schema.ts
├── services/                # Business logic — no HTTP concerns
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── admin.service.ts               # getUserById no longer includes subs   [S12]
│   ├── category.service.ts
│   ├── path.service.ts
│   ├── module.service.ts
│   ├── lesson.service.ts              # Access control                         [S11]
│   ├── enrollment.service.ts          # Progress + currentLesson               [S11]
│   ├── progress.service.ts            # + warm-up + lesson-completion XP       [S12]
│   ├── gamification.service.ts        # Response shapes                        [S11]
│   ├── payment.service.ts
│   ├── forum.service.ts               # Rewritten: author, userVote, reports   [S12]
│   ├── moderation.service.ts          # Rewritten: ForumReport queue           [S12]
│   ├── notification.service.ts
│   ├── search.service.ts              # 100% branches                          [S12]
│   ├── recommendation.service.ts
│   ├── parent.service.ts              # Email link, flat settings, billing     [S12]
│   ├── pdf.service.ts
│   ├── s3.service.ts
│   ├── slide.service.ts               # Server-side evaluation                 [S12]
│   ├── quest.service.ts               # Server-side evaluation                 [S12]
│   ├── bossBattle.service.ts          # Badge persistence, retry rename        [S12]
│   ├── recharge.service.ts
│   ├── email.service.ts               # Non-throwing; SES via sesClient        [S11]
│   ├── answerEvaluation.service.ts    # NEW — shared evaluator                 [S12]
│   ├── certificate.service.ts
│   ├── certificatePdf.service.ts
│   └── certificateStorage.service.ts
├── controllers/             # request handlers
├── routes/                  # endpoint definitions
│   └── index.ts             # Mounts all routers
├── jobs/
│   └── paymentExpiry.job.ts                                                    [S11]
├── types/
│   ├── express.d.ts
│   └── arabic-persian-reshaper.d.ts                                            [S11]
└── prisma/
    ├── schema.prisma
    ├── migrations/
    │   ├── 20260911203608_initial_schema/                                      (rebased S11)
    │   ├── 20260911212808_add_badge_name_en/                                   [S11]
    │   ├── 20260915101558_add_forum_reports/                                   [S12]
    │   ├── 20260916140547_deprecate_subscription/                              [S12]
    │   └── 20260917120000_add_lesson_completion_and_warmup_xp/                 [S12]
    └── seed.ts

scripts/
└── check-migrations.js       # Prisma bug guard                                [S11]
```

**Pattern:** `routes` → `controllers` → `services`.
All responses follow the standard format:

```json
{
  "success": true,
  "data": {},
  "message": "Arabic message",
  "errors": null,
  "meta": null
}
```

### Request Lifecycle

1. **Route** matches URL and method.
2. **Middleware** chain executes: helmet → CORS → body parsing → health checks (bypass limiter) → rate limiter → route-level middleware (auth / optionalAuth / idempotency / validation).
3. **Controller** extracts validated data, calls the service.
4. **Service** performs business logic and database operations via Prisma.
5. **Controller** formats the response with `apiResponse()` and sends.
6. **Central error handler** catches any thrown `AppError` and converts to JSON.

### Graceful Shutdown Sequence

On `SIGTERM`, `SIGINT`, or `uncaughtException`:

1. Set `shuttingDown` flag (ignore repeat signals)
2. Start 15-second force-exit timer
3. Stop background jobs (`stopPaymentExpiryJob()`)
4. Close HTTP server — wait for in-flight requests to drain
5. `prisma.$disconnect()`
6. `redis.quit()`
7. Clear force-exit timer, `process.exit(0)`

---

## 5. Implemented Endpoints

### 5.1 Authentication (Sprint 1)

| Method | Endpoint | Description | Auth Required | Rate Limited |
|--------|----------|-------------|---------------|--------------|
| POST | `/auth/register` | Create user. **Auto-creates UserStats + assigns daily quests in a transaction.** | No | Yes (10/min) |
| POST | `/auth/login` | Login with email/password | No | Yes (10/min) |
| POST | `/auth/refresh` | Refresh access token. **Rebuilds payload before signing (S11 fix).** | No | No |
| POST | `/auth/logout` | Invalidate refresh token | Yes | No |
| POST | `/auth/forgot-password` | Send password reset email | No | Yes (10/min) |
| POST | `/auth/reset-password` | Reset password with token | No | Yes (10/min) |

**Registration roles:** `STUDENT` (default) or `PARENT`. Admin cannot be self-assigned.

### 5.2 User Profile (Sprint 2)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/me` | Get current user profile | Yes |
| PUT | `/users/me` | Full update profile | Yes |
| PATCH | `/users/me` | Partial update profile | Yes |
| DELETE | `/users/me` | Soft delete account | Yes |
| PUT | `/users/me/privacy` | Update privacy settings | Yes |
| GET | `/users/me/privacy` | Get privacy settings | Yes |
| POST | `/users/me/avatar` | Upload avatar (local storage; S3 pending) | Yes |
| DELETE | `/users/me/avatar` | Remove avatar | Yes |

### 5.3 Admin User Management (Sprint 2, 12)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/users` | List users (pagination, search) | Admin |
| GET | `/admin/users/:id` | Get user details | Admin |
| PUT | `/admin/users/:id` | Update user | Admin |
| POST | `/admin/users/:id/suspend` | Suspend user | Admin |
| POST | `/admin/users/:id/activate` | Activate user | Admin |
| POST | `/admin/users/:id/role` | Change user role | Admin |

**Sprint 12 note:** every admin route now has param-level UUID validation. `POST /admin/users/:id/role` uses a dedicated `changeUserRoleSchema` (role is required).

### 5.4 Categories (Sprint 3)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/categories` | List categories (pagination, search) | No |
| GET | `/categories/:id` | Get category with children & paths | No |
| POST | `/categories` | Create category | Admin |
| PUT | `/categories/:id` | Update category | Admin |
| DELETE | `/categories/:id` | Soft-delete category | Admin |

### 5.5 Paths (Sprint 3, 12)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/paths` | List published paths (filters). **`isFeatured` correctly parsed (S12).** | No |
| GET | `/paths/admin/list` | List all paths (incl. unpublished) | Admin |
| GET | `/paths/:id` | Get path (admin sees unpublished via `optionalAuth`) | No/Admin |
| POST | `/paths` | Create path | Admin |
| PUT | `/paths/:id` | Update path | Admin |
| DELETE | `/paths/:id` | Soft-delete path | Admin |
| POST | `/paths/:id/publish` | Publish/unpublish (`{ publish: boolean }`) | Admin |

### 5.6 Modules (Sprint 3, 12)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/modules?pathId=...` | List modules for a path. **`isPublished` correctly parsed (S12).** | No/Admin |
| GET | `/modules/:id` | Get module with lessons | No/Admin |
| POST | `/modules` | Create module | Admin |
| PUT | `/modules/:id` | Update module | Admin |
| DELETE | `/modules/:id` | Delete module | Admin |

### 5.7 Lessons (Sprint 3, 9, 10, 11, 12)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/lessons?moduleId=...` | List lessons for a module. Each lesson includes `isAccessible`. | No/Yes |
| GET | `/lessons/:id` | Get lesson with quiz questions. **Enforces access control.** | No/Yes |
| POST | `/lessons` | Create lesson | Admin |
| PUT | `/lessons/:id` | Update lesson | Admin |
| DELETE | `/lessons/:id` | Delete lesson | Admin |
| GET | `/lessons/:id/lock-status` | Get lock status for current user | Yes |
| GET | `/lessons/:id/pdf-url` | Get signed PDF URL (5 min expiry) | Yes |
| POST | `/lessons/:id/pdf` | Upload PDF for lesson | Admin |
| DELETE | `/lessons/:id/pdf` | Delete PDF for lesson | Admin |
| GET | `/lessons/:id/recharge-status` | Get recharge status for current user | Yes |
| **POST** | **`/lessons/:lessonId/warmup/complete`** | **Submit warm-up answer (S12)** | **Yes** |

**Lesson access control (Sprint 11):**
1. Preview lessons (`isPreview: true`) — accessible to everyone (including anonymous)
2. Non-preview lessons — require an active enrollment in the parent path
3. Admins — bypass all checks

### 5.8 Enrollment (Sprint 3, 11)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/enrollments/paths/:pathId/enroll` | Enroll current user | Yes |
| DELETE | `/enrollments/paths/:pathId/enroll` | Unenroll current user | Yes |
| GET | `/enrollments/me/enrollments` | List current user's active enrollments | Yes |
| GET | `/enrollments/paths/:pathId/enrollments` | List enrolled users (path) | Admin |

### 5.9 Progress (Sprint 3, 11, 12)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/progress/lessons/:lessonId` | Update lesson progress. **Awards lesson-completion XP + updates streak + attempts certificate auto-issue when `completed: true`.** | Yes |
| GET | `/progress/paths/:pathId` | Get path progress summary | Yes |

### 5.10 Gamification (Sprint 4, 11, 12)

#### Profile

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/me` | Current user gamification profile | Yes |
| GET | `/gamification/users/:userId` | Gamification profile for a user | Yes |

#### XP & Levels

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/xp/history` | XP history (paginated) | Yes |
| GET | `/gamification/levels` | Level definitions | No |

#### Badges

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/badges` | All badge definitions | No |
| GET | `/gamification/me/badges` | Current user's earned badges | Yes |
| GET | `/gamification/users/:userId/badges` | Any user's earned badges | Yes |

**Boss Battle badges (Sprint 12):** 4 tier badges now persist as real `UserBadge` rows.

#### Leaderboards

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/leaderboard?scope=global` | Global leaderboard by XP | Yes |
| GET | `/gamification/leaderboard?scope=path&pathId=...` | Path leaderboard by completed lessons | Yes |

#### Streaks

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/me/streak` | Current streak info | Yes |
| POST | `/gamification/me/streak/freeze` | Use a streak freeze token | Yes |

#### Daily Quests

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/daily-quests` | Active daily quests with progress | Yes |
| POST | `/gamification/daily-quests/:questId/complete` | Complete a daily quest and earn XP | Yes |

### 5.11 Payments (Sprint 5, 11, 12)

**Note:** Sprint 5 implements a **manual payment flow** using Vodafone Cash and InstaPay.

> ⚠️ **Subscription model deprecated (Sprint 12).** The `Subscription` table was removed. `Enrollment.expiresAt` models the subscription window. `GET /parents/me/billing` returns `purchases` only.

**Idempotency (Sprint 11):** `POST /payments/requests` supports `Idempotency-Key` header (24h cache, fail-open).

#### User Payment Requests

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/payments/requests` | Create payment request. Supports `Idempotency-Key`. | Yes |
| GET | `/payments/requests` | List current user's payment requests | Yes |
| POST | `/payments/requests/:id/mark-sent` | Mark payment as sent | Yes |

#### Admin Payment Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/payments/admin/requests` | List all payment requests | Admin |
| POST | `/payments/admin/requests/:id/activate` | Activate request (creates enrollment + purchase) | Admin |
| POST | `/payments/admin/requests/:id/reject` | Reject request with reason | Admin |

**Payment Request Statuses:** `PENDING`, `VERIFIED`, `ACTIVATED`, `REJECTED`, `EXPIRED`

**Auto-expiration:** `PENDING` requests auto-flip to `EXPIRED` after `expiresAt`. `VERIFIED` requests are **never** auto-expired.

### 5.12 Community (Sprint 6, 12)

> ⚠️ **Sprint 12 response shape changes:** `user` → `author`, `userVote` added, `postCount` on categories, deterministic sorting, comment duplication fixed.

#### Forum Categories

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/forum/categories` | List forum categories (only active by default) | No |

**Category fields:** `id`, `nameAr`, `nameEn`, `slug`, `descriptionAr`, `descriptionEn`, `displayOrder`, `isActive`, `postCount`, `createdAt`, `updatedAt`.

#### Forum Posts

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/forum/posts` | List posts with filters. Includes `author`, `userVote`. | No/Yes |
| POST | `/forum/posts` | Create new post | Yes |
| GET | `/forum/posts/:id` | Get post by ID (increments view count) | No/Yes |
| PUT | `/forum/posts/:id` | Update post (owner/admin) | Yes |
| DELETE | `/forum/posts/:id` | Soft delete post (owner/admin) | Yes |

#### Comments

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/forum/posts/:postId/comments` | List top-level comments with nested replies | No |
| POST | `/forum/posts/:postId/comments` | Add comment (supports replies) | Yes |
| PUT | `/forum/comments/:id` | Update comment (owner/admin) | Yes |
| DELETE | `/forum/comments/:id` | Soft delete comment (owner/admin) | Yes |

#### Voting

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/forum/posts/:id/upvote` | Upvote a post (toggle) | Yes |
| POST | `/forum/posts/:id/downvote` | Downvote a post (toggle) | Yes |
| POST | `/forum/comments/:id/upvote` | Upvote a comment (toggle) | Yes |
| POST | `/forum/comments/:id/downvote` | Downvote a comment (toggle) | Yes |

#### Best Answer

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/forum/posts/:id/mark-answer` | Mark a comment as best answer (post owner) | Yes |

#### Reporting (Sprint 12)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/forum/posts/:id/report` | Report a post | Yes |
| POST | `/forum/comments/:id/report` | Report a comment | Yes |

**Reasons:** `spam`, `harassment`, `inappropriate`, `misinformation`, `off-topic`, `other`. Duplicate → `409`; self-report → `400`.

#### Search

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/forum/search?q=...` | Simple ILIKE search | No |

#### Admin Moderation

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/forum/reports` | List reported content (returns `ForumReport` objects) | Admin |
| POST | `/admin/forum/reports/:id/resolve` | Resolve a report | Admin |
| POST | `/admin/forum/posts/:id/hide` | Hide a post | Admin |
| POST | `/admin/forum/posts/:id/unhide` | Unhide a post | Admin |
| POST | `/admin/forum/comments/:id/hide` | Hide a comment | Admin |
| POST | `/admin/forum/comments/:id/unhide` | Unhide a comment | Admin |

### 5.13 Notifications (Sprint 7, 12)

#### User Notification Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/notifications` | List user notifications. **Boolean filters correctly parsed (S12).** | Yes |
| GET | `/notifications/unread/count` | Get count of unread notifications | Yes |
| POST | `/notifications/read-all` | Mark all notifications as read | Yes |
| POST | `/notifications/:id/read` | Mark a notification as read | Yes |
| POST | `/notifications/:id/archive` | Archive a notification | Yes |
| POST | `/notifications/:id/dismiss` | Dismiss a notification | Yes |
| DELETE | `/notifications/:id` | Delete a notification | Yes |
| POST | `/notifications/device/register` | Register a device for push notifications | Yes |
| DELETE | `/notifications/device/:id` | Unregister a device | Yes |

#### Admin Notification Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/admin/notifications` | Send system notification to all users or specific users | Admin |

**Sprint 12 fix:** boolean query params now correctly distinguish omitted (no filter) from `false` (filter for un-archived/unread items).

### 5.14 Search & Recommendations (Sprint 8, 12)

#### Global Search

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/search` | Global search across paths, forum posts, and users | No |
| GET | `/search/paths` | Search paths only | No |
| GET | `/search/forum` | Search forum posts only (canonical for community) | No |
| GET | `/search/users` | Search users only | No |

#### Recommendations

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/recommendations/paths` | Personalized path recommendations | Yes |
| GET | `/recommendations/popular` | Popular paths | No |
| GET | `/recommendations/trending` | Trending paths | No |
| GET | `/recommendations/related/:pathId` | Related paths (co-enrollment) | No |

**Sprint 12 status:** refinement (fallback for new users, deterministic tie-breaking) deferred to Sprint 13.

### 5.15 Parent Endpoints (Sprint 9, 12)

#### Parent Dashboard

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/parents/me/overview` | Overview with `children[]` (each with `stats.level`), `totalXP`, `lastActiveChild` | Parent |
| GET | `/parents/me/billing` | **Aggregated** purchase history across parent + linked children | Parent |

**Sprint 12 changes:**
- **`POST /parents/me/children`** accepts `childId` **or** `email`
- **`GET + PUT /parents/me/children/:childId/settings`** return flat shape
- **`GET /parents/me/billing`** aggregates purchases from parent + all linked children; `subscriptions` key gone

#### Child Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/parents/me/children` | Link a child (body: `{ childId }` **or** `{ email }`) | Parent |
| GET | `/parents/me/children` | List children | Parent |
| DELETE | `/parents/me/children/:childId` | Unlink a child | Parent |
| GET | `/parents/me/children/:childId/progress` | Get child progress summary | Parent |
| GET | `/parents/me/children/:childId/performance` | Get child quiz scores & challenges | Parent |
| GET | `/parents/me/children/:childId/time-tracking` | Get child time tracking | Parent |
| GET | `/parents/me/children/:childId/settings` | Get child settings (flat shape) | Parent |
| PUT | `/parents/me/children/:childId/settings` | Update child settings | Parent |

### 5.16 Enhanced Content Endpoints (Sprint 10, 12)

#### Slides

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/lessons/:lessonId/slides` | List slides for a lesson | Yes |
| POST | `/lessons/:lessonId/slides` | Create slide | Admin |
| PUT | `/lessons/:lessonId/slides/:slideId` | Update slide | Admin |
| DELETE | `/lessons/:lessonId/slides/:slideId` | Delete slide | Admin |
| POST | `/lessons/:lessonId/slides/reorder` | Reorder slides | Admin |
| POST | `/lessons/:lessonId/slides/:slideId/complete` | **Complete slide. Body: `{ answer }` only. Server evaluates.** | Yes |

**Slide Types:** `INFO`, `QUIZ`, `DRAG_DROP`, `TRUE_FALSE`, `FILL_BLANK`

**Answer shapes:** `INFO` → `{}`; `QUIZ` → `{ index }`; `TRUE_FALSE` → `{ value }`; `FILL_BLANK` → `{ text }`; `DRAG_DROP` → `{ items: [{ label, correctZone }] }`.

#### Quest Checkpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/lessons/:lessonId/checkpoints` | List quest checkpoints for a lesson | Yes |
| POST | `/lessons/:lessonId/checkpoints` | Create checkpoint | Admin |
| PUT | `/lessons/:lessonId/checkpoints/:checkpointId` | Update checkpoint | Admin |
| DELETE | `/lessons/:lessonId/checkpoints/:checkpointId` | Delete checkpoint | Admin |
| POST | `/lessons/:lessonId/checkpoints/reorder` | Reorder checkpoints | Admin |
| POST | `/lessons/:lessonId/checkpoints/:checkpointId/complete` | **Complete checkpoint. Body: `{ selfReflectionAnswer }` only.** | Yes |

#### Boss Battle

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/modules/:moduleId/boss-battle` | Get boss battle | Yes |
| POST | `/modules/:moduleId/boss-battle` | Create boss battle | Admin |
| PUT | `/modules/:moduleId/boss-battle/:battleId` | Update boss battle | Admin |
| DELETE | `/modules/:moduleId/boss-battle/:battleId` | Delete boss battle | Admin |
| POST | `/modules/:moduleId/boss-battle/submit` | Submit boss battle answers | Yes |

**Victory tiers:** `legend` (≥80%), `warrior` (≥60%), `trainee` (≥40%), `retry` (<40%). Retry label is `مش هستسلم`. Each tier awards a persistent badge.

#### Recharge

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/lessons/:id/recharge-status` | Get recharge status for current user | Yes |

### 5.17 Certificate Endpoints (Sprint 11)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/certificates/me` | List current user's certificates | Yes |
| GET | `/certificates/:id` | Get certificate by ID (owner or admin) | Yes |
| GET | `/certificates/:id/download` | Get download URL | Yes |
| GET | `/certificates/verify/:code` | **Public** verify by code | No |
| POST | `/certificates/admin/issue` | Manually issue | Admin |
| POST | `/certificates/admin/:id/revoke` | Revoke | Admin |

---

## 6. Key Decisions & Technical Notes

### Version Pins & Dependencies

- **Prisma pinned to `6.19.0`.** Do **not** upgrade — pending upstream fix for the migration bug (see §10).
- **Node.js v20 LTS** (recommended).
- **TypeScript 5.5.4** (strict mode).
- **Express 5** — `req.query`/`req.params` getter-only; use `Object.defineProperty`.
- **PostgreSQL** — dev port `5433`, test port `5434`.
- **Redis** — dev port `6379`, test port `6380`.

### Server-Side Answer Evaluation (Sprint 12)

- **Never accept `isCorrect` / `completed` from the client.** The backend computes correctness for slides (all 5 types) and checkpoints.
- **Shared module:** `src/services/answerEvaluation.service.ts`
- **Arabic normalization** is applied to FILL_BLANK and warm-up answers.
- **Zod schemas** use `.strict()` on `completeSlide` and `completeCheckpoint` — sending extra fields → `400`.
- **Boss battles** already worked this way (server-side correct-index comparison); no change needed there.

### Lesson-Completion XP (Sprint 12)

- `Lesson.completionXpAward` (default `10`)
- Awarded once per user per lesson on first `completed: true` transition
- Non-blocking — wrapped in try/catch

### Warm-Up XP (Sprint 12)

- `Lesson.warmUpJson.answerAr` is the target; server-side evaluation via the same Arabic normalization as FILL_BLANK
- First submission only — duplicates rejected
- Wrong answer still marks complete but awards 0 XP

### Boolean Query Parameters (Sprint 12)

Use `optionalBooleanQuery` from `src/utils/validators/booleanQuery.ts` for any query param accepting a boolean. **Never** use `z.coerce.boolean()` (breaks on `'false'`) or `.optional().transform(v => v === 'true')` (breaks on omitted params).

### Email (Changed in Sprint 11)

- **Provider:** AWS SES (via `@aws-sdk/client-ses`).
- **`sendEmail` never throws.** Failures are logged, never propagated.
- Dev short-circuit: `[DEV] Would send email to ...` when `AWS_ACCESS_KEY_ID` empty.
- Test short-circuit: `Test mode: email sending skipped.` when `NODE_ENV === 'test'`.

### Rate Limiting (Changed in Sprint 11)

- Redis-backed, sliding window via `INCR` + `EXPIRE`.
- Key strategy: `userId` when authenticated, IP otherwise.
- Fail-open on Redis outage.
- Excluded: `/health`, `/health/live`, `/health/ready`, `/api-docs`, `/uploads`.

### Level Formula (Changed in Sprint 11)

- `threshold(N) = 50 · N · (N - 1)` for cumulative XP to reach level N
- Worked example: 1250 XP → level 5, `currentLevelXp = 250`, `nextLevelXp = 500`

### Background Jobs (Sprint 11)

- Payment expiry cron every 5 minutes, Redis-locked, fail-open
- Graceful shutdown hooks in `src/index.ts`

### Health Checks (Sprint 11)

- `/health/live` — always 200
- `/health/ready` — 200 if Postgres + Redis reachable, 503 otherwise
- `/health` — backwards-compat alias

### Idempotency (Sprint 11)

- `idempotency()` middleware, optional `Idempotency-Key` header
- 24h cache of 2xx responses, `SET NX` in-flight marker, fail-open

### Certificate Issuance (Sprint 11)

- Auto-issued on path completion, idempotent, non-blocking, best-effort
- A4 landscape PDF via PDFKit + Noto Naskh Arabic + `arabic-persian-reshaper`
- Public verification endpoint

### Non-Blocking Side Effects (Convention)

Wrapped in try/catch and logged, never propagated:
- Email sending
- Streak updates
- Certificate auto-issue
- Lesson-completion XP award

### Community Conventions (Sprint 12)

- **`author`** field on posts/comments (not `user`)
- **`userVote`** (`'up' | 'down' | null`) reflects the current user's vote state
- **`isSolved`** on post + **`isBestAnswer`** on comment (no `bestAnswerId`)
- **`postCount`** on categories (published + non-deleted only)
- **Deterministic sorting** — `createdAt DESC` always the tie-breaker
- **2-level comment threading** — top-level comments + direct replies only

### Other Decisions

- **PostgreSQL port:** dev `5433`, test `5434`.
- **Redis usage:** token storage, rate limiting, account lockout, idempotency cache, cron lock.
- **Avatar upload:** Multer local storage; S3 for production (pending).
- **Swagger UI:** all endpoints documented.
- **Express 5:** getter-only `req.query`/`req.params`.
- **Leaderboards:** global uses `userStats`; path-specific uses lesson progress.
- **Streak freeze:** decrements token; sets `lastStreakFreezeAt`.
- **Manual Payments:** reference code pattern; expiration automated.
- **Forum voting:** polymorphic `ForumVote`.
- **Best answer:** only post author can mark; sets `isSolved`.
- **Seed script:** idempotent; includes forum content + paid path + updated boss battle.
- **Notifications:** `channelsSent` is a list; email `link` coerced `?? undefined`.
- **Recommendations:** popularity and co-enrollment.
- **Parent-Child:** self-referential; `ChildSettings`.
- **Lesson lock / recharge:** based on previous lesson's `lockDurationHours`; parent override.
- **PDF Delivery:** S3 signed URLs with 5-min expiry; access control.
- **YouTube Validation:** enforced via `extractYouTubeId`.
- **Slides:** 5 types, stored in `Slide` model; progress in `UserSlideProgress`.
- **Mini-Quests:** checkpoints with XP; progress tracked; next checkpoint logic.
- **Boss Battles:** questions, scoring, victory levels, badge persistence, duplicate submission blocked.
- **Recharge:** XP boost multiplier based on window after previous lesson; base XP only, not bonus.

---

## 7. Testing

### Run tests

```bash
# Unit tests with coverage
npm test -- --coverage

# Integration tests (Docker required)
npm run test:integration

# Type check
npx tsc --noEmit

# Migration safety net
npm run check:migrations
```

### Current coverage (service layer)

| Service | Statements | Branches |
|---------|------------|----------|
| auth | 98.9% | 93.7% |
| user | 100% | 100% |
| admin | 97.5% | 91.6% |
| category | 100% | 90% |
| path | 92.8% | 77.7% |
| module | 97.5% | 83.3% |
| lesson | 98.8% | 88.7% |
| enrollment | 98.2% | 90% |
| progress | 91.5% | 75% |
| gamification | 100% | 91.2% |
| payment | 100% | 90.9% |
| forum | 88.6% | 77.2% |
| moderation | 95.9% | 87.5% |
| notification | 98.1% | 94% |
| search | 100% | **100%** |
| recommendation | 97.3% | 88.8% |
| parent | 97.6% | 89.3% |
| slide | 100% | 100% |
| quest | 98.5% | 92.3% |
| bossBattle | 95.2% | 81.8% |
| recharge | 96.2% | 66.6% |
| answerEvaluation | 79.2% | 76.6% |
| certificate | 70.4% | 72.2% |
| certificatePdf | 15.7% | 0% |
| certificateStorage | 40% | 100% |
| email | ~50% | ~7% |

| Middleware | Statements | Branches |
|------------|------------|----------|
| rateLimiter | 97.2% | 82.3% |
| idempotency | 94.1% | 92% |

| Jobs | Statements | Branches |
|------|------------|----------|
| paymentExpiry | 93.3% | 86.6% |

**Overall service layer:** ~93% statements, ~82% branches, ~97% functions.
**Total tests:** 452 unit + 80 integration = **532 passing**.

### Testing approach

- Mock Prisma, Redis, AWS SDK clients, PDFKit in unit tests.
- All services have test files in `src/services/__tests__/`.
- Middleware tests in `src/middleware/__tests__/`.
- Job tests in `src/jobs/__tests__/`.
- Integration tests hit the real Express app via Supertest against isolated Docker containers.

---

## 8. Next Steps

### Deferred to Sprint 13 (in original order)

1. **Recommendation refinement** — fallback for new users, deterministic tie-breaking
2. **Bulk enrollment endpoint** — enterprise feature per Gap Analysis N11
3. **Weekly summary cron** — fills the partial R168 requirement
4. **Controller unit tests** — thin wrappers, currently 0% coverage
5. **Deployment configuration** — ECS vs EC2 decision, then CI/CD pipeline

### AWS-Gated (Waiting on Solution Architect)

1. **S3 avatar upload** — reuse `s3.service.ts`.
2. **SES production access** — verify `qafzly.com` domain, exit sandbox.
3. **Staging deployment** — ECS vs EC2 decision, then CI/CD pipeline.
4. **Secrets management** — migrate from env files to AWS Secrets Manager.
5. **CloudWatch monitoring** — Pino logs to CloudWatch Logs.

### Firebase-Gated

1. **Push notifications** — replace the current logging placeholder in `notification.service.ts`.

### Beyond (Post-MVP)

- Voice support in parent dashboard (Phase 2).
- PayMob integration (replacing manual payments).
- OAuth 2.0 (Google / Facebook / Apple).
- Webhooks, live sessions, offline mode, 2FA, native mobile apps.

---

## 9. Important Commands

```bash
# Development
npm run dev

# Type-check
npx tsc --noEmit

# Unit tests
npm test -- --coverage

# Integration tests (Docker required)
npm run test:integration

# Migration safety net
npm run check:migrations

# Database
npx prisma generate
npx prisma migrate deploy              # Apply migrations — safe
npx prisma migrate status
npx prisma studio

# One-time recovery if drift breaks (dev only)
docker exec <pg-container> psql -U qafzly -d qafzly_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npx prisma migrate deploy
npx ts-node prisma/seed.ts

# Docker
docker-compose up -d
docker-compose down -v
```

---

## 10. Known Issues / Gotchas

### Prisma & Migrations

- **Never run bare `npx prisma migrate dev`.** See §2.10 (S11) and `CONTRIBUTING.md` §7. The Prisma 6.x bug ([#24496](https://github.com/prisma/prisma/issues/24496), [#15654](https://github.com/prisma/prisma/issues/15654)) generates invalid SQL for generated columns.
- **`Unsupported("tsvector")` columns** — do not remove their declarations; Prisma will drop them.
- **`SELECT *` breaks search** — always select explicit columns in raw SQL.
- **`EPERM: operation not permitted`** on `prisma generate` — kill node first: `Get-Process node | Stop-Process -Force`.
- **`migrate status` reports missing migrations** — drift. Full recovery in §2.10 (S11).
- **`$transaction is not a function`** in unit tests — add `$transaction` mock.

### Runtime

- **Express 5** — `req.query` / `req.params` are getter-only.
- **JWT `expiresIn` type error** — cast `as any`.
- **Refresh-token payload** — rebuild as `{ userId, email, role }` before signing.
- **Email** — never throws; failures are logged.
- **`console.log` from dotenv** — dotenv should only be imported in `env.ts`.

### Data Model

- **Soft deletes** — filter `deletedAt: null` on public queries.
- **`VERIFIED` payment requests are never auto-expired** — intentional.
- **Parent-child linking** — `ChildSettings` enforces uniqueness; delete settings on unlink.
- **Level formula** — `threshold(N) = 50·N·(N-1)`. **Changed in Sprint 11.**
- **Forum votes** — polymorphic; specify `targetType` + `targetId`.
- **Forum response fields** — `author` (not `user`); `userVote`; `isSolved` + `isBestAnswer`.
- **Notifications** — `channelsSent` is an array; email `link` coerced `?? undefined`.
- **Subscription** — **model removed** in Sprint 12. Use `Enrollment.expiresAt`.

### Query-String Booleans (Sprint 12)

- Use `optionalBooleanQuery` from `src/utils/validators/booleanQuery.ts`.
- **Never** use `z.coerce.boolean()` — `Boolean('false')` is `true`.
- **Never** use `.optional().transform(v => v === 'true')` — Zod runs the transform on `undefined`.

### Testing

- **`npm run test:integration`** — requires `.env.test` and Docker. Containers torn down automatically.
- **Jest `testMatch`** — default `jest.config.js` excludes `src/__tests__/integration/`.
- **"Your test suite must contain at least one test"** — helper files picked up by default Jest. Register via `setupFiles`.
- **Async middleware assertions fail silently** — use a `flushAsync` helper.
- **Daily quests inactive after seed** — seed deletes and recreates them each run.

### Windows / Local Dev

- **Git ownership:** `git config --global --add safe.directory D:/Career/Qafzly`
- **PowerShell `-it` with Docker** — hangs. Drop the `-t` for one-shot commands.
- **PowerShell `curl`** — aliases `Invoke-WebRequest`. Use `curl.exe`.
- **`dotenv -e .env.test`** on PowerShell — use `npm run test:integration:migrate`.
- **Do not commit** `.env`, `.env.test`, or any `uploads/` content.

---

## 11. Contact

Read this document and run locally before changes. `README.md` has the endpoint reference; this document has the *why* behind the *what*.

For AWS-related questions, coordinate with the Project Manager and the AWS Solution Architect (kickoff scheduled).

---

## 12. Repository State (End of Sprint 12)

| Item | State |
|------|-------|
| Branch | `main` |
| Unit tests | 452 passing |
| Integration tests | 80 passing |
| Migration history | 5 migrations |
| Swagger | All endpoints documented, including new community/warm-up endpoints |
| Coverage | ~93% service layer; search at 100% branches |
| Backend MVP | ✅ Feature complete for UAT; Community contract fully aligned |

### Recent Major Commits

```
feat: community contract fixes (author, userVote, postCount, forum seed)
feat: forum reporting + moderation queue rewrite
feat: server-side answer evaluation for slides and checkpoints
feat: lesson-completion XP + warm-up XP endpoint
feat: parent dashboard fixes (email link, flat settings, aggregated billing)
feat: boss battle badge persistence + retry tier rename
fix: boolean query parameter coercion across isFeatured/isPublished/isArchived
fix: comment duplication in getComments
fix: admin bypass on GET /paths/:id and GET /forum/posts/:id
chore: deprecate Subscription model
test: expand integration suite to 80 tests
test: search service branch coverage to 100%
```

---

## 13. Sprint Deferral Note

Per PM decision on September 17, 2026, the following were originally targeted for Sprint 12 but deferred by one sprint. All future sprints shift accordingly:

- **Original Sprint 12** → completed as above
- **Original Sprint 13 (was Sprint 12 in earlier plans)** → now Sprint 13: recommendation refinement, bulk enrollment, weekly summary cron, controller unit tests, deployment configuration
- **Subsequent sprints** shift by one

This deferral was chosen to allow the frontend team to integrate Task #7 (Community) without blocking on non-critical items.

---

**End of Handoff Document**