import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Progress Tracking', () => {
    let accessToken: string;
    let pathId: string;
    let moduleId: string;
    let lessonId: string;

    beforeAll(async () => {
        // Get a seeded published path with modules and lessons
        const path = await prisma.path.findFirst({
            where: { isPublished: true },
            include: { modules: { include: { lessons: true } } },
        });
        expect(path).toBeDefined();
        pathId = path!.id;
        moduleId = path!.modules[0].id;
        lessonId = path!.modules[0].lessons[0].id;

        // Register and enroll
        const email = `progress_${Date.now()}@example.com`;
        const password = 'Progress@123456';
        const fullName = 'Progress Test User';

        const regRes = await request(app)
            .post('/v1/auth/register')
            .send({ email, password, fullName, language: 'ar', skillLevel: 'BEGINNER' })
            .expect(201);
        accessToken = regRes.body.data.accessToken;

        // Enroll
        await request(app)
            .post(`/v1/enrollments/paths/${pathId}/enroll`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(201);
    });

    it('POST /progress/lessons/:lessonId should update progress', async () => {
        const res = await request(app)
            .post(`/v1/progress/lessons/${lessonId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ completed: true, timeSpent: 120, quizScore: 90 })
            .expect(200);

        expect(res.body.success).toBe(true);
    });

    it('GET /progress/paths/:pathId should return progress summary', async () => {
        const res = await request(app)
            .get(`/v1/progress/paths/${pathId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.data).toHaveProperty('totalLessons');
        expect(res.body.data).toHaveProperty('completedLessons');
    });
});