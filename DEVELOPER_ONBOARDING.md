# 📄 Qafzly Backend – Developer Onboarding & Progress Report

**Date:** September 12, 2026
**Prepared by:** Senior Backend Engineer
**Purpose:** To provide the incoming developer with a thorough understanding of the project, its current state, development conventions, and guidance for continuing work.

---

## 1. Project Snapshot

| Aspect | Detail |
|--------|--------|
| **Current Phase** | ✅ Sprint 11 Complete – Backend ready for UAT. Awaiting AWS Solution Architect for staging deployment. |
| **Repository** | Private GitHub repo (ask Project Manager for access) |
| **Core Stack** | Node.js 20 LTS, TypeScript 5.5, Express 5, Prisma 6.19.0 (pinned), PostgreSQL 15, Redis |
| **Architecture** | `routes → controllers → services` |
| **Testing** | Jest (unit) + Supertest (integration). **361 unit tests** passing, **22 integration tests** passing. Service-layer coverage ~93%. |
| **API Docs** | Swagger UI at `/api-docs` (fully documented, includes certificates) |
| **Email** | AWS SES (`@aws-sdk/client-ses`). Non-throwing; sandbox mode in dev. |
| **Background Jobs** | Payment expiration cron (every 5 minutes, Redis-locked leader election) |

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
                            # users, categories, paths, modules, lessons, slides,
                            # checkpoints, boss battle, enrollment, progress,
                            # badges, quests
npm run dev                 # start server
```

**Verification after setup:**
```bash
npx tsc --noEmit                  # expect silent
npm test -- --coverage            # expect 361 passing
npm run test:integration          # expect 22 passing (Docker required)
```

### 2.3 Important Ports

| Service | Host Port | Container Port | Notes |
|---------|-----------|----------------|-------|
| PostgreSQL (dev) | **5433** | 5432 | Port 5432 was already in use by local PostgreSQL, so we chose 5433 to avoid conflict |
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
├── index.ts                    # Entry: connect DB/Redis, start server, background jobs,
│                               # graceful shutdown handlers (SIGTERM/SIGINT)
├── app.ts                      # Express app — middleware chain, health checks,
│                               # rate limiter, routes, Swagger, static uploads
├── config/
│   ├── env.ts                  # Zod-validated environment variables
│   ├── database.ts             # Prisma client singleton
│   ├── redis.ts                # Redis client singleton
│   ├── sesClient.ts            # AWS SES client + sendSesEmail helper       [NEW §6]
│   ├── logger.ts               # Pino logger (JSON output, pretty in dev)
│   └── swagger.ts              # OpenAPI 3.0 definition (all endpoints)
├── middleware/
│   ├── authenticate.ts         # JWT verification — attaches payload to req.user
│   ├── optionalAuth.ts         # Attaches req.user if present, does not reject [NEW §6]
│   ├── authorize.ts            # Role-based access (ADMIN, PARENT)
│   ├── errorHandler.ts         # Central error handler
│   ├── validate.ts             # Zod validation (Express 5 compatible)
│   ├── rateLimiter.ts          # Redis-backed factory + general instance    [REWRITTEN §6]
│   ├── authRateLimiter.ts      # Uses factory, 10/min per IP per endpoint   [REWRITTEN §6]
│   └── idempotency.ts          # Idempotency-Key middleware                 [NEW §6]
├── utils/
│   ├── asyncHandler.ts         # Wraps async controllers to catch errors
│   ├── AppError.ts             # Custom error class with statusCode + metadata
│   ├── apiResponse.ts          # Standard JSON response formatter
│   ├── token.ts                # JWT generate/verify (access & refresh)
│   ├── upload.ts               # Multer config for avatar upload (local)
│   ├── uploadPdf.ts            # Multer config for PDF upload (memory)
│   ├── youtube.ts              # YouTube ID extraction
│   └── validators/             # Zod schemas (one per feature) — 21 files
├── services/                   # Business logic — no HTTP concerns
│   ├── certificate.service.ts        # Auto-issue, verify, revoke          [NEW §6]
│   ├── certificatePdf.service.ts     # PDFKit + Arabic shaping             [NEW §6]
│   └── certificateStorage.service.ts # Storage abstraction (local/S3)      [NEW §6]
├── controllers/                # Extract request data, call service, respond
├── routes/                     # Endpoint definitions
│   └── index.ts                # Mounts all routers (now includes /certificates)
├── jobs/                       # Background cron jobs                       [NEW DIR §6]
│   └── paymentExpiry.job.ts
├── types/
│   ├── express.d.ts            # Extends Express Request with `user`
│   └── arabic-persian-reshaper.d.ts                                       [NEW §6]
└── prisma/
    ├── schema.prisma           # Single source of truth for DB models
    ├── migrations/             # 2 migrations (rebased in Sprint 11)       [§6]
    └── seed.ts                 # Seed script (extended in Sprint 11)

scripts/                                                                    [NEW DIR §6]
└── check-migrations.js          # Prisma generated-column bug guard
```

Test directories:
```
src/
├── services/__tests__/                 # Unit tests (Prisma/Redis mocked)
├── middleware/__tests__/               # Middleware unit tests               [NEW §6]
│   ├── rateLimiter.test.ts
│   └── idempotency.test.ts
├── jobs/__tests__/                     # Job unit tests                      [NEW §6]
│   └── paymentExpiry.job.test.ts
└── __tests__/integration/              # Integration tests (real DB/Redis)
    ├── env.setup.ts                    # Loads .env.test before any module
    ├── setup.ts                        # Migrations, seed, cleanup
    ├── auth.test.ts
    ├── user.test.ts
    ├── enrollment.test.ts
    ├── progress.test.ts
    ├── gamification.test.ts
    ├── payments.test.ts
    ├── forum.test.ts
    ├── search.test.ts
    └── health.test.ts
```

### 3.2 Request Lifecycle

1. **Route** matches URL and method.
2. **Middleware** chain executes (helmet, CORS, body parsing, health checks, rate limiter, then route-level auth/validation/idempotency).
3. **Controller** extracts validated data from `req.body`, `req.query`, `req.params`, calls the service.
4. **Service** performs business logic and database operations via Prisma.
5. **Controller** formats the response with `apiResponse()` and sends.
6. **Central error handler** catches any thrown `AppError` and converts to JSON.

### 3.3 Graceful Shutdown Sequence

When `SIGTERM` or `SIGINT` fires (or `uncaughtException`):

1. Set `shuttingDown` flag (ignore repeat signals)
2. Start 15-second force-exit timer
3. Stop background jobs (`stopPaymentExpiryJob()`)
4. Close HTTP server — wait for in-flight requests to drain
5. `prisma.$disconnect()`
6. `redis.quit()`
7. Clear force-exit timer, `process.exit(0)`

If drain exceeds 15 seconds, `process.exit(1)` regardless.

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
  "meta": null   // pagination info if applicable
}
```

Use `apiResponse(res, statusCode, data, message, errors, meta)`.

### 4.2 Error Handling

- Throw `new AppError(statusCode, message)` in services/controllers.
- Validation errors are automatically caught by `validate` middleware and produce a 400 with Arabic messages.
- Unknown errors are logged and return a generic 500.

### 4.3 Validation

- Define Zod schemas in `src/utils/validators/`.
- Use `validate(schema)` middleware in routes.
- The middleware **mutates** `req.body`, `req.query`, `req.params` with the parsed values.
- **Important:** Due to Express 5, `req.query` and `req.params` are getter-only. The middleware uses `Object.defineProperty` to reassign them. **Do not** change this back to direct assignment.

### 4.4 Authentication

- JWT access token (15 min) in `Authorization: Bearer <token>`.
- Refresh token (7 days) stored in Redis with key `refresh_token:<userId>`.
- Account lockout after 5 failed attempts, for 15 minutes, tracked in Redis.
- **Refresh token handling:** rebuild the payload as `{ userId, email, role }` before calling `generateAccessToken`. Passing the decoded JWT (which includes `exp`/`iat`) causes a `Bad "options.expiresIn"` error.
- **Optional auth:** `optionalAuth` middleware attaches `req.user` if a valid Bearer token is present and silently continues as anonymous otherwise. Used on public endpoints that enrich their response for logged-in users (e.g., lesson list).

### 4.5 Database Access

- Use Prisma Client only within services.
- Never access `prisma` directly in controllers.
- **Migration workflow — see §6.** Never run bare `migrate dev`.
- All queries must consider soft-deleted records (`deletedAt: null`) unless explicitly for admin.

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

### 4.7 Testing Conventions

- **Unit tests** live alongside source in `__tests__/` subfolders. Mock Prisma, Redis, AWS SDK clients, and PDFKit.
- **Integration tests** live in `src/__tests__/integration/`. Use `supertest` and real services backed by isolated Docker containers.
- Any new endpoint or business-logic change must:
  - Have unit tests for the service layer.
  - Have integration coverage for at least the happy path if it's a critical flow.
- **Do not** place helper files in `src/__tests__/integration/` without registering them in Jest config (`setupFiles` / `setupFilesAfterEnv`), otherwise Jest will treat them as test suites.

### 4.8 Email Sending

- **`sendEmail` is non-throwing.** It catches all errors, logs them, and returns. Never propagate an email failure into a request handler.
- Dev: leave `AWS_ACCESS_KEY_ID` empty to trigger the `[DEV] Would send email to ...` short-circuit.
- Test: `NODE_ENV === 'test'` short-circuits to `Test mode: email sending skipped.`
- Production: requires verified SES identity + IAM credentials (or IAM role).

---

## 5. Implemented Features (Sprint 1–10)

*(Reference material — full endpoint tables are in `README.md`. This section is a condensed map.)*

### 5.1 Authentication (Sprint 1)
Register, login, refresh, logout, forgot/reset password. JWT + bcrypt (12 rounds). Redis rate limiting (10 req/min on auth endpoints) + account lockout.

**Registration now also:** auto-creates `UserStats` and assigns active daily quests — all inside a single transaction. Prevents the "empty dashboard" state for fresh users.

### 5.2 User Management (Sprint 2)
Self-profile CRUD, privacy settings, avatar upload/removal (local storage). Admin user management with role and suspend/activate controls.

### 5.3 Path Core (Sprint 3)
Categories, paths, modules, lessons CRUD. Enrollment and progress tracking.

**Lesson access control (Sprint 11):**
- Preview lessons (`isPreview: true`) accessible to everyone (including anonymous).
- Non-preview lessons require an active enrollment in the parent path.
- Admins bypass.
- List endpoint returns `isAccessible: boolean` per lesson; detail endpoint returns `access.reason`.

### 5.4 Gamification (Sprint 4)
XP, 50-level curve, badges, leaderboards (global + path), streaks, daily quests.

**Response shape was rewritten in Sprint 11** to match the Student Dashboard spec:
- `totalXp`, `level`, `currentLevelXp`, `nextLevelXp`, `rank`, `badges[]` with `nameAr` + `nameEn`.
- Daily quests use `xpAward` (not `xpReward`).
- Streak response includes `lastActivityDate`.
- Streak is auto-updated on lesson completion.

### 5.5 Manual Payments (Sprint 5)
Payment request flow via Vodafone Cash / InstaPay. Admin activates/rejects manually.

**Sprint 11 additions:**
- `Idempotency-Key` header support on `POST /payments/requests`.
- Background cron auto-expires `PENDING` requests past `expiresAt`.
- `VERIFIED` requests are **not** auto-expired.
- Email sending no longer blocks request creation.

### 5.6 Community (Sprint 6)
Forum categories, posts, comments, polymorphic voting, best answer, search, admin moderation.

### 5.7 Notifications (Sprint 7)
In-app notifications with filters, device tokens, admin broadcast. Email via SES (was SendGrid). Push notifications are logged placeholders (Firebase integration pending).

### 5.8 Search & Recommendations (Sprint 8)
Global search across paths/forum/users. Popular, trending, related, personalized path recommendations.

**Implementation notes:**
- Uses `plainto_tsquery(${q}::regconfig)` against generated `tsvector` columns.
- Raw SQL always selects explicit columns — `SELECT *` breaks Prisma's `tsvector` deserialization.
- Generated columns declared as `Unsupported("tsvector")?` in `schema.prisma`.

### 5.9 Parent-Child & Lesson Enhancements (Sprint 9)
Self-referential parent-child relations, `ChildSettings` for lock override, 12-hour lock logic based on previous lesson completion. S3 signed PDF URLs (5 min expiry) for lesson PDFs. YouTube ID validation.

### 5.10 Enhanced Content (Sprint 10)
Slides (5 types: `INFO`, `QUIZ`, `DRAG_DROP`, `TRUE_FALSE`, `FILL_BLANK`), quest checkpoints, boss battles, XP recharge boost window.

---

## 6. Sprint 11 Progress — Completed

### 6.1 Integration Test Infrastructure

- **Isolated Docker setup** (`docker-compose.test.yml`) — Postgres `5434`, Redis `6380`.
- **`jest.integration.config.js`** with `setupFiles` + `setupFilesAfterEnv`.
- **Dedicated `.env.test`** (git-ignored).
- **22 tests passing** across 9 files.
- **Scripts:** `test:integration`, `test:integration:up`, `test:integration:migrate`, `test:integration:down`.

### 6.2 Critical Production Fixes

Discovered by the new integration suite. Each was a genuine UAT blocker.

| # | Bug | Fix |
|---|-----|-----|
| 1 | `/enrollments` returned 404 for all paths | Added router mount to `src/routes/index.ts` |
| 2 | `/moderation` broken | Added missing leading slash |
| 3 | `/payment` vs `/payments` mismatch | Renamed to `/payments` |
| 4 | Auth refresh failed with `Bad "options.expiresIn"` | Rebuild payload before signing |
| 5 | Search returned 500 with `tsvector` deserialization | Explicit column selection + `plainto_tsquery` |

### 6.3 Redis Rate Limiter

Factory-pattern middleware replacing the old in-memory limiter.

- **`createRateLimiter({ windowMs, max, keyPrefix, keyGenerator, skipOnError })`**
- **Key strategy:** `userId` when authenticated, IP otherwise (CGNAT-friendly for Egyptian mobile)
- **Auth limiter:** 10 req/min per IP per endpoint
- **General limiter:** 100 req/min (configurable via env)
- **Fail-open** on Redis outage (`RATE_LIMIT_FAIL_OPEN`)
- **Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` on 429
- **Excluded:** `/health`, `/health/live`, `/health/ready`, `/api-docs`, `/uploads`
- **6 unit tests**

### 6.4 Payment Expiration Cron + Graceful Shutdown + Health Split

- **`src/jobs/paymentExpiry.job.ts`** — every 5 min, flips `PENDING → EXPIRED`
  - Redis lock `cron:payment_expiry:lock` (55s TTL) for multi-instance leader election
  - Fail-open on Redis outage (idempotent `updateMany`)
  - `startPaymentExpiryJob()` / `stopPaymentExpiryJob()` lifecycle
  - 6 unit tests
- **Graceful shutdown in `src/index.ts`** — SIGTERM/SIGINT handlers with 15s force-exit
- **Health split:**
  - `/health/live` — always 200
  - `/health/ready` — 200 if Postgres + Redis reachable, 503 otherwise
  - `/health` — backwards-compat alias for `/health/live`

### 6.5 Idempotency-Key on `POST /payments/requests`

- **`src/middleware/idempotency.ts`** — reusable factory
- 24h cache of 2xx responses per `(userId, key)`
- `SET NX` in-flight marker prevents concurrent duplicates (returns `409`)
- Error responses not cached — lock released for retry
- Fail-open on Redis unavailability
- **8 unit tests**

### 6.6 AWS SES Migration

- **`src/config/sesClient.ts`** — `SESClient` + `sendSesEmail` helper
- **`sendEmail` is now non-throwing** — email failures no longer cascade into 500s on payment request creation
- **Sandbox mode** — no domain verification yet; empty `AWS_ACCESS_KEY_ID` triggers dev short-circuit
- **Removed:** `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `@sendgrid/mail` dependency
- **Added:** `SES_FROM_EMAIL`

### 6.7 Preview Lesson Access Control

- **`src/middleware/optionalAuth.ts`** — attaches `req.user` if token present, doesn't reject if absent
- **Access rule:** preview OR enrolled OR admin → access; otherwise 403
- **`GET /lessons`** — always lists all, marks each with `isAccessible`
- **`GET /lessons/:id`** — enforces access; response includes `access.reason`
- **10 unit tests** + manual verification

### 6.8 Certificate Generation

- **New model `Certificate`** — unique per `(userId, pathId)`, Base32 code, JSON metadata snapshot, revocation fields
- **Auto-issue** — hooked into `progress.service.ts` after `completed: true` lessons. Idempotent, non-blocking, best-effort
- **PDF generation** — A4 landscape via `pdfkit` + Noto Naskh Arabic + `arabic-persian-reshaper`
- **Storage abstraction** — `certificateStorage.service.ts` (local today, S3 swap later)
- **6 endpoints:** list, detail, download, public verify, admin issue, admin revoke
- **Email template** — Arabic, RTL, gold-branded
- **15 unit tests** + Swagger

### 6.9 Frontend Student Dashboard Fixes

Response shapes now match the Student Dashboard spec exactly.

| Endpoint | Change |
|----------|--------|
| `GET /gamification/me` | `totalXp`, `currentLevelXp`, `nextLevelXp`, `rank`, `badges[]` with `nameAr` + `nameEn` |
| `GET /gamification/me/streak` | Adds `lastActivityDate` |
| `GET /gamification/daily-quests` | `xpReward` → `xpAward`; adds `titleAr`, `descriptionAr` |
| `GET /enrollments/me/enrollments` | Adds `progress` (0-100), `currentLesson`, `pathTitleAr`/`pathTitleEn` |
| `GET /gamification/leaderboard?scope=global` | Adds `userId`, `level` per entry |

**Auto-streak**: updated on lesson completion per spec §3.4 (same-day no-op, yesterday +1, gap > 1 day → reset to 1). Non-blocking.

**`Badge.nameEn`** added to schema.

**Seed additions**: `test-student@qafzly.com` + 5 leaderboard fillers.

### 6.10 Migration History Rebasing

The pre-existing migration history was broken — a migration named `add_search_vector_columns` actually **dropped** the tsvector columns and indexes it claimed to add. This is a confirmed, still-open Prisma bug ([#24496](https://github.com/prisma/prisma/issues/24496), [#15654](https://github.com/prisma/prisma/issues/15654)).

**Fix:** rebased to a single baseline `20260911203608_initial_schema` + `20260911212808_add_badge_name_en`.

**Workflow — see §6 of `HANDOFF.md` for full detail.** Short version:

```bash
npx prisma migrate dev --create-only --name <desc>
# audit the generated migration.sql, delete forbidden lines (see §6 of HANDOFF)
npm run check:migrations
npx prisma migrate deploy
```

**Never run bare `npx prisma migrate dev`.**

### 6.11 Test Counts

| Suite | Before | After |
|-------|--------|-------|
| Unit | 306 | **361** |
| Integration | 0 | **22** |
| Total | 306 | **383** |

New coverage:
- `jobs/paymentExpiry.job.ts` — 93%
- `middleware/rateLimiter.ts` — 97%
- `middleware/idempotency.ts` — 94%
- `services/certificate.service.ts` — 70%
- `services/certificatePdf.service.ts` — 16% (rendering-heavy)
- `services/certificateStorage.service.ts` — 40%

---

## 7. Database Schema Highlights

- **User** — extended with `displayName`, `timezone`, `lastLoginAt`, `privacySettings` (JSON), `parentId`, `children`, `childSettings`, `certificates`
- **Role enum:** `STUDENT`, `PARENT`, `ADMIN` (no `INSTRUCTOR` since Sprint 9)
- **ChildSettings:** `lockOverrideEnabled`, `customLockDurationHours`
- **Soft delete:** `deletedAt` timestamp on `User`, `Path`, `ForumPost`, `ForumComment` — always filter `deletedAt: null` in public queries
- **Path models:** `Path`, `CourseCategory`, `Module`, `Lesson`, `QuizQuestion`, `Enrollment`, `LessonProgress`
- **Lesson** — content fields, lock fields, recharge fields (`rechargeMessageAr/En`, `rechargeXpBoost`, `rechargeBoostMultiplier`, `rechargeBoostWindowHours`), warm-up (`warmUpJson`), mini-quest (`miniQuestJson`)
- **Enhanced Content:** `Slide`, `QuestCheckpoint`, `BossBattle`, `BossBattleQuestion`, `UserSlideProgress`, `UserQuestProgress`, `UserBossBattleProgress`
- **Gamification:** `UserStats`, `Badge` (now with `nameEn`), `UserBadge`, `XpAuditLog`, `Quest`, `UserQuest`
- **Community:** `ForumCategory`, `ForumPost`, `ForumComment`, `ForumVote` (polymorphic via `targetType` + `targetId`)
- **Payments:** `Subscription`, `Purchase`, `PaymentRequest` with `PaymentRequestStatus` enum
- **Notifications:** `Notification`, `DeviceToken`, `NotificationTemplate`
- **Certificates:** `Certificate` with `certificateCode` (unique), `metadata` JSON snapshot, `revokedAt` + `revokedReason`
- **Search vectors:** `paths` and `forum_posts` have generated `tsvector` columns (`search_vector_ar`, `search_vector_en`) declared as `Unsupported("tsvector")?` in Prisma. Trigram indexes for fuzzy matching.
- **All models use UUID primary keys.**

Full schema in `prisma/schema.prisma`.

---

## 8. Testing Strategy

### 8.1 Unit Tests

- **Location:** `src/services/__tests__/`, `src/middleware/__tests__/`, `src/jobs/__tests__/`
- **Mocks:** Prisma, Redis, AWS SES client, AWS S3 client, PDFKit
- **Run:** `npm test -- --coverage`
- Controllers are not unit-tested (thin wrappers).
- Seed script has `// @ts-nocheck` (acceptable for standalone scripts).

**Current status:** 361 passing. Service-layer coverage ~93% statements, ~82% branches, ~97% functions.

### 8.2 Integration Tests

- **Location:** `src/__tests__/integration/`
- Uses `supertest` against the real Express app.
- Real Postgres + Redis in isolated Docker containers.
- Migrations and seed run automatically in `setup.ts`.
- **Run:** `npm run test:integration`
- **Current status:** 22/22 passing.

**Requirements:**
- `.env.test` in project root (see `README.md` for full template).
- Docker Desktop running.

**Key conventions when adding integration tests:**
- Never place helper files in the integration folder without registering them in Jest config (`setupFiles` / `setupFilesAfterEnv`). Otherwise Jest will treat them as suites.
- Use unique emails per test to avoid collisions: `` `test_${Date.now()}@example.com` ``.
- Use seeded admin credentials for admin-only endpoints: `admin@qafzly.com / Admin@123456`.
- Don't rely on insertion order of seeded data — fetch IDs from the DB via `prisma`.
- Each test file should set up its own state; do not depend on execution order.

### 8.3 Which Tests Should I Add?

| Change | Required tests |
|--------|----------------|
| New service method | Unit test(s) in `src/services/__tests__/` |
| New middleware | Unit test(s) in `src/middleware/__tests__/` |
| New background job | Unit test(s) in `src/jobs/__tests__/` |
| New endpoint on a critical flow | Integration test in `src/__tests__/integration/` |
| Bug fix | Regression test that would have caught the bug |
| New feature | Unit + integration where user-visible |

---

## 9. Known Issues & Gotchas

### Prisma & Migrations

1. **Never run bare `npx prisma migrate dev`.** See §6 of `HANDOFF.md`.
2. **Prisma pinned to 6.19.0.** Do not upgrade — pending upstream fix.
3. **`Unsupported("tsvector")` columns:** do not remove their declarations from `schema.prisma`, or Prisma will drop them.
4. **`SELECT *` in raw SQL breaks search** — always select explicit columns when touching `paths` or `forum_posts`.
5. **`EPERM: operation not permitted`** on `prisma generate` — a Node process is holding the query engine DLL. `Get-Process node | Stop-Process -Force` first.
6. **`Failed to deserialize column of type 'tsvector'`** — same as #4.

### Runtime

7. **Express 5 getter-only `req.query`/`req.params`** — use `Object.defineProperty` (already handled in `validate.ts`).
8. **JWT `expiresIn` type error** — cast `as any` in `token.ts`.
9. **Refresh token payload** — rebuild as `{ userId, email, role }` before signing.
10. **Prisma `take expected Int, got String`** — ensure `z.coerce.number()` in query schemas.

### Data Model

11. **Soft deletes everywhere** — filter `deletedAt: null` in public queries.
12. **`VERIFIED` payment requests are never auto-expired** — intentional.
13. **Parent-child linking** — `ChildSettings` enforces uniqueness; delete settings on unlink.
14. **Streak freeze** — decrements token; doesn't validate the freeze is within the streak window (known limitation).
15. **Level formula** — `threshold(N) = 50·N·(N-1)`. **Changed in Sprint 11.** Do not revert to `N·(N+1)·5`.
16. **Forum votes** — polymorphic; always specify `targetType` and `targetId`.

### Windows / Local Dev

17. **Git ownership:** `git config --global --add safe.directory D:/Career/Qafzly`
18. **PowerShell `-it` with Docker** — hangs. Use `docker exec <container> <cmd>` without `-it` for one-shot commands.
19. **PowerShell `curl`** — aliases `Invoke-WebRequest`. Use `curl.exe` for real curl.
20. **`dotenv -e .env.test`** on PowerShell — Python `dotenv` may shadow the JS one. Use `npm run test:integration:migrate` or `npx dotenv-cli`.
21. **Docker Compose `version:` warning** — harmless; can be removed from `docker-compose.test.yml`.

### Testing

22. **`npm run test:integration`** requires `.env.test` and Docker. Containers are torn down automatically.
23. **Jest `testMatch`** — default `jest.config.js` excludes `src/__tests__/integration/`. Integration tests use `jest.integration.config.js`.
24. **"Your test suite must contain at least one test"** — helper files in `__tests__/integration/` picked up by default Jest. See #23.

### Search

25. **`plainto_tsquery` not `websearch_to_tsquery`** — the latter isn't available in all Postgres builds.
26. **Regconfig cast required:** `plainto_tsquery(${q}::regconfig)`.

---

## 10. Next Steps

### 10.1 Actionable Now (No External Dependency)

1. **Docs sweep** — final pass on all `.md` files (mostly done)
2. **Search service branch coverage** — 59.5% → ≥80%
3. **Controller unit tests** — fill the last remaining 0% coverage area
4. **Integration test expansion** — Slides, Quests, Boss Battle, Recharge, Notifications, Parent, Admin Moderation, PDF
5. **Bulk enrollment endpoint** — enterprise feature
6. **Recommendation refinement** — tie-breaking + popular fallback for new users
7. **Seed data cleanup** — non-zero-price path for realistic payment testing
8. **Weekly summary cron** — fills partial R168 requirement

### 10.2 AWS-Gated (Waiting on Solution Architect)

1. **S3 avatar upload** — reuse `s3.service.ts`
2. **SES production access** — verify `qafzly.com` domain, exit sandbox
3. **Staging deployment** — ECS vs EC2 decision → CI/CD pipeline
4. **Secrets management** — migrate from env files to AWS Secrets Manager
5. **CloudWatch monitoring** — ship Pino logs to CloudWatch Logs

### 10.3 Firebase-Gated

1. **Push notifications** — replace logging placeholder in `notification.service.ts`

### 10.4 Beyond Sprint 11 (Post-MVP)

- Voice support in parent dashboard (Phase 2)
- PayMob integration (replaces manual payments)
- OAuth 2.0 (Google / Facebook / Apple)
- Webhooks
- Live sessions (Zoom / Meet)
- Offline mode
- 2FA
- Native mobile apps (PWA is the MVP)

---

## 11. Troubleshooting Common Problems

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
| `migrate dev` generates `DROP DEFAULT` on tsvector | Prisma bug (§6 HANDOFF) | `--create-only` + edit + `npm run check:migrations` |
| Search returns 500 `column does not exist` | Migration not applied | `npx prisma migrate deploy` |
| Search returns 500 `Failed to deserialize tsvector` | `SELECT *` in raw query | Select explicit columns |
| Refresh returns 400 `Bad "options.expiresIn"` | Decoded JWT (with `exp`) passed to signing | Rebuild payload as `{ userId, email, role }` |
| `console.log` from dotenv spam | `import 'dotenv/config'` leaked into a service | Check imports — dotenv should only be in `env.ts` |
| Integration tests time out after 5s | Running under default Jest config | Use `npm run test:integration` |
| "Your test suite must contain at least one test" | Helper files picked up by default Jest | Exclude integration folder in `jest.config.js` |
| `dotenv -e .env.test` fails on PowerShell | Python `dotenv` shadowing JS | Use `npm run test:integration:migrate` or `npx dotenv-cli` |
| Seed creates users but daily quests are inactive | Old daily quests remain | Seed deletes and recreates them each run |
| Rate limiter doesn't fire on general routes | Redis unavailable + `RATE_LIMIT_FAIL_OPEN=true` | Set `RATE_LIMIT_FAIL_OPEN=false` in `.env` to test |
| Payment request returns 500 with SendGrid error | Old SendGrid import somewhere | Search for `@sendgrid` — SES migration should have removed all |
| `docker exec -it` hangs in PowerShell | TTY allocation not supported | Drop `-t` for one-shot commands |

---

## 12. Repository State (End of Sprint 11)

- **Branch:** `main`
- **Last commit:** Sprint 11 complete — integration test suite, all critical fixes, Redis rate limiter, payment cron, idempotency, SES migration, preview access control, certificate generation, frontend dashboard fixes, migration rebasing.
- **Migration history:** 2 migrations (rebased baseline + badge nameEn)
- **Swagger UI:** all endpoints documented, including certificates
- **Test status:**
  - Unit: **361 passing**, service-layer coverage ~93%
  - Integration: **22/22 passing**
- **Backend MVP:** ✅ Feature-complete for UAT

---

## 13. Contact

For questions, contact the Project Manager. For AWS-related items, coordinate with the AWS Solution Architect (kickoff scheduled).

**Before making changes:** read this document, read `HANDOFF.md` §6 (Prisma bug), run the project locally, run the test suite.

---

**End of Developer Onboarding Document**
````

---

## What Changed vs. the Previous DEVELOPER_ONBOARDING

### Header
- Date: Sep 11 → **Sep 12, 2026**
- Prepared by: Team Falcon → Senior Backend Engineer

### §1 Project Snapshot
- Current Phase: "Sprint 11 in progress" → **"Sprint 11 Complete"**
- Added rows for Email (SES) and Background Jobs
- Test counts: 306+ → **361 unit**, kept 22 integration

### §2 Setup
- Changed `migrate dev` → `migrate deploy` + warning note
- Added verification commands block after setup
- Added Prisma Studio port

### §3 Architecture
- Added: `sesClient.ts`, `optionalAuth.ts`, `idempotency.ts`, `jobs/`, `scripts/`, all certificate files, `arabic-persian-reshaper.d.ts`, `uploadPdf.ts`
- Marked rewritten files: `rateLimiter.ts`, `authRateLimiter.ts`
- Added test directories: `middleware/__tests__/`, `jobs/__tests__/`
- **New §3.3:** Graceful Shutdown Sequence

### §4 Conventions
- §4.4 Auth: added refresh payload rebuild + optionalAuth
- §4.5 Database: migration warning
- **§4.6 NEW:** Idempotency middleware
- **§4.7 NEW:** Email sending behavior
- Renumbered §4.6 → §4.7 (Testing)

### §5 Implemented Features
- §5.1 Registration: added transaction note
- §5.3 Lessons: added access control subsection
- §5.4 Gamification: full rewrite for new response shape + level formula change
- §5.5 Payments: added idempotency + auto-expiration + non-blocking email
- §5.8 Search: added implementation notes
- §5.9: added S3 PDF details

### §6 Sprint 11 Progress
- Rewrote entirely. Old version had 6.1 "Completed" + 6.2 "Remaining". New version has 11 detailed subsections covering everything done, no "Remaining" (all done). The "Remaining" items moved to §10.

### §7 Database Schema
- Added `Badge.nameEn`, `Certificate` model
- Added `certificates` relation on User
- Clarified soft-delete fields

### §8 Testing Strategy
- Unit test counts updated (306 → 361)
- New §8.3 "Which Tests Should I Add?" table (was missing)

### §9 Known Issues
- Restructured into categories: Prisma, Runtime, Data Model, Windows, Testing, Search
- Added: Prisma bug, `EPERM`, PowerShell `-it` hang, level formula change, `VERIFIED` never expires, `plainto_tsquery`
- Removed: "SendGrid not set", "Rate limiter in-memory", "No automatic expiration" (all resolved)

### §10 Next Steps
- Rewrote to reflect what's actually left
- Split into: Actionable / AWS-gated / Firebase-gated / Post-MVP

### §11 Troubleshooting
- Added 8 new rows: `EPERM`, migration drift, `DROP DEFAULT` bug, PowerShell `-it` hang, SendGrid residue, rate limiter testing, dotenv spam

### §12 Repository State
- Updated test counts, migration count (5 → 2), status

---

## Verify & Commit

```powershell
code DEVELOPER_ONBOARDING.md
```

Scan the tables and headers. Then:

```
docs: update DEVELOPER_ONBOARDING for Sprint 11 completion

- Update project snapshot: Sprint 11 complete, 361 unit + 22 integration tests
- Change setup to use `migrate deploy` (bare `migrate dev` forbidden)
- Add graceful shutdown sequence to architecture section
- Add optionalAuth, idempotency, and email-sending conventions
- Rewrite Sprint 11 progress section with all shipped deliverables
- Update database schema with Certificate model and Badge.nameEn
- Update testing strategy with middleware and jobs unit test directories
- Restructure known issues by category (Prisma, runtime, data model, Windows)
- Rewrite next steps: actionable / AWS-gated / Firebase-gated / post-MVP
- Add 8 new troubleshooting rows