# `README.md` — Full Updated Version (Sprint 12)

Below is the complete file. All Sprint 11 content is preserved. Sprint 12 additions are integrated throughout.

---

````markdown
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

| Job | Frequency | Status | Purpose |
|-----|-----------|--------|---------|
| Payment expiration | every 5 minutes | ✅ Active | Flips `PaymentRequest` rows from `PENDING` to `EXPIRED` after their `expiresAt` passes. Uses a Redis lock for multi-instance leader election. Non-blocking: never crashes the process, logs failures and retries on next interval. |
| Weekly summary | Monday 08:00 | 🔜 Sprint 13 | Per-user activity digest (XP earned, lessons completed, streak, rank change). Deferred. |

The payment expiry job is started from `src/index.ts` and stopped cleanly on `SIGTERM` / `SIGINT` via the graceful shutdown handler.

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

## Admin User Management Endpoints (Sprint 2, 12)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/users` | List users (pagination, search, filters) | Admin |
| GET | `/admin/users/:id` | Get user details | Admin |
| PUT | `/admin/users/:id` | Update user | Admin |
| POST | `/admin/users/:id/suspend` | Suspend user | Admin |
| POST | `/admin/users/:id/activate` | Activate user | Admin |
| POST | `/admin/users/:id/role` | Change user role | Admin |

**Sprint 12 note:** every admin route now has param-level UUID validation. The role-change endpoint has a dedicated `changeUserRoleSchema` (role is required, unlike the generic update schema).

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
| GET | `/paths/:id` | Get path by ID (admin sees unpublished via `optionalAuth`) | No/Admin |
| POST | `/paths` | Create path | Admin |
| PUT | `/paths/:id` | Update path | Admin |
| DELETE | `/paths/:id` | Soft-delete path | Admin |
| POST | `/paths/:id/publish` | Publish or unpublish path (`{ "publish": true/false }`) | Admin |

**Sprint 12 note:** `GET /paths/:id` now uses `optionalAuth` so admins with a valid token see unpublished paths through the detail endpoint (the admin-bypass logic was previously dead code).

**Query parameter booleans:** `isFeatured` on `/paths` and `isPublished` on `/modules` now accept proper `'true'`/`'false'` strings. `?isFeatured=false` correctly filters for non-featured paths (previously it silently returned `isFeatured: true` due to a `z.coerce.boolean()` bug).

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

The public lesson endpoints enforce a preview rule:

1. **Preview lessons** (`isPreview: true`) — accessible to everyone, including anonymous users
2. **Non-preview lessons** — require an active enrollment in the parent path
3. **Admins** — bypass all checks

Denied requests return `403 يجب الاشتراك في هذه الدورة للوصول إلى الدرس`.

Successful `GET /lessons/:id` responses include `access.reason` which is one of `'preview' | 'enrolled' | 'admin'`.

The list endpoint (`GET /lessons`) always returns all published lessons but marks each with `isAccessible: boolean`.

### Lesson-Completion XP (Sprint 12)

Every `Lesson` has a `completionXpAward` field (default 10). When a student transitions a lesson to `completed: true` via `POST /progress/lessons/:lessonId`, the backend awards this XP once per user per lesson. Idempotent — repeated completions do not re-award.

### Warm-Up Completion (Sprint 12)

`Lesson.warmUpJson` may contain a riddle prompt with `answerAr` and `xpAward`.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/lessons/:lessonId/warmup/complete` | Submit a warm-up answer. Server evaluates correctness; awards XP on first correct submission | Yes |

**Request body:**
```json
{ "answer": "الكمبيوتر" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lessonId": "...",
    "warmUpCompleted": true,
    "isCorrect": true,
    "xpEarned": 5
  }
}
```

- Server-side evaluation uses the same Arabic normalization as FILL_BLANK slides (tashkeel, alef/yeh/teh variants stripped).
- Duplicate submission → `400 تم إكمال تمرين الإحماء بالفعل`.
- Empty answer → `400 الإجابة مطلوبة`.
- Lesson has no `warmUpJson` → `404 لا يوجد تمرين إحماء لهذا الدرس`.
- Wrong answer still marks `warmUpCompleted: true` but awards `0 XP` (no second chance).

### Enrollment

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/enrollments/paths/:pathId/enroll` | Enroll current user in a path | Yes |
| DELETE | `/enrollments/paths/:pathId/enroll` | Unenroll from a path | Yes |
| GET | `/enrollments/me/enrollments` | List current user's active enrollments (with computed `progress` % and `currentLesson`) | Yes |
| GET | `/enrollments/paths/:pathId/enrollments` | List enrolled users for a path | Admin |

**Enrollment response shape:** each enrollment includes `progress` (0–100), `pathTitleAr`, `pathTitleEn`, `featuredImage`, `difficulty`, and a `currentLesson` object (or `null` when complete).

### Progress

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/progress/lessons/:lessonId` | Update lesson progress (completed, timeSpent, quizScore). Automatically awards lesson-completion XP, updates streak, and attempts certificate auto-issue when `completed: true` | Yes |
| GET | `/progress/paths/:pathId` | Get path progress summary for current user | Yes |

**Side effects of `POST /progress/lessons/:lessonId` with `completed: true`:**
1. Awards `Lesson.completionXpAward` XP (once per user per lesson)
2. Updates streak (same-day no-op, yesterday +1, gap > 1 day → reset to 1)
3. Attempts certificate auto-issue (if this was the last published lesson in the path)

All three are non-blocking — failures are logged, never propagate to the response.

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

```
threshold(N) = 50 · N · (N - 1)     // cumulative XP to REACH level N
threshold(1) = 0
```

Level widths: `L1 = 100`, `L2 = 200`, `L3 = 300`, `L4 = 400`, `L5 = 500`, …

- `level` = highest N with `threshold(N) <= totalXp`
- `currentLevelXp` = `totalXp - threshold(level)`
- `nextLevelXp` = `threshold(level + 1) - threshold(level)`

**Worked example (1250 XP):** `threshold(5) = 1000`, `threshold(6) = 1500` → level 5, `currentLevelXp = 250`, `nextLevelXp = 500`, progress = 50%.

> ⚠️ **Frontend confirmed:** the level table in the Student Dashboard spec was internally inconsistent with its formula. We ship the table's curve (`50·N·(N-1)`). The example user at 2500 XP is **level 7** (not 8 as the original spec claimed).

### XP & Levels

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/xp/history` | Get current user's XP earning history (paginated) | Yes |
| GET | `/gamification/levels` | Get level definitions for levels 1–50 | No |

### Badges

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/badges` | Get all badge definitions | No |
| GET | `/gamification/me/badges` | Get current user's earned badges | Yes |
| GET | `/gamification/users/:userId/badges` | Get any user's earned badges | Yes |

**Badge fields:** each badge includes both `nameAr` and `nameEn` (the `nameEn` column was added in Sprint 11; falls back to Arabic name when absent).

**Boss Battle badges (Sprint 12):** four tier badges are awarded on boss battle submission:
- `أسطورة المدينة` / `City Legend` — score ≥ 80%
- `محارب المدينة` / `City Warrior` — score ≥ 60%
- `متدرب المدينة` / `City Trainee` — score ≥ 40%
- `مش هستسلم` / `Won't Give Up` — score < 40%

These are now persisted as real `UserBadge` rows (previously the badge name was only echoed in the response and never saved).

### Leaderboards

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/leaderboard?scope=global` | Global leaderboard by XP | Yes |
| GET | `/gamification/leaderboard?scope=path&pathId=...` | Path leaderboard by completed lessons | Yes |

**Global entries** include `userId`, `fullName`, `displayName`, `avatarUrl`, `totalXp`, `level`, `rank`. **Path entries** include `userId`, `fullName`, `completedLessons`, `rank`.

### Streaks

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/me/streak` | Get current streak info | Yes |
| POST | `/gamification/me/streak/freeze` | Use a streak freeze token | Yes |

**Streak response:** `currentStreak`, `longestStreak`, `streakFreezeAvailable`, `lastActivityDate` (YYYY-MM-DD or `null`), `lastStreakFreezeAt`.

**Automatic update:** streak updates whenever a lesson is marked `completed: true`.

### Daily Quests

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/daily-quests` | Get active daily quests with user progress | Yes |
| POST | `/gamification/daily-quests/:questId/complete` | Complete a daily quest and earn XP | Yes |

**Quest response shape:** each quest includes `id`, `titleAr`, `titleEn`, `descriptionAr`, `descriptionEn`, `xpAward`, `target`, `progress`, `completed`, `completedAt`.

## Payment Endpoints (Sprint 5 – Manual MVP)

> **Note:** Sprint 5 implements a **manual payment flow** using Vodafone Cash and InstaPay.
> Admin manually verifies and activates purchases. Full PayMob integration is planned for a later phase.

> ⚠️ **Subscription model deprecated (Sprint 12).** The `Subscription` table was removed. `Enrollment.expiresAt` models the subscription window. `GET /parents/me/billing` returns `purchases` only (no `subscriptions` key).

### Idempotency

`POST /payments/requests` supports the standard `Idempotency-Key` header. When supplied, the response is cached for 24 hours under `idempotency:<userId>:<key>` in Redis. Repeated requests with the same key return the original response. Concurrent requests with the same key receive a `409`. The header is optional (backwards-compatible).

Only `2xx` responses are cached. Errors release the in-flight lock so clients can retry. Fail-open on Redis unavailability.

### User Payment Requests

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/payments/requests` | Create payment request and get payment instructions. Supports `Idempotency-Key` | Yes |
| GET | `/payments/requests` | List current user's payment requests | Yes |
| POST | `/payments/requests/:id/mark-sent` | Mark payment as sent (add optional user notes) | Yes |

### Admin Payment Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/payments/admin/requests` | List all payment requests (pagination, status filter, search) | Admin |
| POST | `/payments/admin/requests/:id/activate` | Activate a payment request: creates purchase + enrollment, sends confirmation email | Admin |
| POST | `/payments/admin/requests/:id/reject` | Reject a payment request with reason; user notified by email | Admin |

**Payment Request Statuses:** `PENDING`, `VERIFIED`, `ACTIVATED`, `REJECTED`, `EXPIRED`

`PENDING` requests are automatically flipped to `EXPIRED` after their `expiresAt` passes. `VERIFIED` requests are intentionally **never** auto-expired — once the user has paid and marked sent, expiration is our problem, not theirs.

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

**Response shape (valid):** `{ valid: true, certificate: { certificateCode, recipientName, pathTitle, issuedAt, revokedAt: null, revokedReason: null } }`
**Response shape (invalid):** `{ valid: false, reason: 'NOT_FOUND' }` or `{ valid: false, reason: 'REVOKED', certificate: { ... } }`

### Admin Certificate Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/certificates/admin/issue` | Manually issue a certificate (body: `userId`, `pathId`) | Admin |
| POST | `/certificates/admin/:id/revoke` | Revoke a certificate (body: `reason`) | Admin |

### Auto-Issue Behavior

When a lesson is completed via `/progress/lessons/:lessonId`, the backend checks whether all published lessons in the parent path are now complete. If so, it auto-issues a certificate — **idempotent**, **non-blocking**, **best-effort**.

### PDF Generation

Certificates are rendered as A4 landscape PDFs using PDFKit with the Noto Naskh Arabic font. Arabic text is shaped via `arabic-persian-reshaper`. Storage is local (`uploads/certificates/<userId>/<code>.pdf`) with a storage abstraction ready for S3 swap.

## Community Endpoints (Sprint 6, updated Sprint 12)

> ⚠️ **Response shape changes in Sprint 12:** all post/comment responses now use `author` (not `user`) and include `userVote`. See the frontend Community contract response for full details.

### Forum Categories

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forum/categories` | List forum categories (pagination, search, active filter) | No |

**Category fields:** `id`, `nameAr`, `nameEn`, `slug`, `descriptionAr`, `descriptionEn`, `displayOrder`, `isActive`, `postCount`, `createdAt`, `updatedAt`.

- **`postCount`** counts published, non-deleted posts in the category.
- **Default filter:** only active categories. Pass `?isActive=false` to fetch inactive ones.

### Forum Posts

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forum/posts` | List posts with filters | No |
| POST | `/forum/posts` | Create new post | Yes |
| GET | `/forum/posts/:id` | Get post by ID (increments view count) | No/Yes |
| PUT | `/forum/posts/:id` | Update post (owner or admin) | Yes |
| DELETE | `/forum/posts/:id` | Soft delete post (owner or admin) | Yes |

**Post response shape:**
```json
{
  "id": "...",
  "title": "...",
  "content": "...",
  "categoryId": "uuid | null",
  "category": { "id": "...", "nameAr": "...", "nameEn": "...", "slug": "..." } | null,
  "pathId": "uuid | null",
  "lessonId": "uuid | null",
  "author": { "id": "...", "fullName": "...", "displayName": "...", "avatarUrl": "..." },
  "upvotes": 12,
  "downvotes": 3,
  "viewCount": 145,
  "commentCount": 8,
  "isSolved": false,
  "isPinned": false,
  "isLocked": false,
  "status": "published",
  "flaggedCount": 0,
  "createdAt": "...",
  "updatedAt": "...",
  "userVote": "up" | "down" | null
}
```

- **`author`** replaces the old `user` field. Compare client-side: `post.author.id === currentUser.id` for owner detection.
- **`userVote`** reflects the current user's vote state. Requires a Bearer token; `null` for anonymous callers.
- **`isSolved`** is set to `true` when a best answer is marked. There is no `bestAnswerId` field — find the best answer via `comments.find(c => c.isBestAnswer)?.id`.
- **`viewCount`** increments on every `GET /forum/posts/:id` (fire-and-forget).
- **Sorting** is deterministic: `createdAt DESC` is always the secondary tie-breaker.

### Comments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forum/posts/:postId/comments` | List comments with replies (top-level only, nested `replies` array) | No |
| POST | `/forum/posts/:postId/comments` | Add comment (supports replies) | Yes |
| PUT | `/forum/comments/:id` | Update comment (owner/admin) | Yes |
| DELETE | `/forum/comments/:id` | Soft delete comment (owner/admin) | Yes |

**Comment response shape:** each comment includes `author`, `userVote`, `isBestAnswer`, `isEdited`, and a nested `replies` array (2 levels total — top-level comments + direct replies).

**Nesting:** replies-to-replies appear as top-level comments with a non-null `parentCommentId`. Reconstruct the tree client-side if needed.

### Voting

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/forum/posts/:id/upvote` | Upvote a post (toggle) | Yes |
| POST | `/forum/posts/:id/downvote` | Downvote a post (toggle) | Yes |
| POST | `/forum/comments/:id/upvote` | Upvote a comment (toggle) | Yes |
| POST | `/forum/comments/:id/downvote` | Downvote a comment (toggle) | Yes |

- **Toggle behavior:** same-type vote removes it. Opposite-type vote replaces it. No 400 on toggle.
- **Response:** `null`. Refetch the post/comment to see updated counts and `userVote`.
- **Self-vote:** allowed.

### Best Answer

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/forum/posts/:id/mark-answer` | Mark a comment as best answer (post owner only) | Yes |

**Response:** the updated post object with `isSolved: true`. Only one best answer per post — marking a new one auto-unmarks the old.

**Non-owner:** `403 فقط صاحب المنشور يمكنه تحديد أفضل إجابة`.

### Reporting (Sprint 12)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/forum/posts/:id/report` | Report a post | Yes |
| POST | `/forum/comments/:id/report` | Report a comment | Yes |

**Request body:** `{ reason: 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'off-topic' | 'other', details?: string }`

- Duplicate report by same user → `409`
- Self-report → `400`
- Post/comment not found → `404`

### Search

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/forum/search?q=...` | Simple ILIKE search by title/content | No |
| GET | `/search/forum?q=...` | Full-text ranked search (canonical for community) | No |

**Recommendation:** use `GET /search/forum` for the Community search box — it supports `language`, `categoryId`, `pathId`, and ranked results.

### Admin Moderation

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/forum/reports` | List reported content (paginated, status filter) | Admin |
| POST | `/admin/forum/reports/:id/resolve` | Resolve a report (marks as resolved, decrements post `flaggedCount`) | Admin |
| POST | `/admin/forum/posts/:id/hide` | Hide a post | Admin |
| POST | `/admin/forum/posts/:id/unhide` | Unhide a post | Admin |
| POST | `/admin/forum/comments/:id/hide` | Hide a comment | Admin |
| POST | `/admin/forum/comments/:id/unhide` | Unhide a comment | Admin |

**Moderation queue response:** now returns `ForumReport` objects with embedded `reporter`, `post`, and `comment` — previously returned the raw posts with a `flaggedCount > 0` filter.

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

**Sprint 12 fix:** boolean query params (`isRead`, `isArchived`, `isDismissed`) now correctly distinguish omitted (no filter) from `false` (filter for un-archived / unread items). Previously an omitted param was coerced to `false`, adding an unintended filter.

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
- `language` – `ar` or `en`
- `type` – `path`, `forum`, or `user` (global only)
- `categoryId`, `difficulty`, `minPrice`, `maxPrice` – filters for paths
- `page`, `limit` – pagination

**Implementation:** uses `plainto_tsquery(${q}::regconfig)` against generated `tsvector` columns on `paths` and `forum_posts`. Raw SQL always selects explicit columns — `SELECT *` will fail because Prisma can't deserialize `tsvector`.

**Sprint 12 coverage:** search service is at 100% statement and 100% branch coverage.

### Recommendations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/recommendations/paths` | Personalized path recommendations for current user | Yes |
| GET | `/recommendations/popular` | Popular paths (by enrollments) | No |
| GET | `/recommendations/trending` | Trending paths (recent enrollment activity) | No |
| GET | `/recommendations/related/:pathId` | Paths related to the given path (co-enrollment) | No |

**Sprint 12 status:** refinement (fallback for new users, deterministic tie-breaking) deferred to Sprint 13.

## Parent Endpoints (Sprint 9, updated Sprint 12)

### Parent Dashboard

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/parents/me/overview` | Overview with `children[]` (each with `stats.level`), `totalXP`, `lastActiveChild` | Parent |
| GET | `/parents/me/billing` | Aggregated purchase history across parent + linked children | Parent |

**Sprint 12 changes:**
- **`POST /parents/me/children`** now accepts either `childId` (uuid) **or** `email`. Exactly one required.
- **`GET + PUT /parents/me/children/:childId/settings`** return a **flat shape** `{ lockOverrideEnabled, customLockDurationHours }` regardless of whether a `ChildSettings` row exists. Previously returned the full row when it existed and a slim object when it didn't.
- **`GET /parents/me/billing`** now aggregates purchases from the parent **and all linked children**. The `subscriptions` key is gone (Subscription model deprecated). Each purchase includes `user: { id, fullName, email }` so the UI can show who paid.
- **`GET /parents/me/overview`** — `level` is nested under `child.stats.level`, not top-level. `stats` may be `null` for very new users.

### Child Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/parents/me/children` | Link a child (body: `{ childId }` **or** `{ email }`) | Parent |
| GET | `/parents/me/children` | List children with basic info | Parent |
| DELETE | `/parents/me/children/:childId` | Unlink a child | Parent |
| GET | `/parents/me/children/:childId/progress` | Get child progress summary | Parent |
| GET | `/parents/me/children/:childId/performance` | Get child quiz scores and challenges | Parent |
| GET | `/parents/me/children/:childId/time-tracking` | Get child time tracking | Parent |
| GET | `/parents/me/children/:childId/settings` | Get child settings (flat shape) | Parent |
| PUT | `/parents/me/children/:childId/settings` | Update child settings | Parent |

## Enhanced Content Endpoints (Sprint 10)

### Slides

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/lessons/:lessonId/slides` | List slides for a lesson (each with `completed` flag for the current user) | No/Yes |
| POST | `/lessons/:lessonId/slides` | Create a slide (admin) | Admin |
| PUT | `/lessons/:lessonId/slides/:slideId` | Update a slide (admin) | Admin |
| DELETE | `/lessons/:lessonId/slides/:slideId` | Delete a slide (admin) | Admin |
| POST | `/lessons/:lessonId/slides/reorder` | Reorder slides (admin) | Admin |
| POST | `/lessons/:lessonId/slides/:slideId/complete` | Complete a slide | Yes |

**Slide Types:** `INFO`, `QUIZ`, `DRAG_DROP`, `TRUE_FALSE`, `FILL_BLANK`

#### ⚠️ Answer Evaluation Contract (Sprint 12)

**Correctness is computed server-side.** The client submits only the answer — `isCorrect` is **rejected** with `400` if sent.

**Complete slide request body:**
```json
{ "answer": <type-specific object> }
```

| Slide type | Answer shape |
|---|---|
| INFO | `{}` (or omitted) |
| QUIZ | `{ "index": 2 }` |
| TRUE_FALSE | `{ "value": true }` |
| FILL_BLANK | `{ "text": "الطوبة" }` |
| DRAG_DROP | `{ "items": [{ "label": "...", "correctZone": "..." }] }` |

**Complete slide response:**
```json
{
  "slideId": "...",
  "completed": true,
  "isCorrect": true,
  "xpEarned": 5
}
```

FILL_BLANK answers are Arabic-normalized before comparison (tashkeel, alef/yeh/teh variants stripped). Send the raw user input.

### Mini-Quest Checkpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/lessons/:lessonId/checkpoints` | List quest checkpoints for a lesson | No/Yes |
| POST | `/lessons/:lessonId/checkpoints` | Create a checkpoint (admin) | Admin |
| PUT | `/lessons/:lessonId/checkpoints/:checkpointId` | Update a checkpoint (admin) | Admin |
| DELETE | `/lessons/:lessonId/checkpoints/:checkpointId` | Delete a checkpoint (admin) | Admin |
| POST | `/lessons/:lessonId/checkpoints/reorder` | Reorder checkpoints (admin) | Admin |
| POST | `/lessons/:lessonId/checkpoints/:checkpointId/complete` | Complete a checkpoint | Yes |

#### ⚠️ Checkpoint Completion Contract (Sprint 12)

**The `completed` boolean is no longer accepted.** Non-empty `selfReflectionAnswer` IS the completion signal.

**Request body:**
```json
{ "selfReflectionAnswer": "I learned X" }
```

- Empty / whitespace-only → `400 يجب تقديم إجابة غير فارغة`
- Duplicate completion → `400 تم إكمال نقطة التحقق بالفعل`

**Response:**
```json
{
  "checkpointId": "...",
  "completed": true,
  "xpEarned": 15,
  "questCompleted": false,
  "nextCheckpoint": { "id": "...", "titleAr": "...", "order": 2 }
}
```

- `questCompleted: true` means **all** checkpoints for the lesson are done.
- `nextCheckpoint` is a slim object (`id`, `titleAr`, `order`), not the full checkpoint.

### Boss Battle

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/modules/:moduleId/boss-battle` | Get boss battle for module | Yes |
| POST | `/modules/:moduleId/boss-battle` | Create boss battle (admin) | Admin |
| PUT | `/modules/:moduleId/boss-battle/:battleId` | Update boss battle (admin) | Admin |
| DELETE | `/modules/:moduleId/boss-battle/:battleId` | Delete boss battle (admin) | Admin |
| POST | `/modules/:moduleId/boss-battle/submit` | Submit boss battle answers | Yes |

**Victory tiers:** `legend` (≥80%), `warrior` (≥60%), `trainee` (≥40%), `retry` (<40%).

**Retry label (Sprint 12):** the Arabic label for the `retry` tier is now **`مش هستسلم`** ("won't give up"). Renamed from `حاول تاني` ("try again") because there is no retry mechanic — the submission is one-per-lifetime per user due to a unique constraint.

**Badges (Sprint 12):** each victory tier awards a persistent `UserBadge` (see **Badges** above). The response `badgesEarned` array is now backed by real DB rows.

**Seed update (Sprint 12):** the seeded boss battle now has **5 questions** (was 3) so all four victory tiers are mathematically reachable.

### Recharge

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/lessons/:id/recharge-status` | Get recharge status for current user (XP boost window) | Yes |

## Rate Limiting

All `/v1/*` routes are rate-limited. Health checks, `/api-docs`, and static `/uploads` are excluded.

| Route group | Limit | Key |
|-------------|-------|-----|
| Auth endpoints | 10 req/min | per IP per endpoint |
| All other routes | `RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS` (default `100` / `60s`) | per user ID (fallback to IP) |

**Headers on every response:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. On `429`: `Retry-After`.

**Fail-open on Redis outage:** if Redis is unreachable, requests pass through. Configurable via `RATE_LIMIT_FAIL_OPEN` (default `true`).

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
"meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
```

## Test Users (from seed)

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | `admin@qafzly.com` | `Admin@123456` | Full admin rights |
| Parent | `parent@qafzly.com` | `Parent@123456` | Parent account with two children |
| Child 1 | `child1@qafzly.com` | `Child1@123456` | Enrolled in seeded path, with progress |
| Child 2 | `child2@qafzly.com` | `Child2@123456` | Enrolled, limited progress |
| Test Student | `test-student@qafzly.com` | `Student@123456` | XP 1250, Level 5, Streak 12, 2 badges; owns 3 forum posts |
| Leaderboard fillers | `yusuf@qafzly.com`, `sara@qafzly.com`, `omar@qafzly.com`, `maryam@qafzly.com`, `ziad@qafzly.com` | `Student@123456` | XP 2500 / 2200 / 1800 / 900 / 400 |

## Seed Data

Running `npx ts-node prisma/seed.ts` creates:

- **4 categories** (Programming, Web Development, Data Science, AI)
- **11 users** (admin, parent, 2 children, test student, 5 leaderboard fillers, plus the paid-path author)
- **2 published paths:**
  - `مقدمة إلى الحاسوب` (free, preview lesson, full content)
  - `مقدمة إلى البرمجة بلغة بايثون` (150 EGP, paid path for payment-flow testing)
- **1 unpublished path:** `مقدمة إلى الإنترنت`
- **Parent-child relationships** and settings
- **Lesson progress** for children and the test student
- **UserStats** for all student accounts
- **14 badge definitions** — 10 standard + **4 Boss Battle tier badges** (`أسطورة المدينة`, `محارب المدينة`, `متدرب المدينة`, `مش هستسلم`)
- **2 badges granted** to the test student
- **3 daily quests** (refreshed on every seed run)
- **Enhanced content** for lesson 1: 5 slides (one of each type), 3 checkpoints, warm-up riddle, 5-question boss battle
- **Forum seed (Sprint 12):**
  - **5 forum categories** — أسئلة عامة، مشاكل تقنية، نقاشات، إعلانات، اقتراحات
  - **8 posts** across categories, 3 authored by `test-student@qafzly.com`
  - **13 comments** (10 top-level + 3 nested replies), with **2 marked as best answers**
  - **15 votes** distributed across posts and comments
- **`completionXpAward: 10`** on lesson 1
- **`lockDurationHours: 0`** on lesson 1 (so the frontend can click through without waiting during testing)

*Note: No sample payment requests, notifications, or search/recommendation data are seeded; they are created during manual testing.*

## API Documentation (Swagger UI)

Interactive documentation available at `http://localhost:3000/api-docs`.

Use the **Authorize** button to set the JWT token (login first, then paste the `accessToken`).

## Running Tests

### Unit Tests

```bash
npm test -- --coverage
```

Unit tests live in `src/services/__tests__/`, `src/middleware/__tests__/`, and `src/jobs/__tests__/`. They use mocked Prisma, Redis, and AWS SDK clients.

**Current status:** 452 tests passing. Service-layer coverage ~93%.

### Integration Tests

Fully isolated Postgres and Redis containers, driven by Supertest.

**Prerequisites:**
- Docker Desktop running
- `.env.test` file present in project root

**One-command run:**

```bash
npm run test:integration
```

This command will:
1. Start the isolated test containers (`docker-compose.test.yml`).
2. Apply migrations to the test DB (port `5434`).
3. Seed the test DB.
4. Run the integration suite (`jest.integration.config.js`).
5. Tear down the containers.

**Individual steps (for debugging):**

```bash
npm run test:integration:up        # Start test containers
npm run test:integration:migrate   # Apply migrations to test DB
npm run test:integration:down      # Stop and remove test containers
```

**Integration test files:** `src/__tests__/integration/`

Current coverage (18 files, 80 tests):
- Auth (register → login → refresh)
- User profile (GET, PATCH)
- Enrollment (enroll, list)
- Progress (update lesson, path summary)
- Gamification (profile, streak, daily quests, leaderboard)
- Payments (create request, admin activation)
- Forum (post, comment)
- Forum reporting (report, duplicate prevention, self-report, admin list/resolve)
- Slides (list, complete, access control, `isCorrect` rejection)
- Checkpoints (list, complete, next checkpoint, `completed` rejection)
- Boss Battle (get, submit, all 4 tiers, badge awarding, duplicate rejection)
- Recharge (status, multiplier within boost window)
- Notifications (list, count, read, archive, dismiss, delete, device register)
- Parent (link by id, link by email, list, progress, settings, billing aggregation)
- Moderation (reports list, resolve, hide/unhide)
- Certificates (auto-issue, public verify, revoke)
- Search & recommendations
- Health check

**Current status:** 80 tests passing.

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

**Workflow (mandatory, one command at a time):**

```bash
# 1. Create the migration WITHOUT applying it
npx prisma migrate dev --create-only --name <short_description>

# 2. Open the generated prisma/migrations/<timestamp>_<name>/migration.sql
#    and DELETE any of these lines if present:
#      ALTER TABLE ... ALTER COLUMN "search_vector_ar" DROP DEFAULT
#      ALTER TABLE ... ALTER COLUMN "search_vector_en" DROP DEFAULT
#      ALTER TABLE ... DROP COLUMN "search_vector_ar"
#      ALTER TABLE ... DROP COLUMN "search_vector_en"
#      DROP INDEX "idx_paths_search_ar"    (and the other 7 search/trigram indexes)

# 3. Run the safety net
npm run check:migrations

# 4. Apply
npx prisma migrate deploy
```

**Never** chain these commands. **Never** run bare `npx prisma migrate dev`. The `check:migrations` script fails the build if any forbidden pattern sneaks into a migration file.

### Migration history

The history has been rebased to a small set of migrations:

- `20260911203608_initial_schema` — full schema in one file, including tsvector columns + GIN/trigram indexes
- `20260911212808_add_badge_name_en` — adds `nameEn` to `badges`
- `20260915101558_add_forum_reports` — adds the `forum_reports` table
- `20260916140547_deprecate_subscription` — drops the `subscriptions` table
- `20260917120000_add_lesson_completion_and_warmup_xp` — adds `completionXpAward` to `lessons` and `warmUpCompletedAt` to `lesson_progress`

If `migrate status` complains about drift:

```bash
npx prisma migrate reset --force
npx prisma migrate deploy
npx ts-node prisma/seed.ts
```

### Query-string booleans (Sprint 12)

Any query parameter that accepts a boolean (`isFeatured`, `isPublished`, `isRead`, `isArchived`, `isDismissed`) uses the shared helper `src/utils/validators/booleanQuery.ts`. It correctly distinguishes:

- `'true'` → `true`
- `'false'` → `false`
- omitted → `undefined` (no filter applied)

**Do not use `z.coerce.boolean()`** — `Boolean('false')` is `true` in JavaScript, which breaks filtering. **Do not use `.optional().transform(v => v === 'true')`** — Zod runs the transform on `undefined`, so an omitted param becomes `false` and silently adds an unintended filter.

## Environment Variables

See `.env.example` for all required variables. The most important:

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
| `AWS_S3_BUCKET_NAME` | S3 bucket for PDFs and certificates |
| `ACCOUNT_LOCKOUT_THRESHOLD` / `ACCOUNT_LOCKOUT_DURATION_MINUTES` | Login lockout policy |

## Project Structure

```
src/
├── config/          # env, database, redis, sesClient, logger, swagger
├── middleware/      # authenticate, optionalAuth, authorize, validate, errorHandler, rate limiters, idempotency
├── utils/           # asyncHandler, AppError, apiResponse, token, upload, youtube, validators/ (incl. booleanQuery.ts)
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
  - Certificate generation (auto-issue, verification, PDF, admin revocation)
  - AWS SES migration (SendGrid removed)
  - Frontend Student Dashboard fixes
  - Migration history rebased; `check:migrations` guard added
- ✅ **Sprint 12 – Security, Community Contract & Test Expansion:** Complete.
  - **Server-side answer evaluation** for slides + checkpoints (closes a cheating vector)
  - **Lesson-completion XP** (`Lesson.completionXpAward`, default 10) + **warm-up XP endpoint** (`POST /lessons/:lessonId/warmup/complete`)
  - **Parent Dashboard contract fixes** — link child by email, flat settings shape, aggregated billing across children, Subscription model deprecated
  - **Community contract fixes** — `user` → `author` rename, `userVote` on posts/comments, `postCount` on categories, forum seed added, comment duplication bug fixed, deterministic sorting
  - **Boolean query helper** — eliminates the `z.coerce.boolean()` bug class across `isFeatured`, `isPublished`, `isArchived`, etc.
  - **Boss Battle badge persistence** — 4 tier badges now create real `UserBadge` rows; retry label renamed to `مش هستسلم`
  - **Admin bypass fix** on `GET /paths/:id` and `GET /forum/posts/:id` (both now use `optionalAuth`)
  - **Forum reporting** — new `ForumReport` model + report endpoints + moderation queue rewrite
  - **Test expansion** — unit tests 361 → **452**; integration tests 22 → **80**
  - **Search branch coverage** 59.5% → 100% (statements) / 100% (branches)
- 🔜 **Deferred to Sprint 13** (in original order):
  - **P7** — Recommendation refinement (fallback for new users, deterministic tie-breaking)
  - **P8** — Bulk enrollment endpoint
  - **P9** — Weekly summary cron
  - **P10** — Deployment configuration + CI/CD
  - **P5 (original)** — Controller unit tests
  - **S3 avatar upload** (AWS-gated)
  - **Firebase push notifications** (Firebase-gated)
  - **Staging deployment** (AWS-gated)

---

**Qafzly Backend** · Team Falcon