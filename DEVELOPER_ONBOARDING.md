# 📄 Qafztk Backend – Developer Onboarding & Progress Report

**Date:** September 18, 2026
**Prepared by:** Senior Backend Engineer
**Purpose:** To provide the incoming developer with a thorough understanding of the project, its current state, development conventions, and guidance for continuing work.

> **Brand note:** The project was renamed from **Qafzly** to **Qafztk** in September 2026. Some seed-data emails (`admin@qafzly.com`, `child1@qafzly.com`, `test-student@qafzly.com`, etc.) intentionally remain on the old domain until the seed rename is coordinated with the PM. All new code, docs, and commit messages use **Qafztk**.

---

## 1. Project Snapshot

| Aspect | Detail |
|--------|--------|
| **Current Phase** | 🚧 Sprint 13 — Backend MVP is feature-complete; recommendation refinement shipped; payment contract polish + weekly summary cron delivered. Awaiting AWS Solution Architect for staging deployment. |
| **Repository** | Private GitHub repo (ask Project Manager for access) |
| **Core Stack** | Node.js 20 LTS, TypeScript 5.5, Express 5, Prisma 6.19.0 (pinned), PostgreSQL 15, Redis |
| **Architecture** | `routes → controllers → services` |
| **Testing** | Jest (unit) + Supertest (integration). Sprint 12 baseline: **452 unit**, **80 integration**. Sprint 13 targets: **~518 unit**, **~93 integration**. Service-layer coverage ~93% (search at 100% branches). |
| **API Docs** | Swagger UI at `/api-docs` |
| **Email** | AWS SES (`@aws-sdk/client-ses`). Non-throwing; sandbox mode in dev. |
| **Background Jobs** | Payment expiration cron (every 5 minutes, Redis-locked leader election) + **Weekly summary cron (Monday 08:00 Africa/Cairo, DST-aware)** [S13] |
| **Deferred to Sprint 14** | Bulk enrollment endpoint, controller unit tests, deployment config, brand pass on email templates, `activatePaymentRequest` upsert fix, tsvector trigger migration, RDS migration decision |

---

## 2. Development Environment

### 2.1 Prerequisites
- Node.js v20 LTS (recommended; v22/v24 work)
- Docker Desktop
- Git
- VS Code (recommended)

### 2.2 Setup Commands

```bash
git clone <repo-url>
cd qafzly-backend
npm install
cp .env.example .env        # adjust values if needed
docker-compose up -d        # starts PostgreSQL (port 5433) and Redis (6379)

# ⚠️ Do NOT use bare `npx prisma migrate dev` — see §6 of HANDOFF.md
npx prisma migrate deploy

npx ts-node prisma/seed.ts  # admin, parent, children, test-student, leaderboard
                            # users, categories, paths (incl. paid Python path),
                            # modules, lessons, slides, checkpoints, boss battle
                            # (5 questions), forum content (5 categories, 8 posts,
                            # 13 comments, 15 votes), enrollment, progress,
                            # badges (incl. 4 boss battle tier badges), quests,
                            # payment requests (3: PENDING/ACTIVATED/REJECTED) [S13]
npm run dev                 # start server
```

**Verification after setup:**
```bash
npx tsc --noEmit                  # expect silent
npm test -- --coverage            # expect ~518 passing after Sprint 13
npm run test:integration          # expect ~93 passing (Docker required)
```

### 2.3 Important Ports

| Service | Host Port | Container Port | Notes |
|---------|-----------|----------------|-------|
| PostgreSQL (dev) | **5433** | 5432 | Port 5432 was already in use by local PostgreSQL |
| Redis (dev) | 6379 | 6379 | Standard |
| PostgreSQL (test) | **5434** | 5432 | Used only by integration tests via `docker-compose.test.yml` |
| Redis (test) | **6380** | 6379 | Used only by integration tests |
| API | 3000 | - | Express server |
| Prisma Studio | 5555 | - | `npx prisma studio` |

---

## 3. Architecture Deep Dive

### 3.1 Folder Structure (with commentary)

```
src/
├── index.ts                    # Entry: connect DB/Redis, start server, background jobs
│                               # (paymentExpiry + weeklySummary), graceful shutdown
│                               # handlers (SIGTERM/SIGINT)
├── app.ts                      # Express app — middleware chain, health checks,
│                               # rate limiter, routes, Swagger, static uploads
├── config/
│   ├── env.ts                  # Zod-validated environment variables
│   ├── database.ts             # Prisma client singleton
│   ├── redis.ts                # Redis client singleton
│   ├── sesClient.ts            # AWS SES client + sendSesEmail helper       [S11]
│   ├── logger.ts               # Pino logger
│   └── swagger.ts              # OpenAPI 3.0 definition
├── middleware/
│   ├── authenticate.ts         # JWT verification
│   ├── optionalAuth.ts         # Attaches req.user if present, no reject    [S11]
│   ├── authorize.ts            # Role-based access
│   ├── errorHandler.ts         # Central error handler
│   ├── validate.ts             # Zod validation (Express 5 compatible)
│   ├── rateLimiter.ts          # Redis-backed factory + general instance    [S11]
│   ├── authRateLimiter.ts      # Uses factory, 10/min per IP per endpoint   [S11]
│   └── idempotency.ts          # Idempotency-Key middleware                 [S11]
├── utils/
│   ├── asyncHandler.ts
│   ├── AppError.ts
│   ├── apiResponse.ts
│   ├── token.ts
│   ├── upload.ts               # Multer config for avatar (local)
│   ├── uploadPdf.ts            # Multer config for PDF (memory)
│   ├── youtube.ts
│   └── validators/             # Zod schemas
│       ├── booleanQuery.ts               # Shared optional-boolean helper    [S12]
│       ├── auth.schema.ts
│       ├── user.schema.ts
│       ├── admin.schema.ts
│       ├── category.schema.ts
│       ├── path.schema.ts                # Uses optionalBooleanQuery         [S12]
│       ├── module.schema.ts              # Uses optionalBooleanQuery         [S12]
│       ├── lesson.schema.ts
│       ├── enrollment.schema.ts
│       ├── progress.schema.ts            # + completeWarmUpSchema            [S12]
│       ├── gamification.schema.ts
│       ├── payment.schema.ts
│       ├── forum.schema.ts               # + reportPost/reportComment schemas [S12]
│       ├── notification.schema.ts        # Uses optionalBooleanQuery         [S12]
│       ├── search.schema.ts
│       ├── recommendation.schema.ts
│       ├── parent.schema.ts              # + email link + flat settings      [S12]
│       ├── slide.schema.ts               # + .strict() on complete           [S12]
│       ├── questCheckpoint.schema.ts     # + .strict() on complete           [S12]
│       ├── bossBattle.schema.ts
│       └── certificate.schema.ts
├── services/
│   ├── answerEvaluation.service.ts       # Server-side evaluator             [S12]
│   ├── certificate.service.ts                                                  [S11]
│   ├── certificatePdf.service.ts                                               [S11]
│   ├── certificateStorage.service.ts                                           [S11]
│   ├── forum.service.ts                  # Rewritten: author, userVote        [S12]
│   ├── moderation.service.ts             # Rewritten: ForumReport queue       [S12]
│   ├── parent.service.ts                 # Email link, flat settings, billing [S12]
│   ├── progress.service.ts               # + warm-up + completion XP          [S12]
│   ├── search.service.ts                 # 100% branches                      [S12]
│   ├── bossBattle.service.ts             # Badge persistence, retry rename    [S12]
│   ├── recommendation.service.ts         # Unified Path[] + fallback chain     [S13]
│   ├── weeklySummary.service.ts          # Digest aggregation                  [S13]
│   ├── payment.service.ts                # QFZ- codes + Decimal amount string  [S13]
│   ├── email.service.ts                  # + sendWeeklySummaryEmail            [S13]
│   └── (all other services from Sprints 1–10)
├── controllers/
├── routes/
│   └── index.ts                # Mounts all routers incl. /certificates      [S11]
├── jobs/                                                                    [S11]
│   ├── paymentExpiry.job.ts
│   └── weeklySummary.job.ts     # Monday 08:00 Cairo, DST-aware               [S13]
├── types/
│   ├── express.d.ts
│   └── arabic-persian-reshaper.d.ts                                          [S11]
└── prisma/
    ├── schema.prisma
    ├── migrations/             # 6 migrations (last: add_weekly_summary_fields) [S13]
    └── seed.ts

scripts/
└── check-migrations.js          # Prisma generated-column bug guard          [S11]
```

Test directories:
```
src/
├── services/__tests__/                 # Unit tests (Prisma/Redis mocked)
├── middleware/__tests__/               # rateLimiter, idempotency            [S11]
├── jobs/__tests__/                     # paymentExpiry.job, weeklySummary.job [S11/S13]
└── __tests__/integration/              # Integration tests (real DB/Redis)
    ├── env.setup.ts
    ├── setup.ts
    ├── auth.test.ts
    ├── user.test.ts
    ├── enrollment.test.ts
    ├── progress.test.ts
    ├── gamification.test.ts
    ├── payments.test.ts
    ├── forum.test.ts
    ├── forumReport.test.ts                                                   [S12]
    ├── slides.test.ts                                                        [S12]
    ├── checkpoints.test.ts                                                   [S12]
    ├── bossBattle.test.ts                                                    [S12]
    ├── recharge.test.ts                                                      [S12]
    ├── notifications.test.ts                                                 [S12]
    ├── parent.test.ts                                                        [S12]
    ├── moderation.test.ts                                                    [S12]
    ├── certificates.test.ts                                                  [S12]
    ├── search.test.ts
    ├── recommendations.test.ts                                               [S13]
    └── health.test.ts
```

### 3.2 Request Lifecycle

1. **Route** matches URL and method.
2. **Middleware** chain executes: helmet → CORS → body parsing → health checks (bypass limiter) → rate limiter → route-level middleware (auth / optionalAuth / idempotency / validation).
3. **Controller** extracts validated data, calls the service.
4. **Service** performs business logic and database operations via Prisma.
5. **Controller** formats the response with `apiResponse()` and sends.
6. **Central error handler** catches any thrown `AppError` and converts to JSON.

### 3.3 Graceful Shutdown Sequence

When `SIGTERM`, `SIGINT`, or `uncaughtException` fires:

1. Set `shuttingDown` flag (ignore repeat signals)
2. Start 15-second force-exit timer
3. Stop background jobs — **`stopWeeklySummaryJob()` first, then `stopPaymentExpiryJob()`**
4. Close HTTP server — wait for in-flight requests to drain
5. `prisma.$disconnect()`
6. `redis.quit()`
7. Clear force-exit timer, `process.exit(0)`

If drain exceeds 15 seconds, `process.exit(1)` regardless.

**Order matters (Sprint 13):** `stopWeeklySummaryJob()` runs first because its Redis lock TTL is 5 minutes and its per-user writes are heavier than payment expiry's single `updateMany`. Reversing the order risks an in-flight digest batch hitting the DB during disconnect.

---

## 4. Conventions & Best Practices

### 4.1 Standard Response Format

Every endpoint returns:

```json
{
  "success": true,
  "data": { ... },
  "message": "Arabic success message",
  "errors": null,
  "meta": null
}
```

Use `apiResponse(res, statusCode, data, message, errors, meta)`.

### 4.2 Error Handling

- Throw `new AppError(statusCode, message)` in services/controllers.
- Validation errors → `400` with Zod's `.flatten()` output in `errors`.
- Unknown errors are logged and return a generic `500`.

### 4.3 Validation

- Define Zod schemas in `src/utils/validators/`.
- Use `validate(schema)` middleware in routes.
- **Express 5:** `req.query` and `req.params` are getter-only. The middleware uses `Object.defineProperty` to reassign them. **Do not** change this back to direct assignment.
- **Query-string booleans:** use `optionalBooleanQuery` from `src/utils/validators/booleanQuery.ts`. **Never** use `z.coerce.boolean()` or `.optional().transform(v => v === 'true')` — both have bugs (see §12).

### 4.4 Authentication

- JWT access token (15 min) in `Authorization: Bearer <token>`.
- Refresh token (7 days) stored in Redis with key `refresh_token:<userId>`.
- Account lockout after 5 failed attempts, for 15 minutes.
- **Refresh token handling:** rebuild the payload as `{ userId, email, role }` before calling `generateAccessToken`. Passing the decoded JWT (with `exp`/`iat`) causes a `Bad "options.expiresIn"` error.
- **Optional auth:** `optionalAuth` middleware attaches `req.user` if a valid Bearer token is present and silently continues as anonymous otherwise. Used on public endpoints (lessons, community posts).

### 4.5 Database Access

- Use Prisma Client only within services.
- Never access `prisma` directly in controllers.
- **Migration workflow — see §6 of HANDOFF.md.** Never run bare `migrate dev`.
- Always filter soft-deleted records (`deletedAt: null`) in public queries.
- **Raw SQL safety (Sprint 11, reinforced Sprint 13):**
  - **Never `SELECT *`** against `paths` or `forum_posts`. Both tables carry `Unsupported("tsvector")?` columns that Prisma cannot deserialize. Select explicit columns only.
  - **Never cast `id` / `pathId` / `categoryId` parameters with `::uuid`.** Our schema declares these as `text` (no `@db.Uuid`). Postgres rejects `text = uuid` with code `42883`. Let the comparison be `text = text`.
  - **Cast only the column** when comparing a Postgres enum to a text parameter: `AND p."difficulty"::text = ${value}`.
  - **Two services hit the `SELECT *` trap:** `search.service.ts` (fixed S11) and `recommendation.service.ts` (fixed S13). Any new raw SQL against these tables must follow the same pattern.

### 4.6 Idempotency

Any client-facing endpoint that creates a resource can use the `idempotency()` middleware:

```typescript
router.post(
    '/requests',
    authenticate,
    idempotency({ ttlSeconds: 24 * 60 * 60 }),
    validate(schema),
    controller.create
);
```

- Optional `Idempotency-Key` header.
- 24h cache of successful (2xx) responses.
- Concurrent same-key requests get `409`.
- Error responses are not cached; the in-flight lock is released.
- **Fail-open** on Redis unavailability.

### 4.7 Server-Side Answer Evaluation (Sprint 12)

**Never accept `isCorrect` / `completed` from the client.** The backend computes correctness.

- **Shared module:** `src/services/answerEvaluation.service.ts`
- `evaluateSlideAnswer(slide, answer)` handles all 5 slide types.
- `evaluateCheckpointSubmission(submission)` — non-empty `selfReflectionAnswer` completes.
- `evaluateWarmUpAnswer(warmUpJson, answer)` — Arabic-normalized comparison.
- **Arabic normalization:** strips tashkeel, normalizes alef variants (أ إ آ → ا), yeh variants (ى ئ → ي), teh marbuta (ة → ه), tatweel. Essential for user-facing text input.
- **Zod schemas** use `.strict()` on `completeSlide` and `completeCheckpoint` — sending extra fields → `400`.
- **Boss battles** already worked this way; no change needed.

**Answer shapes:**

| Slide type | Answer shape |
|---|---|
| INFO | `{}` (or omitted) |
| QUIZ | `{ "index": 2 }` |
| TRUE_FALSE | `{ "value": true }` |
| FILL_BLANK | `{ "text": "الطوبة" }` |
| DRAG_DROP | `{ "items": [{ "label": "...", "correctZone": "..." }] }` |

### 4.8 Testing Conventions

- **Unit tests** live alongside source in `__tests__/` subfolders. Mock Prisma, Redis, AWS SDK clients, and PDFKit.
- **Integration tests** live in `src/__tests__/integration/`. Use `supertest` against isolated Docker containers.
- Any new endpoint or business-logic change must have unit tests for the service layer, plus integration coverage for critical flows.
- **Do not** place helper files in `src/__tests__/integration/` without registering them in Jest config (`setupFiles` / `setupFilesAfterEnv`).
- For middleware wrapped in `asyncHandler`, use a `flushAsync` helper (`await new Promise(r => setImmediate(r))`) before asserting.
- **Never chain migration commands.** Run each as a separate shell command.
- **Mock reset (Sprint 13):** `jest.clearAllMocks()` only clears call history — persistent `mockResolvedValue()` implementations leak across tests. Use **`jest.resetAllMocks()` and re-establish persistent defaults in `beforeEach`**:

  ```ts
  beforeEach(() => {
      jest.resetAllMocks();
      (prisma.path.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  });
  ```

  This exact trap surfaced in `recommendation.service.test.ts` during Sprint 13 — a leaked `mockResolvedValue()` from an earlier test silently polluted downstream assertions.

### 4.9 Email Sending

- **`sendEmail` is non-throwing.** Catches all errors, logs them, returns.
- Dev: leave `AWS_ACCESS_KEY_ID` empty → `[DEV] Would send email to ...`
- Test: `NODE_ENV === 'test'` → `Test mode: email sending skipped.`
- Production: verified SES identity + IAM credentials.

### 4.10 Community Conventions (Sprint 12)

- **`author` field** on posts/comments (not `user`). Use `toAuthor()` helper in `forum.service.ts`.
- **`userVote`** (`'up' | 'down' | null`) — batched subquery in `getUserVoteMap`. No N+1.
- **`isSolved`** on post + **`isBestAnswer`** on comment (no `bestAnswerId` field).
- **`postCount`** on categories (published + non-deleted only).
- **Deterministic sorting** — `createdAt DESC` is always the tie-breaker.
- **2-level comment threading** — top-level comments + direct replies only.

### 4.11 Payment Reference Codes (Sprint 13)

- **Format:** `QFZ-XXXX-XXXX-XXXX` — 18 chars total. Crockford base32 alphabet, excludes `I`, `L`, `O`, `U` to prevent visual confusion.
- **Generation:** `crypto.randomBytes` + modular indexing. Collision space ≈ 1.15e18.
- **Retry-on-collision:** `persistPaymentRequest` retries up to 3 times on Prisma `P2002`. The code returned to the caller comes from the **successful insert**, never from a locally-generated one — retrying must not cause a mismatch between the response and the DB row.
- **`amount` is a Decimal string:** `(amountCents / 100).toFixed(2)`. Frontend uses `Intl.NumberFormat` for display; never `parseFloat` for arithmetic on the value.
- **Old format (`PAY-…`) is gone.** Do not reintroduce it anywhere.

### 4.12 Weekly Summary Job (Sprint 13)

- **Fires Monday 08:00 Africa/Cairo**, checked every 15 minutes. `tickWeeklySummary()` is a silent no-op outside that window.
- **DST-aware:** uses `Intl.DateTimeFormat` with `timeZone: 'Africa/Cairo'`. Egypt reintroduced DST in 2023 — offset is UTC+2 winter, UTC+3 summer. **Never replace with offset math.**
- **Dedupe:** checks the population's most recent `lastWeeklySummaryAt`. If < 6 days ago, skip. Combined with Redis lock + per-user write, the job is at-most-once-per-week.
- **Multi-instance:** Redis `SET NX` lock with a 5-minute TTL. Fail-open on Redis outage — the per-user `lastWeeklySummaryAt` guard prevents double-sends.
- **Batch design:** 7 queries per cycle, independent of user count. Joins in memory.
- **State fields:** `User.lastWeeklySummaryAt` + `User.lastWeeklySummaryRank`. Both nullable.
- **Digest fields (9):** `xpEarned`, `lessonsCompleted`, `currentStreak`, `longestStreak`, `rank`, `rankChange`, `badgesEarned[]`, `certificatesEarned`, `bossBattlesWon`.
- **Excluded by design** (weekly-meaningless noise): daily quests, slides, warm-ups, forum activity, recharge boosts, paths enrolled.
- **Delivery:** in-app notification (`type: 'weekly_summary'`) + email. Both suppressed when `privacySettings.emailNotifications === false`.
- **Zero-activity users still receive the digest** with a re-engagement body (`افتقدناك هذا الأسبوع`).
- **All per-user side effects are non-blocking** (`Promise.allSettled`) — a single-user failure is logged and the batch continues.

### 4.13 Recommendations (Sprint 13)

- **Unified response shape (Option A):** all four endpoints (`/popular`, `/trending`, `/related/:pathId`, `/paths`) return a consistent `Path[]` with a nested `category`. Internal ranking signals (`recent_enrollments`, `co_enrollment_count`) are stripped — sort order conveys the ranking.
- **Personalized fallback chain:** category-weighted (warm users) → skill-matched popular → popular → trending. **Enrolled paths are excluded at every stage**, including fallbacks.
- **Difficulty adjacency:**
  - `BEGINNER` → `[BEGINNER, ALL_LEVELS, INTERMEDIATE]`
  - `INTERMEDIATE` → `[INTERMEDIATE, ALL_LEVELS, BEGINNER, ADVANCED]`
  - `ADVANCED` → `[ADVANCED, ALL_LEVELS, INTERMEDIATE]`
- **Deterministic tie-breakers** everywhere: `enrollments DESC → createdAt DESC → id ASC`.
- **Raw SQL pattern:** select only `id` and the aggregate in the raw query; fetch the full Path shape via a second Prisma `findMany` using the shared `PATH_SELECT` projection. This is the pattern that fixed the Sprint 13 P0.
- **Do not add `::uuid` casts to parameters** — see §4.5.
- **Contract change is breaking** on `/trending` and `/related/:pathId`. Both endpoints previously 500'd, so the frontend never consumed them.

---

## 5. Implemented Features (Sprint 1–13)

*(Reference material — full endpoint tables are in `README.md`. This section is a condensed map.)*

### 5.1 Authentication (Sprint 1)
Register, login, refresh, logout, forgot/reset password. JWT + bcrypt (12 rounds). Redis rate limiting (10 req/min on auth endpoints) + account lockout. Registration auto-creates `UserStats` + assigns active daily quests in a transaction.

### 5.2 User Management (Sprint 2)
Self-profile CRUD, privacy settings, avatar upload/removal (local storage). Admin user management with role and suspend/activate controls.

### 5.3 Path Core (Sprint 3)
Categories, paths, modules, lessons CRUD. Enrollment and progress tracking.

**Lesson access control (Sprint 11):**
- Preview lessons (`isPreview: true`) accessible to everyone.
- Non-preview lessons require active enrollment in the parent path.
- Admins bypass.
- List endpoint returns `isAccessible: boolean` per lesson; detail endpoint returns `access.reason`.

### 5.4 Gamification (Sprint 4)
XP, 50-level curve, badges, leaderboards (global + path), streaks, daily quests.

**Response shape rewritten in Sprint 11** to match Student Dashboard spec: `totalXp`, `level`, `currentLevelXp`, `nextLevelXp`, `rank`, `badges[]` with `nameAr` + `nameEn`. Daily quests use `xpAward` (not `xpReward`). Streak response includes `lastActivityDate`.

### 5.5 Manual Payments (Sprint 5)
Payment request flow via Vodafone Cash / InstaPay. Admin activates/rejects manually.

**Sprint 11 additions:** Idempotency-Key support, background auto-expiration, non-blocking email.

**Sprint 12:** `Subscription` model deprecated — `Enrollment.expiresAt` is the source of truth. `GET /parents/me/billing` returns purchases only.

**Sprint 13:** `amount` returns a Decimal string; `referenceCode` uses the `QFZ-XXXX-XXXX-XXXX` Crockford base32 format; retry-on-collision at persistence layer; three seed payment requests added for frontend Task #9 testing.

### 5.6 Community (Sprint 6)
Forum categories, posts, comments, polymorphic voting, best answer, search, admin moderation.

**Sprint 12 changes:** `user` → `author`, `userVote` on all responses, `postCount` on categories, comment duplication fixed, deterministic sorting, forum reporting with `ForumReport` model, moderation queue rewrite.

### 5.7 Notifications (Sprint 7)
In-app notifications with filters, device tokens, admin broadcast. Email via SES.

**Sprint 12:** boolean query params (`isRead`, `isArchived`, `isDismissed`) correctly parsed — omitted means no filter.

**Sprint 13:** new system-generated notification type `weekly_summary` produced by the weekly summary cron. Existing generic `type` filter already supports filtering on it.

### 5.8 Search & Recommendations (Sprint 8)
Global search across paths/forum/users. Popular, trending, related, personalized recommendations.

**Implementation notes:**
- `plainto_tsquery(${q}::regconfig)` against generated `tsvector` columns.
- Raw SQL always selects explicit columns — `SELECT *` breaks Prisma's `tsvector` deserialization.
- Generated columns declared as `Unsupported("tsvector")?` in `schema.prisma`.

**Sprint 12:** search service branch coverage 59.5% → 100%.

**Sprint 13:** recommendation refinement shipped — unified response shape, skill-matched cold-start, category-weighted warm-start, deterministic tie-breakers, two P0 `SELECT *` fixes on `/trending` and `/related/:pathId`. Integration coverage added (13 tests).

### 5.9 Parent-Child & Lesson Enhancements (Sprint 9)
Self-referential parent-child relations, `ChildSettings` for lock override, 12-hour lock logic based on previous lesson completion. S3 signed PDF URLs (5 min expiry). YouTube ID validation.

**Sprint 12 changes:**
- `POST /parents/me/children` accepts `email` as alternative to `childId`
- Settings endpoints return flat shape: `{ lockOverrideEnabled, customLockDurationHours }`
- `GET /parents/me/billing` aggregates purchases from parent + linked children

### 5.10 Enhanced Content (Sprint 10)
Slides (5 types), quest checkpoints, boss battles, XP recharge boost window.

**Sprint 12 changes:**
- Server-side answer evaluation (slide + checkpoint)
- Lesson-completion XP (`Lesson.completionXpAward`, default 10)
- Warm-up XP endpoint (`POST /lessons/:lessonId/warmup/complete`)
- Boss battle badge persistence (4 tier badges)
- Retry tier label renamed `حاول تاني` → `مش هستسلم`
- Seed boss battle: 3 → 5 questions (all tiers reachable)

---

## 6. Sprint 13 Progress — In Progress

Three workstreams. Two are shipped and green; one (weekly summary) is applied and passing as of the current session.

### 6.1 ✅ Recommendation Refinement

**Two P0 bugs caught and fixed:**

1. **`SELECT p.*` against `paths` returned 500** on `/trending` and `/related/:pathId`. The `paths` table carries two `Unsupported("tsvector")` columns that Prisma cannot deserialize. Fixed by selecting only `id` and the aggregate in the raw SQL, then fetching the full Path shape via a second Prisma `findMany`.
2. **`text = uuid` operator error (`42883`)** from casting string parameters with `::uuid`. Fixed by dropping the parameter-side cast — our `pathId` / `categoryId` columns are `text`.

**Contract fix — unified `Path[]` response shape:** all four endpoints return a consistent shape with nested `category`. Internal scoring signals stripped.

**Algorithm refinement:**
- Cold-start: skill-matched popular → popular → trending.
- Warm-start: category-weighted → skill-matched popular → popular → trending.
- Difficulty adjacency table for skill matching.
- Deterministic tie-breakers everywhere.
- **Enrolled paths excluded from every stage** — including popular and trending fallbacks.

**Test coverage:**
- `recommendation.service.test.ts` rewritten — 27 tests.
- **New integration file** `recommendations.test.ts` — 13 tests, including two P0 regression guards and a shape-consistency test.

**Files touched:** `recommendation.service.ts`, `recommendation.controller.ts`, `recommendation.service.test.ts`, `recommendations.test.ts` (new).

### 6.2 ✅ Payment Contract Polish

- **`amount`** — returned as Decimal string (was a JS number). Matches `BACKEND_REFERENCE.md` §23.
- **`referenceCode`** — `QFZ-XXXX-XXXX-XXXX` Crockford base32 (was `PAY-…`). Retry-on-collision at persistence layer.
- **Seed additions** — three payment requests against the Python path (150 EGP): PENDING (test-student), ACTIVATED (yusuf, with matching enrollment), REJECTED (sara). Reference codes carry a `SEED` marker.

**Files touched:** `payment.service.ts`, `payment.service.test.ts` (2 new tests), `prisma/seed.ts`.

**No migration needed** — pure formatting and seed change.

### 6.3 ✅ Weekly Summary Cron

New background job firing **Monday 08:00 Africa/Cairo**, checked every 15 minutes. Delivers an in-app notification + email per eligible student. Both channels suppressed when `privacySettings.emailNotifications === false`. Zero-activity users still receive the digest.

**Full convention details** in §4.12.

**Schema additions:** `User.lastWeeklySummaryAt`, `User.lastWeeklySummaryRank`. Migration `add_weekly_summary_fields`.

**Files added:** `weeklySummary.service.ts`, `weeklySummary.job.ts`, `weeklySummary.service.test.ts` (16 tests), `weeklySummary.job.test.ts` (13 tests).

**Files modified:** `email.service.ts` (appended `sendWeeklySummaryEmail` + `WeeklySummaryEmailData`), `index.ts` (wired start/stop), `prisma/schema.prisma`.

### 6.4 Test Counts

| Suite | End of Sprint 12 | After Sprint 13 |
|-------|------------------|-----------------|
| Unit | 452 | **~518** (+27 recommendation, +16 weekly service, +13 weekly job, +2 payment) |
| Integration | 80 | **~93** (+13 recommendations) |
| Total | 532 | **~611** |

### 6.5 Documentation Status

At Sprint 13 close, the following docs must be updated (checklist):

- [x] `README.md` — recommendations section, payment create-response shape, weekly summary job row, seed data, Sprint status
- [x] `HANDOFF.md` — Sprint 13 section, structure tree, gotchas (raw SQL, Cairo TZ), background jobs
- [x] `DEVELOPER_ONBOARDING.md` — this document
- [ ] `CONTRIBUTING.md` — §4.4 raw SQL casts, §8.1 `resetAllMocks` + defaults
- [ ] `BACKEND_REFERENCE.md` — §23 payment shape, §25 recommendations shape, §21 notification types
- [ ] `src/config/swagger.ts` — `/recommendations/*` responses, payment `amount` type, `QFZ-` example


## 7. Sprint 12 Progress — Previously Completed

### 7.1 Server-Side Answer Evaluation (Security)

**The vulnerability:** `completeSlide` and `completeCheckpoint` accepted `isCorrect` / `completed` booleans directly from the request body. A motivated student could send `isCorrect: true` via DevTools and earn full XP.

**Fix:** correctness computed server-side by `src/services/answerEvaluation.service.ts`.

- Per-type evaluators: INFO, QUIZ, TRUE_FALSE, FILL_BLANK, DRAG_DROP
- Arabic normalization applied to FILL_BLANK and warm-up answers
- `.strict()` Zod schemas reject extra fields
- API contract: slide complete body is now `{ answer }` only; checkpoint complete is `{ selfReflectionAnswer }` only
- Response includes the computed `isCorrect`

### 7.2 Lesson-Completion XP + Warm-Up XP

- **Lesson-completion XP:** new `Lesson.completionXpAward` field (default 10). Awarded once per user per lesson on first `completed: true` transition. Non-blocking.
- **Warm-up XP:** new endpoint `POST /lessons/:lessonId/warmup/complete`. Server evaluates against `Lesson.warmUpJson.answerAr`. First submission only. Wrong answer marks complete but awards 0 XP.
- New field `LessonProgress.warmUpCompletedAt`.

### 7.3 Parent Dashboard Contract Fixes

- **`POST /parents/me/children`** accepts `childId` **or** `email`
- **Settings endpoints** return flat shape `{ lockOverrideEnabled, customLockDurationHours }`
- **`GET /parents/me/billing`** aggregates purchases across parent + children. `subscriptions` key gone.
- **`Subscription` model removed** — `Enrollment.expiresAt` is the source of truth.

### 7.4 Community Contract Fixes

| # | Change |
|---|--------|
| 1 | `user` → `author` rename in all post/comment responses |
| 2 | `userVote` added to posts list, post detail, comments |
| 3 | `postCount` added to `GET /forum/categories` |
| 4 | Comment duplication fix — `getComments` was missing `parentCommentId: null` filter |
| 5 | Create responses include relations (refetch after create) |
| 6 | Deterministic sort tie-breaker: `[{ sortBy }, { createdAt: 'desc' }]` |

Also fixed:
- **`GET /paths/:id` and `GET /forum/posts/:id`** now use `optionalAuth` (admin bypass was dead code)
- **Inactive forum categories** filtered by default

### 7.5 Forum Reporting

- New `ForumReport` model + `POST /forum/posts/:id/report` and `POST /forum/comments/:id/report`
- Reasons: `spam`, `harassment`, `inappropriate`, `misinformation`, `off-topic`, `other`
- Duplicate report → `409`; self-report → `400`
- **Moderation queue rewrite:** `GET /admin/forum/reports` returns `ForumReport` objects with embedded `reporter`, `post`, `comment` — previously returned raw posts with `flaggedCount > 0` filter

### 7.6 Boolean Query Parameter Bug Class

**The bug:** `z.coerce.boolean()` does `Boolean(value)` under the hood. `Boolean('false')` is `true`. So `?isFeatured=false` silently returned `isFeatured: true` results.

Affected: `path.schema.ts` (`isFeatured`), `module.schema.ts` (`isPublished`), `notification.schema.ts` (`isRead`, `isArchived`, `isDismissed`).

**Fix:** shared `src/utils/validators/booleanQuery.ts`:

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

Preserves three cases: `'true'` → `true`, `'false'` → `false`, omitted → `undefined`.

### 7.7 Boss Battle Badge Persistence + Retry Rename

- **Four tier badges now persist** as real `UserBadge` rows:
  - `أسطورة المدينة` / City Legend (≥80%)
  - `محارب المدينة` / City Warrior (≥60%)
  - `متدرب المدينة` / City Trainee (≥40%)
  - `مش هستسلم` / Won't Give Up (<40%)
- Previously the badge name was only echoed and never saved — a broken feature.
- Retry tier label renamed from `حاول تاني` ("try again") to `مش هستسلم` ("won't give up"). The old label promised retry, but the backend blocks resubmission via unique constraint.
- Seed update: boss battle now has **5 questions** (was 3). With 3 questions, trainee tier was mathematically unreachable.

### 7.8 Search Branch Coverage

`search.service.ts` went from 61.9% branch coverage to **100% statements + 100% branches**.

- ~20 branch tests covering: empty `q`, short queries, filter-only queries, all filter combinations, empty count row, pagination boundaries

### 7.9 Integration Test Expansion

Went from **22 integration tests** (9 files) to **80 integration tests** (18 files).

**New files:** `slides.test.ts`, `checkpoints.test.ts`, `bossBattle.test.ts`, `recharge.test.ts`, `notifications.test.ts`, `parent.test.ts`, `moderation.test.ts`, `certificates.test.ts`, `forumReport.test.ts`.

### 7.10 Seed Data Expansion

- **Paid published path** added: `مقدمة إلى البرمجة بلغة بايثون` (150 EGP) for payment-flow testing
- **Forum content** added (previously zero):
  - 5 categories — أسئلة عامة، مشاكل تقنية، نقاشات، إعلانات، اقتراحات
  - 8 posts (3 by `test-student@qafzly.com`)
  - 13 comments (10 top-level + 3 nested), 2 marked as best answers
  - 15 votes distributed
- **Boss battle now has 5 questions** (was 3)
- **Lesson 1** now has:
  - Real public YouTube video IDs
  - `lockDurationHours: 0` (was 12) for testing
  - `completionXpAward: 10`

### 7.11 Test Counts

| Suite | Before S12 | After S12 |
|-------|-----------|-----------|
| Unit | 361 | **452** |
| Integration | 22 | **80** |
| Total | 383 | **532** |

New coverage: `answerEvaluation.service.ts` (79%), search at 100% branches.

### 7.12 Sprint Deferral Note

Per PM decision on September 17, 2026, the following items were deferred to Sprint 13 (each subsequent sprint shifts by one):
- Recommendation refinement
- Bulk enrollment endpoint
- Weekly summary cron
- Controller unit tests
- Deployment configuration (CI/CD, staging)

---

## 8. Sprint 11 Progress — Previously Completed

*(Historical record, preserved for reference.)*

### 8.1 Integration Test Infrastructure
- Isolated Docker setup (`docker-compose.test.yml`) — Postgres `5434`, Redis `6380`
- `jest.integration.config.js` with `setupFiles` + `setupFilesAfterEnv`
- Dedicated `.env.test` (git-ignored)
- 22 integration tests across 9 files
- Scripts: `test:integration`, `test:integration:up`, `test:integration:migrate`, `test:integration:down`

### 8.2 Critical Production Fixes

| # | Bug | Fix |
|---|-----|-----|
| 1 | `/enrollments` returned 404 for all paths | Added router mount |
| 2 | `/moderation` broken | Added missing leading slash |
| 3 | `/payment` vs `/payments` mismatch | Renamed to `/payments` |
| 4 | Auth refresh failed with `Bad "options.expiresIn"` | Rebuild payload |
| 5 | Search returned 500 with `tsvector` deserialization | Explicit columns + `plainto_tsquery` |

### 8.3 Redis Rate Limiter
- Factory pattern: `createRateLimiter({ windowMs, max, keyPrefix, keyGenerator, skipOnError })`
- Key strategy: `userId` when authenticated, IP otherwise
- Auth limiter: 10 req/min per IP per endpoint
- General limiter: 100 req/min
- Fail-open on Redis outage
- Headers: `X-RateLimit-*`, `Retry-After` on 429

### 8.4 Payment Expiration Cron + Graceful Shutdown + Health Split
- `src/jobs/paymentExpiry.job.ts` — flips `PENDING → EXPIRED` every 5 min
- Redis lock `cron:payment_expiry:lock` (55s TTL)
- Graceful shutdown in `src/index.ts` — SIGTERM/SIGINT → 15s force-exit
- `/health/live` (always 200) + `/health/ready` (checks Postgres + Redis)

### 8.5 Idempotency-Key on `POST /payments/requests`
- 24h cache of 2xx responses per `(userId, key)`
- `SET NX` in-flight marker prevents concurrent duplicates (409)
- Error responses not cached; fail-open

### 8.6 AWS SES Migration
- `sendEmail` is now non-throwing
- Sandbox mode; empty `AWS_ACCESS_KEY_ID` triggers dev short-circuit
- Removed SendGrid entirely

### 8.7 Preview Lesson Access Control
- `optionalAuth` middleware + `determineLessonAccess`
- Preview lessons accessible to all; non-preview requires enrollment
- `isAccessible` flag on list, `access.reason` on detail

### 8.8 Certificate Generation
- New `Certificate` model + auto-issue on path completion
- A4 landscape PDF via PDFKit + Noto Naskh Arabic + `arabic-persian-reshaper`
- 6 endpoints: list, detail, download, public verify, admin issue, admin revoke

### 8.9 Frontend Student Dashboard Fixes
- Response shapes matched Student Dashboard spec
- `Badge.nameEn` column added
- Auto-streak on lesson completion
- Level formula changed to `threshold(N) = 50·N·(N-1)`

### 8.10 Migration History Rebasing
- Rebased to `20260911203608_initial_schema` + `20260911212808_add_badge_name_en`
- `scripts/check-migrations.js` guard against Prisma bug #24496

---

## 9. Sprints 1–10 — Historical Summary

*(Full detail preserved in `HANDOFF.md` §2 and previous onboarding revisions.)*

- **Sprint 1 – Authentication:** JWT + bcrypt (12 rounds), Redis rate limiting + account lockout.
- **Sprint 2 – User Management:** Self-profile CRUD, privacy settings, avatar upload (local), admin user management.
- **Sprint 3 – Path Core:** Categories, paths, modules, lessons CRUD. Enrollment + progress tracking. Swagger.
- **Sprint 4 – Gamification:** Profile, XP, levels (50), badges, leaderboards, streaks, daily quests.
- **Sprint 5 – Manual Payments:** Vodafone Cash / InstaPay, admin activation/rejection, Arabic email templates.
- **Sprint 6 – Community:** Forum categories, posts, comments, polymorphic voting, best answer, moderation.
- **Sprint 7 – Notifications:** In-app + device tokens + admin broadcast.
- **Sprint 8 – Search & Recommendations:** Global search, personalized/popular/trending/related recommendations.
- **Sprint 9 – Parent-Child & Lesson Expansion:** Self-referential relation, `ChildSettings`, 12-hour lock, S3 PDF URLs (5 min), YouTube validation.
- **Sprint 10 – Enhanced Content:** Slides (5 types), quest checkpoints, boss battles, XP recharge window.

---

## 10. Database Schema Highlights

- **User** — extended with `displayName`, `timezone`, `lastLoginAt`, `privacySettings`, `parentId`, `children`, `childSettings`, `certificates`, **`lastWeeklySummaryAt` + `lastWeeklySummaryRank` (S13)**
- **Role enum:** `STUDENT`, `PARENT`, `ADMIN`
- **ChildSettings:** `lockOverrideEnabled`, `customLockDurationHours`
- **Soft delete:** `deletedAt` on `User`, `Path`, `ForumPost`, `ForumComment`
- **Lesson** — content fields, lock fields, recharge fields, `warmUpJson`, `miniQuestJson`, **`completionXpAward` (S12)**
- **LessonProgress** — **`warmUpCompletedAt` (S12)**
- **Enhanced Content:** `Slide`, `QuestCheckpoint`, `BossBattle`, `BossBattleQuestion`, `UserSlideProgress`, `UserQuestProgress`, `UserBossBattleProgress`
- **Gamification:** `UserStats`, `Badge` (with `nameEn`), `UserBadge`, `XpAuditLog`, `Quest`, `UserQuest`
- **Community:** `ForumCategory`, `ForumPost`, `ForumComment`, `ForumVote`, **`ForumReport` (S12)**
- **Payments:** `Purchase`, `PaymentRequest` with `PaymentRequestStatus` enum. **`Subscription` removed in S12.** `referenceCode` is now `QFZ-…` for newly-created rows (S13).
- **Notifications:** `Notification`, `DeviceToken`, `NotificationTemplate`. New system-generated type `weekly_summary` (S13).
- **Certificates:** `Certificate` with `certificateCode`, `metadata`, `revokedAt`, `revokedReason`
- **Search vectors:** `paths` and `forum_posts` have generated `tsvector` columns declared as `Unsupported("tsvector")?`
- **All models use UUID primary keys.**
- **Migration history (6):** `20260911203608_initial_schema` → `20260911212808_add_badge_name_en` → `20260915101558_add_forum_reports` → `20260916140547_deprecate_subscription` → `20260917120000_add_lesson_completion_and_warmup_xp` → **`20260918xxxxxx_add_weekly_summary_fields` (S13)**

---

## 11. Testing Strategy

### 11.1 Unit Tests

- **Location:** `src/services/__tests__/`, `src/middleware/__tests__/`, `src/jobs/__tests__/`
- **Mocks:** Prisma, Redis, AWS SES/S3 clients, PDFKit
- **Run:** `npm test -- --coverage`
- **Current status:** ~518 passing (Sprint 13 close). Service-layer coverage ~93% statements, ~85% branches, ~97% functions.

### 11.2 Integration Tests

- **Location:** `src/__tests__/integration/`
- Uses `supertest` against the real Express app with isolated Docker containers.
- Migrations and seed run automatically in `setup.ts`.
- **Run:** `npm run test:integration`
- **Current status:** ~93/93 passing (Sprint 13 close).

**Requirements:**
- `.env.test` in project root (see `README.md` for full template).
- Docker Desktop running.

**Conventions:**
- Never place helper files in the integration folder without registering them in Jest config.
- Use unique emails per test: `` `test_${Date.now()}@example.com` ``.
- Use seeded admin credentials: `admin@qafzly.com / Admin@123456`.
- Fetch IDs from the DB via `prisma`; don't hardcode.
- Each test file sets up its own state.
- **Cairo timezone:** when testing the weekly summary job's timing logic, construct dates explicitly — Monday 08:00 Cairo in September (DST, UTC+3) = `new Date('2026-09-21T05:00:00Z')`. Never assume a fixed offset.

### 11.3 Which Tests Should I Add?

| Change | Required tests |
|--------|----------------|
| New service method | Unit test in `src/services/__tests__/` |
| New middleware | Unit test in `src/middleware/__tests__/` |
| New background job | Unit test in `src/jobs/__tests__/` |
| New endpoint on a critical flow | Integration test in `src/__tests__/integration/` |
| Bug fix | Regression test that would have caught the bug |
| New feature | Unit + integration where user-visible |
| New raw SQL against `paths`/`forum_posts` | Integration test that hits the endpoint end-to-end (the only way to catch tsvector deserialization issues) |
| New job with time-based scheduling | Unit test with mocked `Date` + real `Intl.DateTimeFormat` |

---

## 12. Known Issues & Gotchas

### Prisma & Migrations

1. **Never run bare `npx prisma migrate dev`.** See `HANDOFF.md` §6.
2. **Never chain migration commands.** Run `--create-only`, then audit, then `check:migrations`, then `migrate deploy` — as separate shell commands.
3. **Prisma pinned to 6.19.0.** Do not upgrade — pending upstream fix.
4. **`Unsupported("tsvector")` columns** — do not remove their declarations.
5. **`SELECT *` in raw SQL breaks search and recommendations** — always select explicit columns. Two services hit this trap: `search.service.ts` (fixed S11) and `recommendation.service.ts` (fixed S13).
6. **`EPERM: operation not permitted`** on `prisma generate` — kill node first.
7. **`Failed to deserialize column of type 'tsvector'`** — same as #5.
8. **Never cast `id` / `pathId` / `categoryId` parameters with `::uuid`** — our schema declares these as `text` (no `@db.Uuid`). Postgres rejects `text = uuid` with error code `42883`. Cast only the column, and only when comparing a Postgres enum to a text parameter (`p."difficulty"::text = ${value}`).

### Runtime

9. **Express 5 getter-only `req.query`/`req.params`** — use `Object.defineProperty`.
10. **JWT `expiresIn` type error** — cast `as any`.
11. **Refresh token payload** — rebuild as `{ userId, email, role }` before signing.
12. **Prisma `take expected Int, got String`** — `z.coerce.number()` in query schemas.

### Query-String Booleans (Sprint 12)

13. Use `optionalBooleanQuery` from `src/utils/validators/booleanQuery.ts`.
14. **Never** use `z.coerce.boolean()` — `Boolean('false')` is `true`.
15. **Never** use `.optional().transform(v => v === 'true')` — Zod runs the transform on `undefined`.

### Data Model

16. **Soft deletes everywhere** — filter `deletedAt: null`.
17. **`VERIFIED` payment requests are never auto-expired** — intentional.
18. **Parent-child linking** — `ChildSettings` enforces uniqueness.
19. **Streak freeze** — decrements token; doesn't validate window (known limitation).
20. **Level formula** — `threshold(N) = 50·N·(N-1)`. Do not revert to `N·(N+1)·5`.
21. **Forum votes** — polymorphic; always specify `targetType` and `targetId`.
22. **Forum fields** — `author` (not `user`), `userVote`, `isSolved` + `isBestAnswer`.
23. **`Subscription` model removed** — use `Enrollment.expiresAt`.
24. **`activatePaymentRequest` uses `enrollment.create`** — will throw on a prior enrollment for the same `(userId, pathId)` (unique constraint). Fix scheduled for Sprint 14 (use `upsert`). Currently latent because seed users have no prior enrollment rows.
25. **Weekly summary state fields** — `User.lastWeeklySummaryAt` + `User.lastWeeklySummaryRank`. Do not repurpose these for other features.

### Cairo Timezone (Sprint 13)

26. **Egypt reintroduced DST in 2023.** Offset is UTC+2 in winter, UTC+3 in summer.
27. **Always use `Intl.DateTimeFormat` with `timeZone: 'Africa/Cairo'`** for time-based scheduling. Never hardcode offsets — the job will silently drift twice a year.
28. **Test fixtures:** 08:00 Cairo in September = **05:00 UTC**; in December = **06:00 UTC**.

### Payment Reference Codes (Sprint 13)

29. **Format is `QFZ-XXXX-XXXX-XXXX`.** Crockford base32 (excludes `I L O U`). The old `PAY-…` format is gone — do not reintroduce it.
30. **Retry-on-collision is deliberate.** The code returned to the client comes from the successful insert, never from a locally-generated one. If you refactor `persistPaymentRequest`, preserve this — a retry that returns a locally-generated code will silently mismatch the DB row.
31. **`amount` is a Decimal string.** Never `parseFloat` for arithmetic; use `Intl.NumberFormat` for display.

### Windows / Local Dev

32. **Git ownership:** `git config --global --add safe.directory D:/Career/Qafzly`
33. **PowerShell `-it` with Docker** — hangs. Drop `-t` for one-shot commands.
34. **PowerShell `curl`** — aliases `Invoke-WebRequest`. Use `curl.exe`.
35. **`dotenv -e .env.test`** on PowerShell — Python `dotenv` may shadow JS. Use `npm run test:integration:migrate`.
36. **Docker Compose `version:` warning** — harmless.

### Testing

37. **`npm run test:integration`** requires `.env.test` and Docker.
38. **Jest `testMatch`** — default `jest.config.js` excludes `src/__tests__/integration/`.
39. **"Your test suite must contain at least one test"** — helper files picked up by default Jest. Register via `setupFiles`.
40. **Async middleware assertions fail silently** — use a `flushAsync` helper.
41. **`jest.clearAllMocks()` is not enough** — it doesn't clear persistent implementations. Use `jest.resetAllMocks()` **and re-establish persistent defaults** in `beforeEach`. This trap bit `recommendation.service.test.ts` during Sprint 13.

### Search

42. **`plainto_tsquery` not `websearch_to_tsquery`** — the latter isn't available in all Postgres builds.
43. **Regconfig cast required:** `plainto_tsquery(${q}::regconfig)`.

---

## 13. Next Steps

### 13.1 Sprint 13 close-out checklist

- [x] Apply payment service changes + payment tests + seed additions
- [x] Apply weekly summary files (service, job, tests, email template, index wiring)
- [x] Create migration `add_weekly_summary_fields` with `--create-only`, audit, `check:migrations`, `deploy`
- [x] Run the four guards (`tsc --noEmit`, `npm test -- --coverage`, `npm run test:integration`, `npm run check:migrations`) — all clean
- [ ] Update `README.md`, `HANDOFF.md`, `DEVELOPER_ONBOARDING.md`, `CONTRIBUTING.md`, `BACKEND_REFERENCE.md`, `swagger.ts` for Sprint 13 close
- [ ] Commit Sprint 13

### 13.2 Deferred to Sprint 14

1. **Bulk enrollment endpoint** — enterprise feature per Gap Analysis N11. Consumer TBD (admin → user list vs. parent → multiple children).
2. **Controller unit tests** — thin wrappers, currently 0% coverage. Nice-to-have.
3. **Deployment configuration** — ECS vs EC2 decision, then CI/CD pipeline. Coordinate with AWS SA.
4. **Brand pass — email templates.** Migrate all seven existing templates from Qafzly → Qafztk in one coordinated commit. `sendWeeklySummaryEmail` (S13) already says Qafztk; the rest still say Qafzly.
5. **`activatePaymentRequest` upsert fix.** The `tx.enrollment.create` throws on prior enrollments (unique constraint). Should be `upsert`.
6. **Replace `Unsupported("tsvector")` generated columns with trigger-maintained columns.** This is the actual fix for the Prisma 6.x migration bug that has been the source of the `--create-only` workaround since Sprint 11. Eliminates the workaround permanently. Medium effort, low risk. See `CONTRIBUTING.md` §7 for the current workaround.
7. **Add `page` param to recommendation endpoints.** Currently only `limit` is honored. Not blocking.
8. **Optional: `GET /notifications?type=weekly_summary` filter documentation.** The type is stored today; the generic `type` query param already supports it — just needs a docs line.

### 13.3 AWS-Gated (Waiting on Solution Architect)

1. **RDS migration decision** — **recommended: AWS RDS PostgreSQL, not Supabase.** The Prisma `Unsupported("tsvector")` migration bug is a Prisma introspection issue against `GENERATED ALWAYS AS ... STORED` columns. It reproduces identically on RDS, Supabase, Neon, Railway, and any other Postgres host — migrating hosts does **not** fix it. Supabase adds PgBouncer/Supavisor friction (prepared statement incompatibility, migration advisory lock conflicts, shadow DB restrictions, connection pool tuning) without solving the underlying problem. RDS keeps the stack in one VPC/IAM/billing model.
2. **S3 avatar upload** — reuse `s3.service.ts`.
3. **SES production access** — verify `qafztk.com` domain, exit sandbox.
4. **Staging deployment** — ECS vs EC2 decision, then CI/CD pipeline.
5. **Secrets management** — AWS Secrets Manager.
6. **CloudWatch monitoring** — Pino → CloudWatch Logs.

### 13.4 Firebase-Gated

1. **Push notifications** — replace logging placeholder.

### 13.5 Post-MVP

- Voice support in parent dashboard (Phase 2)
- PayMob integration (replaces manual payments)
- OAuth 2.0 (Google / Facebook / Apple)
- Webhooks
- Live sessions (Zoom / Meet)
- Offline mode
- 2FA
- Native mobile apps (PWA is the MVP)

---

## 14. Troubleshooting Common Problems

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| `PrismaClientValidationError: take expected Int, got String` | Query params not coerced | `z.coerce.number()` in schema; `Object.defineProperty` in `validate.ts` |
| `Cannot set property query of #<IncomingMessage>` | Direct assignment to `req.query` in Express 5 | Use `Object.defineProperty` |
| `JWT expiresIn type error` | `jsonwebtoken` expects `StringValue` | Cast `expiresIn` to `any` |
| DB connection refused on 5432 | Local PostgreSQL already using port | Use `5433` (dev) or `5434` (test) |
| Docker container not starting | Volume stale or port conflict | `docker-compose down -v` then `up -d` |
| TypeScript errors about missing fields | Prisma client not regenerated | `npx prisma generate` |
| `EPERM` on `prisma generate` | Node process holds the query engine DLL | `Get-Process node \| Stop-Process -Force` first |
| Admin endpoints return 403 | Token lacks ADMIN role | Login as `admin@qafzly.com / Admin@123456` |
| `migrate status` shows missing migrations | `_prisma_migrations` has stale rows | `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` then `migrate deploy` + re-seed |
| `migrate dev` generates `DROP DEFAULT` on tsvector | Prisma bug | `--create-only` + edit + `npm run check:migrations` |
| Search returns 500 `column does not exist` | Migration not applied | `npx prisma migrate deploy` |
| Search returns 500 `Failed to deserialize tsvector` | `SELECT *` in raw query | Select explicit columns |
| Recommendations `/trending` or `/related` returns 500 | Same `SELECT *` trap (S13 fix) | Confirm `recommendation.service.ts` selects only `id` + aggregate in raw SQL |
| `operator does not exist: text = uuid` (code 42883) | `::uuid` cast on a `text` parameter | Drop the cast; our IDs are `text`, not `uuid` |
| Refresh returns 400 `Bad "options.expiresIn"` | Decoded JWT passed to signing | Rebuild payload |
| `console.log` from dotenv spam | dotenv imported in a service | Check imports — only `env.ts` should import dotenv |
| Integration tests time out after 5s | Running under default Jest config | Use `npm run test:integration` |
| "Your test suite must contain at least one test" | Helper files picked up by default Jest | Exclude integration folder in `jest.config.js` |
| `dotenv -e .env.test` fails on PowerShell | Python `dotenv` shadowing JS | Use `npm run test:integration:migrate` |
| Seed creates users but daily quests are inactive | Old daily quests remain | Seed deletes and recreates them each run |
| Rate limiter doesn't fire on general routes | Redis unavailable + `RATE_LIMIT_FAIL_OPEN=true` | Set `RATE_LIMIT_FAIL_OPEN=false` to test |
| `?isFeatured=false` returns featured paths | `z.coerce.boolean()` bug | Use `optionalBooleanQuery` |
| Community post has no `author` field | Looking for `user` (old shape) | Use `post.author` (Sprint 12) |
| Votes don't highlight after click | `userVote` not on response | Ensure `optionalAuth` on list/detail; refetch after voting |
| Boss battle trainee tier unreachable | 3-question seed | Seed now has 5 questions; all tiers reachable |
| Boss battle badge not saved | Old stub behavior | Fixed in Sprint 12 — badges persist |
| Payment reference code starts with `PAY-` | Old format (pre-S13) | New rows must be `QFZ-`. If you see `PAY-`, check the seed didn't regenerate old rows and confirm `generateReferenceCode` was updated |
| Weekly summary job runs on the wrong day | Hardcoded UTC offset | Confirm it uses `Intl.DateTimeFormat` with `timeZone: 'Africa/Cairo'` — never hardcoded offsets |
| Weekly summary duplicates in one week | Dedupe window bypassed | Confirm `lastWeeklySummaryAt` check is present AND the per-user write succeeds. Check `markDigestSent` logs for silent failures |
| Weekly summary send fails for one user and stops the batch | Missing `Promise.allSettled` | Confirm `runWeeklySummaryJob` uses `Promise.allSettled`, not `Promise.all` |
| `docker exec -it` hangs in PowerShell | TTY allocation not supported | Drop `-t` for one-shot commands |

---

## 15. Repository State (End of Sprint 13)

- **Branch:** `main`
- **Last commit:** Sprint 13 complete — recommendation refinement (P0 tsvector + type-cast fixes, unified `Path[]` shape, skill-matched cold-start, category-weighted warm-start, deterministic tie-breakers), payment contract polish (`QFZ-` codes, Decimal string amount, seed payment requests), weekly summary cron (Monday 08:00 Cairo, DST-aware, in-app + email).
- **Migration history:** 6 migrations (last: `add_weekly_summary_fields`)
- **Swagger UI:** Sprint 12 endpoints documented. Sprint 13 additions pending a same-day docs commit (recommendations shape, payment `amount` type, `QFZ-` example, `weekly_summary` notification type).
- **Test status (Sprint 13 close):**
  - Unit: **~518 passing**, service-layer coverage ~93% statements / ~85% branches
  - Integration: **~93/93 passing**
- **Backend MVP:** ✅ Feature-complete for UAT; Community contract fully aligned; recommendation surface stable; payment contract ready for frontend Task #9; retention loop (weekly digest) in place.

### Recent Major Commits

**Sprint 13:**
```
feat: recommendation refinement — unified Path[] shape, skill-matched cold-start,
      category-weighted warm-start, deterministic tie-breakers
fix: recommendations SELECT * against tsvector columns (P0)
fix: recommendation raw SQL text = uuid mismatch
fix: enrolled paths excluded from all recommendation fallback stages
feat: payment contract polish — Decimal string amount, QFZ- reference codes
feat: seed payment requests (PENDING / ACTIVATED / REJECTED)
feat: weekly summary cron — Monday 08:00 Cairo, in-app + email, DST-aware
feat: weekly summary digest fields (9) with batch aggregation
test: recommendation integration file (13 tests, 2 P0 regression guards)
test: weekly summary unit coverage (29 tests)
test: payment retry logic + reference-code regex
```

**Sprint 12:**
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

## 16. Contact

For questions, contact the Project Manager. For AWS-related items, coordinate with the AWS Solution Architect.

**Before making changes:** read this document, read `HANDOFF.md` §6 (Prisma bug), run the project locally, run the test suite.

**Standing rules established since Sprint 11:**
- Never run bare `npx prisma migrate dev`.
- Never `SELECT *` against `paths` or `forum_posts`.
- Never cast `text` parameters with `::uuid`.
- Never accept `isCorrect` / `completed` from the client.
- Never use `z.coerce.boolean()`.
- Never hardcode UTC offsets for Cairo time.
- `jest.resetAllMocks()` requires re-establishing persistent defaults.
- Non-blocking side effects always wrapped in try/catch + log.

---

**End of Developer Onboarding Document**