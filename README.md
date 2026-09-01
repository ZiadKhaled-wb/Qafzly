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

## Course Core Endpoints (Sprint 3)

### Categories

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/categories` | List categories (pagination, search, parent filter) | No |
| GET | `/categories/:id` | Get category by ID with children and published courses | No |
| POST | `/categories` | Create category | Admin |
| PUT | `/categories/:id` | Update category | Admin |
| DELETE | `/categories/:id` | Soft-delete category (sets child parent to null, removes course links) | Admin |

### Courses

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/courses` | List public courses (only published, with filters) | No |
| GET | `/courses/admin/list` | List all courses (including unpublished, soft‑deleted excluded) | Admin |
| GET | `/courses/:id` | Get course by ID (admin sees unpublished) | No/Admin |
| POST | `/courses` | Create course | Admin |
| PUT | `/courses/:id` | Update course | Admin |
| DELETE | `/courses/:id` | Soft-delete course | Admin |
| POST | `/courses/:id/publish` | Publish or unpublish course (`{ "publish": true/false }`) | Admin |

### Modules

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/modules?courseId=...` | List modules for a course (only published unless admin) | No/Admin |
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

### Enrollment

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/enrollments/courses/:courseId/enroll` | Enroll current user in a course | Yes |
| DELETE | `/enrollments/courses/:courseId/enroll` | Unenroll from a course | Yes |
| GET | `/enrollments/me/enrollments` | List current user's active enrollments | Yes |
| GET | `/enrollments/courses/:courseId/enrollments` | List enrolled users for a course | Admin |

### Progress

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/progress/lessons/:lessonId` | Update lesson progress (completed, timeSpent, quizScore) | Yes |
| GET | `/progress/courses/:courseId` | Get course progress summary for current user | Yes |

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
| GET | `/gamification/leaderboard?scope=course&courseId=...` | Course leaderboard by completed lessons | Yes |

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
| POST | `/payments/requests` | Create payment request for a course and get payment instructions (reference code, Vodafone Cash & InstaPay numbers) | Yes |
| GET | `/payments/requests` | List current user's payment requests (pagination, optional status filter) | Yes |
| POST | `/payments/requests/:id/mark-sent` | Mark payment as sent (add optional user notes) | Yes |

### Admin Payment Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/payments/admin/requests` | List all payment requests (pagination, status filter, search) | Admin |
| POST | `/payments/admin/requests/:id/activate` | Activate a payment request: creates purchase, enrollment, and sends confirmation email | Admin |
| POST | `/payments/admin/requests/:id/reject` | Reject a payment request with reason; user notified by email | Admin |

**Payment Request Statuses:** `PENDING`, `VERIFIED`, `ACTIVATED`, `REJECTED`, `EXPIRED`

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
| Student | `student@qafzly.com` | `Student@123456` | Enrolled in seeded course, with progress data |

## Seed Data

Running `npx ts-node prisma/seed.ts` creates:

- **4 categories** (Programming, Web Development, Data Science, AI)
- **1 published course** "أساسيات البرمجة بلغة بايثون" with 2 modules and 3 lessons
- **1 unpublished course** "تطوير مواقع الويب المتقدمة"
- **1 quiz question** attached to a lesson
- **1 enrollment** (student in published course)
- **Lesson progress** records for the student
- **User stats** for the student
- **10 badge definitions** (with Arabic/English names)
- **3 daily quests** active for the current day

*Note: No sample payment requests are seeded; they are created during manual testing.*

## API Documentation (Swagger UI)

Interactive documentation available at `http://localhost:3000/api-docs`.

Use the **Authorize** button to set the JWT token (login first, then paste the `accessToken`).

## Running Tests

```bash
npm test -- --coverage
```

## Environment Variables

See `.env.example` for all required variables.