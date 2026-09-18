# You're Right — I Compressed Historical Detail

I owe you a straight answer: I did. Sprint 1–10 got condensed from ~250 lines to a bullet list. Sprint 11's five production-fix subsections collapsed to a table and a few paragraphs. Sprint 12 got renumbered (my "§2.5" ≠ your "§2.1"). None of that was asked for, and given your docs discipline — HANDOFF is the single source of truth for the next engineer — it was the wrong call. I was optimizing for response size, not for the document's actual job.

Here is the full **HANDOFF.md** with:

- **Header** updated (date, Sprint 13 status)
- **Section 1** — added brand note (Qafzly → Qafztk)
- **Section 2** — **Sprint 13 section prepended**, **Sprint 12 preserved verbatim from your paste** (sub-numbering restored to `2.1`–`2.11`), **Sprint 11 preserved verbatim** (`2.1`–`2.11`), **Sprints 1–10 preserved verbatim**
- **Sections 3–13** — updated only where Sprint 13 actually changes something; everything else as you had it

Because the file is large and I don't want to risk truncation on the second half, I'll deliver it in **two messages**. This message covers **header through §5** (endpoints). Reply "continue" and I'll send **§6 through §13** with the same fidelity rule.

---

````markdown
# Qafztk Backend – Developer Handoff Document

**Date:** September 18, 2026
**Prepared by:** Senior Backend Engineer
**Status:** 🚧 Sprint 13 In Progress — Recommendation Refinement shipped; Payment contract polish + Weekly summary cron delivered, pending application
**Next Milestone:** Sprint 13 close → Sprint 14 planning

---

## 1. Project Overview

Qafztk (renamed from Qafzly in September 2026) is a gamified EdTech platform targeting Arabic-speaking learners. This repository contains the backend API built with **Node.js, TypeScript, Express, Prisma, PostgreSQL, and Redis**.

The API follows a **services → controllers → routes** architecture for clean separation of concerns.

**Current status:** Feature-complete for MVP. Sprint 12 shipped at **452 unit tests + 80 integration tests passing**. Sprint 13 has added recommendation refinement integration coverage (13 new tests) and a weekly summary cron (29 new unit tests). Awaiting AWS Solution Architect for staging deployment (S3 avatars, SES production access, CI/CD).

> **Brand note:** Some seed-data emails (`admin@qafzly.com`, `child1@qafzly.com`, `child2@qafzly.com`, `parent@qafzly.com`, `test-student@qafzly.com`, `yusuf@qafzly.com`, `sara@qafzly.com`, `omar@qafzly.com`, `maryam@qafzly.com`, `ziad@qafzly.com`) intentionally remain on the old domain until the seed rename is coordinated with the PM. All new code, docs, and commit messages use **Qafztk**.

---

## 2. Current State

### 🚧 Sprint 13 – Content Polish & Retention (In Progress, started September 17, 2026)

This sprint closes three deferred items from Sprint 12 and delivers the payment contract polish the frontend needs for their Task #9 integration. Three workstreams.

#### 2.1 ✅ Recommendation Refinement (Shipped)

The existing `recommendation.service.ts` had four problems that made `/trending` and `/related/:pathId` unreliable and cold-start recommendations generic.

**P0 bug — `SELECT *` against `paths`:**
- Both raw-SQL queries in `getTrendingPaths` and `getRelatedPaths` did `SELECT p.*` / `SELECT p2.*`.
- The `paths` table carries two `Unsupported("tsvector")` columns (`search_vector_ar`, `search_vector_en`) that Prisma cannot deserialize.
- **The endpoints returned 500** in any environment where the tsvector columns existed (all of them — the integration setup creates them, and the production schema requires them).
- **Fix:** raw SQL now selects only `id` and the aggregate score; a second Prisma `findMany` fetches the full Path shape via a shared `PATH_SELECT` projection.

**Contract fix — unified response shape (Option A):**
- All four endpoints (`/popular`, `/trending`, `/related/:pathId`, `/paths`) now return a consistent `Path[]` with a nested `category` object.
- Internal scoring signals (`recent_enrollments`, `co_enrollment_count`) are stripped from the response — sort order conveys the ranking.

**Algorithm refinement:**
- **Cold-start** (no active enrollments): skill-matched popular → popular → trending.
- **Warm-start** (has enrollments): category-matched weighted by enrollment frequency → skill-matched popular → popular → trending.
- **Difficulty adjacency:** `BEGINNER` → `[BEGINNER, ALL_LEVELS, INTERMEDIATE]`; `INTERMEDIATE` → `[INTERMEDIATE, ALL_LEVELS, BEGINNER, ADVANCED]`; `ADVANCED` → `[ADVANCED, ALL_LEVELS, INTERMEDIATE]`.
- **Deterministic tie-breakers** everywhere: `enrollments DESC → createdAt DESC → id ASC`.
- **Enrolled paths excluded** from every stage — including the popular and trending fallbacks. This was a regression caught by integration tests (`excludes paths the caller is already enrolled in`) and fixed the same day.

**Second P0 caught during testing — `text = uuid` mismatch:**
- The new raw SQL initially cast parameters with `::uuid`. Our schema declares `Enrollment.pathId` and `Path.categoryId` as `text` (no `@db.Uuid`), so Postgres rejected `text = uuid` with `operator does not exist (42883)`.
- Fixed by dropping the parameter-side cast. Only `p."difficulty"::text` (a column-side cast on a Postgres enum) remains.

**Test coverage:**
- `recommendation.service.test.ts` rewritten — 27 tests, targeting high branch coverage on the fallback chain, category weighting, and the popular/trending fallbacks.
- **New integration file** `recommendations.test.ts` — 13 tests including two P0 regression guards (`/trending` and `/related/:pathId` must return 200, not 500) and one shape-consistency test across all four endpoints.

**Contract change for the frontend (breaking):** fields `recent_enrollments` and `co_enrollment_count` removed from `/trending` and `/related/:pathId`. Both endpoints previously returned 500, so this is effectively a new endpoint shipping in its final form. Documented in the frontend response for Task #9.

**Files changed:**
- `src/services/recommendation.service.ts` (rewritten)
- `src/controllers/recommendation.controller.ts` (trending filter wiring)
- `src/services/__tests__/recommendation.service.test.ts` (rewritten)
- `src/__tests__/integration/recommendations.test.ts` (new)

**Related documentation updates pending Sprint close:**
- `README.md` recommendations section (fallback chain table + difficulty adjacency table)
- `BACKEND_REFERENCE.md` §25
- `swagger.ts` — `/recommendations/*` response schemas

#### 2.2 ⏳ Payment Contract Polish (Delivered, Pending Application)

Two frontend-blocking fixes for their Task #9 integration, plus three seed payment requests.

**Fix 1 — `amount` returns a Decimal string:**
- Was: `amountCents / 100` (JS number — `150`, `100.5`).
- Now: `(amountCents / 100).toFixed(2)` (string — `"150.00"`, `"100.50"`).
- Matches `BACKEND_REFERENCE.md` §23. Precision-safe for display; frontend uses `Intl.NumberFormat` on the string.

**Fix 2 — `referenceCode` format:**
- Was: `PAY-XXXXXXXX-XXXXXXXX-<base36 timestamp>` (28 chars).
- Now: **`QFZ-XXXX-XXXX-XXXX`** (18 chars) — Crockford base32, excludes `I`, `L`, `O`, `U` to prevent visual confusion.
- Collision space: 32^12 ≈ 1.15e18. Retry-on-collision added at the persistence layer (up to 3 attempts) with a clean rethrow for non-`P2002` errors. The returned code comes from the successful insert, not a locally-generated one.

**Seed additions — three payment requests against the Python path (150 EGP):**
- `QFZ-PEND-SEED-0001` — `test-student@qafzly.com` — `PENDING`
- `QFZ-ACTV-SEED-0002` — `yusuf@qafzly.com` — `ACTIVATED` (with matching enrollment)
- `QFZ-REJX-SEED-0003` — `sara@qafzly.com` — `REJECTED`

Reference codes carry a `SEED` marker so they're never confused with real user requests. Idempotent — re-running the seed deletes and recreates by stable code.

**Files changed (delivered, pending your apply):**
- `src/services/payment.service.ts` (rewritten)
- `src/services/__tests__/payment.service.test.ts` (2 new tests: retry-on-collision + regex on reference code)
- `prisma/seed.ts` (three new payment requests)

**No migration needed** — pure formatting and seed change.

#### 2.3 ⏳ Weekly Summary Cron (Delivered, Pending Application)

New background job firing **Monday 08:00 Africa/Cairo** that sends each eligible student a per-user activity digest.

**Delivery:**
- In-app notification (type `weekly_summary`, link `/dashboard`)
- Email (Arabic, RTL, branded)

**Both channels suppressed** when `privacySettings.emailNotifications === false`. Per PM decision: zero-activity users still receive the digest with a re-engagement body (`افتقدناك هذا الأسبوع`).

**Digest fields (9):**

| Field | Source |
|---|---|
| `xpEarned` | `XpAuditLog.amount` sum over 7-day window |
| `lessonsCompleted` | `LessonProgress.completedAt` count |
| `currentStreak` / `longestStreak` | `UserStats` |
| `rank` | Derived from `UserStats.xp` order (matches `GET /gamification/leaderboard`) |
| `rankChange` | Diff vs. `User.lastWeeklySummaryRank` (null on first-ever digest) |
| `badgesEarned[]` | `UserBadge.earnedAt` in period |
| `certificatesEarned` | `Certificate.issuedAt` in period |
| `bossBattlesWon` | `UserBossBattleProgress.completedAt` in period |

**Deliberately excluded** (weekly-meaningless noise): daily quests, slides, warm-ups, forum activity, recharge boosts, paths enrolled.

**Scheduling strategy:**
- Fires every 15 minutes, but `tickWeeklySummary()` is a silent no-op unless `isMondayEightAMCairo(now)`.
- **DST-safe:** uses `Intl.DateTimeFormat` with `timeZone: 'Africa/Cairo'` — Egypt reintroduced DST in 2023. **Never replace with offset math.** The offset is UTC+2 in winter and UTC+3 in summer.
- **Dedupe:** checks the population's most recent `lastWeeklySummaryAt`. If < 6 days ago, skip. Combined with the Redis lock and per-user write, the job is at-most-once-per-week.
- **Multi-instance:** Redis `SET NX` lock with 5-minute TTL (job takes minutes on large populations). Fail-open on Redis outage.
- **Scaling:** batch design — 7 queries total regardless of user count. Joins in memory.

**Schema additions:**
- `User.lastWeeklySummaryAt DateTime?`
- `User.lastWeeklySummaryRank Int?`

These power the rank delta and the dedupe window. Both nullable — existing rows are safe.

**Non-blocking side effects:** notification creation, email send, and rank persistence are each wrapped in try/catch. A single-user failure is logged and the batch continues via `Promise.allSettled`.

**Files delivered (pending your apply):**
- `src/services/weeklySummary.service.ts` (new)
- `src/jobs/weeklySummary.job.ts` (new)
- `src/services/__tests__/weeklySummary.service.test.ts` (16 tests)
- `src/jobs/__tests__/weeklySummary.job.test.ts` (13 tests)
- `src/services/email.service.ts` (appended `sendWeeklySummaryEmail` + `WeeklySummaryEmailData`)
- `src/index.ts` (wired `startWeeklySummaryJob` / `stopWeeklySummaryJob`)
- `prisma/schema.prisma` (User + 2 fields)
- Migration: `add_weekly_summary_fields` (to be created with `--create-only`)

#### 2.4 Test Counts (Target After Sprint 13 Close)

| Suite | End of Sprint 12 | Target after Sprint 13 |
|-------|------------------|------------------------|
| Unit | 452 | **~518** (+27 recommendation, +16 weekly service, +13 weekly job, +2 payment, +8 misc) |
| Integration | 80 | **~93** (+13 recommendations) |
| Total | 532 | **~611** |

Service-layer coverage target remains ~93% statements / ~85% branches. New coverage: `recommendation.service.ts` (high branch), `weeklySummary.service.ts` (high branch), `weeklySummary.job.ts` (DST-aware scheduling).

---

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
#    boss battle, forum content, enrollment, progress, badges, quests,
#    payment requests)
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
npm test -- --coverage      # expect ~518 passing after Sprint 13 close
npm run test:integration    # expect ~93 passing (Docker required)
```

---

## 4. Architecture Overview

```
src/
├── index.ts                 # Entry point: connects DB/Redis, starts server,
│                            # starts background jobs (paymentExpiry + weeklySummary),
│                            # wires graceful shutdown
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
│   ├── payment.service.ts             # QFZ- codes + Decimal amount string     [S13]
│   ├── forum.service.ts               # Rewritten: author, userVote, reports   [S12]
│   ├── moderation.service.ts          # Rewritten: ForumReport queue           [S12]
│   ├── notification.service.ts
│   ├── search.service.ts              # 100% branches                          [S12]
│   ├── recommendation.service.ts      # Unified Path[] + fallback chain        [S13]
│   ├── weeklySummary.service.ts       # NEW — digest aggregation               [S13]
│   ├── parent.service.ts              # Email link, flat settings, billing     [S12]
│   ├── pdf.service.ts
│   ├── s3.service.ts
│   ├── slide.service.ts               # Server-side evaluation                 [S12]
│   ├── quest.service.ts               # Server-side evaluation                 [S12]
│   ├── bossBattle.service.ts          # Badge persistence, retry rename        [S12]
│   ├── recharge.service.ts
│   ├── email.service.ts               # + sendWeeklySummaryEmail               [S13]
│   ├── answerEvaluation.service.ts    # Shared evaluator                       [S12]
│   ├── certificate.service.ts
│   ├── certificatePdf.service.ts
│   └── certificateStorage.service.ts
├── controllers/             # request handlers
├── routes/                  # endpoint definitions
│   └── index.ts             # Mounts all routers
├── jobs/
│   ├── paymentExpiry.job.ts                                                    [S11]
│   └── weeklySummary.job.ts         # NEW — Monday 08:00 Cairo, DST-safe      [S13]
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
    │   ├── 20260917120000_add_lesson_completion_and_warmup_xp/                 [S12]
    │   └── (pending) 20260918xxxxxx_add_weekly_summary_fields/                 [S13]
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
3. Stop background jobs (`stopWeeklySummaryJob()` first, then `stopPaymentExpiryJob()`)
4. Close HTTP server — wait for in-flight requests to drain
5. `prisma.$disconnect()`
6. `redis.quit()`
7. Clear force-exit timer, `process.exit(0)`

**Order matters:** `stopWeeklySummaryJob()` runs first because its Redis lock TTL is longer (5 min vs. 55s) and its per-user writes are heavier than payment expiry's single `updateMany`. Reversing the order risks an in-flight digest batch hitting the DB during disconnect.

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

### 5.11 Payments (Sprint 5, 11, 12, 13)

**Note:** Sprint 5 implements a **manual payment flow** using Vodafone Cash and InstaPay.

> ⚠️ **Subscription model deprecated (Sprint 12).** The `Subscription` table was removed. `Enrollment.expiresAt` models the subscription window. `GET /parents/me/billing` returns `purchases` only.

**Idempotency (Sprint 11):** `POST /payments/requests` supports `Idempotency-Key` header (24h cache, fail-open).

**Contract polish (Sprint 13):** `amount` returns a Decimal string (`"150.00"`); `referenceCode` uses `QFZ-XXXX-XXXX-XXXX` Crockford base32. Both changes shipped ahead of the frontend's Task #9 integration.

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

### 5.13 Notifications (Sprint 7, 12, 13)

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

**Notification types (system-generated):** `announcement`, `payment`, `certificate`, `streak`, `weekly_summary` (**Sprint 13**), and various event-specific values. The `type` field is a free-form string on the schema; frontend should treat unknown types as generic.

#### Admin Notification Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/admin/notifications` | Send system notification to all users or specific users | Admin |

**Sprint 12 fix:** boolean query params now correctly distinguish omitted (no filter) from `false` (filter for un-archived/unread items).

### 5.14 Search & Recommendations (Sprint 8, 12, 13)

#### Global Search

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/search` | Global search across paths, forum posts, and users | No |
| GET | `/search/paths` | Search paths only | No |
| GET | `/search/forum` | Search forum posts only (canonical for community) | No |
| GET | `/search/users` | Search users only | No |

#### Recommendations (Sprint 13 refinement)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/recommendations/paths` | Personalized path recommendations | Yes |
| GET | `/recommendations/popular` | Popular paths | No |
| GET | `/recommendations/trending` | Trending paths | No |
| GET | `/recommendations/related/:pathId` | Related paths (co-enrollment) | No |

**Unified response shape (Sprint 13):** all four endpoints return a consistent `Path[]` with nested `category`. Internal ranking signals (`recent_enrollments`, `co_enrollment_count`) are **not** included — sort order conveys the ranking.

**Personalized fallback chain** for `/recommendations/paths`:

| Stage | Source | Applies to |
|---|---|---|
| 1 | Category-matched, weighted by user's enrollment frequency | Warm users (has active enrollments) |
| 2 | Skill-matched popular (difficulty adjacency) | All users |
| 3 | Popular (enrolled paths excluded) | All users |
| 4 | Trending (enrolled paths excluded) | All users |

**Difficulty adjacency** for skill-matched fills:

| User skill | Preferred difficulties (in order) |
|---|---|
| `BEGINNER` | `BEGINNER`, `ALL_LEVELS`, `INTERMEDIATE` |
| `INTERMEDIATE` | `INTERMEDIATE`, `ALL_LEVELS`, `BEGINNER`, `ADVANCED` |
| `ADVANCED` | `ADVANCED`, `ALL_LEVELS`, `INTERMEDIATE` |

**Deterministic ordering** everywhere: `enrollments DESC → createdAt DESC → id ASC`.

**P0 fix (Sprint 13):** `/trending` and `/related/:pathId` previously returned 500 due to `SELECT p.*` hitting the `Unsupported("tsvector")` columns on `paths`. Fixed by selecting explicit columns in the raw SQL. Guards added in the integration suite.

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
````

---

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
- **`sendWeeklySummaryEmail` added in Sprint 13** — Arabic, RTL, "quiet week" body variant. Subject and footer say **Qafztk**.

### Rate Limiting (Changed in Sprint 11)

- Redis-backed, sliding window via `INCR` + `EXPIRE`.
- Key strategy: `userId` when authenticated, IP otherwise.
- Fail-open on Redis outage.
- Excluded: `/health`, `/health/live`, `/health/ready`, `/api-docs`, `/uploads`.

### Level Formula (Changed in Sprint 11)

- `threshold(N) = 50 · N · (N - 1)` for cumulative XP to reach level N
- Worked example: 1250 XP → level 5, `currentLevelXp = 250`, `nextLevelXp = 500`

### Background Jobs (Sprint 11, expanded Sprint 13)

- **Payment expiry cron** — every 5 minutes, Redis-locked, fail-open. Flips `PENDING → EXPIRED` on `PaymentRequest` rows whose `expiresAt` has passed. `VERIFIED` rows are intentionally never auto-expired.
- **Weekly summary cron (Sprint 13)** — fires Monday 08:00 Africa/Cairo, checked every 15 minutes. DST-aware scheduling via `Intl.DateTimeFormat` (never hardcoded UTC offsets). Redis-locked with a 5-minute TTL. Deduped via `User.lastWeeklySummaryAt` (6-day window). Batch design: 7 queries per cycle, independent of user count. Per-user side effects are non-blocking (`Promise.allSettled`).
- Graceful shutdown hooks in `src/index.ts` — `stopWeeklySummaryJob()` runs first (longer lock TTL, heavier writes), then `stopPaymentExpiryJob()`.

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

### Recommendations (Sprint 13)

- **Unified response shape (Option A):** all four endpoints return `Path[]` with nested `category`. Internal ranking signals are stripped — sort order conveys the ranking.
- **Personalized fallback chain:** category-weighted (warm) → skill-matched popular → popular → trending. Enrolled paths are excluded from every stage.
- **Difficulty adjacency:** `BEGINNER` → `[BEGINNER, ALL_LEVELS, INTERMEDIATE]`; `INTERMEDIATE` → `[INTERMEDIATE, ALL_LEVELS, BEGINNER, ADVANCED]`; `ADVANCED` → `[ADVANCED, ALL_LEVELS, INTERMEDIATE]`.
- **Deterministic tie-breakers:** `enrollments DESC → createdAt DESC → id ASC` everywhere.
- **Raw SQL safety:** never `SELECT *` against `paths` (tsvector deserialization fails). Select `id` and the aggregate, then fetch the full shape via a second Prisma `findMany` using the shared `PATH_SELECT` projection.
- **Parameter type casts:** `Path.categoryId` and `Enrollment.pathId` are `text` columns (no `@db.Uuid` in schema). Never cast parameters with `::uuid` — Postgres rejects `text = uuid` with code `42883`. Cast only the column when comparing a Postgres enum to a text parameter (`p."difficulty"::text = ${value}`).

### Payment Reference Codes (Sprint 13)

- **Format:** `QFZ-XXXX-XXXX-XXXX` (18 chars total). Crockford base32 alphabet excludes `I`, `L`, `O`, `U`.
- **Generation:** `crypto.randomBytes` + modular indexing into the alphabet. Collision space: 32^12 ≈ 1.15e18.
- **Retry-on-collision:** `persistPaymentRequest` retries up to 3 times on Prisma `P2002`. The code returned to the caller comes from the successful insert, never from a locally-generated one (avoids response/DB mismatch on retry).
- **`amount` is a Decimal string:** `(amountCents / 100).toFixed(2)`. Frontend uses `Intl.NumberFormat` for display; never `parseFloat`.

### Weekly Summary (Sprint 13)

- **Timezone:** Africa/Cairo via `Intl.DateTimeFormat`. Egypt reintroduced DST in 2023 — offset is UTC+2 winter, UTC+3 summer. **Never replace with offset math.**
- **Delivery:** in-app notification (`type: 'weekly_summary'`) + email. Both suppressed when `privacySettings.emailNotifications === false`.
- **Zero-activity users** still receive the digest with a re-engagement body (`افتقدناك هذا الأسبوع`).
- **State fields:** `User.lastWeeklySummaryAt` (dedupe window) + `User.lastWeeklySummaryRank` (for accurate rank deltas). Both nullable.
- **Dedupe:** population-level check on the most recent `lastWeeklySummaryAt` (< 6 days → skip) + per-user write. Combined with the Redis lock, the job is at-most-once-per-week.
- **Digest fields (9):** `xpEarned`, `lessonsCompleted`, `currentStreak`, `longestStreak`, `rank`, `rankChange`, `badgesEarned[]`, `certificatesEarned`, `bossBattlesWon`.
- **Excluded by design** (weekly-meaningless noise): daily quests, slides, warm-ups, forum activity, recharge boosts, paths enrolled.

### Non-Blocking Side Effects (Convention)

Wrapped in try/catch and logged, never propagated:
- Email sending
- Streak updates
- Certificate auto-issue
- Lesson-completion XP award
- Boss battle badge award
- Weekly summary notification + email per user (Sprint 13)
- `markDigestSent` bookkeeping write (Sprint 13)

### Community Conventions (Sprint 12)

- **`author`** field on posts/comments (not `user`)
- **`userVote`** (`'up' | 'down' | null`) reflects the current user's vote state
- **`isSolved`** on post + **`isBestAnswer`** on comment (no `bestAnswerId`)
- **`postCount`** on categories (published + non-deleted only)
- **Deterministic sorting** — `createdAt DESC` always the tie-breaker
- **2-level comment threading** — top-level comments + direct replies only

### Other Decisions

- **PostgreSQL port:** dev `5433`, test `5434`.
- **Redis usage:** token storage, rate limiting, account lockout, idempotency cache, cron locks (both jobs).
- **Avatar upload:** Multer local storage; S3 for production (pending).
- **Swagger UI:** all endpoints documented.
- **Express 5:** getter-only `req.query`/`req.params`.
- **Leaderboards:** global uses `userStats`; path-specific uses lesson progress.
- **Streak freeze:** decrements token; sets `lastStreakFreezeAt`.
- **Manual Payments:** reference code pattern (`QFZ-…` as of Sprint 13); expiration automated.
- **Forum voting:** polymorphic `ForumVote`.
- **Best answer:** only post author can mark; sets `isSolved`.
- **Seed script:** idempotent; includes forum content + paid path + updated boss battle + 3 seeded payment requests.
- **Notifications:** `channelsSent` is a list; email `link` coerced `?? undefined`.
- **Recommendations:** popularity and co-enrollment; refined in Sprint 13 with category weighting and difficulty adjacency.
- **Parent-Child:** self-referential; `ChildSettings`.
- **Lesson lock / recharge:** based on previous lesson's `lockDurationHours`; parent override.
- **PDF Delivery:** S3 signed URLs with 5-min expiry; access control.
- **YouTube Validation:** enforced via `extractYouTubeId`.
- **Slides:** 5 types, stored in `Slide` model; progress in `UserSlideProgress`.
- **Mini-Quests:** checkpoints with XP; progress tracked; next checkpoint logic.
- **Boss Battles:** questions, scoring, victory levels, badge persistence, duplicate submission blocked.
- **Recharge:** XP boost multiplier based on window after previous lesson; base XP only, not bonus.
- **Weekly summary (Sprint 13):** Monday 08:00 Cairo, DST-safe, at-most-once-per-week dedupe, both channels opt-out via `emailNotifications === false`.

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

*(End of Sprint 12 — will be updated at Sprint 13 close.)*

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

**Sprint 13 additions (targets after close):**

| Module | Notes |
|--------|-------|
| `recommendation.service.ts` | Rewritten test suite (27 tests). High branch coverage on the fallback chain, category weighting, and deterministic ordering. |
| `weeklySummary.service.ts` | 16 tests — eligibility, opt-out, aggregation per field, rank delta, non-blocking persistence. |
| `weeklySummary.job.ts` | 13 tests — Cairo DST-aware scheduling, dedupe window, Redis lock fail-open, `Promise.allSettled` batch isolation, start/stop lifecycle. |
| `recommendations.test.ts` (integration) | 13 tests — shape consistency, P0 tsvector regression guards (`/trending` and `/related` must return 200), malformed UUID → 400, cold-start, warm-start exclusion of enrolled paths. |

**Overall service layer (Sprint 12 baseline):** ~93% statements, ~82% branches, ~97% functions.
**Total tests:** 452 unit + 80 integration = **532 passing**. Target after Sprint 13 close: **~518 unit + ~93 integration = ~611**.

### Testing approach

- Mock Prisma, Redis, AWS SDK clients, PDFKit in unit tests.
- All services have test files in `src/services/__tests__/`.
- Middleware tests in `src/middleware/__tests__/`.
- Job tests in `src/jobs/__tests__/`.
- Integration tests hit the real Express app via Supertest against isolated Docker containers.
- **`jest.resetAllMocks()` requires re-establishing persistent defaults** in `beforeEach` — see CONTRIBUTING.md §8.1. `clearAllMocks()` alone is not enough — it leaves persistent `mockResolvedValue()` implementations in place, causing the exact cross-test leak that surfaced in `recommendation.service.test.ts` during Sprint 13.
- **Cairo timezone in tests:** construct dates explicitly. Monday 08:00 Cairo in September (DST, UTC+3) = `new Date('2026-09-21T05:00:00Z')`. Never assume a fixed offset in test fixtures.

---

## 8. Next Steps

### Sprint 13 close-out checklist

- [ ] Apply payment service changes (`payment.service.ts`, `payment.service.test.ts`, `prisma/seed.ts`)
- [ ] Apply weekly summary files (`weeklySummary.service.ts`, `weeklySummary.job.ts`, both test files, `email.service.ts` append, `index.ts` wiring)
- [ ] Add the two new `User` fields to `schema.prisma`
- [ ] Create migration `add_weekly_summary_fields` with `--create-only`, audit for `DROP DEFAULT` / `DROP COLUMN` / `DROP INDEX` on tsvector/trigram lines, run `check:migrations`, then `migrate deploy` + `prisma generate`
- [ ] Run the four guards: `npx tsc --noEmit`, `npm test -- --coverage`, `npm run test:integration`, `npm run check:migrations`
- [ ] Update `README.md`, `BACKEND_REFERENCE.md`, `DEVELOPER_ONBOARDING.md`, `CONTRIBUTING.md`, `swagger.ts` for Sprint 13 close

### Deferred to Sprint 14

1. **Bulk enrollment endpoint** — enterprise feature per Gap Analysis N11. Consumer TBD (admin → user list vs. parent → multiple children). See §13 note.
2. **Controller unit tests** — thin wrappers, currently 0% coverage. Nice-to-have.
3. **Deployment configuration** — ECS vs EC2 decision, then CI/CD pipeline. Coordinate with AWS SA.
4. **Brand pass — email templates.** Migrate all seven existing templates from Qafzly → Qafztk in one coordinated commit. `sendWeeklySummaryEmail` (Sprint 13) already says Qafztk; the rest still say Qafzly.
5. **`activatePaymentRequest` upsert fix.** The `tx.enrollment.create` throws on prior enrollments (unique constraint on `(userId, pathId)`). Should be `upsert`. Currently latent because seed users have no prior enrollment rows. Would surface on any retry-after-unenroll scenario.
6. **Replace `Unsupported("tsvector")` generated columns with trigger-maintained columns.** This is the actual fix for the Prisma 6.x migration bug that has been the source of the `--create-only` workaround since Sprint 11. Eliminates the workaround permanently without changing the database host. Medium effort, low risk. See CONTRIBUTING.md §7 for the current workaround.
7. **Add `page` param to recommendation endpoints.** Currently only `limit` is honored (schema already exists; service doesn't paginate). Not blocking.
8. **Optional: `GET /notifications?type=weekly_summary` filter documentation.** The type is stored today; the generic `type` query param already supports it — just needs a docs line.

### AWS-Gated (Waiting on Solution Architect)

1. **RDS migration decision** — **recommended: AWS RDS PostgreSQL, not Supabase.** The Prisma `Unsupported("tsvector")` migration bug is a Prisma introspection issue against `GENERATED ALWAYS AS ... STORED` columns — it reproduces identically on RDS, Supabase, Neon, Railway, and any other Postgres host. Migrating hosts does not fix it. Supabase adds PgBouncer/Supavisor friction (prepared statement incompatibility, migration advisory lock conflicts, shadow DB restrictions, connection pool tuning) without solving the underlying problem. RDS keeps the stack in one VPC/IAM/billing model. **Coordinate with PM/SA before any host migration.**
2. **S3 avatar upload** — reuse `s3.service.ts`.
3. **SES production access** — verify `qafztk.com` domain, exit sandbox.
4. **Staging deployment** — ECS vs EC2 decision, then CI/CD pipeline.
5. **Secrets management** — migrate from env files to AWS Secrets Manager.
6. **CloudWatch monitoring** — Pino logs to CloudWatch Logs.

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
- **`SELECT *` breaks search and recommendations** — always select explicit columns in raw SQL against `paths` or `forum_posts`. **Two different services hit this P0:** `search.service.ts` (fixed S11) and `recommendation.service.ts` (fixed S13). Any new raw SQL against these tables must select explicit columns.
- **Parameter type casts:** do **not** add `::uuid` casts to `pathId` / `categoryId` / `id` parameters. Our schema declares these as `text` (no `@db.Uuid`), so Postgres rejects `text = uuid` with code `42883`. Cast only the column when comparing a Postgres enum to a text parameter.
- **`EPERM: operation not permitted`** on `prisma generate` — kill node first: `Get-Process node | Stop-Process -Force`.
- **`migrate status` reports missing migrations** — drift. Full recovery in §2.10 (S11).
- **`$transaction is not a function`** in unit tests — add `$transaction` mock that invokes the callback with the mocked client.

### Runtime

- **Express 5** — `req.query` / `req.params` are getter-only. Use `Object.defineProperty` (already handled in `validate.ts`).
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
- **`activatePaymentRequest` uses `enrollment.create`** — will throw on a prior enrollment for the same `(userId, pathId)`. Fix deferred to Sprint 14 (use `upsert`).
- **Weekly summary state** — `User.lastWeeklySummaryAt` + `User.lastWeeklySummaryRank`. Both nullable. Do not repurpose these fields for other features.

### Query-String Booleans (Sprint 12)

- Use `optionalBooleanQuery` from `src/utils/validators/booleanQuery.ts`.
- **Never** use `z.coerce.boolean()` — `Boolean('false')` is `true`.
- **Never** use `.optional().transform(v => v === 'true')` — Zod runs the transform on `undefined`.

### Cairo Timezone (Sprint 13)

- Egypt reintroduced DST in 2023. Offset is UTC+2 in winter, UTC+3 in summer.
- **Always use `Intl.DateTimeFormat` with `timeZone: 'Africa/Cairo'`** for time-based scheduling. Never hardcode offsets.
- When constructing test dates: 08:00 Cairo in September = **05:00 UTC**; in December = **06:00 UTC**.

### Testing

- **`npm run test:integration`** — requires `.env.test` and Docker. Containers torn down automatically.
- **Jest `testMatch`** — default `jest.config.js` excludes `src/__tests__/integration/`.
- **"Your test suite must contain at least one test"** — helper files picked up by default Jest. Register via `setupFiles`.
- **`jest.clearAllMocks()` is not enough** — it does not clear persistent implementations. Use `jest.resetAllMocks()` **and re-establish persistent defaults** in `beforeEach`. This exact trap bit `recommendation.service.test.ts` during Sprint 13 — a leaked `mockResolvedValue()` from an earlier test silently polluted the cold-start fallback assertions.
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

For AWS-related questions, coordinate with the Project Manager and the AWS Solution Architect (kickoff pending).

---

## 12. Repository State (Mid-Sprint 13)

| Item | State |
|------|-------|
| Branch | `main` |
| Unit tests | 452 passing (Sprint 12 baseline); ~518 target after Sprint 13 close |
| Integration tests | 80 passing (Sprint 12 baseline); ~93 target after Sprint 13 close |
| Migration history | 5 migrations + 1 pending (`add_weekly_summary_fields`) |
| Swagger | All Sprint 12 endpoints documented; Sprint 13 additions pending |
| Coverage | ~93% service layer; search at 100% branches |
| Backend MVP | 🚧 Sprint 13 in progress — recommendation refinement shipped; payment contract polish + weekly summary cron delivered, pending application |

### Recent Major Commits

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

**Sprint 13 (in progress):**
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

---

## 13. Sprint Deferral Note

Per PM decision on September 17, 2026, the following were originally targeted for Sprint 12 but deferred by one sprint. All future sprints shift accordingly.

- **Original Sprint 12** → completed September 17
- **Original Sprint 13** → now Sprint 13 (in progress): recommendation refinement, payment contract polish, weekly summary cron
- **Deferred to Sprint 14:** bulk enrollment, controller unit tests, deployment configuration, brand pass on email templates, `activatePaymentRequest` upsert fix, tsvector trigger migration, RDS migration decision (if approved), optional recommendation pagination

This deferral was chosen to allow the frontend team to integrate Tasks #5–#9 without blocking on non-critical items.

---

**End of Handoff Document**