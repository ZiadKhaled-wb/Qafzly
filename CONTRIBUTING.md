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
  feature/sprint11-integration-tests
  fix/auth-token-refresh
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
feat: add path enrollment endpoint
```

**Recent examples:**
```
fix: mount enrollment routes at /enrollments
fix: rebuild refresh token payload before signing new access token
fix: use plainto_tsquery with ::regconfig cast in search service
test: add integration test suite with Docker isolation
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
- Routes: plural nouns, kebab-case (e.g., `/path-categories`)

### 4.3 Project Structure

Follow the existing **services → controllers → routes** pattern:

- `routes/` define endpoints and middleware binding.
- `controllers/` parse request data, call services, and format responses.
- `services/` contain business logic and database access via Prisma.

Do not mix responsibilities.

**Common pitfalls:**
- Always import the router in `src/routes/index.ts` and mount it with a leading slash (e.g., `router.use('/enrollments', enrollmentRoutes);`). A missing mount silently produces 404s on all endpoints of that feature.
- Keep the base mount consistent with the plural form the frontend expects (e.g., `/payments`, not `/payment`).

---

## 5. Validation

- Use Zod schemas located in `src/utils/validators/`.
- Bind schemas in routes with `validate(schema)` middleware.
- The middleware replaces `req.body`, `req.query`, `req.params` with parsed values.
- **Express 5 note:** `req.query` and `req.params` are getter-only. The middleware uses `Object.defineProperty` internally — do not change this pattern.

---

## 6. Error Handling

- Throw `new AppError(statusCode, message)` for expected errors.
- Let the central error handler format the response.
- Do not catch errors in controllers unless necessary.

---

## 7. Testing

Testing is a first-class citizen on this project. We maintain two test suites:

### 7.1 Unit Tests

- **Location:** `src/services/__tests__/`.
- **Approach:** Mock Prisma and Redis with Jest module mocks.
- **Command:** `npm test -- --coverage`.
- **Requirement:** Coverage must not drop below **80%** for new service code.
- **Patterns to follow:**
  - Use `jest.mock('../../config/database', () => ({ prisma: { ... } }))`.
  - When a service uses `prisma.$transaction`, add a mock that invokes the callback with the mocked client:
    ```ts
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(prisma));
    ```
  - Reset all mocks in `beforeEach` with `jest.clearAllMocks()`.

### 7.2 Integration Tests (NEW)

- **Location:** `src/__tests__/integration/`.
- **Approach:** Use `supertest` against the real Express app; run against real Postgres and Redis in isolated Docker containers.
- **Command:** `npm run test:integration`.
- **Requirements:**
  - `.env.test` file (git-ignored) in project root — see README for the full template.
  - Docker Desktop running.
- **What happens when you run the command:**
  1. Test containers are started (`docker-compose.test.yml`).
  2. Migrations are applied to the test DB (port `5434`).
  3. Seed runs against the test DB.
  4. Suite executes with `jest.integration.config.js`.
  5. Containers are torn down.
- **Conventions when adding integration tests:**
  - **Never** place helper files (e.g., `setup.ts`, `env.setup.ts`) in the integration folder without registering them in `jest.integration.config.js` as `setupFiles` or `setupFilesAfterEnv`. Otherwise, Jest will treat them as test suites and fail with `Your test suite must contain at least one test`.
  - Use **unique emails per test** to avoid collisions: `` `test_${Date.now()}@example.com` ``.
  - Use the seeded admin credentials for admin-only endpoints: `admin@qafzly.com / Admin@123456`.
  - Fetch seeded IDs from the DB via Prisma rather than hard-coding them.
  - Follow the file-level structure: `describe` → `beforeAll` (setup) → `it` (assertions).
  - **Do not** rely on test execution order; each file should set up its own state.

### 7.3 Which tests should I add?

| Change | Required tests |
|--------|----------------|
| New service method | Unit test(s) in `src/services/__tests__/` |
| New endpoint on a critical flow (auth, enrollment, payments, gamification) | Integration test in `src/__tests__/integration/` |
| Bug fix | Add regression test that would have caught the bug |
| New feature | Unit + integration where the flow is user-visible |

### 7.4 Current test status

- Unit: **306+ passing**, service layer coverage ~93%.
- Integration: **22/22 passing**.

---

## 8. Documentation

Update the following when making changes:

- **`README.md`** — when adding new endpoints or changing setup.
- **`HANDOFF.md`** — for major changes, new sprints, or architectural decisions.
- **`DEVELOPER_ONBOARDING.md`** — when onboarding-relevant conventions or gotchas change.
- **`src/config/swagger.ts`** — for every new endpoint. Ensure the request/response schema matches the actual Zod validator and controller output.
- **`prisma/schema.prisma`** — when adding/removing models or fields.

### Search vector columns

The `tsvector` columns on `paths` and `forum_posts` are declared as `Unsupported("tsvector")` in Prisma. Any changes to these columns must go through a raw SQL migration, not through the schema. When writing `$queryRaw`, always:
- Use `plainto_tsquery(${config}::regconfig, ${q})`.
- Select explicit columns — **never use `SELECT *`** in raw queries that touch these tables, or Prisma will fail to deserialize the `tsvector` columns.

---

## 9. Environment & Setup

- Use `.env.example` as the template; never commit `.env`.
- Keep Docker Compose ports consistent:
  - Dev: PostgreSQL `5433`, Redis `6379`.
  - Test: PostgreSQL `5434`, Redis `6380`.
- Run `npx prisma migrate dev` after schema changes.
- Run `npx prisma migrate deploy` in CI and test environments.

### Windows tips

- If you see `fatal: detected dubious ownership in repository`, run:
  ```
  git config --global --add safe.directory D:/Career/Qafzly
  ```
- Do **not** call `dotenv` directly in PowerShell — a Python `dotenv` may shadow the JS one. Use `npm run test:integration:migrate` or `npx dotenv-cli -e .env.test -- ...`.

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
- Created admin user management endpoints (list, detail, update, suspend/activate, change role).
- Extended database schema with `displayName`, `timezone`, `lastLoginAt`, `privacySettings`.
- Added authorization middleware for role-based access control.
- Wrote unit tests for user and admin services (additional 19 tests).
- Integrated Swagger UI for interactive API documentation.

### Sprint 3 – Path Core

- Implemented full CRUD for **categories** (admin) with public listing and hierarchical parent/child support.
- Implemented **paths** CRUD with advanced filtering (search, category, difficulty, price range, sorting, pagination), soft-delete, and publish/unpublish.
- Added **modules** CRUD nested under paths, and **lessons** CRUD nested under modules, with ordering and publish flags.
- Added **enrollment** endpoints: enroll/unenroll current user, list user enrollments, and admin list of path enrollments.
- Added **progress tracking**: update lesson progress and retrieve path progress summary.
- Extended seed script with realistic test data.
- Added unit tests for all new services (total 86 passing at sprint end).

### Sprint 4 – Gamification

- Implemented **gamification profile** endpoints (current user and any user).
- Added **XP & levels**: XP history (paginated) and level definitions (50 levels).
- Added **badges**: list all badges, current user earned badges, and any user badges.
- Implemented **leaderboards**: global (by XP) and path-specific (by completed lessons).
- Added **streaks**: current streak info and streak freeze endpoint.
- Implemented **daily quests**: list active quests with progress and complete quest (awards XP).
- New models `Quest` and `UserQuest` added to schema.
- Added unit tests for gamification service (total 113 passing, service layer coverage 92.81%).
- Gamification service coverage: 100% statements, 90.24% branches.

### Sprint 5 – Manual Payments (MVP)

- Implemented **payment request** creation endpoint: user submits path ID and receives payment instructions (Vodafone Cash & InstaPay numbers, unique reference code).
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

### Sprint 7 – Notifications

- Implemented **user notification endpoints**: list with filters (read, archived, dismissed, type), unread count, mark as read, mark all as read, archive, dismiss, delete, device register/unregister.
- Implemented **admin system notification** endpoint: send to all users or specific users.
- Added **email notifications** via SendGrid using a unified notification email template (Arabic).
- Implemented **push notification placeholder** (logged) for future Firebase integration.
- Upgraded `Notification` model with additional fields: `senderId`, `link`, `iconUrl`, `imageUrl`, `metadata`, `isArchived`, `isDismissed`, `channelsSent`, `readAt`, `dismissedAt`.
- Expanded `DeviceToken` model with `deviceToken`, `deviceType`, `deviceId`, `deviceModel`, `osVersion`, `appVersion`, `isActive`, `lastUsedAt`.
- Added `NotificationTemplate` model.
- Unit tests: notification service coverage >99% statements, >93% branches.
- Overall test count increased to **219 passing**, service layer coverage **93.38%**.

### Sprint 8 – Search & Recommendations

- Implemented **global search** across paths, forum posts, and users with relevance ranking.
- Added dedicated search endpoints for paths, forum, and users with filters.
- Implemented **recommendations**: personalized, popular, trending, and related paths (co-enrollment).
- Database enhancements: added generated `tsvector` columns (`search_vector_ar`, `search_vector_en`) and GIN indexes on `paths` and `forum_posts`; added trigram indexes for fuzzy search on titles and user names.
- Added services: `search.service.ts`, `recommendation.service.ts`; controllers, routes, and validators for both.
- Unit tests: search service 100% statements, 59.52% branches; recommendation service 97.36% statements, 88.88% branches.
- Overall test count increased to **231 passing**, service layer coverage **93.77%**.

### Sprint 9 – Parent-Child, Lesson Expansion, Lock, PDF Delivery

- **User Roles**: Removed `INSTRUCTOR`; roles now `STUDENT`, `PARENT`, `ADMIN`.
- **Parent-Child Relationships**: Added self-referential `User` relation (`parentId`, `children`) and new `ChildSettings` model (`lockOverrideEnabled`, `customLockDurationHours`).
- **Parent Endpoints**: overview, billing, link/unlink child, progress, performance, time-tracking, settings.
- **Lesson Structure Expansion**: Added `overviewVideoUrl`, `pdfUrl`, `explanatoryVideoUrl`, `slidesJson`, `challengeDescription`, `challengeType`, `challengeData`, `lockDurationHours`.
- **12-Hour Lock**: Lock logic based on previous lesson completion and lock duration; parent override available. Added `GET /lessons/:id/lock-status`.
- **PDF Delivery**: `GET /lessons/:id/pdf-url` for signed PDF URL (5-min expiry).
- **YouTube Validation**: `extractYouTubeId` enforced in lesson schema.
- Unit tests: parent service 98.3% statements, 95.83% branches; lesson service 95.38% statements, 82.92% branches.
- Overall test count increased to **252 passing**, service layer coverage **93.78%**.

### Sprint 10 – Enhanced Content Structure (Slides, Mini-Quests, Boss Battle, Recharge)

- **New Models**: `Slide` (with `SlideType` enum), `QuestCheckpoint`, `BossBattle`, `BossBattleQuestion`, `UserSlideProgress`, `UserQuestProgress`, `UserBossBattleProgress`.
- **New Fields on `Lesson`**: `warmUpJson`, `miniQuestJson`, `rechargeMessageAr/En`, `rechargeXpBoost`, `rechargeBoostMultiplier`, `rechargeBoostWindowHours`.
- **New Services**: `slide.service.ts`, `quest.service.ts`, `bossBattle.service.ts`, `recharge.service.ts`.
- **Endpoints**:
  - Slides CRUD + complete: `POST/GET/PUT/DELETE /lessons/:lessonId/slides...`
  - Quest checkpoints CRUD + complete: `POST/GET/PUT/DELETE /lessons/:lessonId/checkpoints...`
  - Boss battle CRUD + submit: `GET/POST/PUT/DELETE /modules/:moduleId/boss-battle...`
  - Recharge status: `GET /lessons/:id/recharge-status`
- **XP Recharge**: base XP multiplied by `rechargeBoostMultiplier` if within boost window after previous lesson completion. Victory bonus not multiplied.
- Overall test count increased to **306+ passing**, service layer coverage remains >90%.

### Sprint 11 – UAT & Bug Fixing (In Progress)

#### ✅ Completed

- **Integration Test Suite**
  - Isolated Docker infrastructure (`docker-compose.test.yml`) — Postgres `5434`, Redis `6380`.
  - Dedicated `.env.test`, `jest.integration.config.js`, and `src/__tests__/integration/` folder.
  - Covers: auth, user, enrollment, progress, gamification, payments, forum, search, health.
  - **22/22 tests passing.**

- **Critical Production Fixes**
  - **Route mounting:** added `/enrollments` mount; fixed `/moderation` (missing leading slash); fixed `/payment` → `/payments`.
  - **Auth refresh token:** rebuild payload (`{ userId, email, role }`) before signing new access token — fixes `Bad "options.expiresIn" option...`.
  - **Search service:** replaced `websearch_to_tsquery` with `plainto_tsquery(...)::regconfig`; select explicit columns (excludes `tsvector`).
  - **New migration:** `20260911150633_add_search_vector_columns` — adds `tsvector` columns and GIN/trigram indexes.
  - **Registration flow:** auto-creates `UserStats` and assigns active daily quests in a transaction.

- **Unit Test Fixes**
  - Updated `auth.service.test.ts` to mock `$transaction`, `userStats.create`, `quest.findMany`, `userQuest.createMany`.
  - Adjusted `refreshToken` test to expect a clean payload.

- **Seed Script Fixes**
  - Daily quests are deleted and recreated on each seed run so they reflect today’s active window.

#### ⏳ Remaining

- Redis rate limiter for general routes.
- S3 upload for avatars.
- Payment request expiration automation (cron).
- Firebase push notifications.
- Search service branch coverage (target ≥80%).
- Recommendation refinement.
- Deployment configuration (CI/CD, env-specific configs).

---

## 11. Known Issues & Gotchas (Quick Reference)

| Issue | Where to look |
|-------|---------------|
| Missing route → 404 | Check `src/routes/index.ts` for the mount, and the route file for the leading slash |
| `Bad "options.expiresIn"` | `auth.service.ts > refreshToken` — must rebuild payload |
| `column "search_vector_*" does not exist` | Apply migration `20260911150633_add_search_vector_columns` |
| `Failed to deserialize column of type 'tsvector'` | Never use `SELECT *` in search queries; list columns |
| `Your test suite must contain at least one test` | Exclude `src/__tests__/integration/` from default `jest.config.js` |
| `$transaction is not a function` in unit tests | Add `$transaction` mock that invokes the callback with `prisma` |
| Integration tests timeout after 5s | Running under default Jest config — use `npm run test:integration` |
| `dotenv -e .env.test` fails on PowerShell | A Python `dotenv` is on PATH — use `npm run test:integration:migrate` |
| Daily quests inactive after seed | Seed now deletes and recreates them each run |
| Express 5 `req.query` is read-only | Use `Object.defineProperty` (already handled in `validate.ts`) |

---

## 12. Review Checklist for PRs

Before opening a PR, confirm:

- [ ] Branch name follows conventions (`feature/*`, `fix/*`, `docs/*`, `test/*`).
- [ ] Commit messages follow the `<type>: <description>` format.
- [ ] Unit tests added/updated for new service code.
- [ ] Integration test added for any new critical endpoint.
- [ ] `npm test -- --coverage` passes and coverage did not drop below 80% for new code.
- [ ] `npm run test:integration` passes locally.
- [ ] Swagger spec (`src/config/swagger.ts`) updated for new endpoints.
- [ ] `README.md` / `HANDOFF.md` updated for major changes.
- [ ] No secrets or `.env*` files committed.
- [ ] Migrations included if Prisma schema changed (`prisma/migrations/`).
- [ ] No debug `console.log` left in code (temporary ones must be removed).

---

Thank you for contributing to Qafzly!