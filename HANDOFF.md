# Qafzly Backend – Developer Handoff Document

**Date:** September 1, 2026  
**Prepared by:** Team Falcon (Developer)  
**Status:** ✅ Sprint 2 Complete – User Management Implemented & Tested  
**Next Sprint:** Sprint 3 – Course Core (starts after Swagger UI setup)

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
  - Seed script (`prisma/seed.ts`) created and executable.

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

### 🔜 Not Started

- **Swagger UI integration** – planned as final step before Sprint 3.  
- **Sprint 3 – Course Core** (Course CRUD, categories, modules, lessons, enrollment, progress).

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
│   ├── authorize.ts         # Role-based access control (admin)
│   ├── errorHandler.ts      # Central error handler
│   ├── validate.ts          # Zod validation wrapper
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
│       └── admin.schema.ts
├── services/                # Business logic
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── admin.service.ts
│   └── email.service.ts
├── controllers/             # Request handlers
│   ├── auth.controller.ts
│   ├── user.controller.ts
│   └── admin.controller.ts
├── routes/                  # Route definitions
│   ├── index.ts             # Aggregates all routers
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   ├── admin.routes.ts
│   └── (other placeholders)
├── types/
│   └── express.d.ts         # Extends Express Request with user
└── prisma/
    ├── schema.prisma        # Database schema (updated with user profile fields)
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

---

## 6. Key Decisions & Technical Notes

- **Prisma version:** Pinned to `6.19.0` (stable). Do **not** upgrade to v7/8 without thorough testing; breaking changes exist.
- **PostgreSQL port:** Host uses `5433` because local PostgreSQL already occupies `5432`. If changed, update `docker-compose.yml` and `DATABASE_URL` in `.env`.
- **Redis usage:** Token storage, rate limiting, account lockout.
- **JWT secrets:** Access and refresh secrets are separate; stored in `.env`.
- **Rate limiting:** Auth routes use `authRateLimiter` (Redis). Other routes currently use in‑memory `rateLimiter` – replace with Redis version for production.
- **Email:** Uses SendGrid if `SENDGRID_API_KEY` is set; otherwise logs to console in development.
- **Testing:** Jest + ts-jest. Prisma and Redis are mocked in unit tests; located in `src/services/__tests__/`.
- **Avatar upload:** Multer, local storage in dev, S3 in production (to be implemented). Served via `/uploads`.
- **Swagger UI:** Interactive documentation available at `http://localhost:3000/api-docs`.

---

## 7. Testing

### Run tests
```bash
npm test -- --coverage
```

### Current coverage (service layer)
- **Auth service:** 94.25% statements, 100% functions.
- **User service:** 89.55% statements, 100% functions.
- **Admin service:** 92.68% statements, 100% functions.
- **Email service:** 0% (stub), not included in critical path.
- **Controllers:** 0% (thin wrappers; acceptable for now).

### Testing approach
- Mock Prisma and Redis using Jest module mocks.
- Use `dotenv.config({ path: '.env.test' })` in `jest.setup.ts` for test environment.

---

## 8. Next Steps – Before Sprint 3

1. **Add Swagger UI**  
   - Install `swagger-ui-express` and `swagger-jsdoc`.  
   - Create `src/config/swagger.ts` with API definition.  
   - Mount at `/api-docs`.  
   - Document all existing endpoints (auth, user, admin).

2. **Commit and push** all Sprint 2 code.

3. **Start Sprint 3 – Course Core**  
   - Course CRUD (admin + public listing with filters).  
   - Course categories.  
   - Modules and lessons CRUD.  
   - Enrollment and progress tracking.  
   - Quiz setup.

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
- Seed script has `// @ts-nocheck` at top to avoid TypeScript config issues; acceptable for a standalone script.

---

## 11. Contact for Questions

If you are the next developer taking over, please read this document and run the project locally before making changes. For architectural questions, refer to the code comments and the `README.md`.

---

**End of Handoff Document**