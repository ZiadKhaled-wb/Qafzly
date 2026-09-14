# Qafzly Backend API

Backend service for the Qafzly gamified EdTech platform (Arabic/Egyptian market).

## Tech Stack

- **Runtime:** Node.js (v20 LTS), TypeScript
- **Framework:** Express v5
- **Database:** PostgreSQL + Prisma ORM (v6.19.0, pinned)
- **Cache / Sessions:** Redis
- **Authentication:** JWT (access + refresh)
- **Validation:** Zod
- **Logging:** Pino
- **Testing:** Jest (unit) + Supertest (integration)
- **Email:** AWS SES (via `@aws-sdk/client-ses`; short-circuits to logs in dev when no credentials are configured)
- **File Storage:** AWS S3 (PDFs and certificates; avatars pending)
- **Search:** PostgreSQL `tsvector`/`tsquery` + `pg_trgm`
- **PDF Generation:** PDFKit + Noto Naskh Arabic (certificate rendering)

## Getting Started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and adjust values.
3. Start Docker services: `docker-compose up -d`
4. Run database migrations: `npx prisma migrate deploy` (see **Database Migrations** below — do **not** use bare `migrate dev`)
5. (Optional but recommended) Seed database: `npx ts-node prisma/seed.ts`
6. Start development server: `npm run dev`

## API Base URL

`http://localhost:3000/v1`

## Health Checks

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Backwards-compatible alias for `/health/live` |
| GET | `/health/live` | Liveness probe — always `200` if the process is up |
| GET | `/health/ready` | Readiness probe — `200` if Postgres + Redis are reachable, `503` otherwise |

`/health`, `/health/live`, `/health/ready`, and `/api-docs` are **excluded from the rate limiter**.

## Background Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Payment expiration | every 5 minutes | Flips `PaymentRequest` rows from `PENDING` to `EXPIRED` after their `expiresAt` passes. Uses a Redis lock for multi-instance leader election. Non-blocking: never crashes the process, logs failures and retries on next interval. |

The job is started from `src/index.ts` and stopped cleanly on `SIGTERM` / `SIGINT` via the graceful shutdown handler.

## Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user (auto-creates gamification profile & assigns active daily quests in a transaction) |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout (invalidates refresh token) |
| POST | `/auth/forgot-password` | Request password reset email |
| POST | `/auth/reset-password` | Reset password using token |

**Registration roles:** `STUDENT` (default) or `PARENT`. Admin role cannot be self-assigned.

## User Profile Endpoints (Sprint 2)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users/me` | Get current user profile (includes gamification + progress summary) | Yes |
| PUT | `/users/me` | Full update profile | Yes |
| PATCH | `/users/me` | Partial update profile | Yes |
| DELETE | `/users/me` | Soft delete account | Yes |
| PUT | `/users/me/privacy` | Update privacy settings | Yes |
| GET | `/users/me/privacy` | Get privacy settings | Yes |
| POST | `/users/me/avatar` | Upload avatar (local storage; S3 migration pending) | Yes |
| DELETE | `/users/me/avatar` | Remove avatar | Yes |

## Admin User Management Endpoints (Sprint 2)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/users` | List users (pagination, search, filters) | Admin |
| GET | `/admin/users/:id` | Get user details | Admin |
| PUT | `/admin/users/:id` | Update user | Admin |
| POST | `/admin/users/:id/suspend` | Suspend user | Admin |
| POST | `/admin/users/:id/activate` | Activate user | Admin |
| POST | `/admin/users/:id/role` | Change user role | Admin |

## Path Core Endpoints (Sprint 3)

### Categories

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/categories` | List categories (pagination, search, parent filter) | No |
| GET | `/categories/:id` | Get category by ID with children and published paths | No |
| POST | `/categories` | Create category | Admin |
| PUT | `/categories/:id` | Update category | Admin |
| DELETE | `/categories/:id` | Soft-delete category (sets child parent to null, removes path links) | Admin |

### Paths

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/paths` | List public paths (only published, with filters) | No |
| GET | `/paths/admin/list` | List all paths (including unpublished, soft-deleted excluded) | Admin |
| GET | `/paths/:id` | Get path by ID (admin sees unpublished) | No/Admin |
| POST | `/paths` | Create path | Admin |
| PUT | `/paths/:id` | Update path | Admin |
| DELETE | `/paths/:id` | Soft-delete path | Admin |
| POST | `/paths/:id/publish` | Publish or unpublish path (`{ "publish": true/false }`) | Admin |

### Modules

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/modules?pathId=...` | List modules for a path (only published unless admin) | No/Admin |
| GET | `/modules/:id` | Get module by ID with lessons | No/Admin |
| POST | `/modules` | Create module | Admin |
| PUT | `/modules/:id` | Update module | Admin |
| DELETE | `/modules/:id` | Delete module (cascade deletes lessons) | Admin |

### Lessons

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/lessons?moduleId=...` | List lessons for a module. Each lesson includes an `isAccessible` flag (see **Lesson Access Control** below) | No/Yes |
| GET | `/lessons/:id` | Get lesson by ID with quiz questions. Enforces access control — `403` when not accessible | No/Yes |
| POST | `/lessons` | Create lesson | Admin |
| PUT | `/lessons/:id` | Update lesson | Admin |
| DELETE | `/lessons/:id` | Delete lesson | Admin |
| GET | `/lessons/:id/lock-status` | Get lock status for current user (12-hour lock logic) | Yes |
| GET | `/lessons/:id/pdf-url` | Get signed PDF URL (5 min expiry) | Yes |
| POST | `/lessons/:id/pdf` | Upload PDF for lesson (admin) | Admin |
| DELETE | `/lessons/:id/pdf` | Delete PDF for lesson (admin) | Admin |
| GET | `/lessons/:id/recharge-status` | Get recharge status for current user (XP boost window) | Yes |

#### Lesson Access Control

The public lesson endpoints now enforce a preview rule:

1. **Preview lessons** (`isPreview: true`) — accessible to everyone, including anonymous users
2. **Non-preview lessons** — require an active enrollment in the parent path
3. **Admins** — bypass all checks

Denied requests return `403 يجب الاشتراك في هذه الدورة للوصول إلى الدرس`.

Successful `GET /lessons/:id` responses include `access.reason` which is one of `'preview' | 'enrolled' | 'admin'`.

The list endpoint (`GET /lessons`) always returns all published lessons but marks each with `isAccessible: boolean` so the UI can show lock icons without a second request.

### Enrollment

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/enrollments/paths/:pathId/enroll` | Enroll current user in a path | Yes |
| DELETE | `/enrollments/paths/:pathId/enroll` | Unenroll from a path | Yes |
| GET | `/enrollments/me/enrollments` | List current user's active enrollments (with computed `progress` % and `currentLesson`) | Yes |
| GET | `/enrollments/paths/:pathId/enrollments` | List enrolled users for a path | Admin |

**Enrollment response shape:** each enrollment includes `progress` (0–100, not a raw count), `pathTitleAr`, `pathTitleEn`, `featuredImage`, `difficulty`, and a `currentLesson` object (or `null` when the path is complete) with `id`, `titleAr`, and `moduleNameAr`.

### Progress

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/progress/lessons/:lessonId` | Update lesson progress (completed, timeSpent, quizScore). Automatically updates streak and attempts certificate auto-issue when `completed: true` | Yes |
| GET | `/progress/paths/:pathId` | Get path progress summary for current user | Yes |

## Gamification Endpoints (Sprint 4)

### Profile

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/me` | Get current user's gamification profile | Yes |
| GET | `/gamification/users/:userId` | Get gamification profile for any user | Yes |

**Profile response shape:**

```json
{
  "userId": "...",
  "totalXp": 1250,
  "level": 5,
  "currentLevelXp": 250,
  "nextLevelXp": 500,
  "rank": 4,
  "badges": [
    { "id": "...", "nameAr": "أول درس", "nameEn": "First Lesson", "iconUrl": "...", "earnedAt": "..." }
  ],
  "currentStreak": 12,
  "longestStreak": 20,
  "totalLessonsCompleted": 8,
  "totalPathsCompleted": 0
}
```

#### Leveling Formula

The XP curve is:

```
threshold(N) = 50 · N · (N - 1)     // cumulative XP to REACH level N
threshold(1) = 0
```

Level widths: `L1 = 100`, `L2 = 200`, `L3 = 300`, `L4 = 400`, `L5 = 500`, … Each level requires more XP than the previous.

- `level` = highest N with `threshold(N) <= totalXp`
- `currentLevelXp` = `totalXp - threshold(level)`
- `nextLevelXp` = `threshold(level + 1) - threshold(level)`

**Worked example (1250 XP):** `threshold(5) = 1000`, `threshold(6) = 1500` → level 5, `currentLevelXp = 250`, `nextLevelXp = 500`, progress = 50%.

> ⚠️ Note for FE: the level table in the Student Dashboard spec contained an internal inconsistency (formula vs. table). We shipped the table's curve. Confirm before UAT.

### XP & Levels

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/xp/history` | Get current user's XP earning history (paginated) | Yes |
| GET | `/gamification/levels` | Get level definitions (`level`, `xpRequired`, `xpToNext`, `xpNextLevel`) for levels 1–50 | No |

### Badges

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/badges` | Get all badge definitions | No |
| GET | `/gamification/me/badges` | Get current user's earned badges | Yes |
| GET | `/gamification/users/:userId/badges` | Get any user's earned badges | Yes |

**Badge fields:** each badge includes both `nameAr` and `nameEn`. The `Badge` model was extended with a `nameEn` column (nullable; falls back to the Arabic name when absent).

### Leaderboards

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/leaderboard?scope=global` | Global leaderboard by XP | Yes |
| GET | `/gamification/leaderboard?scope=path&pathId=...` | Path leaderboard by completed lessons | Yes |

**Global entries** include `userId`, `fullName`, `displayName`, `avatarUrl`, `totalXp`, `level`, `rank`. **Path entries** include `userId`, `fullName`, `completedLessons`, `rank`. Rank is dynamic and computed from a global count of higher-XP users.

### Streaks

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/me/streak` | Get current streak info | Yes |
| POST | `/gamification/me/streak/freeze` | Use a streak freeze token | Yes |

**Streak response:** `currentStreak`, `longestStreak`, `streakFreezeAvailable`, `lastActivityDate` (YYYY-MM-DD or `null`), `lastStreakFreezeAt`.

**Automatic update:** the streak is updated whenever a lesson is marked `completed: true` via `/progress/lessons/:lessonId`. Rule: same-day → unchanged; yesterday → +1; gap > 1 day → reset to 1. `longestStreak` updates automatically.

### Daily Quests

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/daily-quests` | Get active daily quests with user progress | Yes |
| POST | `/gamification/daily-quests/:questId/complete` | Complete a daily quest and earn XP | Yes |

**Quest response shape:** each quest includes `id`, `titleAr`, `titleEn`, `descriptionAr`, `descriptionEn`, `xpAward` (integer > 0), `target`, `progress`, `completed`, `completedAt`.

> Note: the field name is `xpAward` (renamed from `xpReward` to match the Student Dashboard spec).

## Payment Endpoints (Sprint 5 – Manual MVP)

> **Note:** Sprint 5 implements a **manual payment flow** using Vodafone Cash and InstaPay.
> Admin manually verifies and activates subscriptions. Full PayMob integration is planned for a later phase.

### Idempotency

`POST /payments/requests` supports the standard `Idempotency-Key` header. When supplied, the response is cached for 24 hours under `idempotency:<userId>:<key>` in Redis. Repeated requests with the same key return the original response. Concurrent requests with the same key receive a `409`. The header is optional (backwards-compatible).

Only `2xx` responses are cached. Errors release the in-flight lock so clients can retry. Fail-open on Redis unavailability.

### User Payment Requests

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/payments/requests` | Create payment request for a path and get payment instructions (reference code, Vodafone Cash & InstaPay numbers). Supports `Idempotency-Key` header | Yes |
| GET | `/payments/requests` | List current user's payment requests (pagination, optional status filter) | Yes |
| POST | `/payments/requests/:id/mark-sent` | Mark payment as sent (add optional user notes) | Yes |

### Admin Payment Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/payments/admin/requests` | List all payment requests (pagination, status filter, search) | Admin |
| POST | `/payments/admin/requests/:id/activate` | Activate a payment request: creates purchase, enrollment, and sends confirmation email | Admin |
| POST | `/payments/admin/requests/:id/reject` | Reject a payment request with reason; user notified by email | Admin |

**Payment Request Statuses:** `PENDING`, `VERIFIED`, `ACTIVATED`, `REJECTED`, `EXPIRED`

`PENDING` requests are automatically flipped to `EXPIRED` by the background job after their `expiresAt` passes (see **Background Jobs**).

## Certificate Endpoints (Sprint 11)

### User Certificates

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/certificates/me` | List current user's certificates (paginated) | Yes |
| GET | `/certificates/:id` | Get certificate by ID (owner or admin) | Yes |
| GET | `/certificates/:id/download` | Get download URL for the certificate PDF (owner or admin) | Yes |

### Public Verification

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/certificates/verify/:code` | Verify a certificate by its code (no auth required) | No |

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

### Admin Certificate Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/certificates/admin/issue` | Manually issue a certificate (body: `userId`, `pathId`) | Admin |
| POST | `/certificates/admin/:id/revoke` | Revoke a certificate (body: `reason`) | Admin |

### Auto-Issue Behavior

When a lesson is completed via `/progress/lessons/:lessonId`, the backend checks whether all published lessons in the parent path are now complete. If so, it auto-issues a certificate — **idempotent** (one certificate per user per path, enforced by a unique constraint), **non-blocking** (failures are logged, never propagate to the response), and **best-effort** (PDF + email are generated asynchronously after the DB row exists).

### PDF Generation

Certificates are rendered as A4 landscape PDFs using PDFKit with the Noto Naskh Arabic font. Arabic text is shaped via `arabic-persian-reshaper` before rendering. Storage is local (`uploads/certificates/<userId>/<code>.pdf`) in dev, with a storage abstraction ready for S3 swap. Certificates include the recipient name, path title, issue date, verification code, and a public verification URL.

## Community Endpoints (Sprint 6)

### Forum Categories

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forum/categories` | List forum categories (pagination, search, active filter) | No |

### Forum Posts

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forum/posts` | List posts with filters (category, path, lesson, status, search, sort, pagination) | No |
| POST | `/forum/posts` | Create new post | Yes |
| GET | `/forum/posts/:id` | Get post by ID (increments view count) | No/Yes |
| PUT | `/forum/posts/:id` | Update post (owner or admin) | Yes |
| DELETE | `/forum/posts/:id` | Soft delete post (owner or admin) | Yes |

### Comments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forum/posts/:postId/comments` | List comments with replies | No |
| POST | `/forum/posts/:postId/comments` | Add comment (supports replies) | Yes |
| PUT | `/forum/comments/:id` | Update comment (owner/admin) | Yes |
| DELETE | `/forum/comments/:id` | Soft delete comment (owner/admin) | Yes |

### Voting

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/forum/posts/:id/upvote` | Upvote a post (toggle) | Yes |
| POST | `/forum/posts/:id/downvote` | Downvote a post (toggle) | Yes |
| POST | `/forum/comments/:id/upvote` | Upvote a comment (toggle) | Yes |
| POST | `/forum/comments/:id/downvote` | Downvote a comment (toggle) | Yes |

### Best Answer

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/forum/posts/:id/mark-answer` | Mark a comment as best answer (post owner only) | Yes |

### Search

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forum/search?q=...` | Search posts by title/content | No |

### Admin Moderation

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/forum/reports` | List reported posts (flagged) | Admin |
| POST | `/admin/forum/reports/:id/resolve` | Resolve a report (reset flag count) | Admin |
| POST | `/admin/forum/posts/:id/hide` | Hide a post | Admin |
| POST | `/admin/forum/posts/:id/unhide` | Unhide a post | Admin |
| POST | `/admin/forum/comments/:id/hide` | Hide a comment | Admin |
| POST | `/admin/forum/comments/:id/unhide` | Unhide a comment | Admin |

## Notification Endpoints (Sprint 7)

### User Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/notifications` | List current user's notifications (pagination, filter by read/unread, archived, dismissed, type) | Yes |
| GET | `/notifications/unread/count` | Get count of unread notifications | Yes |
| POST | `/notifications/read-all` | Mark all notifications as read | Yes |
| POST | `/notifications/:id/read` | Mark a notification as read | Yes |
| POST | `/notifications/:id/archive` | Archive a notification | Yes |
| POST | `/notifications/:id/dismiss` | Dismiss a notification | Yes |
| DELETE | `/notifications/:id` | Delete a notification | Yes |
| POST | `/notifications/device/register` | Register a device for push notifications | Yes |
| DELETE | `/notifications/device/:id` | Unregister a device | Yes |

### Admin Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/admin/notifications` | Send system notification to all users or specific users | Admin |

**Note:** Push notifications (Firebase) are currently logged as placeholders; email notifications are sent via Amazon SES when credentials are configured.

## Search & Recommendations Endpoints (Sprint 8)

### Global Search

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/search?q=...` | Global search across paths, forum posts, and users | No |
| GET | `/search/paths?q=...` | Search paths only | No |
| GET | `/search/forum?q=...` | Search forum posts only | No |
| GET | `/search/users?q=...` | Search users only | No |

**Search query parameters:**
- `q` (required) – search keyword
- `language` – `ar` or `en` (optional, default inferred)
- `type` – `path`, `forum`, or `user` (optional, for global search)
- `categoryId`, `difficulty`, `minPrice`, `maxPrice` – filters for paths
- `page`, `limit` – pagination

**Implementation note:** search uses `plainto_tsquery(${q}::regconfig)` against generated `tsvector` columns on `paths` and `forum_posts`. Raw SQL always selects explicit columns — `SELECT *` will fail because Prisma can't deserialize `tsvector`.

### Recommendations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/recommendations/paths` | Personalized path recommendations for current user | Yes |
| GET | `/recommendations/popular` | Popular paths (by enrollments) | No |
| GET | `/recommendations/trending` | Trending paths (recent enrollment activity) | No |
| GET | `/recommendations/related/:pathId` | Paths related to the given path (co-enrollment) | No |

**Recommendation query parameters:**
- `limit` – number of results (default 10, max 20)
- `categoryId`, `difficulty` – optional filters for popular/trending

## Parent Endpoints (Sprint 9)

### Parent Dashboard

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/parents/me/overview` | Get overview (children count, total XP, last active child) | Parent |
| GET | `/parents/me/billing` | Get subscription and purchase history | Parent |

### Child Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/parents/me/children` | Link a child to the parent (body: `childId`) | Parent |
| GET | `/parents/me/children` | List children with basic info | Parent |
| DELETE | `/parents/me/children/:childId` | Unlink a child | Parent |
| GET | `/parents/me/children/:childId/progress` | Get child progress summary | Parent |
| GET | `/parents/me/children/:childId/performance` | Get child quiz scores and challenges | Parent |
| GET | `/parents/me/children/:childId/time-tracking` | Get child time tracking | Parent |
| GET | `/parents/me/children/:childId/settings` | Get child settings | Parent |
| PUT | `/parents/me/children/:childId/settings` | Update child settings (lock override) | Parent |

## Enhanced Content Endpoints (Sprint 10)

### Slides

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/lessons/:lessonId/slides` | List slides for a lesson | Yes |
| POST | `/lessons/:lessonId/slides` | Create a slide (admin) | Admin |
| PUT | `/lessons/:lessonId/slides/:slideId` | Update a slide (admin) | Admin |
| DELETE | `/lessons/:lessonId/slides/:slideId` | Delete a slide (admin) | Admin |
| POST | `/lessons/:lessonId/slides/reorder` | Reorder slides (admin) | Admin |
| POST | `/lessons/:lessonId/slides/:slideId/complete` | Complete a slide | Yes |

**Slide Types:** `INFO`, `QUIZ`, `DRAG_DROP`, `TRUE_FALSE`, `FILL_BLANK`

### Mini-Quest Checkpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/lessons/:lessonId/checkpoints` | List quest checkpoints for a lesson | Yes |
| POST | `/lessons/:lessonId/checkpoints` | Create a quest checkpoint (admin) | Admin |
| PUT | `/lessons/:lessonId/checkpoints/:checkpointId` | Update a checkpoint (admin) | Admin |
| DELETE | `/lessons/:lessonId/checkpoints/:checkpointId` | Delete a checkpoint (admin) | Admin |
| POST | `/lessons/:lessonId/checkpoints/reorder` | Reorder checkpoints (admin) | Admin |
| POST | `/lessons/:lessonId/checkpoints/:checkpointId/complete` | Complete a checkpoint | Yes |

### Boss Battle

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/modules/:moduleId/boss-battle` | Get boss battle for module | Yes |
| POST | `/modules/:moduleId/boss-battle` | Create boss battle (admin) | Admin |
| PUT | `/modules/:moduleId/boss-battle/:battleId` | Update boss battle (admin) | Admin |
| DELETE | `/modules/:moduleId/boss-battle/:battleId` | Delete boss battle (admin) | Admin |
| POST | `/modules/:moduleId/boss-battle/submit` | Submit boss battle answers | Yes |

### Recharge

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/lessons/:id/recharge-status` | Get recharge status for current user (XP boost window) | Yes |

## Rate Limiting

All `/v1/*` routes are rate-limited. Health checks, `/api-docs`, and static `/uploads` are excluded.

| Route group | Limit | Key |
|-------------|-------|-----|
| Auth endpoints (`/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`) | 10 req/min | per IP per endpoint |
| All other routes | `RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS` (default `100` / `60s`) | per user ID (fallback to IP) |

**Headers on every response:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. On `429`: `Retry-After`.

**Fail-open on Redis outage:** if Redis is unreachable, requests pass through. This is configurable via `RATE_LIMIT_FAIL_OPEN` (default `true`).

## Response Format

All endpoints return JSON in the standard format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Success message (Arabic)",
  "errors": null,
  "meta": null
}
```

Pagination meta object (when applicable):
```json
"meta": {
  "page": 1,
  "limit": 20,
  "total": 100,
  "totalPages": 5
}
```

## Test Users (from seed)

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | `admin@qafzly.com` | `Admin@123456` | Full admin rights |
| Parent | `parent@qafzly.com` | `Parent@123456` | Parent account with two children |
| Child 1 | `child1@qafzly.com` | `Child1@123456` | Enrolled in seeded path, with progress |
| Child 2 | `child2@qafzly.com` | `Child2@123456` | Enrolled, limited progress |
| Test Student | `test-student@qafzly.com` | `Student@123456` | XP 1250, Level 5, Streak 12, 2 badges — matches the Student Dashboard spec's worked example |
| Leaderboard fillers | `yusuf@qafzly.com`, `sara@qafzly.com`, `omar@qafzly.com`, `maryam@qafzly.com`, `ziad@qafzly.com` | `Student@123456` | XP 2500 / 2200 / 1800 / 900 / 400 — populate the global leaderboard so the test student ranks at position 4 |

## Seed Data

Running `npx ts-node prisma/seed.ts` creates:

- **4 categories** (Programming, Web Development, Data Science, AI)
- **6 users** beyond the two children: admin, parent, test student, and 5 leaderboard fillers
- **1 published path** "مقدمة إلى الحاسوب" with modules and lessons
- **1 unpublished path** "مقدمة إلى الإنترنت"
- **Parent-child relationships** and settings
- **Lesson progress** for children and the test student
- **UserStats** for children, test student, and leaderboard users
- **10 badge definitions** (with Arabic/English names)
- **2 badges granted** to the test student
- **3 daily quests** active for the current day (refreshed on every seed run)
- **Enhanced content**: slides, quest checkpoints, boss battle, and warm-up for lesson 1

*Note: No sample payment requests, forum posts, notifications, or search/recommendation data are seeded; they are created during manual testing.*

## API Documentation (Swagger UI)

Interactive documentation available at `http://localhost:3000/api-docs`.

Use the **Authorize** button to set the JWT token (login first, then paste the `accessToken`).

## Running Tests

### Unit Tests

```bash
npm test -- --coverage
```

Unit tests live in `src/services/__tests__/`, `src/middleware/__tests__/`, and `src/jobs/__tests__/`. They use mocked Prisma, Redis, and AWS SDK clients.

**Current status:** 361 tests passing. Service-layer coverage ~93% statements.

### Integration Tests

The project uses fully isolated Postgres and Redis containers to run end-to-end HTTP tests with Supertest.

**Prerequisites:**
- Docker Desktop running
- `.env.test` file present in project root

**One-command run:**

```bash
npm run test:integration
```

This command will:
1. Start the isolated test containers (`docker-compose.test.yml`).
2. Apply migrations to the test database (port `5434`).
3. Seed the test DB.
4. Run the integration test suite (`jest.integration.config.js`).
5. Tear down the containers.

**Individual steps (for debugging):**

```bash
npm run test:integration:up        # Start test containers
npm run test:integration:migrate   # Apply migrations to test DB
npm run test:integration:down      # Stop and remove test containers
```

**Integration test files:** `src/__tests__/integration/`

Current coverage:
- Auth flow (register → login → refresh)
- User profile (GET, PATCH)
- Enrollment (enroll, list)
- Progress (update lesson, get path summary)
- Gamification (profile, streak, daily quests, leaderboard)
- Payments (create request, admin activation)
- Forum (post, comment)
- Search & recommendations
- Health check

**Current status:** 22 tests passing.

### `.env.test`

The integration tests load their own environment file. Create `.env.test` in the project root with:

```env
NODE_ENV=test
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/qafzly_test?schema=public
REDIS_URL=redis://localhost:6380
JWT_ACCESS_SECRET=test_access_secret
JWT_REFRESH_SECRET=test_refresh_secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_FAIL_OPEN=true
LOG_LEVEL=error
ACCOUNT_LOCKOUT_THRESHOLD=5
ACCOUNT_LOCKOUT_DURATION_MINUTES=15
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=test_access_key
AWS_SECRET_ACCESS_KEY=test_secret_key
AWS_S3_BUCKET_NAME=test-bucket
SES_FROM_EMAIL=test@qafzly.com
```

**Important:** `.env.test` must be git-ignored.

## Database Migrations

### ⚠️ Read this before touching migrations

Prisma 6.x has an unfixed bug ([#24496](https://github.com/prisma/prisma/issues/24496), [#15654](https://github.com/prisma/prisma/issues/15654)) that generates invalid SQL for PostgreSQL generated columns. This project has four such columns (`search_vector_ar` / `search_vector_en` on `paths` and `forum_posts`), so **every `migrate dev` diff produces a broken migration**.

**Workflow (mandatory):**

```bash
# 1. Create the migration WITHOUT applying it
npx prisma migrate dev --create-only --name <short_description>

# 2. Open the generated prisma/migrations/<timestamp>_<name>/migration.sql
#    and DELETE any of these lines if present:
#      ALTER TABLE ... ALTER COLUMN "search_vector_ar" DROP DEFAULT
#      ALTER TABLE ... ALTER COLUMN "search_vector_en" DROP DEFAULT
#      ALTER TABLE ... DROP COLUMN "search_vector_ar"
#      ALTER TABLE ... DROP COLUMN "search_vector_en"
#      DROP INDEX "idx_paths_search_ar"    (and any of the other 7 search/trigram indexes)

# 3. Run the safety net
npm run check:migrations

# 4. Apply
npx prisma migrate deploy
```

**Never** run bare `npx prisma migrate dev`. The `check:migrations` script fails the build if any forbidden pattern sneaks into a migration file.

### Migration history

The current history has been rebased to two migrations:

- `20260911203608_initial_schema` — the full schema in one file, including the `tsvector` columns and GIN/trigram indexes that Prisma can't generate
- `20260911212808_add_badge_name_en` — adds the `nameEn` column to `badges`

If you're pulling a large change and `migrate status` complains about drift or missing migrations, run:

```bash
npx prisma migrate reset --force
npx prisma migrate deploy
npx ts-node prisma/seed.ts
```

## Environment Variables

See `.env.example` for all required variables. The following are the most important:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (dev: port `5433`) |
| `REDIS_URL` | Redis connection string (dev: port `6379`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets for JWT |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` | Token TTLs (e.g. `15m`, `7d`) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | General rate limiter (default 60s / 100 req) |
| `RATE_LIMIT_FAIL_OPEN` | If `true` (default), rate limiter passes through when Redis is down |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Shared AWS credentials (SES + S3). Leave access keys empty in dev to short-circuit email sending |
| `SES_FROM_EMAIL` | Verified SES identity used as the `From:` address |
| `AWS_S3_BUCKET_NAME` | S3 bucket for PDFs and certificates (must match `.env.example` exactly) |
| `ACCOUNT_LOCKOUT_THRESHOLD` / `ACCOUNT_LOCKOUT_DURATION_MINUTES` | Login lockout policy |

## Project Structure

```
src/
├── config/          # env, database, redis, sesClient, logger, swagger
├── middleware/      # authenticate, optionalAuth, authorize, validate, error handler, rate limiters, idempotency
├── utils/           # asyncHandler, AppError, apiResponse, token, upload, youtube, validators/
├── services/        # business logic (all .service.ts files)
├── controllers/     # request handlers
├── routes/          # endpoint definitions
├── jobs/            # background cron jobs (payment expiry)
└── prisma/          # schema.prisma, migrations/, seed.ts

scripts/
└── check-migrations.js   # CI safety net for the Prisma generated-column bug
```

**Architecture pattern:** `routes → controllers → services`. Business logic belongs in services; controllers stay thin.

## Contributing

See `CONTRIBUTING.md` for coding standards, commit conventions, migration workflow, and testing requirements.

## Sprint Status

- ✅ **Sprints 1–10:** All features complete (Auth, User, Path Core, Gamification, Payments, Community, Notifications, Search, Parent-Child, Enhanced Content).
- ✅ **Sprint 11 – UAT & Bug Fixing:** Complete.
  - Redis-backed rate limiter on general routes
  - Payment expiration cron job + graceful shutdown + health readiness split
  - Idempotency-Key support on `POST /payments/requests`
  - Preview lesson access control (`isPreview`)
  - Certificate generation (auto-issue on path completion, public verification, PDF rendering, admin revocation)
  - AWS SES migration (SendGrid removed) — sandbox-ready, awaiting domain verification for production access
  - Frontend Student Dashboard fixes (gamification profile shape, daily quests, streak, badges, enrollment progress)
  - Migration history rebased; `check:migrations` guard added
- 🔜 **Remaining (non-blocking):** S3 avatar upload (AWS-gated), Firebase push notifications (Firebase-gated), staging deployment + CI/CD (AWS-gated), controller unit tests, search branch coverage, integration test expansion.

---

**Qafzly Backend** · Team Falcon
````

---

## What Changed vs. the Previous README

I'll list the deltas so you can sanity-check before committing.

### Additions

| Section | Why |
|---|---|
| **Health Checks** table with `/health/live` + `/health/ready` | Reflects the graceful shutdown + readiness split from Task #2 |
| **Background Jobs** section | Payment expiry cron was previously undocumented |
| **Lesson Access Control** subsection | Preview flag behavior + `access.reason` |
| **Idempotency** subsection under Payments | `Idempotency-Key` header support |
| **Certificate Endpoints** (new top-level section) | Full Sprint 11 feature |
| **Rate Limiting** section | Redis-backed limiter, key strategy, fail-open |
| **Leveling Formula** subsection | Documents the curve + worked example |
| **Migration workflow warning** | The Prisma bug, forbidden patterns, `check:migrations` |
| **Test Student** row in Test Users table | Frontend needs it |
| **5 leaderboard filler users** row | Explains rank 4 positioning |
| **`RATE_LIMIT_FAIL_OPEN`, `SES_FROM_EMAIL`** env vars | New since last README |

### Updates

| Section | Change |
|---|---|
| Tech Stack | SendGrid → AWS SES; added PDFKit |
| Lesson endpoints | Added `isAccessible` note; `/lessons/:id` returns `403` for non-enrolled |
| Enrollment response shape | `progress` %, `currentLesson`, `pathTitleAr` |
| Gamification profile | New shape with `totalXp`, `currentLevelXp`, `nextLevelXp`, `rank` |
| Daily quests | `xpAward` (was `xpReward`) |
| Streak | `lastActivityDate` + auto-update rule |
| Badge model | `nameEn` field |
| Seed data | Test student, leaderboard users, badge grants |
| `.env.test` block | SendGrid removed; SES + fail-open added |
| Test counts | 361 unit / 22 integration |
| Project structure | Added `jobs/`, `scripts/`, `sesClient` |
| Sprint Status | Full closure of Sprint 11 |

### Removals

- **SendGrid references** everywhere except historical notes
- **`MAINTENANCE_MODE` / `ENABLE_PAYMENTS`** from `.env.test` — they were never in the Zod schema
- **"Remaining: Redis rate limiter, S3 avatar, payment expiration cron, ..."** from Sprint Status — all done

---

## Verify & Commit

```powershell
# Sanity check the render — no broken markdown, tables aligned
code README.md
```

Scan visually for the tables. Then commit:

```
docs: update README for Sprint 11 completion

- Reflect AWS SES migration (SendGrid removed)
- Document health check split (/health/live + /health/ready)
- Add background jobs section (payment expiry cron)
- Add certificate endpoints (auto-issue, verification, admin)
- Document lesson access control (preview flag)
- Document idempotency-key support on payments
- Document rate limiting (keys, limits, fail-open)
- Document leveling formula with worked example
- Rewrite migration workflow (Prisma bug workaround + check:migrations)
- Update test user list (add test-student + leaderboard fillers)
- Update test counts (361 unit / 22 integration)
- Remove ENABLE_PAYMENTS / MAINTENANCE_MODE from .env.test template