# Qafzly Backend – Developer Handoff Document

**Date:** August 31, 2026  
**Prepared by:** Team Falcon (Initial Developer)  
**Status:** ✅ Sprint 1 Complete – Authentication Endpoints Implemented & Tested  
**Next Sprint:** Sprint 2 – User Management (starts September 1, 2026)

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

- **Sprint 1 – Authentication**  
  - Endpoints: register, login, refresh, logout, forgot password, reset password.
  - Redis‑backed rate limiting and account lockout.
  - JWT access/refresh tokens with refresh tokens stored in Redis.
  - Bcrypt password hashing (12 rounds).
  - Arabic error messages.
  - Unit tests: 12/12 passing, 94.25% statement coverage.

### 🔜 Not Started
- Sprint 2 – User Management (detailed below).

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

# 6. (Optional) Seed the database with admin user and categories
npx ts-node prisma/seed.ts

# 7. Start the development server
npm run dev
```


The API will be available at `http://localhost:3000/v1`.  
Health check: `GET http://localhost:3000/health`.

---

## 4. Architecture Overview

```
src/
├── index.ts                 # Entry point: connects DB/Redis, starts server
├── app.ts                   # Express app setup (middleware, routes)
├── config/                  # Environment, database, redis, logger
│   ├── env.ts
│   ├── database.ts
│   ├── redis.ts
│   └── logger.ts
├── middleware/              # Custom middleware
│   ├── authenticate.ts      # JWT verification
│   ├── errorHandler.ts      # Central error handler
│   ├── validate.ts          # Zod validation wrapper
│   ├── rateLimiter.ts       # Basic in-memory rate limiter (dev)
│   └── authRateLimiter.ts   # Redis‑backed rate limiter for auth routes
├── utils/
│   ├── asyncHandler.ts      # Async error wrapper
│   ├── AppError.ts          # Custom error class
│   ├── apiResponse.ts       # Standard response formatter
│   ├── token.ts             # JWT generation/verification
│   └── validators/          # Zod schemas (auth.schema.ts)
├── services/                # Business logic
│   ├── auth.service.ts
│   └── email.service.ts
├── controllers/             # Request handlers
│   └── auth.controller.ts
├── routes/                  # Route definitions
│   ├── index.ts             # Aggregates all routers
│   ├── auth.routes.ts
│   └── (other placeholders)
├── types/
│   └── express.d.ts         # Extends Express Request with user
└── prisma/
    ├── schema.prisma        # Database schema
    ├── migrations/          # Applied migrations
    └── seed.ts              # Seed script
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

## 5. Implemented Endpoints (Sprint 1)

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

---

## 6. Key Decisions & Technical Notes

- **Prisma version:** Pinned to `6.19.0` (stable). Do **not** upgrade to v7/8 without thorough testing; breaking changes exist.
- **PostgreSQL port:** Host uses `5433` because local PostgreSQL already occupies `5432`. If changed, update `docker-compose.yml` and `DATABASE_URL` in `.env`.
- **Redis usage:** Token storage, rate limiting, account lockout.
- **JWT secrets:** Access and refresh secrets are separate; stored in `.env`.
- **Rate limiting:** Auth routes use `authRateLimiter` (Redis). Other routes currently use in‑memory `rateLimiter` – replace with Redis version for production.
- **Email:** Uses SendGrid if `SENDGRID_API_KEY` is set; otherwise logs to console in development.
- **Testing:** Jest + ts-jest. Prisma and Redis are mocked in unit tests; located in `src/services/__tests__/`.

---

## 7. Testing

### Run tests
```bash
npm test -- --coverage
```

### Current coverage
- **Auth service:** 94.25% statements, 100% functions.
- **Email service:** 0% (stub), not included in critical path.

### Testing approach
- Mock Prisma and Redis using Jest module mocks.
- Use `dotenv.config({ path: '.env.test' })` in `jest.setup.ts` for test environment.

---

## 8. Next Steps – Sprint 2: User Management

### 8.1 Priority Order (from Project Manager)

| Priority | Endpoint                      | Acceptance Criteria |
|----------|-------------------------------|---------------------|
| Critical | `GET /users/me`               | Returns user profile, gamification stats, progress summary |
| Critical | `PUT /users/me`               | Full update with validation |
| Critical | `PATCH /users/me`             | Partial update |
| Critical | `DELETE /users/me`            | Soft delete (GDPR) |
| Important| `POST /users/me/avatar`       | Upload profile picture |
| Important| `DELETE /users/me/avatar`     | Remove profile picture |
| Important| `PUT /users/me/privacy`       | Update privacy settings |
| Nice-to-Have | `GET /users/me/data/export` | Export user data (GDPR) |
| Admin    | `GET /admin/users`            | List users with filters, pagination |
| Admin    | `GET /admin/users/:id`        | Get full user details |
| Admin    | `PUT /admin/users/:id`        | Update any user |
| Admin    | `POST /admin/users/:id/suspend` | Suspend user |
| Admin    | `POST /admin/users/:id/activate` | Activate user |
| Admin    | `POST /admin/users/:id/role`  | Change user role |

### 8.2 Suggested Response Structure for `GET /users/me`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "أحمد محمد",
      "displayName": "أحمد",
      "bio": "مطور ويب متعلم",
      "profilePictureUrl": "https://...",
      "countryCode": "EG",
      "languagePreference": "ar",
      "role": "student",
      "status": "active",
      "emailVerified": true,
      "createdAt": "2026-08-31T10:00:00Z",
      "lastLoginAt": "2026-08-31T15:30:00Z"
    },
    "gamification": {
      "level": 1,
      "xp": 0,
      "xpToNextLevel": 50,
      "streak": 0,
      "badges": []
    },
    "progress": {
      "totalCoursesEnrolled": 0,
      "totalCoursesCompleted": 0,
      "totalLessonsCompleted": 0,
      "currentCourse": null
    }
  }
}
```

### 8.3 Validation Rules for Profile Update

| Field | Validation |
|-------|------------|
| `fullName` | Required, min 2, max 100 |
| `displayName` | Optional, max 100 |
| `bio` | Optional, max 500 |
| `countryCode` | Optional, 2 chars (ISO 3166-1) |
| `languagePreference` | Optional, 'ar' or 'en' |
| `timezone` | Optional, valid timezone string |

### 8.4 Privacy Settings Structure

```json
{
  "profileVisibility": "public",        // public | private | followers
  "showProgress": true,
  "showBadges": true,
  "allowMessages": "everyone",          // everyone | followers | none
  "emailNotifications": true,
  "pushNotifications": true
}
```

### 8.5 Admin User Management

- All admin endpoints require `ADMIN` role (use `authorize` middleware).
- List users: support `page`, `limit`, `search`, `role`, `status` query params.
- Pagination meta must be included in response.

### 8.6 GDPR Compliance

- `DELETE /users/me` = soft delete (set `deletedAt`). User cannot log in but data retained.
- `GET /users/me/data/export` = return JSON with all user data (can be asynchronous).
- After 30 days, anonymize PII (later sprint).

---

## 9. Important Commands

```bash
npm run dev                 # start development server
npm test -- --coverage      # run tests with coverage
npx prisma migrate dev      # apply database migrations
npx prisma generate         # regenerate Prisma Client
docker-compose up -d        # start local infrastructure
docker-compose down -v      # stop and remove volumes (resets data)
npx ts-node prisma/seed.ts  # seed database (admin user, categories)
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

---

## 11. Contact for Questions

If you are the next developer taking over, please read this document and run the project locally before making changes. For architectural questions, refer to the code comments and the `README.md`.

---

**End of Handoff Document**