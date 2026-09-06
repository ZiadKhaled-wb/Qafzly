# Qafzly Backend API

Backend service for the Qafzly gamified EdTech platform (Arabic/Egyptian market).

## Tech Stack
- Node.js, TypeScript, Express
- PostgreSQL + Prisma ORM
- Redis
- JWT Authentication
- Zod validation
- Pino logging

## Getting Started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and adjust values.
3. Start Docker services: `docker-compose up -d`
4. Run database migrations: `npx prisma migrate dev`
5. (Optional but recommended) Seed database: `npx ts-node prisma/seed.ts`
6. Start development server: `npm run dev`

## API Base URL
`http://localhost:3000/v1`

## Health Check
`GET /health`

## Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout (invalidates refresh token) |
| POST | `/auth/forgot-password` | Request password reset email |
| POST | `/auth/reset-password` | Reset password using token |

## User Profile Endpoints (Sprint 2)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users/me` | Get current user profile | Yes |
| PUT | `/users/me` | Full update profile | Yes |
| PATCH | `/users/me` | Partial update profile | Yes |
| DELETE | `/users/me` | Soft delete account | Yes |
| PUT | `/users/me/privacy` | Update privacy settings | Yes |
| GET | `/users/me/privacy` | Get privacy settings | Yes |
| POST | `/users/me/avatar` | Upload avatar | Yes |
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
| GET | `/paths/admin/list` | List all paths (including unpublished, soft‑deleted excluded) | Admin |
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
| GET | `/lessons?moduleId=...` | List lessons for a module (only published unless admin) | No/Admin |
| GET | `/lessons/:id` | Get lesson by ID with quiz questions | No/Admin |
| POST | `/lessons` | Create lesson | Admin |
| PUT | `/lessons/:id` | Update lesson | Admin |
| DELETE | `/lessons/:id` | Delete lesson | Admin |
| GET | `/lessons/:id/pdf-url` | Get signed PDF URL (5 min expiry) | Yes |

### Enrollment

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/enrollments/paths/:pathId/enroll` | Enroll current user in a path | Yes |
| DELETE | `/enrollments/paths/:pathId/enroll` | Unenroll from a path | Yes |
| GET | `/enrollments/me/enrollments` | List current user's active enrollments | Yes |
| GET | `/enrollments/paths/:pathId/enrollments` | List enrolled users for a path | Admin |

### Progress

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/progress/lessons/:lessonId` | Update lesson progress (completed, timeSpent, quizScore) | Yes |
| GET | `/progress/paths/:pathId` | Get path progress summary for current user | Yes |

## Gamification Endpoints (Sprint 4)

### Profile

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/me` | Get current user's gamification profile (XP, level, badges, rank) | Yes |
| GET | `/gamification/users/:userId` | Get gamification profile for any user | Yes |

### XP & Levels

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/xp/history` | Get current user's XP earning history (paginated) | Yes |
| GET | `/gamification/levels` | Get level definitions and XP thresholds | No |

### Badges

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/badges` | Get all badge definitions | No |
| GET | `/gamification/me/badges` | Get current user's earned badges | Yes |
| GET | `/gamification/users/:userId/badges` | Get any user's earned badges | Yes |

### Leaderboards

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/leaderboard?scope=global` | Global leaderboard by XP | Yes |
| GET | `/gamification/leaderboard?scope=path&pathId=...` | Path leaderboard by completed lessons | Yes |

### Streaks

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/me/streak` | Get current streak info (current, longest, freeze availability) | Yes |
| POST | `/gamification/me/streak/freeze` | Use a streak freeze token | Yes |

### Daily Quests

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/gamification/daily-quests` | Get active daily quests with user progress | Yes |
| POST | `/gamification/daily-quests/:questId/complete` | Complete a daily quest and earn XP | Yes |

## Payment Endpoints (Sprint 5 – Manual MVP)

> **Note:** Sprint 5 implements a **manual payment flow** using Vodafone Cash and InstaPay.  
> Admin manually verifies and activates subscriptions. Full PayMob integration is planned for a later phase.

### User Payment Requests

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/payments/requests` | Create payment request for a path and get payment instructions (reference code, Vodafone Cash & InstaPay numbers) | Yes |
| GET | `/payments/requests` | List current user's payment requests (pagination, optional status filter) | Yes |
| POST | `/payments/requests/:id/mark-sent` | Mark payment as sent (add optional user notes) | Yes |

### Admin Payment Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/payments/admin/requests` | List all payment requests (pagination, status filter, search) | Admin |
| POST | `/payments/admin/requests/:id/activate` | Activate a payment request: creates purchase, enrollment, and sends confirmation email | Admin |
| POST | `/payments/admin/requests/:id/reject` | Reject a payment request with reason; user notified by email | Admin |

**Payment Request Statuses:** `PENDING`, `VERIFIED`, `ACTIVATED`, `REJECTED`, `EXPIRED`

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

**Note:** Push notifications (Firebase) are currently logged as placeholders; email notifications are sent via SendGrid if configured.

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

### Recommendations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/recommendations/paths` | Personalized path recommendations for current user | Yes |
| GET | `/recommendations/popular` | Popular paths (by enrollments) | No |
| GET | `/recommendations/trending` | Trending paths (recent enrollment activity) | No |
| GET | `/recommendations/related/:pathId` | Paths related to the given path (co‑enrollment) | No |

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

## Seed Data

Running `npx ts-node prisma/seed.ts` creates:

- **4 categories** (Programming, Web Development, Data Science, AI)
- **1 published path** "مقدمة إلى الحاسوب" with modules and lessons
- **1 unpublished path** "مقدمة إلى الإنترنت"
- **Parent-child relationships** and settings
- **Lesson progress** for children
- **User stats** for children
- **10 badge definitions** (with Arabic/English names)
- **3 daily quests** active for the current day

*Note: No sample payment requests, forum posts, notifications, or search/recommendation data are seeded; they are created during manual testing.*

## API Documentation (Swagger UI)

Interactive documentation available at `http://localhost:3000/api-docs`.

Use the **Authorize** button to set the JWT token (login first, then paste the `accessToken`).

## Running Tests

```bash
npm test -- --coverage
```

## Environment Variables

See `.env.example` for all required variables.