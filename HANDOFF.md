# Qafzly Backend – Developer Handoff Document

**Date:** September 12, 2026
**Prepared by:** Senior Backend Engineer (from Team Falcon handoff)
**Status:** ✅ Sprint 11 Complete – Backend Ready for UAT
**Next Sprint:** UAT Support & AWS Staging Deployment

---

## 1. Project Overview

Qafzly is a gamified EdTech platform targeting Arabic-speaking learners. This repository contains the backend API built with **Node.js, TypeScript, Express, Prisma, PostgreSQL, and Redis**.

The API follows a **services → controllers → routes** architecture for clean separation of concerns.

**Current status:** Feature-complete for MVP. 361 unit tests + 22 integration tests passing. Awaiting AWS Solution Architect for staging deployment (S3 avatars, SES production access, CI/CD).

---

## 2. Current State

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
#    boss battle, enrollment, progress, badges, quests)
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
npm test -- --coverage      # expect 361 passing
npm run test:integration    # expect 22 passing (Docker required)
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
│   ├── sesClient.ts         # AWS SES client + sendSesEmail helper         [NEW S11]
│   ├── logger.ts            # Pino logger
│   └── swagger.ts           # OpenAPI 3.0 definition (all endpoints)
├── middleware/
│   ├── authenticate.ts      # JWT verification
│   ├── optionalAuth.ts      # Attaches req.user if token present          [NEW S11]
│   ├── authorize.ts         # Role-based access
│   ├── errorHandler.ts      # Central error handler
│   ├── validate.ts          # Express 5 compatible (Object.defineProperty)
│   ├── rateLimiter.ts       # Redis factory + general instance             [REWRITTEN S11]
│   ├── authRateLimiter.ts   # Uses factory, 10/min per IP per endpoint     [REWRITTEN S11]
│   └── idempotency.ts       # Idempotency-Key middleware                   [NEW S11]
├── utils/
│   ├── asyncHandler.ts
│   ├── AppError.ts
│   ├── apiResponse.ts
│   ├── token.ts
│   ├── upload.ts            # Multer config for avatar (local storage)
│   ├── uploadPdf.ts         # Multer config for PDF (memory)
│   ├── youtube.ts
│   └── validators/          # Zod schemas (21 files; + certificate.schema.ts S11)
├── services/                # Business logic — no HTTP concerns
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── admin.service.ts
│   ├── category.service.ts
│   ├── path.service.ts
│   ├── module.service.ts
│   ├── lesson.service.ts             # Access control added             [UPDATED S11]
│   ├── enrollment.service.ts         # Progress + currentLesson         [UPDATED S11]
│   ├── progress.service.ts           # Auto-streak + certificate hook    [UPDATED S11]
│   ├── gamification.service.ts       # New response shapes              [REWRITTEN S11]
│   ├── payment.service.ts
│   ├── forum.service.ts
│   ├── moderation.service.ts
│   ├── notification.service.ts
│   ├── search.service.ts
│   ├── recommendation.service.ts
│   ├── parent.service.ts
│   ├── pdf.service.ts
│   ├── s3.service.ts
│   ├── slide.service.ts
│   ├── quest.service.ts
│   ├── bossBattle.service.ts
│   ├── recharge.service.ts
│   ├── email.service.ts              # Non-throwing; SES via sesClient    [UPDATED S11]
│   ├── certificate.service.ts        # Auto-issue, verify, revoke        [NEW S11]
│   ├── certificatePdf.service.ts     # PDFKit + Arabic shaping           [NEW S11]
│   └── certificateStorage.service.ts # Local storage abstraction         [NEW S11]
├── controllers/             # 21 files (+ certificate.controller.ts S11)
├── routes/                  # 21 files (+ certificate.routes.ts S11)
│   └── index.ts             # Mounts all routers incl. /certificates     [UPDATED S11]
├── jobs/                                                                    [NEW DIR S11]
│   └── paymentExpiry.job.ts
├── types/
│   ├── express.d.ts
│   └── arabic-persian-reshaper.d.ts                                          [NEW S11]
└── prisma/
    ├── schema.prisma
    ├── migrations/
    │   ├── 20260911203608_initial_schema/                                    (rebased S11)
    │   └── 20260911212808_add_badge_name_en/                                 (new S11)
    └── seed.ts

scripts/                                                                       [NEW DIR S11]
└── check-migrations.js       # Prisma bug guard
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

### 5.3 Admin User Management (Sprint 2)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/users` | List users (pagination, search) | Admin |
| GET | `/admin/users/:id` | Get user details | Admin |
| PUT | `/admin/users/:id` | Update user | Admin |
| POST | `/admin/users/:id/suspend` | Suspend user | Admin |
| POST | `/admin/users/:id/activate` | Activate user | Admin |
| POST | `/admin/users/:id/role` | Change user role | Admin |

### 5.4 Categories (Sprint 3)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/categories` | List categories (pagination, search) | No |
| GET | `/categories/:id` | Get category with children & paths | No |
| POST | `/categories` | Create category | Admin |
| PUT | `/categories/:id` | Update category | Admin |
| DELETE | `/categories/:id` | Soft-delete category | Admin |

### 5.5 Paths (Sprint 3)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/paths` | List published paths (filters) | No |
| GET | `/paths/admin/list` | List all paths (incl. unpublished) | Admin |
| GET | `/paths/:id` | Get path (admin sees unpublished) | No/Admin |
| POST | `/paths` | Create path | Admin |
| PUT | `/paths/:id` | Update path | Admin |
| DELETE | `/paths/:id` | Soft-delete path | Admin |
| POST | `/paths/:id/publish` | Publish/unpublish (`{ publish: boolean }`) | Admin |

### 5.6 Modules (Sprint 3)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/modules?pathId=...` | List modules for a path | No/Admin |
| GET | `/modules/:id` | Get module with lessons | No/Admin |
| POST | `/modules` | Create module | Admin |
| PUT | `/modules/:id` | Update module | Admin |
| DELETE | `/modules/:id` | Delete module | Admin |

### 5.7 Lessons (Sprint 3, 9, 10, 11)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/lessons?moduleId=...` | List lessons for a module. Each lesson includes `isAccessible` flag. | No/Yes |
| GET | `/lessons/:id` | Get lesson with quiz questions. **Enforces access control** — 403 when not accessible. Response includes `access.reason`. | No/Yes |
| POST | `/lessons` | Create lesson | Admin |
| PUT | `/lessons/:id` | Update lesson | Admin |
| DELETE | `/lessons/:id` | Delete lesson | Admin |
| GET | `/lessons/:id/lock-status` | Get lock status for current user | Yes |
| GET | `/lessons/:id/pdf-url` | Get signed PDF URL (5 min expiry) | Yes |
| POST | `/lessons/:id/pdf` | Upload PDF for lesson | Admin |
| DELETE | `/lessons/:id/pdf` | Delete PDF for lesson | Admin |
| GET | `/lessons/:id/recharge-status` | Get recharge status for current user | Yes |

**Lesson access control (Sprint 11):**
1. Preview lessons (`isPreview: true`) — accessible to everyone (including anonymous)
2. Non-preview lessons — require an active enrollment in the parent path
3. Admins — bypass all checks
4. Denied → `403 يجب الاشتراك في هذه الدورة للوصول إلى الدرس`
5. `access.reason` on detail response is `'preview' | 'enrolled' | 'admin'`

### 5.8 Enrollment (Sprint 3, 11)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/enrollments/paths/:pathId/enroll` | Enroll current user | Yes |
| DELETE | `/enrollments/paths/:pathId/enroll` | Unenroll current user | Yes |
| GET | `/enrollments/me/enrollments` | List current user's active enrollments | Yes |
| GET | `/enrollments/paths/:pathId/enrollments` | List enrolled users (path) | Admin |

**Response shape (Sprint 11):** each enrollment includes `progress` (0–100, not raw count), `pathTitleAr`, `pathTitleEn`, `featuredImage`, `difficulty`, and a `currentLesson` object (or `null` when complete) with `id`, `titleAr`, `moduleNameAr`.

**Historical note:** the `/enrollments` mount was missing in an earlier version of `routes/index.ts` — fixed in Sprint 11.

### 5.9 Progress (Sprint 3, 11)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/progress/lessons/:lessonId` | Update lesson progress. **Auto-updates streak + attempts certificate auto-issue when `completed: true`.** | Yes |
| GET | `/progress/paths/:pathId` | Get path progress summary | Yes |

### 5.10 Gamification (Sprint 4, 11)

#### Profile

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/me` | Current user gamification profile | Yes |
| GET | `/gamification/users/:userId` | Gamification profile for a user | Yes |

**Response shape (Sprint 11):**

```json
{
  "userId": "...",
  "totalXp": 1250,
  "level": 5,
  "currentLevelXp": 250,
  "nextLevelXp": 500,
  "rank": 4,
  "badges": [{ "id": "...", "nameAr": "...", "nameEn": "...", "iconUrl": "...", "earnedAt": "..." }],
  "currentStreak": 12,
  "longestStreak": 20,
  "totalLessonsCompleted": 8,
  "totalPathsCompleted": 0
}
```

#### XP & Levels

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/xp/history` | XP history (paginated) | Yes |
| GET | `/gamification/levels` | Level definitions (`level`, `xpRequired`, `xpToNext`, `xpNextLevel`) for 1–50 | No |

#### Badges

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/badges` | All badge definitions | No |
| GET | `/gamification/me/badges` | Current user's earned badges | Yes |
| GET | `/gamification/users/:userId/badges` | Any user's earned badges | Yes |

**Note:** `Badge.nameEn` column added in Sprint 11 (nullable; falls back to Arabic name when absent).

#### Leaderboards

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/leaderboard?scope=global` | Global leaderboard by XP | Yes |
| GET | `/gamification/leaderboard?scope=path&pathId=...` | Path leaderboard by completed lessons | Yes |

**Global entries include:** `userId`, `fullName`, `displayName`, `avatarUrl`, `totalXp`, `level`, `rank`.
**Path entries include:** `userId`, `fullName`, `completedLessons`, `rank`.

#### Streaks

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/me/streak` | Current streak info | Yes |
| POST | `/gamification/me/streak/freeze` | Use a streak freeze token | Yes |

**Streak response (Sprint 11):** `currentStreak`, `longestStreak`, `streakFreezeAvailable`, `lastActivityDate` (YYYY-MM-DD or `null`), `lastStreakFreezeAt`.

**Auto-update rule:** same-day → unchanged; yesterday → +1; gap > 1 day → reset to 1. `longestStreak` updates automatically.

#### Daily Quests

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/gamification/daily-quests` | Active daily quests with progress | Yes |
| POST | `/gamification/daily-quests/:questId/complete` | Complete a daily quest and earn XP | Yes |

**Response shape (Sprint 11):** each quest includes `id`, `titleAr`, `titleEn`, `descriptionAr`, `descriptionEn`, `xpAward` (was `xpReward`), `target`, `progress`, `completed`, `completedAt`.

### 5.11 Payments (Sprint 5 – Manual MVP, Sprint 11)

**Note:** Sprint 5 implements a **manual payment flow** using Vodafone Cash and InstaPay. Admin verifies and activates manually. Full PayMob integration is planned for a later phase.

**Idempotency (Sprint 11):** `POST /payments/requests` supports the `Idempotency-Key` header. Responses cached 24h per `(userId, key)`. Only 2xx cached. Concurrent same-key requests get `409`. Fail-open on Redis outage.

#### User Payment Requests

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/payments/requests` | Create payment request. Supports `Idempotency-Key`. | Yes |
| GET | `/payments/requests` | List current user's payment requests | Yes |
| POST | `/payments/requests/:id/mark-sent` | Mark payment as sent (add user notes) | Yes |

#### Admin Payment Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/payments/admin/requests` | List all payment requests (filters) | Admin |
| POST | `/payments/admin/requests/:id/activate` | Activate request (creates enrollment, purchase) | Admin |
| POST | `/payments/admin/requests/:id/reject` | Reject request with reason | Admin |

**Payment Request Statuses:** `PENDING`, `VERIFIED`, `ACTIVATED`, `REJECTED`, `EXPIRED`

**Auto-expiration (Sprint 11):** `PENDING` requests auto-flip to `EXPIRED` after `expiresAt` (7 days default) via the cron job. `VERIFIED` requests are **not** auto-expired — once the user has paid and marked sent, expiration is our problem, not theirs.

**Base mount:** `/payments` (plural) — corrected in Sprint 11.

### 5.12 Community (Sprint 6)

#### Forum Categories

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/forum/categories` | List forum categories (pagination, search) | No |

#### Forum Posts

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/forum/posts` | List posts with filters (category, path, status, search) | No |
| POST | `/forum/posts` | Create new post | Yes |
| GET | `/forum/posts/:id` | Get post by ID (increments view count) | No/Yes |
| PUT | `/forum/posts/:id` | Update post (owner/admin) | Yes |
| DELETE | `/forum/posts/:id` | Soft delete post (owner/admin) | Yes |

#### Comments

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/forum/posts/:postId/comments` | List comments with replies | No |
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

#### Search

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/forum/search?q=...` | Search posts by title/content | No |

#### Admin Moderation

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/forum/reports` | List reported posts (flagged) | Admin |
| POST | `/admin/forum/reports/:id/resolve` | Resolve a report (reset flag count) | Admin |
| POST | `/admin/forum/posts/:id/hide` | Hide a post | Admin |
| POST | `/admin/forum/posts/:id/unhide` | Unhide a post | Admin |
| POST | `/admin/forum/comments/:id/hide` | Hide a comment | Admin |
| POST | `/admin/forum/comments/:id/unhide` | Unhide a comment | Admin |

**Note:** admin moderation mount is `/moderation` (leading slash fixed in Sprint 11).

### 5.13 Notifications (Sprint 7)

#### User Notification Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/notifications` | List user notifications (pagination, read/unread/type/archive/dismiss filters) | Yes |
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

**Note:** Email sending is skipped entirely when `NODE_ENV === 'test'`. Push notifications (Firebase) are logged placeholders. Email sending is **non-throwing** as of Sprint 11 — failures are logged, never propagated.

### 5.14 Search & Recommendations (Sprint 8)

#### Global Search

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/search` | Global search across paths, forum posts, and users | No |
| GET | `/search/paths` | Search paths only | No |
| GET | `/search/forum` | Search forum posts only | No |
| GET | `/search/users` | Search users only | No |

**Search query parameters:**
- `q` (required) – search keyword
- `language` – `ar` or `en` (optional)
- `type` – `path`, `forum`, or `user` (optional, global search only)
- `categoryId`, `difficulty`, `minPrice`, `maxPrice` – filters for paths
- `page`, `limit` – pagination

**Implementation notes (Sprint 11):** uses `plainto_tsquery(${q}::regconfig)` against generated `tsvector` columns. Raw SQL always selects explicit columns — `SELECT *` breaks Prisma's `tsvector` deserialization.

#### Recommendations

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/recommendations/paths` | Personalized path recommendations | Yes |
| GET | `/recommendations/popular` | Popular paths | No |
| GET | `/recommendations/trending` | Trending paths | No |
| GET | `/recommendations/related/:pathId` | Related paths (co-enrollment) | No |

**Recommendation query parameters:**
- `limit` – number of results (default 10, max 20)
- `categoryId`, `difficulty` – optional filters for popular/trending

### 5.15 Parent Endpoints (Sprint 9)

#### Parent Dashboard

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/parents/me/overview` | Get parent overview | Parent |
| GET | `/parents/me/billing` | Get subscription and purchase history | Parent |

#### Child Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/parents/me/children` | Link a child | Parent |
| GET | `/parents/me/children` | List children | Parent |
| DELETE | `/parents/me/children/:childId` | Unlink a child | Parent |
| GET | `/parents/me/children/:childId/progress` | Get child progress summary | Parent |
| GET | `/parents/me/children/:childId/performance` | Get child quiz scores & challenges | Parent |
| GET | `/parents/me/children/:childId/time-tracking` | Get child time tracking | Parent |
| GET | `/parents/me/children/:childId/settings` | Get child settings | Parent |
| PUT | `/parents/me/children/:childId/settings` | Update child settings | Parent |

### 5.16 Enhanced Content Endpoints (Sprint 10)

#### Slides

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/lessons/:lessonId/slides` | List slides for a lesson | Yes |
| POST | `/lessons/:lessonId/slides` | Create slide | Admin |
| PUT | `/lessons/:lessonId/slides/:slideId` | Update slide | Admin |
| DELETE | `/lessons/:lessonId/slides/:slideId` | Delete slide | Admin |
| POST | `/lessons/:lessonId/slides/reorder` | Reorder slides | Admin |
| POST | `/lessons/:lessonId/slides/:slideId/complete` | Complete slide | Yes |

**Slide Types:** `INFO`, `QUIZ`, `DRAG_DROP`, `TRUE_FALSE`, `FILL_BLANK`

#### Quest Checkpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/lessons/:lessonId/checkpoints` | List quest checkpoints for a lesson | Yes |
| POST | `/lessons/:lessonId/checkpoints` | Create checkpoint | Admin |
| PUT | `/lessons/:lessonId/checkpoints/:checkpointId` | Update checkpoint | Admin |
| DELETE | `/lessons/:lessonId/checkpoints/:checkpointId` | Delete checkpoint | Admin |
| POST | `/lessons/:lessonId/checkpoints/reorder` | Reorder checkpoints | Admin |
| POST | `/lessons/:lessonId/checkpoints/:checkpointId/complete` | Complete checkpoint | Yes |

#### Boss Battle

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/modules/:moduleId/boss-battle` | Get boss battle | Yes |
| POST | `/modules/:moduleId/boss-battle` | Create boss battle | Admin |
| PUT | `/modules/:moduleId/boss-battle/:battleId` | Update boss battle | Admin |
| DELETE | `/modules/:moduleId/boss-battle/:battleId` | Delete boss battle | Admin |
| POST | `/modules/:moduleId/boss-battle/submit` | Submit boss battle answers | Yes |

#### Recharge

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/lessons/:id/recharge-status` | Get recharge status for current user | Yes |

### 5.17 Certificate Endpoints (Sprint 11)

#### User Certificates

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/certificates/me` | List current user's certificates (paginated) | Yes |
| GET | `/certificates/:id` | Get certificate by ID (owner or admin) | Yes |
| GET | `/certificates/:id/download` | Get download URL for the certificate PDF (owner or admin) | Yes |

#### Public Verification

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/certificates/verify/:code` | Verify a certificate by its code | No |

**Response shape (valid):**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "certificate": {
      "certificateCode": "QFLZ-ABCD-EFGH",
      "recipientName": "...",
      "pathTitle": "...",
      "issuedAt": "...",
      "revokedAt": null,
      "revokedReason": null
    }
  }
}
```

**Response shape (invalid):** `{ "valid": false, "reason": "NOT_FOUND" }` or `{ "valid": false, "reason": "REVOKED", "certificate": { ... } }`.

#### Admin Certificate Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/certificates/admin/issue` | Manually issue a certificate (body: `userId`, `pathId`) | Admin |
| POST | `/certificates/admin/:id/revoke` | Revoke a certificate (body: `reason`) | Admin |

**Auto-issue behavior:** when a lesson is completed via `/progress/lessons/:lessonId`, the backend checks whether all published lessons in the parent path are complete. If so, it auto-issues a certificate — idempotent (one per user per path), non-blocking (failures logged, never propagated), best-effort (PDF + email generated asynchronously).

**PDF generation:** A4 landscape via PDFKit + Noto Naskh Arabic + `arabic-persian-reshaper`. Storage is local (`uploads/certificates/<userId>/<code>.pdf`) with S3 swap-ready abstraction.

---

## 6. Key Decisions & Technical Notes

### Version Pins & Dependencies

- **Prisma pinned to `6.19.0`.** Do **not** upgrade — pending upstream fix for the migration bug (see §10).
- **Node.js v20 LTS** (recommended; v22/v24 work).
- **TypeScript 5.5.4** (strict mode).
- **Express 5** — `req.query`/`req.params` getter-only; use `Object.defineProperty`.
- **PostgreSQL** — dev port `5433`, test port `5434`.
- **Redis** — dev port `6379`, test port `6380`.

### Email (Changed in Sprint 11)

- **Provider:** AWS SES (via `@aws-sdk/client-ses`). Previously SendGrid.
- **`sendEmail` never throws.** Failures are logged, never propagated.
- **Dev short-circuit:** when `AWS_ACCESS_KEY_ID` is empty, logs `[DEV] Would send email to ...` and returns.
- **Test short-circuit:** when `NODE_ENV === 'test'`, logs `Test mode: email sending skipped.` and returns.
- **Sandbox:** SES is in sandbox mode. Production access requires verified `qafzly.com` domain — coordinated with AWS Solution Architect.

### Rate Limiting (Changed in Sprint 11)

- **Redis-backed** sliding window via `INCR` + `EXPIRE`.
- **Key strategy:** `userId` when authenticated, IP otherwise. CGNAT-friendly.
- **Fail-open** on Redis outage (`RATE_LIMIT_FAIL_OPEN=true` default).
- **Auth endpoints** limited to 10 req/min per IP per endpoint.
- **General routes** limited to `RATE_LIMIT_MAX_REQUESTS` (default 100) per `RATE_LIMIT_WINDOW_MS` (default 60s).
- **Excluded:** `/health`, `/health/live`, `/health/ready`, `/api-docs`, `/uploads`.

### Level Formula (Changed in Sprint 11)

**Old (Sprint 4):** `level * (level + 1) * 5` — deprecated.
**Current:** `threshold(N) = 50 · N · (N - 1)` for cumulative XP to reach level N. `threshold(1) = 0`.

- Level widths: `L1 = 100`, `L2 = 200`, `L3 = 300`, `L4 = 400`, `L5 = 500`, …
- `level` = highest N with `threshold(N) <= totalXp`
- `currentLevelXp` = `totalXp - threshold(level)`
- `nextLevelXp` = `threshold(level + 1) - threshold(level)`

**Worked example (1250 XP):** `threshold(5) = 1000`, `threshold(6) = 1500` → level 5, `currentLevelXp = 250`, `nextLevelXp = 500`, progress = 50%.

**This matches the Student Dashboard spec's table.** The spec's formula text and its table were inconsistent — we shipped the table.

### Background Jobs (New in Sprint 11)

- **Payment expiry cron** every 5 minutes.
- **Redis lock** (`cron:payment_expiry:lock`, 55s TTL) for multi-instance leader election.
- **Fail-open** on Redis outage — idempotent `updateMany` with status filter.
- **Graceful shutdown hooks** in `src/index.ts`.

### Health Checks (New in Sprint 11)

- `/health/live` — always 200 (process alive).
- `/health/ready` — 200 if Postgres + Redis reachable, 503 otherwise.
- `/health` — backwards-compatible alias for `/health/live`.
- All excluded from rate limiter.

### Idempotency (New in Sprint 11)

- `idempotency()` middleware — reusable factory.
- Optional `Idempotency-Key` header.
- 24h cache of 2xx responses per `(userId, key)`.
- `SET NX` in-flight marker prevents concurrent duplicates (409).
- Error responses not cached — lock released for retry.
- Fail-open on Redis outage.

### Certificate Issuance (New in Sprint 11)

- Auto-issued when all published lessons in a path are complete.
- Idempotent — one certificate per `(userId, pathId)`.
- Non-blocking — PDF generation and email are asynchronous; a failure doesn't undo the DB row.
- Public verification — no auth required.
- PDF rendering with Arabic shaping via `arabic-persian-reshaper`.

### Non-Blocking Side Effects (Sprint 11 Convention)

The following are wrapped in try/catch and logged, never propagated:
- Email sending
- Streak updates
- Certificate auto-issue

Reason: an email-service outage must never break payment creation; a streak-service error must never break lesson completion.

### Lesson Access Control (Sprint 11)

- Preview lessons accessible to all.
- Non-preview lessons require an active enrollment in the parent path.
- Admins bypass.
- `isAccessible` returned on list; `access.reason` returned on detail.

### Search (Unchanged since Sprint 8, clarified Sprint 11)

- **`plainto_tsquery(${q}::regconfig)`**, not `websearch_to_tsquery` (the latter isn't available in all Postgres builds).
- **Explicit column selection** in raw SQL — `SELECT *` breaks Prisma's `tsvector` deserialization.
- **Generated columns** declared as `Unsupported("tsvector")?` in `schema.prisma`. **Do not remove these declarations.**
- Uses `pg_trgm` for fuzzy matching on titles.

### Other Decisions

- **PostgreSQL port:** dev `5433`, test `5434`.
- **Redis usage:** token storage, rate limiting, account lockout, idempotency cache, cron lock.
- **Avatar upload:** Multer local storage; S3 for production (to be implemented).
- **Swagger UI:** all endpoints documented.
- **Express 5:** getter-only `req.query`/`req.params`.
- **Leaderboards:** global uses `userStats`; path-specific uses lesson progress.
- **Streak freeze:** decrements token; sets `lastStreakFreezeAt`.
- **Manual Payments:** reference code pattern; expiration now automated.
- **Forum voting:** polymorphic `ForumVote` — always specify `targetType` and `targetId`.
- **Best answer:** only post author can mark; sets `isSolved`.
- **Seed script:** includes enhanced content samples + test student + leaderboard fillers; daily quests deleted/recreated each run.
- **Notifications:** `channelsSent` is a list; email `link` must be coerced `?? undefined`.
- **Recommendations:** popularity and co-enrollment.
- **Parent-Child:** self-referential; `ChildSettings`.
- **Lesson lock / recharge:** based on previous lesson's `lockDurationHours`; parent override.
- **PDF Delivery:** S3 signed URLs with 5-min expiry; access control.
- **YouTube Validation:** enforced via `extractYouTubeId`.
- **Slides:** 5 types, stored in `Slide` model; progress in `UserSlideProgress`.
- **Mini-Quests:** checkpoints with XP; progress tracked; next checkpoint logic.
- **Boss Battles:** questions, scoring, victory levels, XP bonus; duplicate submission blocked.
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
| enrollment | ~85% | ~80% |
| progress | ~85% | ~70% |
| gamification | 100% | 91.2% |
| payment | 100% | 90.9% |
| forum | 87.9% | 75.2% |
| moderation | 100% | 100% |
| notification | 98.1% | 94% |
| search | 100% | 61.9% |
| recommendation | 97.3% | 88.8% |
| parent | 98.6% | 84.3% |
| slide | 100% | 100% |
| quest | 98.4% | 88.4% |
| bossBattle | 91.3% | 75% |
| recharge | 96.2% | 66.6% |
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
**Total tests:** 361 unit + 22 integration = **383 passing**.

### Testing approach

- Mock Prisma, Redis, AWS SDK clients, PDFKit in unit tests.
- All services have test files in `src/services/__tests__/`.
- Middleware tests in `src/middleware/__tests__/`.
- Job tests in `src/jobs/__tests__/`.
- Integration tests hit the real Express app via Supertest against isolated Docker containers.

---

## 8. Next Steps

### Recommended Immediate Actions

1. **Search branch coverage** — currently 59.5% (spec 61.9%); target ≥80%. Search is the most error-prone subsystem.
2. **Controller unit tests** — thin wrappers, currently 0% coverage; low effort for real protection.
3. **Integration test expansion** — Slides, Quests, Boss Battle, Recharge, Notifications, Parent, Admin Moderation, PDF delivery, search edge cases.
4. **Bulk enrollment endpoint** — enterprise feature per Gap Analysis N11.
5. **Recommendation refinement** — tie-breaking + popular fallback for new users.
6. **Seed data cleanup** — add a non-zero-price path for realistic payment testing.
7. **Weekly summary cron** — fills the partial R168 requirement.

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

- **Never run bare `npx prisma migrate dev`.** See §2.10 and `CONTRIBUTING.md` §7. The Prisma 6.x bug ([#24496](https://github.com/prisma/prisma/issues/24496), [#15654](https://github.com/prisma/prisma/issues/15654)) generates invalid SQL for generated columns.
- **`Unsupported("tsvector")` columns** — do not remove their declarations from `schema.prisma`; Prisma will drop them.
- **`SELECT *` breaks search** — always select explicit columns in raw SQL.
- **`EPERM: operation not permitted`** on `prisma generate` — a Node process is holding the query engine DLL. Kill node first: `Get-Process node | Stop-Process -Force`.
- **`Failed to deserialize column of type 'tsvector'`** — same as `SELECT *` issue.
- **`migrate status` reports missing migrations** — drift. Full recovery in §2.10.
- **`$transaction is not a function`** in unit tests — add `$transaction` mock that invokes the callback with `prisma`.

### Runtime

- **Express 5** — `req.query` / `req.params` are getter-only; use `Object.defineProperty` in middleware.
- **JWT `expiresIn` type error** — `jsonwebtoken` expects `StringValue`; cast `as any`.
- **Refresh-token payload** — rebuild as `{ userId, email, role }` before signing.
- **Email** — if `AWS_ACCESS_KEY_ID` is empty (dev) or `NODE_ENV === 'test'`, emails are logged/skipped. Never propagate email errors — `sendEmail` is non-throwing.
- **`console.log` from dotenv** — dotenv should only be imported in `env.ts`. Check other services if you see the boot log spam.

### Data Model

- **Soft deletes** — filter `deletedAt: null` on public queries (User, Path, ForumPost, ForumComment).
- **`VERIFIED` payment requests are never auto-expired** — intentional.
- **Parent-child linking** — `ChildSettings` enforces uniqueness; delete settings on unlink.
- **Streak freeze** — decrements token; doesn't validate the freeze is within the streak window (known limitation).
- **Level formula** — `threshold(N) = 50·N·(N-1)`. **Changed in Sprint 11.**
- **Forum votes** — polymorphic; always specify `targetType` and `targetId`.
- **Forum soft delete** — sets both `deletedAt` and `status = 'deleted'`.
- **Notifications** — `channelsSent` is an array; email `link` must be coerced `?? undefined`.

### Testing

- **`npm run test:integration`** — requires `.env.test` and Docker. Containers torn down automatically.
- **Jest `testMatch`** — default `jest.config.js` excludes `src/__tests__/integration/`. Integration tests use `jest.integration.config.js`.
- **"Your test suite must contain at least one test"** — helper files in `__tests__/integration/` picked up by default Jest. Register them via `setupFiles` / `setupFilesAfterEnv`.
- **Async middleware assertions fail silently** — use a `flushAsync` helper (see `CONTRIBUTING.md` §8.1).
- **Daily quests inactive after seed** — seed deletes and recreates them each run.

### Windows / Local Dev

- **Git ownership:** `git config --global --add safe.directory D:/Career/Qafzly`
- **PowerShell `-it` with Docker** — hangs. Use `docker exec <container> <cmd>` without `-it` for one-shot commands.
- **PowerShell `curl`** — aliases `Invoke-WebRequest`. Use `curl.exe` for real curl.
- **`dotenv -e .env.test`** on PowerShell — Python `dotenv` may shadow the JS one. Use `npm run test:integration:migrate` or `npx dotenv-cli`.
- **Docker Compose `version:` warning** — harmless; can be removed from `docker-compose.test.yml`.
- **Do not commit** `.env`, `.env.test`, or any `uploads/` content.

---

## 11. Contact

Read this document and run locally before changes. `README.md` has the endpoint reference; this document has the *why* behind the *what*.

For AWS-related questions, coordinate with the Project Manager and the AWS Solution Architect (kickoff scheduled).

---

## 12. Repository State (End of Sprint 11)

| Item | State |
|------|-------|
| Branch | `main` |
| Unit tests | 361 passing |
| Integration tests | 22 passing |
| Migration history | 2 migrations (rebased baseline + badge nameEn) |
| Swagger | All endpoints documented, including certificates |
| Coverage | ~93% service layer |
| Backend MVP | ✅ Feature complete for UAT |

### Recent Major Commits

```
feat: certificate generation on path completion
feat: preview lesson access control (freemium tier)
feat: idempotency-key support for POST /payments/requests
feat: payment expiry cron + graceful shutdown + health checks
fix: replace in-memory rate limiter with Redis-backed sliding window
fix: migrate email from SendGrid to AWS SES (non-throwing)
fix: frontend student dashboard response shapes
chore: rebase migration history to a single baseline
```

---

**End of Handoff Document**