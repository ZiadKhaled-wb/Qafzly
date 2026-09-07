# Qafzly Backend – Developer Handoff Document

**Date:** September 8, 2026  
**Prepared by:** Team Falcon (Developer)  
**Status:** ✅ Sprint 10 Complete – Enhanced Content Structure (Slides, Mini-Quests, Boss Battle, Recharge)  
**Next Sprint:** Sprint 11 – UAT & Bug Fixing

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
  - Prisma schema with all core models (users, paths, progress, gamification, community, payments, notifications, child settings, enhanced content models).  
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

- **Sprint 3 – Path Core**  
  - **Categories**: full CRUD (admin) + public listing/detail.  
  - **Paths**: CRUD (admin), public listing with filters, admin listing including unpublished, publish/unpublish.  
  - **Modules**: CRUD (admin), list by path (public/private), detail with lessons.  
  - **Lessons**: CRUD (admin), list by module, detail with quiz questions.  
  - **Enrollment**: enroll/unenroll, list user enrollments, list path enrollments (admin).  
  - **Progress**: update lesson progress, get path progress summary.  
  - Swagger UI fully documented with all endpoints.  
  - Seed script extended with realistic test data.  
  - Unit tests: 86 passing (services layer), coverage ~91% statements.

- **Sprint 4 – Gamification**  
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

- **Sprint 5 – Manual Payments (MVP)**  
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

- **Sprint 7 – Notifications**  
  - **User Endpoints**: list notifications with filters, unread count, mark as read, mark all as read, archive, dismiss, delete, device register/unregister.  
  - **Admin Endpoints**: send system notification to all users or specific users.  
  - **Email Integration**: SendGrid‑based email notifications (notification‑specific email template).  
  - **Push Notifications**: placeholder for Firebase Cloud Messaging (logged, not yet sent).  
  - **Models Upgraded**: `Notification` model expanded to include `senderId`, `link`, `iconUrl`, `imageUrl`, `metadata`, `isArchived`, `isDismissed`, `channelsSent`, `readAt`, `dismissedAt`. `DeviceToken` model expanded with `deviceToken`, `deviceType`, `deviceId`, `deviceModel`, `osVersion`, `appVersion`, `isActive`, `lastUsedAt`. New `NotificationTemplate` model added.  
  - New service: `notification.service.ts`.  
  - New controller: `notification.controller.ts`.  
  - New route: `notification.routes.ts` (replaced placeholder).  
  - New validators: `notification.schema.ts`.  
  - Unit tests: **219 passing** (up from 190), notification service coverage **>99% statements, >93% branches**.  
  - Overall service layer coverage: **93.38% statements**.

- **Sprint 8 – Search & Recommendations**  
  - **Global Search**: search across paths, forum posts, and users with relevance ranking.  
  - **Path Search**: filters by category, difficulty, price range.  
  - **Forum Search**: filters by category and path.  
  - **User Search**: by name, display name, email.  
  - **Recommendations**:  
    - Personalized path recommendations based on user’s enrollment history.  
    - Popular paths (by enrollment count).  
    - Trending paths (recent enrollment activity, last 30 days).  
    - Related paths (“because you took”) using co‑enrollment.  
  - **Database**: Added generated `tsvector` columns (`search_vector_ar`, `search_vector_en`) and GIN indexes on `paths` and `forum_posts`. Added trigram indexes on `users.fullName`, `users.email`, `paths.title`, `forum_posts.title`.  
  - New services: `search.service.ts`, `recommendation.service.ts`.  
  - New controllers: `search.controller.ts`, `recommendation.controller.ts`.  
  - New routes: `search.routes.ts`, `recommendation.routes.ts`.  
  - New validators: `search.schema.ts`, `recommendation.schema.ts`.  
  - Unit tests: **231 passing** (up from 219).  
  - Search service coverage: **100% statements, 59.52% branches, 100% functions**.  
  - Recommendation service coverage: **97.36% statements, 88.88% branches, 100% functions**.  
  - Overall service layer coverage: **93.77% statements, 82.67% branches, 94.89% functions**.

- **Sprint 9 – Parent‑Child, Lesson Expansion, Lock, PDF Delivery**  
  - **User Roles**: Removed `INSTRUCTOR`; roles now `STUDENT`, `PARENT`, `ADMIN`.  
  - **Parent‑Child Relationships**: Self‑referential `User` relation (`parentId`, `children`). New `ChildSettings` model (lock override enabled, custom lock duration).  
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
  - **12‑Hour Lock**: Implemented lock logic based on previous lesson completion and lock duration. Parent override can disable or adjust. Added endpoint `GET /lessons/:id/lock-status`.  
  - **PDF Delivery**: Added `PDF` signed URL endpoint `GET /lessons/:id/pdf-url` (S3 signed URL with 5‑min expiry).  
  - **YouTube Validation**: Utility `extractYouTubeId` created and enforced in lesson schema.  
  - New services: `parent.service.ts`, `pdf.service.ts`, `s3.service.ts`.  
  - New controllers: `parent.controller.ts`.  
  - New routes: `parent.routes.ts`.  
  - New validators: `parent.schema.ts`.  
  - Unit tests: **252 passing** (up from 231).  
  - Parent service coverage: **98.3% statements, 95.83% branches**.  
  - Lesson service coverage: **95.38% statements, 82.92% branches**.  
  - Overall service layer coverage: **93.78% statements, 82.18% branches, 95.33% functions**.

- **Sprint 10 – Enhanced Content Structure (Slides, Mini-Quests, Boss Battle, Recharge)**  
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

# 5. Run database migrations
npx prisma migrate dev

# 6. Seed the database (admin, parent, children, categories, paths, modules, lessons, slides, checkpoints, boss battle, enrollment, progress, badges, quests)
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
├── config/
│   ├── env.ts
│   ├── database.ts
│   ├── redis.ts
│   ├── logger.ts
│   └── swagger.ts           # OpenAPI 3.0 definition (all endpoints)
├── middleware/
│   ├── authenticate.ts
│   ├── authorize.ts
│   ├── errorHandler.ts
│   ├── validate.ts          # Express 5 compatible
│   ├── rateLimiter.ts
│   └── authRateLimiter.ts
├── utils/
│   ├── asyncHandler.ts
│   ├── AppError.ts
│   ├── apiResponse.ts
│   ├── token.ts
│   ├── upload.ts
│   ├── youtube.ts
│   └── validators/          # Zod schemas
│       ├── auth.schema.ts
│       ├── user.schema.ts
│       ├── admin.schema.ts
│       ├── category.schema.ts
│       ├── path.schema.ts
│       ├── module.schema.ts
│       ├── lesson.schema.ts
│       ├── enrollment.schema.ts
│       ├── progress.schema.ts
│       ├── gamification.schema.ts
│       ├── payment.schema.ts
│       ├── forum.schema.ts
│       ├── notification.schema.ts
│       ├── search.schema.ts
│       ├── recommendation.schema.ts
│       ├── parent.schema.ts
│       ├── slide.schema.ts
│       ├── questCheckpoint.schema.ts
│       └── bossBattle.schema.ts
├── services/
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── admin.service.ts
│   ├── category.service.ts
│   ├── path.service.ts
│   ├── module.service.ts
│   ├── lesson.service.ts
│   ├── enrollment.service.ts
│   ├── progress.service.ts
│   ├── gamification.service.ts
│   ├── payment.service.ts
│   ├── forum.service.ts
│   ├── moderation.service.ts
│   ├── notification.service.ts
│   ├── search.service.ts
│   ├── recommendation.service.ts
│   ├── parent.service.ts
│   ├── pdf.service.ts
│   ├── s3.service.ts
│   ├── slide.service.ts
│   ├── quest.service.ts
│   ├── bossBattle.service.ts
│   ├── recharge.service.ts
│   └── email.service.ts
├── controllers/
│   ├── auth.controller.ts
│   ├── user.controller.ts
│   ├── admin.controller.ts
│   ├── category.controller.ts
│   ├── path.controller.ts
│   ├── module.controller.ts
│   ├── lesson.controller.ts
│   ├── enrollment.controller.ts
│   ├── progress.controller.ts
│   ├── gamification.controller.ts
│   ├── payment.controller.ts
│   ├── forum.controller.ts
│   ├── moderation.controller.ts
│   ├── notification.controller.ts
│   ├── search.controller.ts
│   ├── recommendation.controller.ts
│   ├── parent.controller.ts
│   ├── slide.controller.ts
│   ├── quest.controller.ts
│   └── bossBattle.controller.ts
├── routes/
│   ├── index.ts
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   ├── admin.routes.ts
│   ├── category.routes.ts
│   ├── path.routes.ts
│   ├── module.routes.ts
│   ├── lesson.routes.ts
│   ├── enrollment.routes.ts
│   ├── progress.routes.ts
│   ├── gamification.routes.ts
│   ├── payment.routes.ts
│   ├── forum.routes.ts
│   ├── moderation.routes.ts
│   ├── notification.routes.ts
│   ├── search.routes.ts
│   ├── recommendation.routes.ts
│   ├── parent.routes.ts
│   ├── slide.routes.ts
│   ├── quest.routes.ts
│   └── bossBattle.routes.ts
├── types/
│   └── express.d.ts
└── prisma/
    ├── schema.prisma
    ├── migrations/
    └── seed.ts
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
| GET    | `/categories/:id`         | Get category with children & paths      | No            |
| POST   | `/categories`             | Create category                         | Admin         |
| PUT    | `/categories/:id`         | Update category                         | Admin         |
| DELETE | `/categories/:id`         | Soft-delete category                    | Admin         |

### 5.5 Paths (Sprint 3)

| Method | Endpoint                      | Description                                 | Auth Required |
|--------|-------------------------------|---------------------------------------------|---------------|
| GET    | `/paths`                    | List published paths (filters)             | No            |
| GET    | `/paths/admin/list`         | List all paths (incl. unpublished)         | Admin         |
| GET    | `/paths/:id`                | Get path (admin sees unpublished)          | No/Admin      |
| POST   | `/paths`                    | Create path                                | Admin         |
| PUT    | `/paths/:id`                | Update path                                | Admin         |
| DELETE | `/paths/:id`                | Soft-delete path                           | Admin         |
| POST   | `/paths/:id/publish`        | Publish/unpublish (`{ publish: boolean }`) | Admin         |

### 5.6 Modules (Sprint 3)

| Method | Endpoint                  | Description                                   | Auth Required |
|--------|---------------------------|-----------------------------------------------|---------------|
| GET    | `/modules?pathId=...`     | List modules for a path                       | No/Admin      |
| GET    | `/modules/:id`            | Get module with lessons                       | No/Admin      |
| POST   | `/modules`                | Create module                                 | Admin         |
| PUT    | `/modules/:id`            | Update module                                 | Admin         |
| DELETE | `/modules/:id`            | Delete module                                 | Admin         |

### 5.7 Lessons (Sprint 3, 9, 10)

| Method | Endpoint                  | Description                                   | Auth Required |
|--------|---------------------------|-----------------------------------------------|---------------|
| GET    | `/lessons?moduleId=...`   | List lessons for a module                     | No/Admin      |
| GET    | `/lessons/:id`            | Get lesson with quiz questions                | No/Admin      |
| POST   | `/lessons`                | Create lesson                                 | Admin         |
| PUT    | `/lessons/:id`            | Update lesson                                 | Admin         |
| DELETE | `/lessons/:id`            | Delete lesson                                 | Admin         |
| GET    | `/lessons/:id/lock-status`| Get lock status for current user              | Yes           |
| GET    | `/lessons/:id/pdf-url`    | Get signed PDF URL (5 min expiry)             | Yes           |
| GET    | `/lessons/:id/recharge-status` | Get recharge status for current user      | Yes           |

### 5.8 Enrollment (Sprint 3)

| Method | Endpoint                                      | Description                     | Auth Required |
|--------|-----------------------------------------------|---------------------------------|---------------|
| POST   | `/enrollments/paths/:pathId/enroll`           | Enroll current user             | Yes           |
| DELETE | `/enrollments/paths/:pathId/enroll`           | Unenroll current user           | Yes           |
| GET    | `/enrollments/me/enrollments`                 | List current user's enrollments | Yes           |
| GET    | `/enrollments/paths/:pathId/enrollments`      | List enrolled users (path)      | Admin         |

### 5.9 Progress (Sprint 3)

| Method | Endpoint                      | Description                         | Auth Required |
|--------|-------------------------------|-------------------------------------|---------------|
| POST   | `/progress/lessons/:lessonId` | Update lesson progress              | Yes           |
| GET    | `/progress/paths/:pathId`     | Get path progress summary           | Yes           |

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
| GET    | `/gamification/leaderboard?scope=path&pathId=...` | Path leaderboard by completed lessons | Yes   |

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
| GET    | `/forum/posts`                    | List posts with filters (category, path, status, search) | No |
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

### 5.13 Notifications (Sprint 7)

#### User Notification Endpoints

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/notifications`                  | List user notifications (pagination, read/unread/type/archive/dismiss filters) | Yes |
| GET    | `/notifications/unread/count`     | Get count of unread notifications           | Yes           |
| POST   | `/notifications/read-all`         | Mark all notifications as read              | Yes           |
| POST   | `/notifications/:id/read`         | Mark a notification as read                 | Yes           |
| POST   | `/notifications/:id/archive`      | Archive a notification                      | Yes           |
| POST   | `/notifications/:id/dismiss`      | Dismiss a notification                      | Yes           |
| DELETE | `/notifications/:id`              | Delete a notification                       | Yes           |
| POST   | `/notifications/device/register`  | Register a device for push notifications   | Yes           |
| DELETE | `/notifications/device/:id`       | Unregister a device                         | Yes           |

#### Admin Notification Endpoints

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| POST   | `/admin/notifications`            | Send system notification to all users or specific users | Admin |

### 5.14 Search & Recommendations (Sprint 8)

#### Global Search

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/search`                         | Global search across paths, forum posts, and users | No |
| GET    | `/search/paths`                   | Search paths only                           | No |
| GET    | `/search/forum`                   | Search forum posts only                     | No |
| GET    | `/search/users`                   | Search users only                           | No |

#### Recommendations

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/recommendations/paths`          | Personalized path recommendations           | Yes           |
| GET    | `/recommendations/popular`        | Popular paths                               | No            |
| GET    | `/recommendations/trending`       | Trending paths                              | No            |
| GET    | `/recommendations/related/:pathId`| Related paths (co‑enrollment)               | No            |

### 5.15 Parent Endpoints (Sprint 9)

#### Parent Dashboard

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/parents/me/overview`            | Get parent overview                         | Parent        |
| GET    | `/parents/me/billing`             | Get subscription and purchase history       | Parent        |

#### Child Management

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| POST   | `/parents/me/children`            | Link a child                                | Parent        |
| GET    | `/parents/me/children`            | List children                               | Parent        |
| DELETE | `/parents/me/children/:childId`   | Unlink a child                              | Parent        |
| GET    | `/parents/me/children/:childId/progress` | Get child progress summary            | Parent        |
| GET    | `/parents/me/children/:childId/performance` | Get child quiz scores & challenges | Parent        |
| GET    | `/parents/me/children/:childId/time-tracking` | Get child time tracking             | Parent        |
| GET    | `/parents/me/children/:childId/settings` | Get child settings                   | Parent        |
| PUT    | `/parents/me/children/:childId/settings` | Update child settings               | Parent        |

### 5.16 Enhanced Content Endpoints (Sprint 10)

#### Slides

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| POST   | `/lessons/:lessonId/slides`       | Create slide                                | Admin         |
| PUT    | `/lessons/:lessonId/slides/:slideId` | Update slide                             | Admin         |
| DELETE | `/lessons/:lessonId/slides/:slideId` | Delete slide                             | Admin         |
| POST   | `/lessons/:lessonId/slides/reorder` | Reorder slides                            | Admin         |
| POST   | `/lessons/:lessonId/slides/:slideId/complete` | Complete slide                  | Yes           |

#### Quest Checkpoints

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| POST   | `/lessons/:lessonId/checkpoints`  | Create checkpoint                           | Admin         |
| PUT    | `/lessons/:lessonId/checkpoints/:checkpointId` | Update checkpoint                | Admin         |
| DELETE | `/lessons/:lessonId/checkpoints/:checkpointId` | Delete checkpoint                | Admin         |
| POST   | `/lessons/:lessonId/checkpoints/reorder` | Reorder checkpoints                   | Admin         |
| POST   | `/lessons/:lessonId/checkpoints/:checkpointId/complete` | Complete checkpoint    | Yes           |

#### Boss Battle

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/modules/:moduleId/boss-battle`  | Get boss battle                             | Yes           |
| POST   | `/modules/:moduleId/boss-battle`  | Create boss battle                          | Admin         |
| PUT    | `/modules/:moduleId/boss-battle/:battleId` | Update boss battle                  | Admin         |
| DELETE | `/modules/:moduleId/boss-battle/:battleId` | Delete boss battle                  | Admin         |
| POST   | `/modules/:moduleId/boss-battle/submit` | Submit boss battle answers              | Yes           |

#### Recharge

| Method | Endpoint                          | Description                                 | Auth Required |
|--------|-----------------------------------|---------------------------------------------|---------------|
| GET    | `/lessons/:id/recharge-status`    | Get recharge status for current user        | Yes           |

---

## 6. Key Decisions & Technical Notes

- **Prisma version:** Pinned to `6.19.0`. Do **not** upgrade to v7/8.
- **PostgreSQL port:** Host uses `5433`.
- **Redis usage:** Token storage, rate limiting, account lockout.
- **Email:** SendGrid if key set; logs otherwise.
- **Testing:** Jest + ts-jest; Prisma/Redis mocked.
- **Avatar upload:** Multer local; S3 for production (to be implemented).
- **Swagger UI:** all endpoints documented.
- **Express 5:** `req.query`/`req.params` getter-only; use `Object.defineProperty`.
- **Level formula:** XP per level = `level * (level + 1) * 5`.
- **Leaderboards:** global uses `userStats`; path-specific uses lesson progress.
- **Streak freeze:** decrements token; sets `lastStreakFreezeAt`.
- **Manual Payments:** reference code pattern; expiration not automated yet.
- **Forum voting:** polymorphic `ForumVote`.
- **Best answer:** only post author can mark; sets `isSolved`.
- **Seed script:** now includes enhanced content samples.
- **Notifications:** channelsSent is list; email link must be coerced `?? undefined`.
- **Search:** `tsvector`/`tsquery` with `websearch_to_tsquery`; `pg_trgm`.
- **Recommendations:** popularity and co-enrollment.
- **Parent-Child:** self-referential; `ChildSettings`.
- **Lesson lock / recharge:** based on previous lesson; parent override.
- **PDF Delivery:** S3 signed URLs with 5-min expiry; access control.
- **YouTube Validation:** enforced via `extractYouTubeId`.
- **Slides:** 5 types, stored in `Slide` model; progress in `UserSlideProgress`.
- **Mini-Quests:** checkpoints with XP; progress tracked; next checkpoint logic.
- **Boss Battles:** questions, scoring, victory levels, XP bonus; duplicate submission blocked.
- **Recharge:** XP boost multiplier based on window after previous lesson; base XP only, not bonus.

---

## 7. Testing

### Run tests
```bash
npm test -- --coverage
```

### Current coverage (service layer)
- **Auth:** 98.85% stmts, 100% funcs
- **User:** 100% stmts, 100% funcs
- **Admin:** 97.56% stmts, 100% funcs
- **Category:** 100% stmts, 100% funcs
- **Path:** 92.85% stmts, 77.77% branches
- **Module:** 97.5% stmts
- **Lesson:** 95.45% stmts
- **Enrollment:** 100% stmts
- **Progress:** 100% stmts
- **Gamification:** 100% stmts, 90.24% branches
- **Payment:** 100% stmts, 90.9% branches
- **Forum:** 87.95% stmts
- **Moderation:** 100% stmts
- **Notification:** 98.18% stmts
- **Search:** 100% stmts, 59.52% branches
- **Recommendation:** 97.36% stmts
- **Parent:** 98.66% stmts
- **Slide:** 100% stmts
- **Quest:** 98.41% stmts
- **BossBattle:** 91.3% stmts
- **Recharge:** 90%+ stmts (after test addition)
- **Email:** 0% (stub)
- **Controllers:** 0% (thin wrappers)

**Overall service layer coverage:** ~93% statements, 82% branches, 95% functions.  
**Total tests:** 306+ passing.

### Testing approach
- Mock Prisma/Redis.
- All services have test files in `src/services/__tests__/`.

---

## 8. Next Steps – Beyond Sprint 10

### Recommended Immediate Actions
1. **Integration tests**: supertest for critical flows.
2. **Controller coverage**: optional.
3. **Redis rate limiter** for general routes.
4. **S3 upload for avatars**.
5. **Payment expiration automation**.
6. **Push notifications**: Firebase integration.
7. **Search branch tests**: improve search coverage.
8. **Recommendation refinement**.
9. **YouTube validation** already enforced; may add more robust checks.
10. **PDF signed URLs** fully S3 integrated.
11. **Voice support** in parent dashboard (Phase 2).

### Future Sprints
- **Sprint 11 – UAT & Bug Fixing**

---

## 9. Important Commands

```bash
npm run dev
npm test -- --coverage
npx prisma migrate dev
npx prisma generate
docker-compose up -d
docker-compose down -v
npx ts-node prisma/seed.ts
```

---

## 10. Known Issues / Gotchas

- Git ownership: `git config --global --add safe.directory D:/Career/Qafzly`
- Do not commit `.env`.
- In-memory rate limiter for general routes.
- Email stubbed in dev.
- Prisma migrations tracked.
- Express 5 getter issue.
- Soft deletes.
- Price range in `listPaths`.
- Streak freeze validation.
- Manual payments expiration.
- Forum votes polymorphic.
- Notifications list default, email link null.
- Search vector columns generated; raw SQL parameterization.
- Recommendation relation count may be slow.
- Parent-child linking.
- Lesson lock based on previous lesson.
- Slides/quests/boss battle duplicate submission checks.
- Recharge boost window.

---

## 11. Contact

Read this document and run locally before changes.

**End of Handoff Document**