import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Boss Battle — Integration', () => {
    let moduleId: string;
    let questions: Array<{ id: string; correctIndex: number }> = [];
    const tokens: Record<string, string> = {};

    beforeAll(async () => {
        const battle = await prisma.bossBattle.findFirst({
            include: {
                module: { select: { id: true } },
                questions: { orderBy: { order: 'asc' }, select: { id: true, correctIndex: true } },
            },
        });
        expect(battle).toBeDefined();
        moduleId = battle!.module.id;
        questions = battle!.questions;

        // Register 4 fresh users so each can submit exactly once (unique constraint per user)
        for (const tier of ['legend', 'warrior', 'trainee', 'retry']) {
            const email = `bb_${tier}_${Date.now()}@example.com`;
            const reg = await request(app)
                .post('/v1/auth/register')
                .send({
                    email,
                    password: 'BB@123456',
                    fullName: `Boss Battle ${tier}`,
                    language: 'ar',
                    skillLevel: 'BEGINNER',
                })
                .expect(201);
            tokens[tier] = reg.body.data.accessToken;
        }
    });

    const buildAnswers = (correctCount: number) =>
        questions.map((q, idx) => ({
            questionId: q.id,
            // Deliver correctIndex for first N questions, wrong for the rest
            selectedIndex: idx < correctCount ? q.correctIndex : (q.correctIndex + 1) % 4,
        }));

    it('GET /modules/:moduleId/boss-battle — returns questions without correctIndex', async () => {
        const res = await request(app)
            .get(`/v1/modules/${moduleId}/boss-battle`)
            .set('Authorization', `Bearer ${tokens.legend}`)
            .expect(200);

        expect(res.body.data.questions.length).toBeGreaterThan(0);
        expect(res.body.data.questions[0]).not.toHaveProperty('correctIndex');
        expect(res.body.data).toHaveProperty('completed', false);
    });

    it('POST submit — all correct → legend tier + badge awarded', async () => {
        const total = questions.length;
        const answers = buildAnswers(total); // 100% correct

        const res = await request(app)
            .post(`/v1/modules/${moduleId}/boss-battle/submit`)
            .set('Authorization', `Bearer ${tokens.legend}`)
            .send({ answers })
            .expect(200);

        expect(res.body.data.victoryLevel).toBe('legend');
        expect(res.body.data.scorePercent).toBeGreaterThanOrEqual(80);
        expect(res.body.data.badgesEarned).toContain('أسطورة المدينة');
    });

    it('POST submit — 60% correct → warrior tier + badge', async () => {
        const total = questions.length;
        const answers = buildAnswers(Math.max(1, Math.floor(total * 0.6)));

        const res = await request(app)
            .post(`/v1/modules/${moduleId}/boss-battle/submit`)
            .set('Authorization', `Bearer ${tokens.warrior}`)
            .send({ answers })
            .expect(200);

        const percent = res.body.data.scorePercent;
        expect(percent).toBeGreaterThanOrEqual(60);
        expect(percent).toBeLessThan(80);
        expect(res.body.data.badgesEarned).toContain('محارب المدينة');
    });

    it('POST submit — 40% correct → trainee tier + badge', async () => {
        const total = questions.length;
        const answers = buildAnswers(Math.max(1, Math.floor(total * 0.4)));

        const res = await request(app)
            .post(`/v1/modules/${moduleId}/boss-battle/submit`)
            .set('Authorization', `Bearer ${tokens.trainee}`)
            .send({ answers })
            .expect(200);

        const percent = res.body.data.scorePercent;
        expect(percent).toBeGreaterThanOrEqual(40);
        expect(percent).toBeLessThan(60);
        expect(res.body.data.badgesEarned).toContain('متدرب المدينة');
    });

    it('POST submit — <40% correct → retry tier + "مش هستسلم" badge', async () => {
        const answers = buildAnswers(0); // 0% correct

        const res = await request(app)
            .post(`/v1/modules/${moduleId}/boss-battle/submit`)
            .set('Authorization', `Bearer ${tokens.retry}`)
            .send({ answers })
            .expect(200);

        expect(res.body.data.victoryLevel).toBe('retry');
        expect(res.body.data.victoryLabelAr).toBe('مش هستسلم');
        expect(res.body.data.badgesEarned).toContain('مش هستسلم');
    });

    it('POST submit — duplicate submission for same user returns 400', async () => {
        const total = questions.length;
        const answers = buildAnswers(total);

        await request(app)
            .post(`/v1/modules/${moduleId}/boss-battle/submit`)
            .set('Authorization', `Bearer ${tokens.legend}`)
            .send({ answers })
            .expect(400);
    });
});