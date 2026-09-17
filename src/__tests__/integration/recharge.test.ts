import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Recharge — Integration', () => {
    let accessToken: string;
    let firstLessonId: string;
    let secondLessonId: string;

    beforeAll(async () => {
        // Find a module with at least 2 published lessons
        const lessons = await prisma.lesson.findMany({
            where: { isPublished: true, module: { isPublished: true } },
            orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
            select: { id: true, moduleId: true },
        });

        // Group by module and pick the first module with >= 2 lessons
        const byModule: Record<string, string[]> = {};
        for (const l of lessons) {
            byModule[l.moduleId] = byModule[l.moduleId] || [];
            byModule[l.moduleId].push(l.id);
        }
        const moduleWithTwo = Object.values(byModule).find((arr) => arr.length >= 2);
        expect(moduleWithTwo).toBeDefined();
        [firstLessonId, secondLessonId] = moduleWithTwo!;

        const email = `recharge_${Date.now()}@example.com`;
        const reg = await request(app)
            .post('/v1/auth/register')
            .send({
                email,
                password: 'Recharge@123456',
                fullName: 'Recharge Tester',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        accessToken = reg.body.data.accessToken;

        // Enroll in the parent path
        const lesson = await prisma.lesson.findUnique({
            where: { id: firstLessonId },
            include: { module: { select: { pathId: true } } },
        });
        await request(app)
            .post(`/v1/enrollments/paths/${lesson!.module.pathId}/enroll`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(201);
    });

    it('GET /lessons/:lessonId/recharge-status — before lesson 1 completed → not recharging', async () => {
        const res = await request(app)
            .get(`/v1/lessons/${secondLessonId}/recharge-status`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.data.isRecharging).toBe(false);
        expect(res.body.data.xpBoostAvailable).toBe(false);
    });

    it('POST /progress/lessons/:firstLessonId — completes lesson 1 (opens recharge window)', async () => {
        const res = await request(app)
            .post(`/v1/progress/lessons/${firstLessonId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ completed: true, timeSpent: 120 })
            .expect(200);

        expect(res.body.data.completed).toBe(true);
    });

    it('GET /lessons/:secondLessonId/recharge-status — after lesson 1 done → recharging with boost', async () => {
        const res = await request(app)
            .get(`/v1/lessons/${secondLessonId}/recharge-status`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.data.isRecharging).toBe(true);
        expect(res.body.data.xpBoostAvailable).toBe(true);
        expect(res.body.data.xpBoostMultiplier).toBeGreaterThan(1);
        expect(res.body.data.remainingSeconds).toBeGreaterThan(0);
        expect(res.body.data.rechargeMessageAr).toBeTruthy();
    });
});