# 📄 Qafzly Backend – Developer Onboarding & Progress Report

**Date:** September 11, 2026  
**Prepared by:** Team Falcon  
**Purpose:** To provide the incoming developer with a thorough understanding of the project, its current state, development conventions, and guidance for continuing work.

---

## 1. Project Snapshot

| Aspect | Detail |
|--------|--------|
| **Current Phase** | Sprint 11 – UAT & Bug Fixing (in progress). Sprint 10 features complete. Integration test suite added and passing. |
| **Repository** | Private GitHub repo (ask for access) |
| **Core Stack** | Node.js, TypeScript, Express 5, Prisma, PostgreSQL, Redis |
| **Architecture** | services → controllers → routes |
| **Testing** | Jest (unit) + Supertest (integration). 306+ unit tests passing, 22 integration tests passing. Service layer coverage ~93%. |
| **API Docs** | Swagger UI at `/api-docs` (fully documented, recently updated) |

---

## 2. Development Environment

### 2.1 Prerequisites
- Node.js v20 LTS (recommended; v24 also works)
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
npx prisma migrate dev      # apply all migrations
npx ts-node prisma/seed.ts  # seed admin, parent, children, categories, paths, modules, lessons, slides, checkpoints, boss battle, enrollment, progress, badges, quests
npm run dev                 # start server
```

### 2.3 Important Ports

| Service | Host Port | Container Port | Notes |
|---------|-----------|----------------|-------|
| PostgreSQL (dev) | **5433** | 5432 | Port 5432 was already in use by local PostgreSQL, so we chose 5433 to avoid conflict |
| Redis (dev) | 6379 | 6379 | Standard |
| PostgreSQL (test) | **5434** | 5432 | Used only by integration tests via `docker-compose.test.yml` |
| Redis (test) | **6380** | 6379 | Used only by integration tests |
| API | 3000 | - | Express server |

---

## 3. Architecture Deep Dive

### 3.1 Folder Structure (with commentary)

```
src/
├── index.ts                 # Entry point – connects DB/Redis then starts server
├── app.ts                   # Express app – middleware, route mounting, Swagger, static files
├── config/
│   ├── env.ts               # Zod-validated environment variables (never access process.env directly)
│   ├── database.ts          # Prisma client singleton
│   ├── redis.ts             # Redis client singleton
│   ├── logger.ts            # Pino logger (JSON output, pretty in dev)
│   └── swagger.ts           # Swagger/OpenAPI definition (all endpoints documented)
├── middleware/
│   ├── authenticate.ts      # JWT verification – attaches payload to req.user
│   ├── authorize.ts         # Role-based access (ADMIN, PARENT)
│   ├── errorHandler.ts      # Central error handler (AppError, ZodError, unknown)
│   ├── validate.ts          # Zod validation – parses body/query/params, handles Express 5 getter issue
│   ├── rateLimiter.ts       # In-memory rate limiter (for general use – replace with Redis in prod)
│   └── authRateLimiter.ts   # Redis-backed rate limiter used on auth endpoints
├── utils/
│   ├── asyncHandler.ts      # Wraps async controllers to catch errors
│   ├── AppError.ts          # Custom error class with statusCode and metadata
│   ├── apiResponse.ts       # Standard JSON response formatter
│   ├── token.ts             # JWT generate/verify (access & refresh)
│   ├── upload.ts            # Multer config for avatar upload
│   ├── youtube.ts           # YouTube ID extraction utility
│   └── validators/          # Zod schemas (one per feature)
├── services/                # Business logic – no HTTP concerns
├── controllers/             # Extract request data, call service, send response
├── routes/                  # Define endpoints, bind middleware and controllers
│   └── index.ts             # Aggregates all routers
├── types/
│   └── express.d.ts         # Extends Express Request with `user`
└── prisma/
    ├── schema.prisma        # Single source of truth for DB models
    ├── migrations/          # Auto-generated migration files (5 migrations as of Sprint 11)
    └── seed.ts              # Seed script (full test data)
```

Test directories:
```
src/
├── services/__tests__/                 # Unit tests (Prisma/Redis mocked)
└── __tests__/integration/              # Integration tests (real DB/Redis)
    ├── env.setup.ts                    # Loads .env.test before any module
    ├── setup.ts                        # Migrations, seed, search-vector setup, cleanup
    ├── globalSetup.ts                  # (legacy, may be removed)
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
2. **Middleware** chain executes (auth, validation, rate limiting).
3. **Controller** extracts validated data from `req.body`, `req.query`, `req.params`, calls the service.
4. **Service** performs business logic and database operations using Prisma.
5. **Controller** formats the response with `apiResponse()` and sends.
6. **Central error handler** catches any thrown `AppError` and converts to JSON.

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
- **Important:** Due to Express 5, `req.query` and `req.params` are getter-only. The middleware uses `Object.defineProperty` to reassign them. Do not change this back to direct assignment.

### 4.4 Authentication

- JWT access token (15 min) in `Authorization: Bearer <token>`.
- Refresh token (7 days) stored in Redis with key `refresh_token:<userId>`.
- Account lockout after 5 failed attempts, for 15 minutes, tracked in Redis.

### 4.5 Database Access

- Use Prisma Client only within services.
- Never access `prisma` directly in controllers.
- Migrations are managed via `npx prisma migrate dev`.
- All queries must consider soft-deleted records (`deletedAt: null`) unless explicitly for admin.

### 4.6 Testing Conventions (NEW)

- **Unit tests** live in `src/services/__tests__/`. Mock Prisma and Redis.
- **Integration tests** live in `src/__tests__/integration/`. Use `supertest` and real services backed by isolated Docker containers.
- Any new endpoint or business-logic change must:
  - Have unit tests for the service layer.
  - Have integration coverage for at least the happy path if it’s a critical flow.
- **Do not** place helper files in `src/__tests__/integration/` without referencing them through Jest config (`setupFiles` / `setupFilesAfterEnv`), otherwise Jest may treat them as test suites.

---

## 5. Implemented Features (Sprint 1–10)

### 5.1 Authentication (Sprint 1)

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| POST `/auth/register` | Create user | Hashes password with bcrypt (12 rounds). **Now creates `UserStats` and assigns active daily quests in a transaction.** |
| POST `/auth/login` | Login | Returns access/refresh tokens |
| POST `/auth/refresh` | Refresh token | Verifies refresh token in Redis. **Rebuilds payload before signing new access token (fixes `exp` collision).** |
| POST `/auth/logout` | Logout | Deletes refresh token from Redis |
| POST `/auth/forgot-password` | Request reset | Sends email (skipped in test mode) |
| POST `/auth/reset-password` | Reset password | Uses temporary token (15 min) |

**Security:** Redis rate limiting (10 req/min) on register, login, forgot/reset.

### 5.2 User Management (Sprint 2)

| Endpoint | Purpose |
|----------|---------|
| GET `/users/me` | Get profile + gamification + progress |
| PUT `/users/me` | Full update |
| PATCH `/users/me` | Partial update |
| DELETE `/users/me` | Soft delete (sets `deletedAt`, `isActive=false`) |
| GET/PUT `/users/me/privacy` | Manage privacy settings (JSON) |
| POST/DELETE `/users/me/avatar` | Avatar upload/removal |

**Admin Endpoints** (all require `ADMIN` role):

| Endpoint | Purpose |
|----------|---------|
| GET `/admin/users` | List users (pagination, search, role/status filter) |
| GET `/admin/users/:id` | Get user details |
| PUT `/admin/users/:id` | Update user (role, isActive, isEmailVerified) |
| POST `/admin/users/:id/suspend` | Suspend user |
| POST `/admin/users/:id/activate` | Activate user |
| POST `/admin/users/:id/role` | Change role |

### 5.3 Path Core (Sprint 3)

#### Categories
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/categories` | List categories (pagination, search, parent filter) | No |
| GET `/categories/:id` | Get category with children & published paths | No |
| POST `/categories` | Create category | Admin |
| PUT `/categories/:id` | Update category | Admin |
| DELETE `/categories/:id` | Soft-delete category | Admin |

#### Paths
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/paths` | List published paths (filters: search, category, difficulty, price range, sort) | No |
| GET `/paths/admin/list` | List all paths (incl. unpublished) | Admin |
| GET `/paths/:id` | Get path (admin sees unpublished) | No/Admin |
| POST `/paths` | Create path | Admin |
| PUT `/paths/:id` | Update path | Admin |
| DELETE `/paths/:id` | Soft-delete path | Admin |
| POST `/paths/:id/publish` | Publish/unpublish (`{ "publish": true/false }`) | Admin |

#### Modules
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/modules?pathId=...` | List modules for a path | No/Admin |
| GET `/modules/:id` | Get module with lessons | No/Admin |
| POST `/modules` | Create module | Admin |
| PUT `/modules/:id` | Update module | Admin |
| DELETE `/modules/:id` | Delete module (cascade deletes lessons) | Admin |

#### Lessons
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/lessons?moduleId=...` | List lessons for a module | No/Admin |
| GET `/lessons/:id` | Get lesson with quiz questions | No/Admin |
| POST `/lessons` | Create lesson | Admin |
| PUT `/lessons/:id` | Update lesson | Admin |
| DELETE `/lessons/:id` | Delete lesson | Admin |
| GET `/lessons/:id/lock-status` | Get lock status for current user | Yes |
| GET `/lessons/:id/pdf-url` | Get signed PDF URL (5 min expiry) | Yes |
| GET `/lessons/:id/recharge-status` | Get recharge status for current user | Yes |

#### Enrollment
| Endpoint | Purpose | Auth |
|----------|---------|------|
| POST `/enrollments/paths/:pathId/enroll` | Enroll current user | Yes |
| DELETE `/enrollments/paths/:pathId/enroll` | Unenroll current user | Yes |
| GET `/enrollments/me/enrollments` | List current user's active enrollments | Yes |
| GET `/enrollments/paths/:pathId/enrollments` | List enrolled users for a path | Admin |

**Note:** The `/enrollments` mount was missing in an earlier version of `routes/index.ts` — now fixed.

#### Progress
| Endpoint | Purpose | Auth |
|----------|---------|------|
| POST `/progress/lessons/:lessonId` | Update lesson progress (completed, timeSpent, quizScore) | Yes |
| GET `/progress/paths/:pathId` | Get path progress summary for current user | Yes |

### 5.4 Gamification (Sprint 4)

#### Profile
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/gamification/me` | Get current user gamification profile | Yes |
| GET `/gamification/users/:userId` | Get gamification profile for any user | Yes |

#### XP & Levels
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/gamification/xp/history` | Get current user XP history (paginated) | Yes |
| GET `/gamification/levels` | Get level definitions and XP thresholds | No |

#### Badges
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/gamification/badges` | Get all badge definitions | No |
| GET `/gamification/me/badges` | Get current user earned badges | Yes |
| GET `/gamification/users/:userId/badges` | Get any user earned badges | Yes |

#### Leaderboards
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/gamification/leaderboard?scope=global` | Global leaderboard by XP | Yes |
| GET `/gamification/leaderboard?scope=path&pathId=...` | Path leaderboard by completed lessons | Yes |

#### Streaks
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/gamification/me/streak` | Get current streak info | Yes |
| POST `/gamification/me/streak/freeze` | Use a streak freeze token | Yes |

#### Daily Quests
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/gamification/daily-quests` | Get active daily quests with user progress | Yes |
| POST `/gamification/daily-quests/:questId/complete` | Complete a daily quest and earn XP | Yes |

**Note:** New users get their `UserStats` and `UserQuest` records created automatically at registration.

### 5.5 Manual Payments (Sprint 5)

#### User Endpoints
| Endpoint | Purpose | Auth |
|----------|---------|------|
| POST `/payments/requests` | Create payment request, get instructions | Yes |
| GET `/payments/requests` | List current user's payment requests | Yes |
| POST `/payments/requests/:id/mark-sent` | Mark payment as sent | Yes |

#### Admin Endpoints
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/payments/admin/requests` | List all payment requests | Admin |
| POST `/payments/admin/requests/:id/activate` | Activate request: creates enrollment, purchase, sends confirmation email | Admin |
| POST `/payments/admin/requests/:id/reject` | Reject request with reason | Admin |

**Payment Request Statuses:** `PENDING`, `VERIFIED`, `ACTIVATED`, `REJECTED`, `EXPIRED`

**Note:** Base mount is `/payments` (plural) — this was corrected in `routes/index.ts` during Sprint 11.

### 5.6 Community Features (Sprint 6)

#### Forum Categories, Posts, Comments, Voting, Best Answer, Search, Admin Moderation
- All endpoints as previously documented (see README for the full table).
- **Note:** Admin moderation mount is `/moderation` (leading slash was fixed in Sprint 11).

### 5.7 Notifications (Sprint 7)

All endpoints as previously documented. **Email sending is skipped entirely when `NODE_ENV === 'test'`.** Push notifications are logged, not sent.

### 5.8 Search & Recommendations (Sprint 8)

- Search endpoints use `plainto_tsquery` with `::regconfig` cast (replaced `websearch_to_tsquery` due to function availability).
- Raw SQL selects explicit columns to avoid `tsvector` deserialization errors in Prisma.
- Search vector columns declared as `Unsupported("tsvector")` in Prisma; managed via migration `20260911150633_add_search_vector_columns`.

### 5.9 Parent-Child & Lesson Enhancements (Sprint 9)

All endpoints as previously documented.

### 5.10 Enhanced Content Structure (Sprint 10)

All endpoints as previously documented.

---

## 6. Sprint 11 Progress (NEW)

### 6.1 Completed

- **Integration Test Suite**
  - Fully isolated Docker infrastructure (`docker-compose.test.yml`) — Postgres on port `5434`, Redis on `6380`.
  - Dedicated `.env.test` (git-ignored) and `jest.integration.config.js`.
  - Test files in `src/__tests__/integration/` covering auth, user, enrollment, progress, gamification, payments, forum, search, health.
  - **22 tests passing.**
  - New scripts: `test:integration`, `test:integration:up`, `test:integration:down`, `test:integration:migrate`.

- **Critical Production Fixes**
  - **Route Mounting:** Added `/enrollments` mount; fixed `/moderation` (missing slash); fixed `/payment` → `/payments`.
  - **Auth Refresh:** Fixed `Bad "options.expiresIn" option...` by passing a clean payload (`userId`, `email`, `role`) to `generateAccessToken`.
  - **Search Service:** Replaced `websearch_to_tsquery` with `plainto_tsquery` + `::regconfig` cast. Selected explicit columns.
  - **Search Vector Migration:** Added `20260911150633_add_search_vector_columns` — adds `tsvector` columns and GIN/trigram indexes.
  - **Registration Flow:** Auto-creates `UserStats` and assigns active daily quests in a transaction.

- **Unit Test Fixes**
  - Updated `auth.service.test.ts` to mock `$transaction`, `userStats.create`, `quest.findMany`, `userQuest.createMany`.
  - Adjusted `refreshToken` test to expect a clean payload.
  - All 306+ unit tests passing.

- **Seed Script Fixes**
  - Daily quests are now deleted and recreated on each seed run so they reflect today's active window.

### 6.2 Remaining

- **Redis rate limiter** for general routes (replace in-memory).
- **S3 avatar upload** (reuse `s3.service.ts`).
- **Payment request expiration automation** (cron job).
- **Firebase push notifications** (replace logging).
- **Search service branch coverage** (target ≥80%).
- **Recommendation refinement**.
- **Deployment configuration** (env-specific, CI/CD, Docker image).

---

## 7. Database Schema Highlights

- **User** model extended with `displayName`, `timezone`, `lastLoginAt`, `privacySettings` (JSON), `parentId`, `children`, `childSettings`.
- **Role enum:** STUDENT, PARENT, ADMIN.
- **ChildSettings model:** `lockOverrideEnabled`, `customLockDurationHours`.
- **Soft delete:** `deletedAt` timestamp; queries must check for `deletedAt: null`.
- **Path models:** Path, CourseCategory, Module, Lesson, QuizQuestion, Enrollment, LessonProgress.
- **Lesson model:** expanded with content, lock, and recharge fields.
- **Enhanced Content models:** `Slide`, `QuestCheckpoint`, `BossBattle`, `BossBattleQuestion`, `UserSlideProgress`, `UserQuestProgress`, `UserBossBattleProgress`.
- **Gamification models:** UserStats, Badge, UserBadge, XpAuditLog, Quest, UserQuest.
- **Community models:** ForumCategory, ForumPost, ForumComment, ForumVote (polymorphic).
- **Payment models:** Subscription, Purchase, PaymentRequest with enum PaymentRequestStatus.
- **Notification models:** Notification, DeviceToken, NotificationTemplate.
- **Search:** `paths` and `forum_posts` have generated `tsvector` columns (`search_vector_ar`, `search_vector_en`) declared as `Unsupported("tsvector")` in Prisma. Trigram indexes added for fuzzy matching.
- **All models use UUID primary keys.**

Full schema in `prisma/schema.prisma`.

---

## 8. Testing Strategy

### 8.1 Unit Tests

- Location: `src/services/__tests__/`.
- Mock Prisma and Redis with Jest module mocks.
- Run `npm test -- --coverage`.
- Controllers are not unit-tested; they are thin wrappers.
- Seed script has `// @ts-nocheck`; that’s acceptable for a standalone script.

**Current status:** 306+ passing. Service layer coverage ~93% statements, ~80% branches, ~95% functions.

### 8.2 Integration Tests (NEW)

- Location: `src/__tests__/integration/`.
- Uses `supertest` against the real Express app.
- Uses real Postgres + Redis in isolated Docker containers.
- Migrations and seed run automatically in `setup.ts`.
- Run: `npm run test:integration`.
- **Current status:** 22/22 passing.

Requirements:
- `.env.test` in project root (see README for the full template).
- Docker Desktop running.

Key conventions when adding integration tests:
- Never put helper files in the integration folder without registering them in the Jest config (as `setupFiles` / `setupFilesAfterEnv`). Otherwise Jest will try to run them as test suites.
- Use unique emails per test to avoid collisions (`test_${Date.now()}@example.com`).
- Use the seeded admin credentials for admin-only endpoints: `admin@qafzly.com / Admin@123456`.
- Don’t rely on insertion order of seeded data — fetch IDs from the DB via `prisma`.

---

## 9. Known Issues & Gotchas

1. **Prisma version:** Strictly use 6.19.0. Do not upgrade to v7/8.
2. **PostgreSQL port:** Use `5433` for dev (test uses `5434`). Redis dev `6379`, test `6380`.
3. **Rate limiter:** Generic `rateLimiter` is in-memory; replace with Redis for production.
4. **Email:** If `SENDGRID_API_KEY` is not set (or `NODE_ENV === 'test'`), emails are logged/skipped.
5. **Git ownership:** If you see `fatal: detected dubious ownership`, run `git config --global --add safe.directory D:/Career/Qafzly`.
6. **Seed script:** Run after migrations if you reset the database.
7. **Swagger UI:** Available at `/api-docs`; use Authorize button to set JWT token.
8. **Express 5 getter issue:** `req.query`/`req.params` are getter-only. Use `Object.defineProperty` in `validate.ts`.
9. **Price range filter in `listPaths`:** Use the same pattern for other range filters.
10. **Soft-deletes:** Filter `deletedAt: null` in public queries.
11. **Streak freeze:** Does not verify that the freeze is within the streak window.
12. **Manual payments:** `expiresAt` set in application code (default 7 days); no automatic expiration yet.
13. **Forum votes:** Polymorphic; always specify `targetType` and `targetId`.
14. **Forum soft delete:** Sets both `deletedAt` and `status = 'deleted'`.
15. **Notifications:** `channelsSent` is an array; email `link` must be coerced `?? undefined`.
16. **Search vectors:** Declared as `Unsupported("tsvector")`. Must use `$queryRaw` with `Prisma.sql` for parameterization. Use `plainto_tsquery` + `::regconfig` cast. Select explicit columns (do **not** use `SELECT *`) to avoid Prisma failing to deserialize `tsvector` columns.
17. **Parent-child linking:** Ensure the child is not already linked to another parent. Delete `ChildSettings` on unlink.
18. **Lesson lock / recharge:** Lock duration based on previous lesson's `lockDurationHours`. Recharge boost applies to base XP only.
19. **Slides/Quests/Boss Battles:** Prevent duplicate completion/submission with unique constraints.
20. **Auth refresh token:** Rebuild the payload with only `{ userId, email, role }` before calling `generateAccessToken` (the original decoded payload contains `exp`/`iat` which cause a signing error).
21. **`npm run test:integration`** requires `.env.test` and uses isolated containers. Between runs, containers are torn down automatically.
22. **Windows PowerShell:** Do not call `dotenv` directly (a conflicting Python `dotenv` may shadow it). Use `npm run test:integration:migrate` or `npx dotenv-cli -e .env.test -- ...`.
23. **Jest `testMatch`:** The default `jest.config.js` must exclude `src/__tests__/integration/`, otherwise Jest will treat helper files as suites. Integration tests use `jest.integration.config.js`.
24. **Docker Compose warning** about obsolete `version:` key — harmless; can be removed later.

---

## 10. Next Steps (Remaining Sprint 11 Work)

### 10.1 High Priority

1. **Redis rate limiter** for general routes.
2. **S3 avatar upload** using `s3.service.ts`.
3. **Payment expiration cron** (`PENDING` → `EXPIRED`).
4. **Firebase push notifications** (replace logging).
5. **Search service branch coverage** (target ≥80%).
6. **Deployment configuration** (env-specific, CI/CD, Docker image).

### 10.2 Extend Integration Coverage (recommended)

- Slides & Mini-Quests.
- Boss Battle.
- Recharge.
- Notifications.
- Parent endpoints.
- Admin moderation.
- PDF delivery.
- Search edge cases.

### 10.3 Beyond Sprint 11

- Voice support in parent dashboard (Phase 2).
- PayMob integration (replacing manual payments).

---

## 11. Troubleshooting Common Problems

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| `PrismaClientValidationError: take expected Int, got String` | Query params not coerced | Ensure `z.coerce.number()` and `validate` middleware reassigns via `Object.defineProperty` |
| `Cannot set property query of #<IncomingMessage>` | Direct assignment to `req.query` in Express 5 | Use `Object.defineProperty` |
| `JWT expiresIn type error` | `jsonwebtoken` expects `StringValue` | Cast `expiresIn` to `any` or use `ms` package |
| DB connection refused on 5432 | Local PostgreSQL already using port | Use `5433` (dev) or `5434` (test) |
| Docker container not starting | Volume stale or port conflict | `docker-compose down -v` then `docker-compose up -d` |
| TypeScript errors about missing fields | Prisma client not regenerated | `npx prisma generate` |
| Admin endpoints return 403 | Token lacks ADMIN role | Log in as admin, use returned access token |
| Prisma model mock missing method in unit test | Missing `jest.fn()` | Add `jest.fn()` for the missing method |
| Search returns 500 `column does not exist` | Migration not applied | `npx prisma migrate deploy` |
| Search returns 500 `Failed to deserialize column of type 'tsvector'` | `SELECT *` in raw query | Select explicit columns (exclude `search_vector_*`) |
| Refresh token returns 400 `Bad "options.expiresIn"...` | Passing decoded JWT (with `exp`) to `generateAccessToken` | Rebuild payload with only `{ userId, email, role }` |
| Integration tests time out after 5s | Running under default Jest config | Use `npm run test:integration` (uses `jest.integration.config.js`) |
| “Your test suite must contain at least one test” | Helper files in `__tests__/integration/` picked up by default Jest | Exclude integration folder in default `jest.config.js` |
| `dotenv -e .env.test` fails with “Invalid value for '-e'” | Python `dotenv` shadowing the JS one | Use `npm run test:integration:migrate` or `npx dotenv-cli -e .env.test -- ...` |
| Seed creates users but daily quests are inactive | Old daily quests remain in DB | Seed now deletes and recreates daily quests each run |

---

## 12. Repository State

- **Branch:** `main`
- **Last commit:** Sprint 11 in progress — integration test suite added; critical route/auth/search fixes; unit and integration tests passing.
- **Swagger UI:** all endpoints documented, including lock-status, archive/dismiss notifications, and slide/checkpoint update+delete.
- **Test status:**
  - Unit: 306+ passing, service layer coverage ~93%.
  - Integration: 22/22 passing.

---

## 13. Contact

For questions, contact the original developer (Team Falcon) or the Project Manager.

---

**End of Developer Onboarding Document**