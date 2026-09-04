# 📄 Qafzly Backend – Developer Onboarding & Progress Report

**Date:** September 4, 2026  
**Prepared by:** Team Falcon  
**Purpose:** To provide the incoming developer with a thorough understanding of the project, its current state, development conventions, and guidance for continuing work.

---

## 1. Project Snapshot

| Aspect | Detail |
|--------|--------|
| **Current Phase** | Sprint 8 Complete; Search & Recommendations Implemented & Tested |
| **Repository** | Private GitHub repo (ask for access) |
| **Core Stack** | Node.js, TypeScript, Express, Prisma, PostgreSQL, Redis |
| **Architecture** | services → controllers → routes |
| **Testing** | Jest, 231 tests passing, service layer coverage 93.77% |
| **API Docs** | Swagger UI at `/api-docs` (fully documented) |

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
npx ts-node prisma/seed.ts  # seed admin, student, categories, courses, modules, lessons, enrollment, progress, badges, quests
npm run dev                 # start server
```

### 2.3 Important Ports

| Service | Host Port | Container Port | Notes |
|---------|-----------|----------------|-------|
| PostgreSQL | **5433** | 5432 | Port 5432 was already in use by local PostgreSQL, so we chose 5433 to avoid conflict |
| Redis | 6379 | 6379 | Standard |
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
│   ├── authorize.ts         # Role-based access (ADMIN only for now)
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
│   └── validators/          # Zod schemas (auth, user, admin, category, course, module, lesson, enrollment, progress, gamification, payment, forum, notification, search, recommendation)
├── services/                # Business logic – no HTTP concerns
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── admin.service.ts
│   ├── category.service.ts
│   ├── course.service.ts
│   ├── module.service.ts
│   ├── lesson.service.ts
│   ├── enrollment.service.ts
│   ├── progress.service.ts
│   ├── gamification.service.ts   # XP, levels, badges, leaderboards, streaks, quests
│   ├── payment.service.ts        # Manual payment request flow
│   ├── forum.service.ts          # Community: posts, comments, voting, best answer
│   ├── moderation.service.ts     # Admin moderation: reports, hide/unhide
│   ├── notification.service.ts   # Notifications: create, bulk, list, read, archive, dismiss, device management
│   ├── search.service.ts         # Search: global, courses, forum, users
│   ├── recommendation.service.ts # Recommendations: popular, trending, personalized, related
│   └── email.service.ts
├── controllers/             # Extract request data, call service, send response
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
│   ├── forum.controller.ts        # Community endpoints
│   ├── moderation.controller.ts   # Moderation endpoints
│   ├── notification.controller.ts # Notification endpoints
│   ├── search.controller.ts       # Search endpoints
│   └── recommendation.controller.ts # Recommendation endpoints
├── routes/                  # Define endpoints, bind middleware and controllers
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
│   ├── forum.routes.ts          # Community routes
│   ├── moderation.routes.ts     # Moderation routes
│   ├── notification.routes.ts   # Notification routes
│   ├── search.routes.ts         # Search routes
│   └── recommendation.routes.ts # Recommendation routes
├── types/
│   └── express.d.ts         # Extends Express Request with `user`
└── prisma/
    ├── schema.prisma        # Single source of truth for DB models (includes PaymentRequest, Forum, Notification, DeviceToken, NotificationTemplate, search vector columns)
    ├── migrations/          # Auto-generated migration files
    └── seed.ts              # Seed script (full test data: admin, student, categories, courses, modules, lessons, enrollment, progress, badges, quests)
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

---

## 5. Implemented Features (Sprint 1–8)

### 5.1 Authentication (Sprint 1)

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| POST `/auth/register` | Create user | Hashes password with bcrypt (12 rounds) |
| POST `/auth/login` | Login | Returns access/refresh tokens |
| POST `/auth/refresh` | Refresh token | Verifies refresh token in Redis |
| POST `/auth/logout` | Logout | Deletes refresh token from Redis |
| POST `/auth/forgot-password` | Request reset | Sends email (stub in dev) |
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

### 5.3 Course Core (Sprint 3)

#### Categories
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/categories` | List categories (pagination, search, parent filter) | No |
| GET `/categories/:id` | Get category with children & published courses | No |
| POST `/categories` | Create category | Admin |
| PUT `/categories/:id` | Update category | Admin |
| DELETE `/categories/:id` | Soft-delete category | Admin |

#### Courses
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/courses` | List published courses (filters: search, category, difficulty, price range, sort) | No |
| GET `/courses/admin/list` | List all courses (incl. unpublished) | Admin |
| GET `/courses/:id` | Get course (admin sees unpublished) | No/Admin |
| POST `/courses` | Create course | Admin |
| PUT `/courses/:id` | Update course | Admin |
| DELETE `/courses/:id` | Soft-delete course | Admin |
| POST `/courses/:id/publish` | Publish/unpublish (`{ "publish": true/false }`) | Admin |

#### Modules
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/modules?courseId=...` | List modules for a course (only published unless admin) | No/Admin |
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

#### Enrollment
| Endpoint | Purpose | Auth |
|----------|---------|------|
| POST `/enrollments/courses/:courseId/enroll` | Enroll current user | Yes |
| DELETE `/enrollments/courses/:courseId/enroll` | Unenroll current user | Yes |
| GET `/enrollments/me/enrollments` | List current user's active enrollments | Yes |
| GET `/enrollments/courses/:courseId/enrollments` | List enrolled users for a course | Admin |

#### Progress
| Endpoint | Purpose | Auth |
|----------|---------|------|
| POST `/progress/lessons/:lessonId` | Update lesson progress (completed, timeSpent, quizScore) | Yes |
| GET `/progress/courses/:courseId` | Get course progress summary for current user | Yes |

### 5.4 Gamification (Sprint 4)

#### Profile
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/gamification/me` | Get current user gamification profile (XP, level, badges, rank) | Yes |
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
| GET `/gamification/leaderboard?scope=course&courseId=...` | Course leaderboard by completed lessons | Yes |

#### Streaks
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/gamification/me/streak` | Get current streak info (current, longest, freeze availability) | Yes |
| POST `/gamification/me/streak/freeze` | Use a streak freeze token | Yes |

#### Daily Quests
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/gamification/daily-quests` | Get active daily quests with user progress | Yes |
| POST `/gamification/daily-quests/:questId/complete` | Complete a daily quest and earn XP | Yes |

### 5.5 Manual Payments (Sprint 5)

#### User Endpoints
| Endpoint | Purpose | Auth |
|----------|---------|------|
| POST `/payments/requests` | Create payment request, get instructions (Vodafone Cash & InstaPay numbers, reference code) | Yes |
| GET `/payments/requests` | List current user's payment requests | Yes |
| POST `/payments/requests/:id/mark-sent` | Mark payment as sent (add user notes) | Yes |

#### Admin Endpoints
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/payments/admin/requests` | List all payment requests (filters, search) | Admin |
| POST `/payments/admin/requests/:id/activate` | Activate request: creates enrollment, purchase, sends confirmation email | Admin |
| POST `/payments/admin/requests/:id/reject` | Reject request with reason, notifies user | Admin |

**Payment Request Statuses:** `PENDING`, `VERIFIED`, `ACTIVATED`, `REJECTED`, `EXPIRED`

### 5.6 Community Features (Sprint 6)

#### Forum Categories
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/forum/categories` | List forum categories (pagination, search) | No |

#### Forum Posts
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/forum/posts` | List posts with filters (category, course, lesson, status, search, sort) | No |
| POST `/forum/posts` | Create new post | Yes |
| GET `/forum/posts/:id` | Get post by ID (increments view count) | No/Yes |
| PUT `/forum/posts/:id` | Update post (owner/admin) | Yes |
| DELETE `/forum/posts/:id` | Soft delete post (owner/admin) | Yes |

#### Comments
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/forum/posts/:postId/comments` | List comments with replies | No |
| POST `/forum/posts/:postId/comments` | Add comment (supports replies) | Yes |
| PUT `/forum/comments/:id` | Update comment (owner/admin) | Yes |
| DELETE `/forum/comments/:id` | Soft delete comment (owner/admin) | Yes |

#### Voting
| Endpoint | Purpose | Auth |
|----------|---------|------|
| POST `/forum/posts/:id/upvote` | Upvote a post (toggle) | Yes |
| POST `/forum/posts/:id/downvote` | Downvote a post (toggle) | Yes |
| POST `/forum/comments/:id/upvote` | Upvote a comment (toggle) | Yes |
| POST `/forum/comments/:id/downvote` | Downvote a comment (toggle) | Yes |

#### Best Answer
| Endpoint | Purpose | Auth |
|----------|---------|------|
| POST `/forum/posts/:id/mark-answer` | Mark a comment as best answer (post owner) | Yes |

#### Search
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/forum/search?q=...` | Search posts by title/content | No |

#### Admin Moderation
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/admin/forum/reports` | List reported posts (flagged) | Admin |
| POST `/admin/forum/reports/:id/resolve` | Resolve a report (reset flag count) | Admin |
| POST `/admin/forum/posts/:id/hide` | Hide a post | Admin |
| POST `/admin/forum/posts/:id/unhide` | Unhide a post | Admin |
| POST `/admin/forum/comments/:id/hide` | Hide a comment | Admin |
| POST `/admin/forum/comments/:id/unhide` | Unhide a comment | Admin |

### 5.7 Notifications (Sprint 7)

#### User Notification Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/notifications` | List user notifications (filters: read/unread, archived, dismissed, type) | Yes |
| GET `/notifications/unread/count` | Get count of unread notifications | Yes |
| POST `/notifications/read-all` | Mark all notifications as read | Yes |
| POST `/notifications/:id/read` | Mark a notification as read | Yes |
| POST `/notifications/:id/archive` | Archive a notification | Yes |
| POST `/notifications/:id/dismiss` | Dismiss a notification | Yes |
| DELETE `/notifications/:id` | Delete a notification | Yes |
| POST `/notifications/device/register` | Register a device for push notifications | Yes |
| DELETE `/notifications/device/:id` | Unregister a device | Yes |

#### Admin Notification Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| POST `/admin/notifications` | Send system notification to all users or specific users | Admin |

### 5.8 Search & Recommendations (Sprint 8)

#### Global Search

| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/search?q=...` | Global search across courses, forum posts, and users | No |
| GET `/search/courses?q=...` | Search courses only | No |
| GET `/search/forum?q=...` | Search forum posts only | No |
| GET `/search/users?q=...` | Search users only | No |

**Search parameters:** `q` (required), `language` (`ar`/`en`), `type` (`course`/`forum`/`user`), `categoryId`, `difficulty`, `minPrice`, `maxPrice`, `page`, `limit`.

#### Recommendations

| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET `/recommendations/courses` | Personalized course recommendations for current user | Yes |
| GET `/recommendations/popular` | Popular courses (by enrollment count) | No |
| GET `/recommendations/trending` | Trending courses (recent enrollment activity) | No |
| GET `/recommendations/related/:courseId` | Courses related to the given course (co‑enrollment) | No |

**Recommendation parameters:** `limit`, `categoryId`, `difficulty`.

---

## 6. Database Schema Highlights

- **User** model extended with `displayName`, `timezone`, `lastLoginAt`, `privacySettings` (JSON).
- **Role enum:** STUDENT, INSTRUCTOR, ADMIN.
- **Soft delete:** `deletedAt` timestamp; queries must check for `deletedAt: null`.
- **Course models:** Course, CourseCategory, Module, Lesson, QuizQuestion, Enrollment, LessonProgress.
- **Gamification models:** UserStats, Badge, UserBadge, XpAuditLog, Quest, UserQuest.
- **Community models:** ForumCategory, ForumPost, ForumComment, ForumVote (polymorphic). Status enums for posts/comments included.
- **Payment models:** Subscription, Purchase, PaymentRequest with enum PaymentRequestStatus.
- **Notification models:** Notification (upgraded with rich fields), DeviceToken (expanded), NotificationTemplate (new).
- **Search models:** `Course` and `ForumPost` have generated `tsvector` columns (`search_vector_ar`, `search_vector_en`) declared as `Unsupported("tsvector")` in Prisma. Trigram indexes added for fuzzy matching.
- **All models use UUID primary keys.**

Full schema in `prisma/schema.prisma`.

---

## 7. Testing Strategy

- **Unit tests** in `src/services/__tests__/`.
- Mock Prisma and Redis with Jest module mocks.
- Run `npm test -- --coverage` to see coverage.
- Controllers are not unit-tested; they are thin wrappers. Integration tests can be added later.
- Seed script has `// @ts-nocheck` to avoid TypeScript config issues; it's acceptable for a standalone script.

**Current test counts:** 231 passing (12 auth, ~10 user, ~9 admin, ~55 Sprint 3 tests, ~27 gamification tests, ~11 payment tests, ~27 forum tests, ~10 moderation tests, ~29 notification tests, ~6 search tests, ~5 recommendation tests).  
Service layer coverage: 93.77% statements, 82.67% branches, 94.89% functions.

---

## 8. Known Issues & Gotchas

1. **Prisma version:** Strictly use 6.19.0. Do not upgrade to 7/8 (breaking changes). The CLI and client versions must match.
2. **PostgreSQL port:** Use 5433 locally. If you change it, update `docker-compose.yml` and `DATABASE_URL` in `.env`.
3. **Rate limiter:** The generic `rateLimiter` is in-memory; for production, replace with Redis or use `authRateLimiter`.
4. **Email:** If `SENDGRID_API_KEY` is not set, emails are logged to console. Set a valid key to send real emails.
5. **Git ownership:** If you see `fatal: detected dubious ownership`, run `git config --global --add safe.directory D:/Career/Qafzly`.
6. **Seed script:** Must be run after migrations if you reset the database. It creates admin, student, categories, courses, modules, lessons, quiz, enrollment, progress, badges, quests.
7. **Swagger UI:** Available at `/api-docs`; use Authorize button to set JWT token.
8. **Express 5 getter issue:** `req.query` and `req.params` are getter-only. In `validate.ts`, we use `Object.defineProperty` to reassign them. Do not change this pattern.
9. **Price range filter in listCourses:** `minPrice` and `maxPrice` are combined into a single `where.price` object. If adding more range filters, follow this pattern.
10. **Soft-deletes:** Public endpoints exclude soft-deleted records; admin endpoints include them. Always check `deletedAt: null` where needed.
11. **Streak freeze:** The endpoint does not validate if the freeze is within the current streak; it simply decrements the token. Business logic may be enhanced later.
12. **Manual payments:** `expiresAt` field is set in application code (default 7 days). No automatic expiration is implemented yet; expired requests may remain `PENDING` until manually addressed. Consider adding a cron job for production.
13. **Forum votes:** The `ForumVote` model is polymorphic; when using Prisma client, ensure you always specify `targetType` and `targetId` together. There is no direct relation to `ForumPost` or `ForumComment`, so querying votes requires manual filtering.
14. **Forum soft delete:** Deleting a post or comment sets `deletedAt` and `status` to `deleted`; public queries exclude them by checking `deletedAt: null` and `status: published`. Admin can still view if needed.
15. **Notifications:** The `channelsSent` field is a list; in Prisma, always set it as an array (`[]`) in defaults. Email link must be coerced from `null` to `undefined` before passing to `sendNotificationEmail`. Push notifications are currently logged, not sent.
16. **Search vectors:** The `tsvector` columns are generated and cannot be updated directly. They are declared as `Unsupported("tsvector")` in Prisma. Raw SQL via `$queryRaw` is used for search; always use parameterized queries (`Prisma.sql`). Short queries (<3 chars) fallback to `ILIKE`.

---

## 9. Next Steps (Future Sprints)

### Sprint 9 – Admin Dashboard Enhancements
- Additional admin metrics and management tools.
- Dashboard endpoints for stats, charts, and user management enhancements.

### Sprint 10 – UAT & Bug Fixing
- Full user acceptance testing and bug fixes.
- Address integration test coverage.

**Suggested approach for each:**
1. Extend Prisma schema if needed.
2. Create validation schemas.
3. Implement services.
4. Add controllers and routes.
5. Write unit tests.
6. Update Swagger definition.
7. Update docs.

---

## 10. Troubleshooting Common Problems

| Problem | Likely Cause | Solution |
|---------|--------------|----------|
| `PrismaClientValidationError: take expected Int, got String` | Query params not coerced | Ensure `z.coerce.number()` in schema and `validate` middleware reassigns parsed values via `Object.defineProperty` |
| `Cannot set property query of #<IncomingMessage>` | Direct assignment to `req.query` in Express 5 | Use `Object.defineProperty(req, 'query', { value: parsed.query, writable: true, configurable: true })` |
| `JWT expiresIn type error` | `jsonwebtoken` expects `StringValue` type | Cast `expiresIn` to `any` or use `ms` package |
| Database connection refused on 5432 | Local PostgreSQL already using port | Use 5433 as configured, or change Docker mapping |
| Docker container not starting | Volume stale or port conflict | Run `docker-compose down -v` then `docker-compose up -d` |
| TypeScript errors about missing fields | Prisma client not regenerated | Run `npx prisma generate` |
| Admin endpoints return 403 | Token doesn't have ADMIN role | Log in as admin and use returned access token |
| `prisma.userStats.update` is not a function in tests | Missing mock | Add `update: jest.fn()` to the `userStats` mock in the test file |
| `prisma.paymentRequest.create` is not a function in tests | Missing mock for new model | Ensure `paymentRequest` mock includes all used methods |
| `prisma.forumVote.findUnique` is not a function | Missing mock for ForumVote | Add `findUnique` to the `forumVote` mock in tests |
| `prisma.notification.create` is not a function | Missing mock for Notification | Add `create` to the `notification` mock in tests |
| Email link passing `null` to SendGrid | Nullable `link` field | Coerce with `?? undefined` before calling `sendNotificationEmail` |
| Search vector columns missing | Migration not applied | Run `npx prisma migrate dev` or manually apply SQL and `migrate resolve --applied` |
| Raw SQL type mismatch in `$queryRaw` | Missing type annotation | Cast `$queryRaw<any[]>` or provide explicit type |

---

## 11. Repository State

- **Branch:** main
- **Last commit:** Sprint 8 complete (search, recommendations, tests, Swagger, seed)
- **Swagger UI:** implemented and documented for all endpoints (including search & recommendations).
- **Test status:** 231 passing, service layer coverage 93.77%.

---

## 12. Contact

For questions, contact the original developer (Team Falcon) or the Project Manager.

---

**End of Developer Onboarding Document**