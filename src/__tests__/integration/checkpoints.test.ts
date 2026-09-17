import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Quest Checkpoints — Integration', () => {
    let accessToken: string;
    let lessonId: string;

    beforeAll(async () => {
        const lesson = await prisma.lesson.findFirst({
            where: { isPublished: true, questCheckpoints: { some: {} } },
            include: { module: { select: { pathId: true } } },
        });
        expect(lesson).toBeDefined();
        lessonId = lesson!.id;
        const pathId = lesson!.module.pathId;

        const email = `checkpoints_${Date.now()}@example.com`;
        const reg = await request(app)
            .post('/v1/auth/register')
            .send({
                email,
                password: 'Checkpoints@123456',
                fullName: 'Checkpoints Tester',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        accessToken = reg.body.data.accessToken;

        await request(app)
            .post(`/v1/enrollments/paths/${pathId}/enroll`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(201);
    });

    it('GET /lessons/:lessonId/checkpoints — anonymous returns without completed flag', async () => {
        const res = await request(app)
            .get(`/v1/lessons/${lessonId}/checkpoints`)
            .expect(200);

        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0]).not.toHaveProperty('completed');
    });

    it('GET — authenticated returns completed flag', async () => {
        const res = await request(app)
            .get(`/v1/lessons/${lessonId}/checkpoints`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.data[0]).toHaveProperty('completed');
    });

    it('POST complete — valid self-reflection marks checkpoint and returns nextCheckpoint', async () => {
        const firstCp = await prisma.questCheckpoint.findFirst({
            where: { lessonId },
            orderBy: { order: 'asc' },
        });
        expect(firstCp).toBeDefined();

        const res = await request(app)
            .post(`/v1/lessons/${lessonId}/checkpoints/${firstCp!.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ selfReflectionAnswer: 'I learned that computers process input.' })
            .expect(200);

        expect(res.body.data.completed).toBe(true);
        expect(res.body.data.xpEarned).toBeGreaterThan(0);
        // Quest not complete yet if there are more checkpoints
        if (res.body.data.questCompleted === false) {
            expect(res.body.data.nextCheckpoint).toBeDefined();
            expect(res.body.data.nextCheckpoint).toHaveProperty('id');
            expect(res.body.data.nextCheckpoint).toHaveProperty('titleAr');
            expect(res.body.data.nextCheckpoint).toHaveProperty('order');
        }
    });

    it('POST complete — duplicate submission returns 400', async () => {
        const firstCp = await prisma.questCheckpoint.findFirst({
            where: { lessonId },
            orderBy: { order: 'asc' },
        });

        await request(app)
            .post(`/v1/lessons/${lessonId}/checkpoints/${firstCp!.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ selfReflectionAnswer: 'another attempt' })
            .expect(400);
    });

    it('POST complete — empty answer returns 400', async () => {
        const secondCp = await prisma.questCheckpoint.findFirst({
            where: { lessonId },
            orderBy: { order: 'asc' },
            skip: 1,
        });
        if (!secondCp) return;

        await request(app)
            .post(`/v1/lessons/${lessonId}/checkpoints/${secondCp.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ selfReflectionAnswer: '   ' })
            .expect(400);
    });

    it('POST complete — client-submitted completed field is rejected', async () => {
        const thirdCp = await prisma.questCheckpoint.findFirst({
            where: { lessonId },
            orderBy: { order: 'asc' },
            skip: 2,
        });
        if (!thirdCp) return;

        await request(app)
            .post(`/v1/lessons/${lessonId}/checkpoints/${thirdCp.id}/complete`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ completed: true, selfReflectionAnswer: 'x' })
            .expect(400);
    });
});