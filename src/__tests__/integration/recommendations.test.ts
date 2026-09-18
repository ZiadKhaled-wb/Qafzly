import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Recommendations', () => {
    let accessToken: string;          // test-student token (has an active enrollment)
    let enrolledPathId: string;       // path test-student is enrolled in
    let otherPublishedPathId: string; // a different published path (for /related)

    beforeAll(async () => {
        // Login as the seeded user with a known enrollment
        const loginRes = await request(app)
            .post('/v1/auth/login')
            .send({
                email: 'test-student@qafzly.com',
                password: 'Student@123456',
            })
            .expect(200);
        accessToken = loginRes.body.data.accessToken;

        // Fetch seeded IDs from the DB (never hard-code)
        const enrollment = await prisma.enrollment.findFirst({
            where: {
                user: { email: 'test-student@qafzly.com' },
                isActive: true,
            },
            select: { pathId: true },
        });
        if (!enrollment) throw new Error('Seed did not enroll test-student');
        enrolledPathId = enrollment.pathId;

        const otherPath = await prisma.path.findFirst({
            where: {
                isPublished: true,
                deletedAt: null,
                id: { not: enrolledPathId },
            },
            select: { id: true },
        });
        // The seed ships two published paths; if that ever changes, fall back
        // to the enrolled path so /related can still hit the endpoint.
        otherPublishedPathId = otherPath?.id ?? enrolledPathId;
    });

    // =====================================================================
    // GET /v1/recommendations/popular
    // =====================================================================
    describe('GET /v1/recommendations/popular', () => {
        it('returns 200 with a Path[] payload', async () => {
            const res = await request(app)
                .get('/v1/recommendations/popular')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('each item carries the Option A shape (nested category, no tsvector leak)', async () => {
            const res = await request(app)
                .get('/v1/recommendations/popular')
                .query({ limit: 5 })
                .expect(200);

            for (const p of res.body.data) {
                expect(p).toHaveProperty('id');
                expect(p).toHaveProperty('title');
                expect(p).toHaveProperty('category');
                expect(p).not.toHaveProperty('search_vector_ar');
                expect(p).not.toHaveProperty('search_vector_en');
            }
        });

        it('respects the limit query param', async () => {
            const res = await request(app)
                .get('/v1/recommendations/popular')
                .query({ limit: 1 })
                .expect(200);

            expect(res.body.data.length).toBeLessThanOrEqual(1);
        });
    });

    // =====================================================================
    // GET /v1/recommendations/trending
    //
    // P0 regression guard: the pre-fix service ran `SELECT p.*` against
    // `paths`, which Prisma cannot deserialize because the table carries the
    // `search_vector_ar` / `search_vector_en` tsvector columns. On the old
    // code this endpoint returned 500. `setup.ts` creates those columns on
    // the test DB, so this test reproduces the failure exactly.
    // =====================================================================
    describe('GET /v1/recommendations/trending', () => {
        it('returns 200 with a Path[] payload (tsvector regression guard)', async () => {
            const res = await request(app)
                .get('/v1/recommendations/trending')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);

            for (const p of res.body.data) {
                expect(p).not.toHaveProperty('search_vector_ar');
                expect(p).not.toHaveProperty('search_vector_en');
                expect(p).not.toHaveProperty('recent_enrollments');
            }
        });

        it('returns recent-enrollment paths (seed enrollments land within 30d)', async () => {
            const res = await request(app)
                .get('/v1/recommendations/trending')
                .query({ limit: 10 })
                .expect(200);

            expect(res.body.data.length).toBeGreaterThan(0);
        });

        it('accepts categoryId and difficulty filters', async () => {
            const res = await request(app)
                .get('/v1/recommendations/trending')
                .query({ limit: 5, difficulty: 'BEGINNER' })
                .expect(200);

            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    // =====================================================================
    // GET /v1/recommendations/related/:pathId
    //
    // Second P0 regression guard — same `SELECT *` failure mode. Also
    // guards against the `text = uuid` operator error that the previous
    // version of the SQL produced when parameters were cast to `::uuid`.
    // =====================================================================
    describe('GET /v1/recommendations/related/:pathId', () => {
        it('returns 200 with a Path[] payload (tsvector + type-cast regression guard)', async () => {
            const res = await request(app)
                .get(`/v1/recommendations/related/${otherPublishedPathId}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);

            for (const p of res.body.data) {
                expect(p).not.toHaveProperty('search_vector_ar');
                expect(p).not.toHaveProperty('search_vector_en');
                expect(p).not.toHaveProperty('co_enrollment_count');
            }
        });

        it('never includes the origin path in its own related list', async () => {
            const res = await request(app)
                .get(`/v1/recommendations/related/${otherPublishedPathId}`)
                .query({ limit: 20 })
                .expect(200);

            const ids = res.body.data.map((p: any) => p.id);
            expect(ids).not.toContain(otherPublishedPathId);
        });

        it('rejects a malformed pathId with 400 (Zod UUID validation)', async () => {
            await request(app)
                .get('/v1/recommendations/related/not-a-uuid')
                .expect(400);
        });
    });

    // =====================================================================
    // GET /v1/recommendations/paths (authenticated)
    // =====================================================================
    describe('GET /v1/recommendations/paths', () => {
        it('returns 401 without a token', async () => {
            await request(app).get('/v1/recommendations/paths').expect(401);
        });

        it('returns 200 with a Path[] payload for the seeded warm user', async () => {
            const res = await request(app)
                .get('/v1/recommendations/paths')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        it('excludes paths the caller is already enrolled in', async () => {
            const res = await request(app)
                .get('/v1/recommendations/paths')
                .set('Authorization', `Bearer ${accessToken}`)
                .query({ limit: 20 })
                .expect(200);

            const ids = res.body.data.map((p: any) => p.id);
            expect(ids).not.toContain(enrolledPathId);
        });

        it('cold-start: a fresh user receives a non-empty Path[]', async () => {
            const email = `reco_${Date.now()}@example.com`;
            const regRes = await request(app)
                .post('/v1/auth/register')
                .send({
                    email,
                    password: 'Password123',
                    fullName: 'Reco Fresh User',
                })
                .expect(201);

            const freshToken = regRes.body.data.accessToken;

            const res = await request(app)
                .get('/v1/recommendations/paths')
                .set('Authorization', `Bearer ${freshToken}`)
                .expect(200);

            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });
    });

    // =====================================================================
    // Shape consistency — the entire point of Option A
    // =====================================================================
    describe('Shape consistency across endpoints', () => {
        it('all four endpoints return the same top-level shape', async () => {
            const [popular, trending, related, personalized] = await Promise.all([
                request(app).get('/v1/recommendations/popular').query({ limit: 1 }),
                request(app).get('/v1/recommendations/trending').query({ limit: 1 }),
                request(app)
                    .get(`/v1/recommendations/related/${otherPublishedPathId}`)
                    .query({ limit: 1 }),
                request(app)
                    .get('/v1/recommendations/paths')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .query({ limit: 1 }),
            ]);

            for (const res of [popular, trending, related, personalized]) {
                expect(res.status).toBe(200);
                expect(Array.isArray(res.body.data)).toBe(true);
                for (const p of res.body.data) {
                    expect(p).toHaveProperty('id');
                    expect(p).toHaveProperty('title');
                    expect(p).toHaveProperty('category');
                    expect(p).toHaveProperty('difficulty');
                    expect(p).toHaveProperty('price');
                }
            }
        });
    });
});