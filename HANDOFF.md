# Qafzly Backend – Developer Handoff Document

**Date:** September 1, 2026  
**Prepared by:** Team Falcon (Developer)  
**Status:** ✅ Sprint 6 Complete – Community Features Implemented & Tested  
**Next Sprint:** Sprint 7 – Notifications (email, push)

---

## 1. Project Overview

Qafzly is a gamified EdTech platform targeting Arabic-speaking learners. This repository contains the backend API built with **Node.js, TypeScript, Express, Prisma, PostgreSQL, and Redis**.

The API follows a **services → controllers → routes** architecture for clean separation of concerns.

---

## 2. Current State

### ✅ Completed

- **Project Foundation**  
  - Full folder structure, middleware, utilities, configuration.  
  - Docker Compose for local PostgreSQL and Redis.  
  - Prisma schema with all core models (users, courses, progress, gamification, community, payments, notifications).  
  - First database migration applied successfully.  
  - Seed script (`prisma/seed.ts`) fully extended with sample data for all features.

- **Sprint 1 – Authentication**  
  - Endpoints: register, login, refresh, logout, forgot password, reset password.  
  - Redis‑backed rate limiting and account lockout.  
  - JWT access/refresh tokens with refresh tokens stored in Redis.  
  - Bcrypt password hashing (12 rounds).  
  - Arabic error messages.  
  - Unit tests: 12/12 passing, 94.25% statement coverage.

- **Sprint 2 – User Management**  
  - Self‑profile endpoints (GET, PUT, PATCH, DELETE).  
  - Privacy settings (GET/PUT).  
  - Avatar upload/removal (Multer).  
  - Admin user management (list, detail, update, suspend/activate, change role).  
  - Database schema extended with `displayName`, `timezone`, `lastLoginAt`, `privacySettings`.  
  - New middleware: `authorize.ts` for role‑based access.  
  - New utilities: `upload.ts` for Multer configuration.  
  - New services: `user.service.ts`, `admin.service.ts`.  
  - New controllers: `user.controller.ts`, `admin.controller.ts`.  
  - New routes: `user.routes.ts`, `admin.routes.ts`.  
  - New validators: `user.schema.ts`, `admin.schema.ts`.  
  - Unit tests: 31 total (12 auth + 19 user/admin), service layer coverage 83.33%.

- **Sprint 3 – Course Core**  
  - **Categories**: full CRUD (admin) + public listing/detail.  
  - **Courses**: CRUD (admin), public listing with filters, admin listing including unpublished, publish/unpublish.  
  - **Modules**: CRUD (admin), list by course (public/private), detail with lessons.  
  - **Lessons**: CRUD (admin), list by module, detail with quiz questions.  
  - **Enrollment**: enroll/unenroll, list user enrollments, list course enrollments (admin).  
  - **Progress**: update lesson progress, get course progress summary.  
  - Swagger UI fully documented with all endpoints.  
  - Seed script extended with realistic test data.  
  - Unit tests: 86 passing (services layer), coverage ~91% statements.

- **Sprint 4 – Gamification**  
  - **Profile**: current user gamification profile (XP, level, badges, rank).  
  - **XP & Levels**: XP history, level definitions (50 levels).  
  - **Badges**: all badges, my badges, user badges.  
  - **Leaderboards**: global and course-specific.  
  - **Streaks**: current streak info and streak freeze endpoint.  
  - **Daily Quests**: active quests and completion.  
  - New service: `gamification.service.ts`.  
  - New controller: `gamification.controller.ts`.  
  - New route: `gamification.routes.ts`.  
  - New validators: `gamification.schema.ts`.  
  - Unit tests: **113 passing**, service layer coverage **92.81%**.  
  - Gamification service coverage: **100% statements, 90.24% branches**.

- **Sprint 5 – Manual Payments (MVP)**  
  - **Payment Requests**: user can create a payment request for a course and receive clear payment instructions (Vodafone Cash & InstaPay numbers, reference code).  
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

- **Sprint 6 – Community Features**  
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

### 🔜 Not Started (Future Sprints)

- **Sprint 7** – Notifications (email, push)  
- **Sprint 8** – Search & Recommendations  
- **Sprint 9** – Admin Dashboard Enhancements  
- **Sprint 10** – UAT & Bug Fixing

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

# 5. Run database migrations
npx prisma migrate dev

# 6. Seed the database (admin, student, categories, courses, modules, lessons, enrollment, progress, badges, quests)
npx ts-node prisma/seed.ts

# 7. Start the development server
npm run dev
```

The API will be available at `http://localhost:3000/v1`.  
Health check: `GET http://localhost:3000/health`.  
Swagger UI: `http://localhost:3000/api-docs`.

---

## 4. Architecture Overview

```
src/
├── index.ts                 # Entry point: connects DB/Redis, starts server
├── app.ts                   # Express app setup (middleware, routes, Swagger)
├── config/                  # Environment, database, redis, logger, swagger
│   ├── env.ts
│   ├── database.ts
│   ├── redis.ts
│   ├── logger.ts
│   └── swagger.ts           # OpenAPI 3.0 definition (all endpoints)
├── middleware/              # Custom middleware
│   ├── authenticate.ts      # JWT verification
│   ├── authorize.ts         # Role-based access control (admin)
│   ├── errorHandler.ts      # Central error handler
│   ├── validate.ts          # Zod validation wrapper (Express 5 compatible)
│   ├── rateLimiter.ts       # Basic in-memory rate limiter (dev)
│   └── authRateLimiter.ts   # Redis‑backed rate limiter for auth routes
├── utils/
│   ├── asyncHandler.ts      # Async error wrapper
│   ├── AppError.ts          # Custom error class
│   ├── apiResponse.ts       # Standard response formatter
│   ├── token.ts             # JWT generation/verification
│   ├── upload.ts            # Multer configuration for avatar
│   └── validators/          # Zod schemas
│       ├── auth.schema.ts
│       ├── user.schema.ts
│       ├── admin.schema.ts
│       ├── category.schema.ts
│       ├── course.schema.ts
│       ├── module.schema.ts
│       ├── lesson.schema.ts
│       ├── enrollment.schema.ts
│       ├── progress.schema.ts
│       ├── gamification.schema.ts
│       ├── payment.schema.ts
│       └── forum.schema.ts
├── services/                # Business logic
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── admin.service.ts
│   ├── category.service.ts
│   ├── course.service.ts
│   ├── module.service.ts
│   ├── lesson.service.ts
│   ├── enrollment.service.ts
│   ├── progress.service.ts
│   ├── gamification.service.ts
│   ├── payment.service.ts
│   ├── forum.service.ts
│   ├── moderation.service.ts
│   └── email.service.ts
├── controllers/             # Request handlers
│   ├── auth.controller.ts
│   ├── user.controller.ts
│   ├── admin.controller.ts
│   ├── category.controller.ts
│   ├── course.controller.ts
│   ├── module.controller.ts
│   ├── lesson.controller.ts
│   ├── enrollment.controller.ts
│   ├── progress.controller.ts
│   ├── gamification.controller.ts
│   ├── payment.controller.ts
│   ├── forum.controller.ts
│   └── moderation.controller.ts
├── routes/                  # Route definitions
│   ├── index.ts             # Aggregates all routers
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   ├── admin.routes.ts
│   ├── category.routes.ts
│   ├── course.routes.ts
│   ├── module.routes.ts
│   ├── lesson.routes.ts
│   ├── enrollment.routes.ts
│   ├── progress.routes.ts
│   ├── gamification.routes.ts
│   ├── payment.routes.ts
│   ├── forum.routes.ts
│   └── moderation.routes.ts
├── types/
│   └── express.d.ts         # Extends Express Request with user
└── prisma/
    ├── schema.prisma        # Database schema (all models)
    ├── migrations/          # Applied migrations
    └── seed.ts              # Seed script (test data)
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

---

## 5. Implemented Endpoints

### 5.1 Authentication (Sprint 1)

| Method | Endpoint                  | Description                     | Auth Required | Rate Limited |
|--------|---------------------------|---------------------------------|---------------|--------------|
| POST   | `/auth/register`          | Create new user                 | No            | Yes (10/min) |
| POST   | `/auth/login`             | Login with email/password       | No            | Yes (10/min) |
| POST   | `/auth/refresh`           | Refresh access token            | No            | No           |
| POST   | `/auth/logout`            | Invalidate refresh token        | Yes           | No           |
| POST   | `/auth/forgot-password`   | Send password reset email       | No            | Yes (10/min) |
| POST   | `/auth/reset-password`    | Reset password with token       | No            | Yes (10/min) |

**Authentication details:**
- Access token: 15 minutes expiry.
- Refresh token: 7 days expiry, stored in Redis with key `refresh_token:<userId>`.
- Account lockout: after 5 failed login attempts, locked for 15 minutes.
- Passwords hashed with bcrypt (12 rounds).
- All error messages returned in Arabic.

### 5.2 User Profile (Sprint 2)

| Method | Endpoint                  | Description                     | Auth Required |
|--------|---------------------------|---------------------------------|---------------|
| GET    | `/users/me`               | Get current user profile        | Yes           |
| PUT    | `/users/me`               | Full update profile             | Yes           |
| PATCH  | `/users/me`               | Partial update profile          | Yes           |
| DELETE | `/users/me`               | Soft delete account             | Yes           |
| PUT    | `/users/me/privacy`       | Update privacy settings         | Yes           |
| GET    | `/users/me/privacy`       | Get privacy settings            | Yes           |
| POST   | `/users/me/avatar`        | Upload avatar                   | Yes           |
| DELETE | `/users/me/avatar`        | Remove avatar                   | Yes           |

### 5.3 Admin User Management (Sprint 2)

| Method | Endpoint                      | Description                     | Auth Required |
|--------|-------------------------------|---------------------------------|---------------|
| GET    | `/admin/users`                | List users (pagination, search) | Admin         |
| GET    | `/admin/users/:id`            | Get user details                | Admin         |
| PUT    | `/admin/users/:id`            | Update user                     | Admin         |
| POST   | `/admin/users/:id/suspend`    | Suspend user                    | Admin         |
| POST   | `/admin/users/:id/activate`   | Activate user                   | Admin         |
| POST   | `/admin/users/:id/role`       | Change user role                | Admin         |

### 5.4 Categories (Sprint 3)

| Method | Endpoint                  | Description                             | Auth Required |
|--------|---------------------------|-----------------------------------------|---------------|
| GET    | `/categories`             | List categories (pagination, search)    | No            |
| GET    | `/categories/:id`         | Get category with children & courses    | No            |
| POST   | `/categories`             | Create category                         | Admin         |
| PUT    | `/categories/:id`         | Update category                         | Admin         |
| DELETE | `/categories/:id`         | Soft-delete category                    | Admin         |

### 5.5 Courses (Sprint 3)

| Method | Endpoint                      | Description                                 | Auth Required |
|--------|-------------------------------|---------------------------------------------|---------------|
| GET    | `/courses`                    | List published courses (filters)           | No            |
| GET    | `/courses/admin/list`         | List all courses (incl. unpublished)       | Admin         |
| GET    | `/courses/:id`                | Get course (admin sees unpublished)        | No/Admin      |
| POST   | `/courses`                    | Create course                              | Admin         |
| PUT    | `/courses/:id`                | Update course                              | Admin         |
| DELETE | `/courses/:id`                | Soft-delete course                         | Admin         |
| POST   | `/courses/:id/publish`        | Publish/unpublish (`{ publish: boolean }`) | Admin         |

### 5.6 Modules (Sprint 3)

| Method | Endpoint                  | Description                                   | Auth Required |
|--------|---------------------------|-----------------------------------------------|---------------|
| GET    | `/modules?courseId=...`   | List modules for a course                     | No/Admin      |
| GET    | `/modules/:id`            | Get module with lessons                       | No/Admin      |
| POST   | `/modules`                | Create module                                 | Admin         |
| PUT    | `/modules/:id`            | Update module                                 | Admin         |
| DELETE | `/modules/:id`            | Delete module                                 | Admin         |

### 5.7 Lessons (Sprint 3)

| Method | Endpoint                  | Description                                   | Auth Required |
|--------|---------------------------|-----------------------------------------------|---------------|
| GET    | `/lessons?moduleId=...`   | List lessons for a module                     | No/Admin      |
| GET    | `/lessons/:id`            | Get lesson with quiz questions                | No/Admin      |
| POST   | `/lessons`                | Create lesson                                 | Admin         |
| PUT    | `/lessons/:id`            | Update lesson                                 | Admin         |
| DELETE | `/lessons/:id`            | Delete lesson                                 | Admin         |

### 5.8 Enrollment (Sprint 3)

| Method | Endpoint                                      | Description                     | Auth Required |
|--------|-----------------------------------------------|---------------------------------|---------------|
| POST   | `/enrollments/courses/:courseId/enroll`       | Enroll current user             | Yes           |
| DELETE | `/enrollments/courses/:courseId/enroll`       | Unenroll current user           | Yes           |
| GET    | `/enrollments/me/enrollments`                 | List current user's enrollments | Yes           |
| GET    | `/enrollments/courses/:courseId/enrollments`  | List enrolled users (course)    | Admin         |

### 5.9 Progress (Sprint 3)

| Method | Endpoint                      | Description                         | Auth Required |
|--------|-------------------------------|-------------------------------------|---------------|
| POST   | `/progress/lessons/:lessonId` | Update lesson progress              | Yes           |
| GET    | `/progress/courses/:courseId` | Get course progress summary         | Yes           |

### 5.10 Gamification (Sprint 4)

#### Profile

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/gamification/me`                | Current user gamification profile           | Yes           |
| GET    | `/gamification/users/:userId`     | Gamification profile for a user             | Yes           |

#### XP & Levels

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/gamification/xp/history`        | XP history (paginated)                      | Yes           |
| GET    | `/gamification/levels`            | Level definitions (50 levels)               | No            |

#### Badges

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/gamification/badges`            | All badge definitions                       | No            |
| GET    | `/gamification/me/badges`         | Current user's earned badges                | Yes           |
| GET    | `/gamification/users/:userId/badges` | Any user's earned badges                 | Yes           |

#### Leaderboards

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/gamification/leaderboard?scope=global` | Global leaderboard by XP             | Yes           |
| GET    | `/gamification/leaderboard?scope=course&courseId=...` | Course leaderboard by completed lessons | Yes   |

#### Streaks

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/gamification/me/streak`         | Current streak info                         | Yes           |
| POST   | `/gamification/me/streak/freeze`  | Use a streak freeze token                   | Yes           |

#### Daily Quests

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/gamification/daily-quests`      | Active daily quests with progress           | Yes           |
| POST   | `/gamification/daily-quests/:questId/complete` | Complete a daily quest and earn XP | Yes     |

### 5.11 Payments (Sprint 5 – Manual MVP)

#### User Payment Requests

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| POST   | `/payments/requests`              | Create payment request and get instructions | Yes           |
| GET    | `/payments/requests`              | List current user's payment requests        | Yes           |
| POST   | `/payments/requests/:id/mark-sent`| Mark payment as sent (add user notes)       | Yes           |

#### Admin Payment Management

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/payments/admin/requests`        | List all payment requests (filters)         | Admin         |
| POST   | `/payments/admin/requests/:id/activate` | Activate request (creates enrollment, purchase) | Admin   |
| POST   | `/payments/admin/requests/:id/reject`   | Reject request with reason               | Admin         |

### 5.12 Community (Sprint 6)

#### Forum Categories

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/forum/categories`               | List forum categories (pagination, search)  | No            |

#### Forum Posts

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/forum/posts`                    | List posts with filters (category, course, status, search) | No |
| POST   | `/forum/posts`                    | Create new post                             | Yes           |
| GET    | `/forum/posts/:id`                | Get post by ID (increments view count)      | No/Yes        |
| PUT    | `/forum/posts/:id`                | Update post (owner/admin)                   | Yes           |
| DELETE | `/forum/posts/:id`                | Soft delete post (owner/admin)              | Yes           |

#### Comments

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/forum/posts/:postId/comments`   | List comments with replies                  | No            |
| POST   | `/forum/posts/:postId/comments`   | Add comment (supports replies)              | Yes           |
| PUT    | `/forum/comments/:id`             | Update comment (owner/admin)                | Yes           |
| DELETE | `/forum/comments/:id`             | Soft delete comment (owner/admin)           | Yes           |

#### Voting

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| POST   | `/forum/posts/:id/upvote`         | Upvote a post (toggle)                      | Yes           |
| POST   | `/forum/posts/:id/downvote`       | Downvote a post (toggle)                    | Yes           |
| POST   | `/forum/comments/:id/upvote`      | Upvote a comment (toggle)                   | Yes           |
| POST   | `/forum/comments/:id/downvote`    | Downvote a comment (toggle)                 | Yes           |

#### Best Answer

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| POST   | `/forum/posts/:id/mark-answer`    | Mark a comment as best answer (post owner)  | Yes           |

#### Search

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/forum/search?q=...`             | Search posts by title/content               | No            |

#### Admin Moderation

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/admin/forum/reports`            | List reported posts (flagged)               | Admin         |
| POST   | `/admin/forum/reports/:id/resolve`| Resolve a report (reset flag count)         | Admin         |
| POST   | `/admin/forum/posts/:id/hide`     | Hide a post                                 | Admin         |
| POST   | `/admin/forum/posts/:id/unhide`   | Unhide a post                               | Admin         |
| POST   | `/admin/forum/comments/:id/hide`  | Hide a comment                              | Admin         |
| POST   | `/admin/forum/comments/:id/unhide`| Unhide a comment                            | Admin         |

---

## 6. Key Decisions & Technical Notes

- **Prisma version:** Pinned to `6.19.0` (stable). Do **not** upgrade to v7/8 without thorough testing; breaking changes exist.
- **PostgreSQL port:** Host uses `5433` because local PostgreSQL already occupies `5432`. If changed, update `docker-compose.yml` and `DATABASE_URL` in `.env`.
- **Redis usage:** Token storage, rate limiting, account lockout.
- **JWT secrets:** Access and refresh secrets are separate; stored in `.env`.
- **Rate limiting:** Auth routes use `authRateLimiter` (Redis). Other routes currently use in‑memory `rateLimiter` – replace with Redis version for production.
- **Email:** Uses SendGrid if `SENDGRID_API_KEY` is set; otherwise logs to console in development. Payment emails are sent asynchronously.
- **Testing:** Jest + ts-jest. Prisma and Redis are mocked in unit tests; located in `src/services/__tests__/`.
- **Avatar upload:** Multer, local storage in dev, S3 in production (to be implemented). Served via `/uploads`.
- **Swagger UI:** Interactive documentation available at `http://localhost:3000/api-docs`. All endpoints documented.
- **Express 5:** `req.query` and `req.params` are getter-only; the `validate` middleware uses `Object.defineProperty` to reassign parsed values. Ensure this is not changed back to direct assignment.
- **Level formula:** XP per level is `level * (level + 1) * 5`. The `getLevels` endpoint returns the first 50 levels.
- **Leaderboards:** Global uses `userStats` ordered by XP; course-specific uses lesson progress aggregation. Pagination is supported.
- **Streak freeze:** Users can freeze streaks using `streakFreezeAvailable` tokens. The endpoint decrements the token and sets `lastStreakFreezeAt`.
- **Manual Payments:** Payment requests are created with a unique reference code (`PAY-{userId-part}-{courseId-part}-{timestamp}`). They expire after 7 days (expiry set in application code). Admin activation uses a Prisma transaction to create `Purchase` and `Enrollment` records. No automatic expiration is currently implemented; future enhancement may add a cron job.
- **Forum voting:** Uses a polymorphic `ForumVote` model with `targetType` and `targetId`. Toggling logic: same vote removes it, opposite vote changes it, no vote creates it. Unique constraint prevents double voting.
- **Best answer:** Only the post author can mark a comment as best answer. Previous best answer is cleared, and the post's `isSolved` flag is set.
- **Seed script:** Provides admin, student, categories, courses, modules, lessons, enrollment, progress, badges, daily quests. Run after migrations for full test data.

---

## 7. Testing

### Run tests
```bash
npm test -- --coverage
```

### Current coverage (service layer)
- **Auth service:** 98.85% statements, 100% functions.
- **User service:** 100% statements, 100% functions.
- **Admin service:** 97.56% statements, 100% functions.
- **Category service:** 100% statements, 100% functions.
- **Course service:** 96.72% statements, 100% functions.
- **Module service:** 97.5% statements, 100% functions.
- **Lesson service:** 97.29% statements, 100% functions.
- **Enrollment service:** 100% statements, 100% functions.
- **Progress service:** 100% statements, 100% functions.
- **Gamification service:** 100% statements, 90.24% branches, 100% functions.
- **Payment service:** 100% statements, 90.9% branches, 100% functions.
- **Forum service:** 87.95% statements, 75.2% branches, 93.33% functions.
- **Moderation service:** 100% statements, 100% branches, 100% functions.
- **Email service:** 0% (stub), not included in critical path.
- **Controllers:** 0% (thin wrappers; acceptable for now).

**Overall service layer coverage:** 93.2% statements, 83.95% branches, 94.39% functions.  
**Total tests:** 190 passing, 0 failing.

### Testing approach
- Mock Prisma and Redis using Jest module mocks.
- Use `dotenv.config({ path: '.env.test' })` in `jest.setup.ts` for test environment.
- All services have corresponding test files in `src/services/__tests__/`.

---

## 8. Next Steps – Beyond Sprint 6

### Recommended Immediate Actions
1. **Integration tests**: Add end‑to‑end tests for critical flows using supertest.
2. **Controller coverage**: Optional; controllers are thin, but adding tests would increase confidence.
3. **Redis rate limiter for general routes**: Replace in‑memory `rateLimiter` with Redis version for production readiness.
4. **S3 upload for avatars**: Implement production storage (currently local filesystem).
5. **Payment expiration automation**: Implement a cron job or scheduled function to mark expired payment requests as `EXPIRED`.
6. **Forum search improvements**: Consider full-text search with `tsvector` for better relevance.

### Future Sprints (as per roadmap)
- **Sprint 7 – Notifications**: Email & push notifications. (Models exist.)
- **Sprint 8 – Search & Recommendations**.
- **Sprint 9 – Admin Dashboard Enhancements**.
- **Sprint 10 – UAT & Bug Fixing**.

---

## 9. Important Commands

```bash
npm run dev                 # start development server
npm test -- --coverage      # run tests with coverage
npx prisma migrate dev      # apply database migrations
npx prisma generate         # regenerate Prisma Client
docker-compose up -d        # start local infrastructure
docker-compose down -v      # stop and remove volumes (resets data)
npx ts-node prisma/seed.ts  # seed database (admin, student, courses, badges, quests)
```

---

## 10. Known Issues / Gotchas

- If you see `fatal: detected dubious ownership` in Git, run:
  ```bash
  git config --global --add safe.directory D:/Career/Qafzly
  ```
- Do **not** commit `.env`; it is gitignored. Use `.env.example` as template.
- The generic `rateLimiter` middleware is in‑memory; use `authRateLimiter` or replace with Redis for production.
- Email sending is stubbed in dev. Set `SENDGRID_API_KEY` to actually send emails.
- Prisma migrations are tracked; do not edit existing migration files manually.
- Seed script has `// @ts-nocheck` at top to avoid TypeScript config issues; acceptable for a standalone script.
- **Express 5 compatibility**: Avoid assigning `req.query`, `req.params` directly; use `Object.defineProperty` as done in `validate.ts`.
- Soft‑deleted records are never returned in public endpoints; admin endpoints include them (with `deletedAt` set). Queries should always check `deletedAt: null` unless admin.
- When updating a course's `price`, the `listCourses` service now correctly combines `minPrice` and `maxPrice` into a single `where.price` object. Keep this pattern if adding more range filters.
- **Streak freeze**: The endpoint does not validate if the freeze is within the current streak; it simply decrements the token. Business logic may be enhanced later.
- **Manual payments**: The `expiresAt` field is set in application code (default 7 days). No automatic expiration is implemented yet; expired requests may remain `PENDING` until manually addressed. Consider adding a cron job for production.
- **Forum votes**: The `ForumVote` model is polymorphic; when using Prisma client, ensure you always specify `targetType` and `targetId` together. There is no direct relation to `ForumPost` or `ForumComment`, so querying votes requires manual filtering.

---

## 11. Contact for Questions

If you are the next developer taking over, please read this document and run the project locally before making changes. For architectural questions, refer to the code comments and the `README.md`.

---

**End of Handoff Document**