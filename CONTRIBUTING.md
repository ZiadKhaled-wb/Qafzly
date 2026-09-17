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
  feature/community-reporting
  fix/boolean-query-coercion
  docs/update-contributing
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
feat: server-side answer evaluation for slides and checkpoints
feat: lesson-completion XP + warm-up XP endpoint
feat: community contract fixes (author, userVote, postCount)
feat: forum reporting + moderation queue rewrite
feat: parent dashboard fixes (email link, flat settings, aggregated billing)
feat: boss battle badge persistence + retry tier rename
fix: boolean query parameter coercion across isFeatured/isPublished/isArchived
fix: comment duplication in getComments
fix: admin bypass on GET /paths/:id and GET /forum/posts/:id
fix: replace in-memory rate limiter with Redis-backed sliding window
fix: rebuild refresh token payload before signing new access token
chore: deprecate Subscription model
chore: rebase migration history to a single baseline
test: expand integration suite to 80 tests
test: search service branch coverage to 100%
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
- `jobs/` contain background cron work (see `paymentExpiry.job.ts`).
- `middleware/` contains reusable request-level concerns.

Do not mix responsibilities.

**Common pitfalls:**
- Always import the router in `src/routes/index.ts` and mount it with a leading slash (e.g., `router.use('/enrollments', enrollmentRoutes);`). A missing mount silently produces 404s.
- Keep the base mount consistent with the plural form the frontend expects (e.g., `/payments`, not `/payment`).

### 4.4 Non-Blocking Side Effects

Certain operations must **never** propagate their failure into the request response:

- **Email sending** — `sendEmail` catches and logs; never throws. See `email.service.ts`.
- **Certificate auto-issue** — hooked into `progress.service.ts`; wrapped in try/catch.
- **Streak updates** — same as above.
- **Lesson-completion XP award** — same as above (Sprint 12).
- **Boss battle badge award** — logged on failure, never propagated.

Wrap new side effects in try/catch and log via `logger.error`. Use `void somePromise.catch(...)` for fire-and-forget.

### 4.5 Optional Authentication

For endpoints that should serve both anonymous and authenticated users (lesson detail with preview, forum posts with `userVote`, etc.), use `optionalAuth` middleware instead of `authenticate`. It attaches `req.user` when a valid Bearer token is present and continues as anonymous otherwise. Never use it on endpoints that require authentication.

### 4.6 Response Shape Conventions (Sprint 12)

Never leak raw Prisma objects to the frontend. Reshape in the service layer.

**Community responses:**
- Use **`author`** (not `user`) for post/comment authors. Helper: `toAuthor()` in `forum.service.ts`.
- Always include **`userVote`** (`'up' | 'down' | null`) on posts and comments when `userId` is available. Use `getUserVoteMap()` for batched lookups (no N+1).
- Use **`isSolved`** on posts and **`isBestAnswer`** on comments — there is no `bestAnswerId` field.
- `postCount` on categories counts published, non-deleted posts only.

**Parent responses:**
- Settings endpoints return the flat shape `{ lockOverrideEnabled, customLockDurationHours }` regardless of whether a `ChildSettings` row exists.

### 4.7 Server-Side Answer Evaluation (Sprint 12)

**Never accept `isCorrect` / `completed` from the client.** Correctness is computed server-side.

- Module: `src/services/answerEvaluation.service.ts`
- Functions: `evaluateSlideAnswer`, `evaluateCheckpointSubmission`, `evaluateWarmUpAnswer`
- Arabic normalization applied to FILL_BLANK + warm-up answers (tashkeel stripped, alef/yeh/teh variants normalized)
- Zod schemas use `.strict()` on `completeSlide` and `completeCheckpoint` — extra fields → `400`
- Boss battles already worked this way

**Answer shapes:**

| Slide type | Answer shape |
|---|---|
| INFO | `{}` (or omitted) |
| QUIZ | `{ "index": 2 }` |
| TRUE_FALSE | `{ "value": true }` |
| FILL_BLANK | `{ "text": "الطوبة" }` |
| DRAG_DROP | `{ "items": [{ "label": "...", "correctZone": "..." }] }` |

**If you add a new slide type:** add an evaluator branch to `answerEvaluation.service.ts` and unit tests in `answerEvaluation.service.test.ts`.

---

## 5. Validation

- Use Zod schemas located in `src/utils/validators/`.
- Bind schemas in routes with `validate(schema)` middleware.
- The middleware replaces `req.body`, `req.query`, `req.params` with parsed values.
- **Express 5 note:** `req.query` and `req.params` are getter-only. The middleware uses `Object.defineProperty` — do not change this pattern.

### 5.1 Query-String Booleans (Sprint 12)

**Always** use `optionalBooleanQuery` from `src/utils/validators/booleanQuery.ts` for query params that accept booleans.

```typescript
import { optionalBooleanQuery } from './booleanQuery';

export const listPathsQuerySchema = z.object({
    query: z.object({
        // ...
        isFeatured: optionalBooleanQuery,
    }),
});
```

**Never** use these — both are broken:

| Broken pattern | Why it fails |
|---|---|
| `z.coerce.boolean()` | `Boolean('false')` is `true` — non-empty strings are truthy |
| `.optional().transform(v => v === 'true')` | Zod runs `.transform()` on `undefined`, silently turning an omitted param into `false` (adds an unintended filter) |

`optionalBooleanQuery` preserves three distinct cases:
- `'true'` → `true`
- `'false'` → `false`
- omitted → `undefined` (no filter)

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

**⚠️ Never chain migration commands in one shell paste.** Run each as a separate command and inspect output before the next.

```bash
# 1. Create the migration WITHOUT applying it
npx prisma migrate dev --create-only --name <short_description>
```

```bash
# 2. Open the generated prisma/migrations/<timestamp>_<name>/migration.sql
#    and DELETE any of these lines if present:
#      ALTER TABLE ... ALTER COLUMN "search_vector_ar" DROP DEFAULT
#      ALTER TABLE ... ALTER COLUMN "search_vector_en" DROP DEFAULT
#      ALTER TABLE ... DROP COLUMN "search_vector_ar"
#      ALTER TABLE ... DROP COLUMN "search_vector_en"
#      DROP INDEX "idx_paths_search_ar"                     (and the 7 other
#      DROP INDEX "idx_forum_posts_search_ar"                search/trigram
#      DROP INDEX "idx_users_fullname_trgm"                  indexes)
```

```bash
# 3. Run the safety net (do NOT proceed if this fails)
npm run check:migrations
```

```bash
# 4. Apply
npx prisma migrate deploy
```

### Rules

- ❌ **Never** run bare `npx prisma migrate dev` — always use `--create-only`
- ❌ **Never** chain migration commands — if `check:migrations` fails, `migrate deploy` will still run and apply the broken migration
- ❌ **Never** commit a migration without running `npm run check:migrations`
- ❌ **Never** edit a migration that has already been applied to any environment
- ✅ `--create-only` → audit → `check:migrations` → `deploy` — one command at a time

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

The `tsvector` columns are declared as `Unsupported("tsvector")?` in `schema.prisma`. **Do not remove these declarations** — Prisma will drop the columns on the next migration.

When writing `$queryRaw` against `paths` or `forum_posts`:
- Use `plainto_tsquery(${config}::regconfig, ${q})` — the `::regconfig` cast is required.
- Select explicit columns — **never `SELECT *`**, or Prisma fails to deserialize the `tsvector` columns.

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

  - When a service does `create` followed by `findUnique` (e.g., forum `createPost`), mock both calls.
  - When a service iterates a relation array (e.g., `comment.replies`), always include `replies: []` in the mock.

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
  - When a test asserts on user-specific state (votes, completions), register a **fresh user** per test — the seed's shared users accumulate state across files.

### 8.3 Which tests should I add?

| Change | Required tests |
|--------|----------------|
| New service method | Unit test(s) in `src/services/__tests__/` |
| New middleware | Unit test(s) in `src/middleware/__tests__/` |
| New background job | Unit test(s) in `src/jobs/__tests__/` |
| New endpoint on a critical flow (auth, enrollment, payments, gamification, certificates, community) | Integration test in `src/__tests__/integration/` |
| Bug fix | Add a regression test that would have caught the bug |
| New feature | Unit + integration where the flow is user-visible |
| New slide type or answer format | Unit test in `answerEvaluation.service.test.ts` + integration test in `slides.test.ts` |
| New query-string boolean filter | Test both `?param=true` and `?param=false` behaviors |

### 8.4 Current test status

- Unit: **452 passing**, service-layer coverage ~93% statements, ~82% branches.
- Integration: **80/80 passing** across 18 files.

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

### Breaking contract changes

Any change to a response shape that the frontend already consumes (field renames, added/removed fields, changed types) must:

1. Be documented in a frontend contract response document.
2. Be flagged with a "known changes since last reference sheet" section at the top.
3. Ship with a same-day notification to the frontend team.

This was the pattern that eliminated rework on Tasks #6 and #7.

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
- When passing SQL to `psql` via `docker exec`, use **single quotes** for the whole `-c` argument — PowerShell mangles escaped double quotes.

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

### Sprint 5 – Manual Payments (MVP)

- Payment request creation with Vodafone Cash / InstaPay instructions.
- User tracking (list requests, mark sent).
- Admin management (list with filters, activate, reject).
- Arabic email templates.

### Sprint 6 – Community Features

- Forum categories, posts, comments.
- Polymorphic voting (posts + comments).
- Best answer marking.
- Post search by title/content.
- Admin moderation: reports, resolve, hide/unhide.

### Sprint 7 – Notifications

- User notifications with filters (read/archived/dismissed/type), unread count, mark read, archive, dismiss, delete.
- Device register/unregister.
- Admin system notification (all users or specific).
- Email via SES (originally SendGrid; migrated in Sprint 11).
- Push placeholder (logged).

### Sprint 8 – Search & Recommendations

- Global search across paths, forum posts, users with relevance ranking.
- Path/forum/user search with filters.
- Personalized, popular, trending, related path recommendations.
- Generated `tsvector` columns + GIN + trigram indexes.

### Sprint 9 – Parent-Child, Lesson Expansion, Lock, PDF

- Removed `INSTRUCTOR` role; roles now `STUDENT`, `PARENT`, `ADMIN`.
- Self-referential parent-child relation + `ChildSettings` model.
- Parent dashboard endpoints (overview, billing, child management).
- Lesson structure expanded (video URLs, PDF, slides JSON, challenge fields, `lockDurationHours`).
- 12-hour lock logic with parent override.
- PDF delivery via S3 signed URLs (5-min expiry).
- YouTube ID validation.

### Sprint 10 – Enhanced Content Structure

- New models: `Slide`, `QuestCheckpoint`, `BossBattle`, `BossBattleQuestion`, plus user-progress tables.
- Full CRUD + completion endpoints for slides, checkpoints, boss battles.
- XP recharge boost window (base XP only, not victory bonus).

### Sprint 11 – UAT & Bug Fixing ✅

**Infrastructure**

- Integration test suite with isolated Docker containers.
- `.env.test`, `jest.integration.config.js`, `npm run test:integration`.
- 22 integration tests passing across 9 files.

**Critical production fixes**

- `/enrollments` router not mounted → fixed.
- `/moderation` missing leading slash → fixed.
- `/payment` → `/payments` mount rename.
- Refresh token payload rebuild.
- Search service: `plainto_tsquery` + `::regconfig` cast.

**New features**

- Redis-backed rate limiter with factory pattern.
- Payment expiration cron (every 5 min, Redis-locked).
- Graceful shutdown with SIGTERM/SIGINT handlers.
- Health check split: `/health/live` + `/health/ready`.
- Idempotency-Key on `POST /payments/requests`.
- AWS SES migration (SendGrid removed).
- Preview lesson access control.
- Certificate generation (auto-issue, verification, PDF, admin revoke).
- Student Dashboard response shapes.
- Auto-streak on lesson completion.
- Migration history rebasing + `check:migrations` safety net.

### Sprint 12 – Security, Community Contract & Test Expansion ✅

**Server-side security**

- **New module** `src/services/answerEvaluation.service.ts`
- Slide + checkpoint completion now compute correctness server-side
- `.strict()` Zod schemas reject client-submitted `isCorrect` / `completed`
- Arabic normalization for FILL_BLANK and warm-up answers
- API contract change: slide complete body is `{ answer }` only; checkpoint complete body is `{ selfReflectionAnswer }` only

**New features**

- **Lesson-completion XP** (`Lesson.completionXpAward`, default 10) — idempotent, non-blocking
- **Warm-up XP endpoint** (`POST /lessons/:lessonId/warmup/complete`)
- **Forum reporting** — `ForumReport` model, report endpoints, moderation queue rewrite with embedded `reporter`/`post`/`comment`

**Contract fixes**

- **Parent Dashboard** — `POST /parents/me/children` accepts `email`; settings endpoints return flat shape; `GET /parents/me/billing` aggregates purchases across children
- **Community** — `user` → `author`, `userVote` on posts/comments, `postCount` on categories, comment duplication bug fixed, deterministic sorting
- **Boss Battle** — badge persistence for all 4 tiers, retry tier renamed `مش هستسلم`, seed now has 5 questions (all tiers reachable)
- **Notifications** — boolean query params correctly distinguish omitted from `false`
- **Admin bypass** — `optionalAuth` on `GET /paths/:id` and `GET /forum/posts/:id`

**Bug class eliminated**

- **`optionalBooleanQuery`** shared helper replaces `z.coerce.boolean()` and `.optional().transform(v => v === 'true')` across `path.schema.ts`, `module.schema.ts`, `notification.schema.ts`

**Deprecation**

- **`Subscription` model removed** — `Enrollment.expiresAt` is the source of truth

**Testing**

- Search branch coverage: 61.9% → 100%
- Integration suite: 22 → 80 tests (9 → 18 files)
- Unit tests: 361 → 452

**Deferred to Sprint 13**

- Recommendation refinement
- Bulk enrollment endpoint
- Weekly summary cron
- Controller unit tests
- Deployment configuration (CI/CD)

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
| Migration folder deleted but Prisma still complains | `migrate resolve --rolled-back <name>` then `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` then `migrate deploy` |

### Runtime

| Issue | Where to look |
|-------|---------------|
| Missing route → 404 | Check `src/routes/index.ts` mount + leading slash in the route file |
| `Bad "options.expiresIn"` on refresh | `auth.service.ts > refreshToken` — rebuild payload |
| Express 5 `req.query` is read-only | Use `Object.defineProperty` (already handled in `validate.ts`) |
| `PrismaClientValidationError: take expected Int, got String` | Add `z.coerce.number()` in validator |
| JWT `expiresIn` type error | Cast `as any` in `token.ts` |
| `?isFeatured=false` returns featured paths | `z.coerce.boolean()` bug — use `optionalBooleanQuery` |
| `?isArchived=true` returns empty list | Same bug class — the `undefined`-swallowing variant |
| Community post missing `author` field | Response shape was renamed in Sprint 12 — use `post.author` not `post.user` |
| Votes don't highlight after click | List/detail endpoint needs `optionalAuth`; refetch after vote |
| Boss battle trainee tier unreachable | Seed has 5 questions — re-seed if your DB has 3 |
| Boss battle badge not persisted | Fixed in Sprint 12 — badges are real `UserBadge` rows now |

### Testing

| Issue | Where to look |
|-------|---------------|
| `Your test suite must contain at least one test` | Exclude `src/__tests__/integration/` from default `jest.config.js` |
| Integration tests time out after 5s | Use `npm run test:integration` (uses `jest.integration.config.js`) |
| Async middleware assertions fail silently | Use a `flushAsync` helper (see §8.1) |
| Daily quests inactive after seed | Seed deletes and recreates them each run |
| `c.replies is not iterable` | Mock must include `replies: []` on every comment |

### Environment (Windows)

| Issue | Where to look |
|-------|---------------|
| `fatal: detected dubious ownership` | `git config --global --add safe.directory D:/Career/Qafzly` |
| `dotenv -e .env.test` fails on PowerShell | Python `dotenv` shadowing — use the npm script |
| `curl` returns PowerShell objects | Use `curl.exe` |
| `docker exec -it` hangs | Drop the `-t` for one-shot commands |
| `psql` complains "extra command-line argument" | PowerShell mangled escaped quotes — use single-quoted `-c` argument |

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
- [ ] Non-blocking side effects (email, streaks, certificates, XP awards) wrapped in try/catch and logged.
- [ ] No changes to `Unsupported("tsvector")` declarations in `schema.prisma`.
- [ ] Query-string booleans use `optionalBooleanQuery`, not `z.coerce.boolean()` or `.optional().transform()`.
- [ ] Client-submitted correctness fields (`isCorrect`, `completed`) are rejected by `.strict()` schemas.
- [ ] Community responses use `author` (not `user`) and include `userVote` when a user is authenticated.
- [ ] Response shape changes are documented in a frontend contract response before merging.

---

Thank you for contributing to Qafzly!