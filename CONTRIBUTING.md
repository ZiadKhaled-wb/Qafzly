# Contributing to Qafztk Backend

Welcome! We appreciate your interest in contributing to the Qafztk backend. This document outlines the guidelines, coding standards, and workflow to follow when adding features, fixing bugs, or improving the codebase.

> **Brand note:** The project was renamed from **Qafzly** to **Qafztk** in September 2026. Some seed-data emails (`admin@qafzly.com`, `child1@qafzly.com`, `test-student@qafzly.com`, etc.) intentionally remain on the old domain until the seed rename is coordinated with the PM. All new code, docs, and commit messages use **Qafztk**.

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
feat: recommendation refinement — unified Path[] shape, skill-matched cold-start,
      category-weighted warm-start, deterministic tie-breakers
feat: payment contract polish — Decimal string amount, QFZ- reference codes
feat: seed payment requests (PENDING / ACTIVATED / REJECTED)
feat: weekly summary cron — Monday 08:00 Cairo, in-app + email, DST-aware
feat: server-side answer evaluation for slides and checkpoints
feat: lesson-completion XP + warm-up XP endpoint
feat: community contract fixes (author, userVote, postCount)
feat: forum reporting + moderation queue rewrite
feat: parent dashboard fixes (email link, flat settings, aggregated billing)
feat: boss battle badge persistence + retry tier rename
fix: recommendations SELECT * against tsvector columns (P0)
fix: recommendation raw SQL text = uuid mismatch
fix: enrolled paths excluded from all recommendation fallback stages
fix: boolean query parameter coercion across isFeatured/isPublished/isArchived
fix: comment duplication in getComments
fix: admin bypass on GET /paths/:id and GET /forum/posts/:id
fix: replace in-memory rate limiter with Redis-backed sliding window
fix: rebuild refresh token payload before signing new access token
chore: deprecate Subscription model
chore: rebase migration history to a single baseline
test: expand integration suite to 80 tests
test: search service branch coverage to 100%
test: recommendation integration file (13 tests, 2 P0 regression guards)
test: weekly summary unit coverage (29 tests)
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
- `jobs/` contain background cron work (`paymentExpiry.job.ts`, `weeklySummary.job.ts`). Jobs follow the same shape: `runXJob()` for the pure cycle, `tickX()` for the schedule/time-gate, `startXJob()` / `stopXJob()` for lifecycle. Redis `SET NX` lock for multi-instance leadership. Fail-open on Redis outage.
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
- **Weekly summary notification + email per user** — the batch uses `Promise.allSettled`; a single-user failure is logged and the batch continues (Sprint 13).
- **`markDigestSent` bookkeeping write** — a failed write only means next week's rank delta is stale for that user; never block the email send over it (Sprint 13).

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

**Recommendation responses (Sprint 13):**
- All four `/recommendations/*` endpoints return a **consistent `Path[]` shape** with a nested `category`. Internal ranking signals (`recent_enrollments`, `co_enrollment_count`) are never included — sort order conveys the ranking.
- The frontend uses the same `<PathCard />` for all four lists; do not introduce per-endpoint shape variants.

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

### 4.8 Raw SQL Safety (Prisma + PostgreSQL) — **Sprint 13**

Two traps in this codebase have each caused a P0 bug. Any new `$queryRaw` against `paths` or `forum_posts` must follow both rules.

#### Trap 1 — Never `SELECT *` against tables with `Unsupported("tsvector")?` columns

`paths` and `forum_posts` each carry two generated `tsvector` columns (`search_vector_ar`, `search_vector_en`). Prisma's client **cannot deserialize `tsvector`** — a raw query that returns those columns will throw at read time, not write time. The endpoint returns **HTTP 500**.

**Wrong:**
```ts
SELECT p.*, COUNT(e.id) AS recent_enrollments
FROM "paths" p ...
```

**Right — two-query pattern:**
```ts
// 1. Raw SQL selects only id + the aggregate
const rows = await prisma.$queryRaw<Array<{ id: string; recent_enrollments: bigint }>>`
    SELECT p.id, COUNT(e.id) AS recent_enrollments
    FROM "paths" p
    JOIN "enrollments" e ON e."pathId" = p.id
    ...
`;

// 2. Second Prisma findMany fetches the full Path shape via a shared projection
const paths = await prisma.path.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: PATH_SELECT,
});

// 3. Preserve the SQL ranking order
const byId = new Map(paths.map((p) => [p.id, p] as const));
return rows.map((r) => byId.get(r.id)).filter(Boolean);
```

**Two services hit this exact trap:** `search.service.ts` (fixed Sprint 11) and `recommendation.service.ts` (fixed Sprint 13). The integration suite now has regression guards for both — but only because the test DB runs `ALTER TABLE ... ADD COLUMN ... tsvector GENERATED`. A unit test that mocks `$queryRaw` will **not** catch this.

#### Trap 2 — Never cast a `text` parameter with `::uuid`

Our schema declares `id`, `pathId`, `categoryId`, and all `String @id @default(uuid())` columns as PostgreSQL `text` — **no `@db.Uuid` decorator**. Prisma binds string parameters as `text`, so the comparison is `text = text`.

**Wrong:**
```ts
WHERE e1."pathId" = ${pathId}::uuid   -- Postgres: operator does not exist: text = uuid (42883)
```

**Right:**
```ts
WHERE e1."pathId" = ${pathId}          -- text = text, always works
```

**Column-side casts** are still fine and sometimes required when comparing a Postgres enum to a text parameter:
```ts
AND p."difficulty"::text = ${filters.difficulty}   -- OK; the cast is on the column, not the parameter
```

#### Checklist for any new raw SQL

- [ ] Explicit column list — no `SELECT *`
- [ ] No `::uuid` casts on parameters
- [ ] `::text` casts only on columns (never on parameters), and only when comparing to a text-bound value
- [ ] Integration test that hits the endpoint end-to-end (unit tests with mocked `$queryRaw` will not catch either trap)
- [ ] If the query ranks results, preserve the SQL order when fetching the full shape via a second `findMany`

### 4.9 Payment Reference Codes (Sprint 13)

Payment reference codes are user-facing, over-the-phone-readable strings. Two invariants:

1. **Format is `QFZ-XXXX-XXXX-XXXX`** — 18 chars total, 3 groups of 4. Alphabet is Crockford base32, **excluding `I`, `L`, `O`, `U`** so users never confuse `0/O`, `1/I/L`. The old `PAY-…` format is gone — do not reintroduce it anywhere.
2. **The code returned to the caller must come from the successful `INSERT`, not from a locally generated string.** `persistPaymentRequest` retries up to 3 times on Prisma `P2002` (unique-constraint collision). On a retry, the locally generated code is thrown away; the code from the retrying insert is what gets returned. Returning the pre-retry code would silently mismatch the DB row.

`amount` is a **Decimal string** (e.g. `"150.00"`), never a JS number. Frontend uses `Intl.NumberFormat` for display; never `parseFloat` for arithmetic.

When adding new user-facing codes (future certificates, invites, etc.), reuse the same `generateReferenceCode` shape: `{PREFIX}-XXXX-XXXX-XXXX` with Crockford base32, collision-retry on insert, and always return the code that was actually persisted.

### 4.10 Cairo Timezone (Sprint 13)

**Egypt reintroduced DST in 2023.** The offset is UTC+2 in winter and UTC+3 in summer — **do not hardcode offsets anywhere**. Any scheduling that says "Monday 08:00 Cairo time" must use `Intl.DateTimeFormat` with `timeZone: 'Africa/Cairo'`:

```ts
const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    hour: '2-digit',
    hour12: false,
});
const parts = fmt.formatToParts(now);
const weekday = parts.find((p) => p.type === 'weekday')?.value;
const hour = parts.find((p) => p.type === 'hour')?.value;
return weekday === 'Monday' && hour === '08';
```

**Never** compute the offset manually (`now.getUTCHours() - 2` etc.) — the job would silently drift twice a year.

**Test fixtures:** when testing Cairo-time logic, construct dates explicitly:
- Monday 08:00 Cairo in September (DST, UTC+3) → `new Date('2026-09-21T05:00:00Z')`
- Monday 08:00 Cairo in December (no DST, UTC+2) → `new Date('2026-12-21T06:00:00Z')`

Never assume a fixed offset in tests.

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
- **No `::uuid` casts on parameters** — see §4.8 for the full raw SQL safety rules.

**Two services have hit these traps:** `search.service.ts` (fixed Sprint 11 — `SELECT *`) and `recommendation.service.ts` (fixed Sprint 13 — `SELECT *` and `text = uuid`). Both now have integration regression guards.

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

  - **Reset mocks with `jest.resetAllMocks()` — not `clearAllMocks()` — and re-establish persistent defaults in `beforeEach`:**

    ```ts
    beforeEach(() => {
        jest.resetAllMocks();
        // Re-establish the defaults that were wiped:
        (prisma.path.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.enrollment.findMany as jest.Mock).mockResolvedValue([]);
    });
    ```

    **Why this matters:**
    - `jest.clearAllMocks()` only clears call history — persistent `mockResolvedValue()` implementations **leak across tests**. A test that does `mockResolvedValue([{ id: 'y' }, { id: 'x' }])` sets a persistent default that silently pollutes later tests.
    - `jest.resetAllMocks()` clears both call history **and** persistent implementations, plus drains the `mockResolvedValueOnce` queue. But wiping persistent implementations means that fallback code paths (which the test didn't explicitly set up) receive `undefined`, causing `TypeError: X is not iterable`.
    - The combination — `resetAllMocks()` + re-establish defaults — is the correct pattern. Both bugs surfaced in `recommendation.service.test.ts` during Sprint 13.

  - For middleware wrapped in `asyncHandler` (which returns a void function with a detached promise chain), use a `flushAsync` helper before asserting:

    ```ts
    const flushAsync = () => new Promise<void>((r) => setImmediate(r));
    mw(req, res, next);
    await flushAsync();
    ```

  - When a service does `create` followed by `findUnique` (e.g., forum `createPost`), mock both calls.
  - When a service iterates a relation array (e.g., `comment.replies`), always include `replies: []` in the mock.
  - When testing time-based jobs, construct dates explicitly — see §4.10 for Cairo timezone fixtures. Never rely on the system clock.

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
  - **`setup.ts` creates the `tsvector` columns on the test DB.** This is what makes the integration suite the only layer that catches `SELECT *` regressions — the unit layer with mocked `$queryRaw` cannot. Any new raw SQL against `paths` or `forum_posts` must have at least one integration test that hits the endpoint end-to-end.

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
| New raw SQL against `paths`/`forum_posts` | Integration test hitting the endpoint end-to-end (unit tests with mocked `$queryRaw` cannot catch tsvector or type-cast issues — see §4.8) |
| New time-based job or schedule | Unit test with explicit dates. Cairo fixtures: 08:00 in September = `05:00Z`; in December = `06:00Z` |
| New user-facing code format (reference codes, invites, etc.) | Unit test asserting the format regex + a test for the retry-on-collision path |

### 8.4 Current test status

**Sprint 13 close:**

- Unit: **~518 passing**, service-layer coverage ~93% statements, ~85% branches.
- Integration: **~93/93 passing** across ~19 files.

**Sprint 12 baseline (for reference):**

- Unit: **452 passing**, service-layer coverage ~93% statements, ~82% branches.
- Integration: **80/80 passing** across 18 files.

**Notable Sprint 13 additions:**

- `recommendation.service.test.ts` — rewritten (27 tests). Covers the full fallback chain, category weighting, deterministic ordering, and the enrolled-path exclusion at every stage.
- `recommendations.test.ts` (integration, new) — 13 tests. Includes two P0 tsvector regression guards (`/trending` and `/related/:pathId` must return 200) and a shape-consistency test across all four endpoints.
- `weeklySummary.service.test.ts` (new) — 16 tests. Eligibility, opt-out, per-field aggregation, rank delta, non-blocking persistence.
- `weeklySummary.job.test.ts` (new) — 13 tests. Cairo DST-aware scheduling, dedupe window, Redis lock fail-open, `Promise.allSettled` batch isolation, start/stop lifecycle.
- `payment.service.test.ts` — 2 new tests: reference-code retry-on-collision + regex on the `QFZ-…` format.

---

## 9. Documentation

Update the following when making changes:

- **`README.md`** — when adding new endpoints or changing setup.
- **`HANDOFF.md`** — for major changes, new sprints, or architectural decisions.
- **`DEVELOPER_ONBOARDING.md`** — when onboarding-relevant conventions or gotchas change.
- **`CONTRIBUTING.md`** — when coding standards, testing patterns, or workflows change (this document).
- **`BACKEND_REFERENCE.md`** — when endpoint contracts change. This is the frontend team's primary reference; keep it authoritative.
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

This was the pattern that eliminated rework on Tasks #6, #7, and #9. Sprint 13 shipped two breaking changes under this pattern:
- `/recommendations/trending` and `/recommendations/related/:pathId` — response shape unified to `Path[]` (both endpoints previously 500'd, so no consumer existed; the "breaking" label is precautionary).
- `POST /payments/requests` — `amount` type changed from `number` to `string`; `referenceCode` format changed from `PAY-…` to `QFZ-…`.

When in doubt about whether a change is breaking: check `BACKEND_REFERENCE.md` against the actual response. If they differ, the change is breaking — document it.

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

### Sprint 13 – Content Polish & Retention ✅

**Recommendation refinement**

- **P0 fix — `SELECT *` against `paths`:** `/trending` and `/related/:pathId` returned 500 due to `Unsupported("tsvector")` columns. Fixed with the two-query pattern: raw SQL selects `id` + aggregate, second `findMany` fetches the full shape.
- **P0 fix — `text = uuid` mismatch:** `::uuid` casts on text parameters caused Postgres error `42883`. Casts removed; only column-side casts remain.
- **Unified response shape:** all four `/recommendations/*` endpoints return `Path[]` with nested `category`. Internal ranking signals stripped from the response.
- **Cold-start fallback chain:** skill-matched popular → popular → trending.
- **Warm-start fallback chain:** category-weighted → skill-matched popular → popular → trending.
- **Difficulty adjacency** for skill matching (`BEGINNER`/`INTERMEDIATE`/`ADVANCED`).
- **Deterministic tie-breakers** everywhere: `enrollments DESC → createdAt DESC → id ASC`.
- **Enrolled paths excluded from every stage** — including popular and trending fallbacks.

**Payment contract polish**

- **`amount` is a Decimal string** (`"150.00"`) — frontend uses `Intl.NumberFormat`, never `parseFloat`.
- **`referenceCode` uses `QFZ-XXXX-XXXX-XXXX`** Crockford base32 (excludes `I L O U`). Retry-on-collision at the persistence layer — the returned code always comes from the successful insert.
- **Seed payment requests:** three rows against the Python path (PENDING/ACTIVATED/REJECTED) with `SEED`-marked reference codes.

**Weekly summary cron**

- **Fires Monday 08:00 Africa/Cairo**, checked every 15 minutes. DST-aware via `Intl.DateTimeFormat` — never offset math.
- **In-app notification + email**, both suppressed when `privacySettings.emailNotifications === false`.
- **Zero-activity users still receive the digest** with a re-engagement body.
- **State fields:** `User.lastWeeklySummaryAt` + `User.lastWeeklySummaryRank`. Dedupe window is 6 days.
- **Batch design:** 7 queries per cycle, independent of user count.
- **All per-user side effects non-blocking** via `Promise.allSettled`.
- **Digest fields (9):** `xpEarned`, `lessonsCompleted`, `currentStreak`, `longestStreak`, `rank`, `rankChange`, `badgesEarned[]`, `certificatesEarned`, `bossBattlesWon`.

**Bug class documented**

- **Raw SQL safety (§4.8)** — two traps documented (tsvector `SELECT *` and `text = uuid` casts), both with checklists. Any new raw SQL against `paths` or `forum_posts` must follow both rules.
- **Mock reset (§8.1)** — `jest.clearAllMocks()` is insufficient; use `jest.resetAllMocks()` + re-establish persistent defaults.

**Testing**

- Recommendation service: 27 unit tests + 13 integration tests (2 P0 regression guards).
- Weekly summary: 16 service tests + 13 job tests.
- Payment: 2 new tests (retry-on-collision + reference-code regex).
- Integration suite: 80 → ~93 tests.
- Unit suite: 452 → ~518 tests.

**Deferred to Sprint 14**

- Bulk enrollment endpoint (enterprise)
- Controller unit tests
- Deployment configuration + CI/CD
- Brand pass on email templates (Qafzly → Qafztk)
- `activatePaymentRequest` upsert fix
- Replace `Unsupported("tsvector")` generated columns with trigger-maintained columns
- RDS migration decision (if approved)

---

## 12. Known Issues & Gotchas (Quick Reference)

### Prisma & Migrations

| Issue | Where to look |
|-------|---------------|
| `migrate dev` generates `DROP DEFAULT` on tsvector columns | Prisma bug — see §7. Use `--create-only` + audit |
| `migrate dev` generates `DROP INDEX` on search indexes | Same as above |
| `column "search_vector_*" does not exist` | Apply the baseline migration; never let a bad `DROP COLUMN` run |
| `Failed to deserialize column of type 'tsvector'` | Never use `SELECT *` in raw SQL against `paths` or `forum_posts`; list columns — see §4.8 |
| `operator does not exist: text = uuid` (code 42883) | Drop `::uuid` casts on parameters; our IDs are `text` — see §4.8 |
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
| `/recommendations/trending` or `/related` returns 500 | Sprint 13 P0 — confirm `recommendation.service.ts` selects only `id` + aggregate in raw SQL, then fetches full shape via second `findMany` |
| Payment `referenceCode` starts with `PAY-` | Pre-Sprint-13 format — check `generateReferenceCode` was updated; new rows must be `QFZ-` |
| Payment `amount` is a number, not a string | Sprint 13 contract polish — confirm `(amountCents / 100).toFixed(2)` in `payment.service.ts` |
| Weekly summary runs on the wrong day | Hardcoded UTC offset — must use `Intl.DateTimeFormat` with `timeZone: 'Africa/Cairo'` |
| Weekly summary duplicates within one week | Dedupe window bypassed — check `lastWeeklySummaryAt` guard AND per-user write. Silent `markDigestSent` failures will cause duplicate sends |
| Weekly summary aborts after one user fails | Missing `Promise.allSettled` — `runWeeklySummaryJob` must use `allSettled`, not `all` |

### Testing

| Issue | Where to look |
|-------|---------------|
| `Your test suite must contain at least one test` | Exclude `src/__tests__/integration/` from default `jest.config.js` |
| Integration tests time out after 5s | Use `npm run test:integration` (uses `jest.integration.config.js`) |
| Async middleware assertions fail silently | Use a `flushAsync` helper (see §8.1) |
| Daily quests inactive after seed | Seed deletes and recreates them each run |
| `c.replies is not iterable` | Mock must include `replies: []` on every comment |
| Mock implementation leaks across tests | Use `jest.resetAllMocks()` + re-establish defaults — see §8.1 |
| Fallback code paths receive `undefined` after `resetAllMocks` | Same — re-establish persistent defaults in `beforeEach` |
| `TypeError: X is not iterable` in recommendation/weekly service tests | Same as above — a mock default is missing after reset |
| Time-based test fails on CI but passes locally | Hardcoded Cairo offset in test fixture — use explicit UTC dates per §4.10 |

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

**Process**
- [ ] Branch name follows conventions (`feature/*`, `fix/*`, `docs/*`, `test/*`).
- [ ] Commit messages follow the `<type>: <description>` format.
- [ ] No secrets or `.env*` files committed.
- [ ] No debug `console.log` left in code (temporary ones must be removed).

**Testing**
- [ ] Unit tests added/updated for new service, middleware, or job code.
- [ ] Integration test added for any new critical endpoint.
- [ ] New raw SQL against `paths` or `forum_posts` has an integration test (unit tests with mocked `$queryRaw` cannot catch tsvector or type-cast issues — see §4.8).
- [ ] `npm test -- --coverage` passes and coverage did not drop below 80% for new code.
- [ ] `npm run test:integration` passes locally.
- [ ] `npx tsc --noEmit` is clean.
- [ ] Mock reset uses `jest.resetAllMocks()` + re-established defaults (§8.1), not `jest.clearAllMocks()`.

**Schema & Migrations**
- [ ] If schema changed: migration created with `--create-only`, audited for `DROP DEFAULT` / `DROP COLUMN` / `DROP INDEX` on tsvector and trigram lines, and `npm run check:migrations` is clean.
- [ ] No changes to `Unsupported("tsvector")` declarations in `schema.prisma`.

**Contracts & Validation**
- [ ] Query-string booleans use `optionalBooleanQuery`, not `z.coerce.boolean()` or `.optional().transform()`.
- [ ] Client-submitted correctness fields (`isCorrect`, `completed`) are rejected by `.strict()` schemas.
- [ ] Community responses use `author` (not `user`) and include `userVote` when a user is authenticated.
- [ ] Raw SQL follows §4.8 — no `SELECT *`, no `::uuid` casts on parameters.
- [ ] Response shape changes are documented in a frontend contract response before merging.

**Conventions**
- [ ] Non-blocking side effects (email, streaks, certificates, XP awards, weekly summary per-user writes) wrapped in try/catch and logged.
- [ ] New background jobs follow the established shape: `runXJob` / `tickX` / `startXJob` / `stopXJob`, Redis `SET NX` lock, fail-open, `unref()` on timers.
- [ ] Time-based logic uses `Intl.DateTimeFormat` with an IANA timezone (never hardcoded offsets) — see §4.10.
- [ ] New user-facing codes (reference codes, invites, etc.) reuse the Crockford base32 shape and retry-on-collision pattern — see §4.9.

**Documentation**
- [ ] Swagger spec (`src/config/swagger.ts`) updated for new endpoints.
- [ ] `README.md` / `HANDOFF.md` / `DEVELOPER_ONBOARDING.md` updated where relevant.
- [ ] `BACKEND_REFERENCE.md` updated if any client-facing contract changed.

---

Thank you for contributing to Qafztk!