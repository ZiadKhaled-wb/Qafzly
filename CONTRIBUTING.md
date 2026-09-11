# `CONTRIBUTING.md` — Full Replacement

Copy the entire block below into `CONTRIBUTING.md`, replacing the existing content.

````markdown
# Contributing to Qafzly Backend

Welcome! We appreciate your interest in contributing to the Qafzly backend. This document outlines the guidelines, coding standards, and workflow to follow when adding features, fixing bugs, or improving the codebase.

---

## 1. Code of Conduct

- Be respectful and inclusive.
- Write clear, maintainable code.
- Provide constructive feedback.
- Document decisions and rationale.

---

## 2. Branching Strategy

- `main` is the stable branch; never push directly to it.
- Create a feature branch for each task:

  ```
  feature/certificate-generation
  fix/refresh-token-payload
  docs/update-handoff
  test/expand-integration-coverage
  ```

- Use pull requests (PRs) for all changes.
- Require at least one approval before merging.

---

## 3. Commit Message Guidelines

Use the following format:

```
<type>: <short description>

[optional body]
[optional footer]
```

Types:
- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation only
- `refactor`: code change that neither fixes a bug nor adds a feature
- `test`: adding or updating tests
- `chore`: build process, tooling, etc.

**Example:**
```
feat: add path enrollment endpoint
```

**Recent examples:**
```
feat: certificate generation on path completion
feat: idempotency-key support for POST /payments/requests
feat: preview lesson access control (freemium tier)
fix: replace in-memory rate limiter with Redis-backed sliding window
fix: migrate email from SendGrid to AWS SES (non-throwing)
fix: mount enrollment routes at /enrollments
fix: rebuild refresh token payload before signing new access token
fix: use plainto_tsquery with ::regconfig cast in search service
chore: rebase migration history to a single baseline
test: add integration test suite with Docker isolation
```

---

## 4. Coding Standards

### 4.1 TypeScript

- Use strict mode (already configured in `tsconfig.json`).
- Avoid `any`; use proper types.
- Use `const` and `let`; avoid `var`.
- Prefer `async/await` over callbacks/promises.

### 4.2 Naming Conventions

- Files: `kebab-case.ts` (e.g., `user.service.ts`)
- Classes: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Routes: plural nouns, kebab-case (e.g., `/path-categories`)

### 4.3 Project Structure

Follow the existing **services → controllers → routes** pattern:

- `routes/` define endpoints and middleware binding.
- `controllers/` parse request data, call services, and format responses.
- `services/` contain business logic and database access via Prisma.
- `jobs/` contain background cron work (see `paymentExpiry.job.ts` for the pattern).
- `middleware/` contains reusable request-level concerns.

Do not mix responsibilities.

**Common pitfalls:**
- Always import the router in `src/routes/index.ts` and mount it with a leading slash (e.g., `router.use('/enrollments', enrollmentRoutes);`). A missing mount silently produces 404s on all endpoints of that feature.
- Keep the base mount consistent with the plural form the frontend expects (e.g., `/payments`, not `/payment`).

### 4.4 Non-Blocking Side Effects

Certain operations must **never** propagate their failure into the request response:

- **Email sending** — `sendEmail` catches and logs; never throws. See `email.service.ts`.
- **Certificate auto-issue** — hooked into `progress.service.ts`; wrapped in try/catch. A failure must not break lesson completion.
- **Streak updates** — same as above.

When adding a side effect that isn't part of the request's core contract, wrap it in try/catch and log via `logger.error`. Use `void somePromise.catch(...)` for fire-and-forget.

### 4.5 Optional Authentication

For endpoints that should serve both anonymous and authenticated users (e.g., lesson detail with preview support), use `optionalAuth` middleware instead of `authenticate`. It attaches `req.user` when a valid Bearer token is present and continues as anonymous otherwise. Never use it on endpoints that require authentication.

---

## 5. Validation

- Use Zod schemas located in `src/utils/validators/`.
- Bind schemas in routes with `validate(schema)` middleware.
- The middleware replaces `req.body`, `req.query`, `req.params` with parsed values.
- **Express 5 note:** `req.query` and `req.params` are getter-only. The middleware uses `Object.defineProperty` internally — do not change this pattern.

---

## 6. Error Handling

- Throw `new AppError(statusCode, message)` for expected errors.
- Let the central error handler format the response.
- Do not catch errors in controllers unless necessary.
- For non-blocking side effects (§4.4), catch and log instead of throwing.

---

## 7. Database Migrations (Prisma)

### ⚠️ Read this before touching migrations

Prisma 6.x has an unfixed introspection bug ([#24496](https://github.com/prisma/prisma/issues/24496), [#15654](https://github.com/prisma/prisma/issues/15654)) that generates invalid SQL for PostgreSQL generated columns. This project has four such columns (`search_vector_ar`/`search_vector_en` on `paths` and `forum_posts`), so **every bare `migrate dev` produces a broken migration**.

### The workflow (mandatory)

```bash
# 1. Create the migration WITHOUT applying it
npx prisma migrate dev --create-only --name <short_description>

# 2. Open the generated prisma/migrations/<timestamp>_<name>/migration.sql
#    and DELETE any of these lines if present:
#      ALTER TABLE ... ALTER COLUMN "search_vector_ar" DROP DEFAULT
#      ALTER TABLE ... ALTER COLUMN "search_vector_en" DROP DEFAULT
#      ALTER TABLE ... DROP COLUMN "search_vector_ar"
#      ALTER TABLE ... DROP COLUMN "search_vector_en"
#      DROP INDEX "idx_paths_search_ar"                     (and the 7 other
#      DROP INDEX "idx_forum_posts_search_ar"                search/trigram
#      DROP INDEX "idx_users_fullname_trgm"                  indexes)

# 3. Run the safety net
npm run check:migrations

# 4. Apply
npx prisma migrate deploy
```

### Rules

- ❌ **Never** run bare `npx prisma migrate dev` — always use `--create-only`
- ❌ **Never** commit a migration without running `npm run check:migrations`
- ❌ **Never** edit a migration that has already been applied to any environment
- ✅ `--create-only` → audit → `check:migrations` → `deploy`

### The safety net

`scripts/check-migrations.js` scans every `migration.sql` and fails if it finds any of the forbidden patterns above. It runs in under a second and is part of the PR checklist.

### If drift breaks your local DB

Typical symptom: `migrate status` reports "migration applied but missing from local directory", or `migrate dev` refuses to run.

```bash
# Dev only — the local DB holds only seeded data
docker exec <pg-container> psql -U qafzly -d qafzly_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npx prisma migrate deploy
npx ts-node prisma/seed.ts
```

Never do this on staging or production without a backup.

### Search vector columns

The `tsvector` columns are declared as `Unsupported("tsvector")?` in `schema.prisma`. **Do not remove these declarations** — Prisma will drop the columns on the next migration. Any changes to them must go through a raw SQL migration, not through the schema.

When writing `$queryRaw` against `paths` or `forum_posts`:
- Use `plainto_tsquery(${config}::regconfig, ${q})` — the `::regconfig` cast is required.
- Select explicit columns — **never `SELECT *`**, or Prisma fails to deserialize the `tsvector` columns with `Failed to deserialize column of type 'tsvector'`.

### Subscribe to the Prisma issues

Both issues are open with no shipped fix. Watch them so we can drop the manual audit once resolved:
- https://github.com/prisma/prisma/issues/24496
- https://github.com/prisma/prisma/issues/15654

---

## 8. Testing

Testing is a first-class citizen on this project. We maintain two test suites.

### 8.1 Unit Tests

- **Location:** `src/services/__tests__/`, `src/middleware/__tests__/`, `src/jobs/__tests__/`.
- **Approach:** Mock Prisma, Redis, AWS SDK clients, and PDFKit with Jest module mocks.
- **Command:** `npm test -- --coverage`.
- **Requirement:** Coverage must not drop below **80%** for new service code.
- **Patterns to follow:**
  - Use `jest.mock('../../config/database', () => ({ prisma: { ... } }))`.
  - When a service uses `prisma.$transaction`, add a mock that invokes the callback with the mocked client:

    ```ts
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(prisma));
    ```

  - Reset all mocks in `beforeEach` with `jest.clearAllMocks()`.
  - For middleware wrapped in `asyncHandler` (which returns a void function with a detached promise chain), use a `flushAsync` helper before asserting:

    ```ts
    const flushAsync = () => new Promise<void>((r) => setImmediate(r));
    mw(req, res, next);
    await flushAsync();
    ```

### 8.2 Integration Tests

- **Location:** `src/__tests__/integration/`.
- **Approach:** Use `supertest` against the real Express app; run against real Postgres and Redis in isolated Docker containers.
- **Command:** `npm run test:integration`.
- **Requirements:**
  - `.env.test` file (git-ignored) in project root — see `README.md` for the full template.
  - Docker Desktop running.
- **What happens when you run the command:**
  1. Test containers are started (`docker-compose.test.yml`).
  2. Migrations are applied to the test DB (port `5434`).
  3. Seed runs against the test DB.
  4. Suite executes with `jest.integration.config.js`.
  5. Containers are torn down.
- **Conventions when adding integration tests:**
  - **Never** place helper files (e.g., `setup.ts`, `env.setup.ts`) in the integration folder without registering them in `jest.integration.config.js` as `setupFiles` or `setupFilesAfterEnv`. Otherwise Jest will treat them as test suites and fail with `Your test suite must contain at least one test`.
  - Use **unique emails per test** to avoid collisions: `` `test_${Date.now()}@example.com` ``.
  - Use the seeded admin credentials for admin-only endpoints: `admin@qafzly.com / Admin@123456`.
  - Fetch seeded IDs from the DB via Prisma rather than hard-coding them.
  - Follow the file-level structure: `describe` → `beforeAll` (setup) → `it` (assertions).
  - **Do not** rely on test execution order; each file should set up its own state.

### 8.3 Which tests should I add?

| Change | Required tests |
|--------|----------------|
| New service method | Unit test(s) in `src/services/__tests__/` |
| New middleware | Unit test(s) in `src/middleware/__tests__/` |
| New background job | Unit test(s) in `src/jobs/__tests__/` |
| New endpoint on a critical flow (auth, enrollment, payments, gamification, certificates) | Integration test in `src/__tests__/integration/` |
| Bug fix | Add a regression test that would have caught the bug |
| New feature | Unit + integration where the flow is user-visible |

### 8.4 Current test status

- Unit: **361 passing**, service-layer coverage ~93% statements, ~82% branches.
- Integration: **22/22 passing**.

---

## 9. Documentation

Update the following when making changes:

- **`README.md`** — when adding new endpoints or changing setup.
- **`HANDOFF.md`** — for major changes, new sprints, or architectural decisions.
- **`DEVELOPER_ONBOARDING.md`** — when onboarding-relevant conventions or gotchas change.
- **`src/config/swagger.ts`** — for every new endpoint. Ensure the request/response schema matches the actual Zod validator and controller output.
- **`prisma/schema.prisma`** — when adding/removing models or fields.

### Swagger should match reality

Whenever you add or change an endpoint, verify the Swagger spec matches:

- Request body shape (must match the Zod schema)
- Response envelope shape
- Authorization requirement (`security: [{ bearerAuth: [] }]` vs `security: []`)
- Query and path parameters

If you change the shape of an existing response (e.g., renamed a field), **update the Swagger entry in the same commit**. A stale Swagger misleads the frontend team more than no Swagger at all.

---

## 10. Environment & Setup

- Use `.env.example` as the template; never commit `.env` or `.env.test`.
- Keep Docker Compose ports consistent:
  - Dev: PostgreSQL `5433`, Redis `6379`.
  - Test: PostgreSQL `5434`, Redis `6380`.
- Apply migrations with `npx prisma migrate deploy` — see §7 for the full workflow.
- If you've reset your DB and need seed data: `npx ts-node prisma/seed.ts`.

### Windows tips

- If you see `fatal: detected dubious ownership in repository`, run:

  ```
  git config --global --add safe.directory D:/Career/Qafzly
  ```

- Do **not** call `dotenv` directly in PowerShell — a Python `dotenv` may shadow the JS one. Use `npm run test:integration:migrate` or `npx dotenv-cli -e .env.test -- ...`.
- `curl` in PowerShell is an alias for `Invoke-WebRequest`. Use `curl.exe` when you need real curl behavior.
- `docker exec -it` hangs in PowerShell (TTY allocation issue). For one-shot commands, drop the `-t`: `docker exec <container> <cmd>`.

---

## 11. Completed Sprints

The following work has been completed. Follow the patterns and quality standards established here.

### Sprint 1 – Authentication

- User registration, login, refresh, logout, forgot/reset password endpoints.
- JWT authentication with access token (15 min) and refresh token (7 days) stored in Redis.
- Bcrypt password hashing (12 rounds).
- Redis-backed rate limiting (10 req/min) for sensitive auth routes.
- Account lockout after 5 failed login attempts for 15 minutes.

### Sprint 2 – User Management

- Self-profile endpoints (GET, PUT, PATCH, DELETE `/users/me`).
- Privacy settings (GET/PUT `/users/me/privacy`).
- Avatar upload/removal via Multer (local storage).
- Admin user management (list, detail, update, suspend/activate, change role).
- Schema extensions: `displayName`, `timezone`, `lastLoginAt`, `privacySettings`.
- `authorize.ts` middleware for role-based access.
- Swagger UI integrated.

### Sprint 3 – Path Core

- Full CRUD for categories, paths, modules, lessons.
- Advanced filtering (search, category, difficulty, price range, sort, pagination).
- Soft-delete + publish/unpublish for paths.
- Enrollment endpoints (enroll/unenroll, list, admin list).
- Progress tracking (lesson progress, path summary).

### Sprint 4 – Gamification

- Gamification profile endpoints.
- XP history (paginated) and 50-level definitions.
- Badges (list, my badges, any user's badges).
- Leaderboards (global by XP, path-specific by completed lessons).
- Streaks + streak freeze.
- Daily quests (list + complete).
- New models: `Quest`, `UserQuest`.

### Sprint 5 – Manual Payments (MVP)

- Payment request creation with Vodafone Cash / InstaPay instructions.
- User tracking (list requests, mark sent).
- Admin management (list with filters, activate, reject).
- Arabic email templates: instructions, activation confirmation, rejection.
- New model `PaymentRequest` + enum `PaymentRequestStatus`.

### Sprint 6 – Community Features

- Forum categories, posts, comments.
- Polymorphic voting (posts + comments).
- Best answer marking.
- Post search by title/content.
- Admin moderation: reports, resolve, hide/unhide.
- New models: `ForumCategory`, `ForumPost`, `ForumComment`, `ForumVote`.

### Sprint 7 – Notifications

- User notifications with filters (read/archived/dismissed/type), unread count, mark read, archive, dismiss, delete.
- Device register/unregister.
- Admin system notification (all users or specific).
- Email via SES (originally SendGrid; migrated in Sprint 11).
- Push placeholder (logged).
- Expanded `Notification` and `DeviceToken` models. New `NotificationTemplate`.

### Sprint 8 – Search & Recommendations

- Global search across paths, forum posts, users with relevance ranking.
- Path/forum/user search with filters.
- Personalized, popular, trending, related path recommendations.
- Generated `tsvector` columns + GIN + trigram indexes on `paths` and `forum_posts`.
- New services: `search.service.ts`, `recommendation.service.ts`.

### Sprint 9 – Parent-Child, Lesson Expansion, Lock, PDF

- Removed `INSTRUCTOR` role; roles now `STUDENT`, `PARENT`, `ADMIN`.
- Self-referential parent-child relation + `ChildSettings` model.
- Parent dashboard endpoints (overview, billing, child management).
- Lesson structure expanded (video URLs, PDF, slides JSON, challenge fields, `lockDurationHours`).
- 12-hour lock logic with parent override. `GET /lessons/:id/lock-status`.
- PDF delivery via S3 signed URLs (5-min expiry). `GET /lessons/:id/pdf-url`.
- YouTube ID validation enforced in lesson schema.

### Sprint 10 – Enhanced Content Structure

- New models: `Slide`, `QuestCheckpoint`, `BossBattle`, `BossBattleQuestion`, plus user-progress tables.
- New `Lesson` fields: `warmUpJson`, `miniQuestJson`, `rechargeMessage*`, `rechargeXpBoost`, `rechargeBoostMultiplier`, `rechargeBoostWindowHours`.
- New services: `slide.service.ts`, `quest.service.ts`, `bossBattle.service.ts`, `recharge.service.ts`.
- Full CRUD + completion endpoints for slides, checkpoints, boss battles.
- XP recharge boost window (base XP only, not victory bonus).

### Sprint 11 – UAT & Bug Fixing ✅

**Infrastructure**

- Integration test suite with isolated Docker containers (Postgres `5434`, Redis `6380`).
- `.env.test`, `jest.integration.config.js`, `npm run test:integration` (one command).
- 22 integration tests passing across 9 files.

**Critical production fixes** (each was a UAT blocker)

- `/enrollments` router not mounted → fixed.
- `/moderation` missing leading slash → fixed.
- `/payment` → `/payments` mount rename.
- Refresh token payload rebuild (fixes `Bad "options.expiresIn"`).
- Search service: `plainto_tsquery` + `::regconfig` cast + explicit column selection.

**New features**

- **Redis-backed rate limiter** replacing in-memory implementation. Factory pattern, user/IP key strategy, fail-open, headers.
- **Payment expiration cron** (every 5 min, Redis-locked, fail-open). Non-blocking email.
- **Graceful shutdown** with SIGTERM/SIGINT handlers and 15s force-exit.
- **Health check split**: `/health/live` (liveness) + `/health/ready` (readiness, checks Postgres + Redis).
- **Idempotency-Key** on `POST /payments/requests`.
- **AWS SES migration** — `sendEmail` is non-throwing; SendGrid removed.
- **Preview lesson access control** — `optionalAuth` middleware, `isAccessible` flag, `403` for non-enrolled.
- **Certificate generation** — auto-issued on path completion. Public verification. PDF rendering with Arabic shaping. Admin revoke.
- **Student Dashboard response shapes** — `totalXp`, `currentLevelXp`, `nextLevelXp`, `rank`, badges with `nameAr`/`nameEn`, daily quests `xpAward`, enrollment `progress` + `currentLesson`, `lastActivityDate` on streak.
- **Auto-streak update** on lesson completion.
- **`Badge.nameEn`** column.
- **Seed additions**: `test-student@qafzly.com` + 5 leaderboard fillers.

**Migration history rebasing**

- Rebased to a single baseline (`20260911203608_initial_schema`) that includes the tsvector columns and indexes.
- Added `20260911212808_add_badge_name_en`.
- Added `scripts/check-migrations.js` safety net + `npm run check:migrations`.

---

## 12. Known Issues & Gotchas (Quick Reference)

### Prisma & Migrations

| Issue | Where to look |
|-------|---------------|
| `migrate dev` generates `DROP DEFAULT` on tsvector columns | Prisma bug — see §7. Use `--create-only` + audit |
| `migrate dev` generates `DROP INDEX` on search indexes | Same as above |
| `column "search_vector_*" does not exist` | Apply the baseline migration; never let a bad `DROP COLUMN` run |
| `Failed to deserialize column of type 'tsvector'` | Never use `SELECT *` in search queries; list columns |
| `EPERM: operation not permitted` on `prisma generate` | A Node process holds the query engine DLL. Kill node first |
| `migrate status` reports missing migrations | Drift — see §7 recovery sequence |
| `$transaction is not a function` in unit tests | Add `$transaction` mock that invokes the callback with `prisma` |

### Runtime

| Issue | Where to look |
|-------|---------------|
| Missing route → 404 | Check `src/routes/index.ts` mount + leading slash in the route file |
| `Bad "options.expiresIn"` on refresh | `auth.service.ts > refreshToken` — rebuild payload |
| Express 5 `req.query` is read-only | Use `Object.defineProperty` (already handled in `validate.ts`) |
| `PrismaClientValidationError: take expected Int, got String` | Add `z.coerce.number()` in validator |
| JWT `expiresIn` type error | Cast `as any` in `token.ts` |

### Testing

| Issue | Where to look |
|-------|---------------|
| `Your test suite must contain at least one test` | Exclude `src/__tests__/integration/` from default `jest.config.js` |
| Integration tests time out after 5s | Use `npm run test:integration` (uses `jest.integration.config.js`) |
| Async middleware assertions fail silently | Use a `flushAsync` helper (see §8.1) |
| Daily quests inactive after seed | Seed deletes and recreates them each run |

### Environment (Windows)

| Issue | Where to look |
|-------|---------------|
| `fatal: detected dubious ownership` | `git config --global --add safe.directory D:/Career/Qafzly` |
| `dotenv -e .env.test` fails on PowerShell | Python `dotenv` shadowing — use the npm script |
| `curl` returns PowerShell objects | Use `curl.exe` |
| `docker exec -it` hangs | Drop the `-t` for one-shot commands |

---

## 13. Review Checklist for PRs

Before opening a PR, confirm:

- [ ] Branch name follows conventions (`feature/*`, `fix/*`, `docs/*`, `test/*`).
- [ ] Commit messages follow the `<type>: <description>` format.
- [ ] Unit tests added/updated for new service, middleware, or job code.
- [ ] Integration test added for any new critical endpoint.
- [ ] `npm test -- --coverage` passes and coverage did not drop below 80% for new code.
- [ ] `npm run test:integration` passes locally.
- [ ] `npx tsc --noEmit` is clean.
- [ ] Swagger spec (`src/config/swagger.ts`) updated for new endpoints.
- [ ] `README.md` / `HANDOFF.md` updated for major changes.
- [ ] No secrets or `.env*` files committed.
- [ ] If schema changed: migration created with `--create-only`, audited, and `npm run check:migrations` is clean.
- [ ] No debug `console.log` left in code (temporary ones must be removed).
- [ ] Non-blocking side effects (email, streaks, certificates) wrapped in try/catch and logged.
- [ ] No changes to `Unsupported("tsvector")` declarations in `schema.prisma`.

---

Thank you for contributing to Qafzly!