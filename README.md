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
5. (Optional) Seed database: `npx ts-node prisma/seed.ts`
6. Start development server: `npm run dev`

## API Base URL
`http://localhost:3000/v1`

## Health Check
`GET /health`

## Authentication Endpoints

Base URL: `http://localhost:3000/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout (invalidates refresh token) |
| POST | `/auth/forgot-password` | Request password reset email |
| POST | `/auth/reset-password` | Reset password using token |

All endpoints return JSON in the standard format:
\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Success message (Arabic)",
  "errors": null,
  "meta": null
}
\`\`\`

### Test Users
- `admin@qafzly.com` / `Admin@123456` (seeded)
- Register new users via API

## Documentation
Full API specification: see project documentation.