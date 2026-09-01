# Contributing to Qafzly Backend

Welcome! We appreciate your interest in contributing to the Qafzly backend. This document outlines the guidelines, coding standards, and workflow to follow when adding features, fixing bugs, or improving the codebase.

---

## 1. Code of Conduct

- Be respectful and inclusive.
- Write clear, maintainable code.
- Provide constructive feedback.
- Document decisions and rationale.

---

## 2. Branching Strategy

- `main` is the stable branch; never push directly to it.
- Create a feature branch for each task:
  ```
  feature/sprint3-course-crud
  fix/auth-token-validation
  docs/update-readme
  ```
- Use pull requests (PRs) for all changes.
- Require at least one approval before merging.

---

## 3. Commit Message Guidelines

Use the following format:

```
<type>: <short description>

[optional body]
[optional footer]
```

Types:
- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation only
- `refactor`: code change that neither fixes a bug nor adds a feature
- `test`: adding or updating tests
- `chore`: build process, tooling, etc.

**Example:**
```
feat: add course enrollment endpoint
```

---

## 4. Coding Standards

### 4.1 TypeScript

- Use strict mode (already configured in `tsconfig.json`).
- Avoid `any`; use proper types.
- Use `const` and `let`; avoid `var`.
- Prefer `async/await` over callbacks/promises.

### 4.2 Naming Conventions

- Files: `kebab-case.ts` (e.g., `user.service.ts`)
- Classes: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Routes: plural nouns, kebab-case (e.g., `/course-categories`)

### 4.3 Project Structure

Follow the existing **services → controllers → routes** pattern:

- `routes/` define endpoints and middleware binding.
- `controllers/` parse request data, call services, and format responses.
- `services/` contain business logic and database access via Prisma.

Do not mix responsibilities.

---

## 5. Validation

- Use Zod schemas located in `src/utils/validators/`.
- Bind schemas in routes with `validate(schema)` middleware.
- The middleware replaces `req.body`, `req.query`, `req.params` with parsed values.

---

## 6. Error Handling

- Throw `new AppError(statusCode, message)` for expected errors.
- Let the central error handler format the response.
- Do not catch errors in controllers unless necessary.

---

## 7. Testing

- Write unit tests for all services.
- Place tests in `src/services/__tests__/`.
- Mock Prisma and Redis with Jest module mocks.
- Run `npm test -- --coverage` and ensure coverage does not drop below 80% for new code.
- Add integration tests for critical flows when feasible.

---

## 8. Documentation

- Update `README.md` when adding new endpoints or changing setup.
- Update `HANDOFF.md` and `DEVELOPER_ONBOARDING.md` for major changes.
- Update Swagger specification in `src/config/swagger.ts` for every new endpoint.

---

## 9. Environment & Setup

- Use `.env.example` as the template; never commit `.env`.
- Keep Docker Compose ports consistent (PostgreSQL host port 5433).
- Run `npx prisma migrate dev` after schema changes.

---

## 10. Completed Sprints by Team Falcon

The following work has been completed by **Team Falcon** and serves as the foundation for all future development. Follow the patterns and quality standards established here.

### Sprint 1 – Authentication

- Implemented user registration, login, refresh, logout, forgot/reset password endpoints.
- Added JWT authentication with access token (15 min) and refresh token (7 days) stored in Redis.
- Integrated bcrypt password hashing (12 rounds).
- Implemented Redis-backed rate limiting (10 requests/min) for sensitive auth routes.
- Added account lockout after 5 failed login attempts for 15 minutes.
- Wrote unit tests for the auth service (12 tests, 94.25% statement coverage).

### Sprint 2 – User Management

- Added self-profile endpoints: GET, PUT, PATCH, DELETE `/users/me`.
- Implemented privacy settings endpoints (GET/PUT `/users/me/privacy`).
- Integrated avatar upload/removal using Multer with local storage.
- Created admin user management endpoints:
  - List users with pagination, search, and filters
  - Get user details
  - Update user
  - Suspend/activate user
  - Change user role
- Extended database schema with `displayName`, `timezone`, `lastLoginAt`, `privacySettings`.
- Added authorization middleware for role-based access control.
- Wrote unit tests for user and admin services (additional 19 tests).
- Integrated Swagger UI for interactive API documentation.

### Sprint 3 – Course Core

- Implemented full CRUD for **categories** (admin) with public listing and hierarchical parent/child support.
- Implemented **courses** CRUD with advanced filtering (search, category, difficulty, price range, sorting, pagination), soft-delete, and publish/unpublish.
- Added **modules** CRUD nested under courses, and **lessons** CRUD nested under modules, with ordering and publish flags.
- Added **enrollment** endpoints: enroll/unenroll current user, list user enrollments, and admin list of course enrollments.
- Added **progress tracking**: update lesson progress and retrieve course progress summary.
- Extended seed script with realistic test data.
- Added unit tests for all new services (total 86 passing at sprint end).

### Sprint 4 – Gamification

- Implemented **gamification profile** endpoints (current user and any user).
- Added **XP & levels**: XP history (paginated) and level definitions (50 levels).
- Added **badges**: list all badges, current user earned badges, and any user badges.
- Implemented **leaderboards**: global (by XP) and course-specific (by completed lessons).
- Added **streaks**: current streak info and streak freeze endpoint.
- Implemented **daily quests**: list active quests with progress and complete quest (awards XP).
- New models `Quest` and `UserQuest` added to schema.
- Added unit tests for gamification service (total 113 passing, service layer coverage 92.81%).
- Gamification service coverage: 100% statements, 90.24% branches.

### Sprint 5 – Manual Payments (MVP)

- Implemented **payment request** creation endpoint: user submits course ID and receives payment instructions (Vodafone Cash & InstaPay numbers, unique reference code).
- Added user endpoints to **list their payment requests** and **mark a payment as sent**.
- Implemented **admin endpoints** to list all payment requests with filters, **activate** a request (creates enrollment, purchase, and sends confirmation email), and **reject** with reason.
- Added email templates for payment instructions, activation confirmation, and rejection notification (Arabic).
- New model `PaymentRequest` and enum `PaymentRequestStatus` added to Prisma schema.
- Added validation schemas, service, controller, and routes for manual payments.
- Unit tests for payment service: 100% statements, 90.9% branches.
- Overall test count increased to **144 passing**, service layer coverage **94.05%**.

### Sprint 6 – Community Features

- Implemented **forum categories** listing with pagination/search.
- Implemented **forum posts** full CRUD with filters, soft delete, view count, and authorization.
- Implemented **comments** CRUD with reply support and soft delete.
- Implemented **voting** system for posts and comments with toggle logic (polymorphic `ForumVote`).
- Implemented **best answer** marking (post owner only).
- Implemented **search** for posts by title/content.
- Implemented **admin moderation** endpoints: list reports (flagged posts), resolve, hide/unhide posts and comments.
- Added new models: `ForumCategory`, `ForumPost`, `ForumComment`, `ForumVote`, and enums `ForumPostStatus`, `ForumCommentStatus`.
- Added services: `forum.service.ts`, `moderation.service.ts`; controllers and routes for both.
- Added validation schemas for all community endpoints.
- Unit tests: forum service coverage 87.95% statements, moderation service coverage 100% statements.
- Overall test count increased to **190 passing**, service layer coverage **93.2%**.

---

Thank you for contributing to Qafzly!