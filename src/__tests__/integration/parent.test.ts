import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Parent Dashboard — Integration', () => {
    let parentToken: string;
    let child1Id: string;
    let child2Email: string;
    let child2Id: string;

    beforeAll(async () => {
        const ts = Date.now();

        const parentReg = await request(app)
            .post('/v1/auth/register')
            .send({
                email: `parent_${ts}@example.com`,
                password: 'Parent@123456',
                fullName: 'Parent Test',
                role: 'PARENT',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        parentToken = parentReg.body.data.accessToken;

        const child1Reg = await request(app)
            .post('/v1/auth/register')
            .send({
                email: `child1_${ts}@example.com`,
                password: 'Child@123456',
                fullName: 'Child One',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        child1Id = child1Reg.body.data.user.id;

        child2Email = `child2_${ts}@example.com`;
        const child2Reg = await request(app)
            .post('/v1/auth/register')
            .send({
                email: child2Email,
                password: 'Child@123456',
                fullName: 'Child Two',
                language: 'ar',
                skillLevel: 'BEGINNER',
            })
            .expect(201);
        child2Id = child2Reg.body.data.user.id;
    });

    it('POST /parents/me/children — links by childId', async () => {
        const res = await request(app)
            .post('/v1/parents/me/children')
            .set('Authorization', `Bearer ${parentToken}`)
            .send({ childId: child1Id })
            .expect(200);

        expect(res.body.data.id).toBe(child1Id);
        expect(res.body.data.parentId).toBeDefined();
    });

    it('POST /parents/me/children — links by email', async () => {
        const res = await request(app)
            .post('/v1/parents/me/children')
            .set('Authorization', `Bearer ${parentToken}`)
            .send({ email: child2Email })
            .expect(200);

        expect(res.body.data.id).toBe(child2Id);
    });

    it('POST /parents/me/children — both fields → 400', async () => {
        await request(app)
            .post('/v1/parents/me/children')
            .set('Authorization', `Bearer ${parentToken}`)
            .send({ childId: child1Id, email: 'x@y.com' })
            .expect(400);
    });

    it('POST /parents/me/children — already linked → 409', async () => {
        await request(app)
            .post('/v1/parents/me/children')
            .set('Authorization', `Bearer ${parentToken}`)
            .send({ childId: child1Id })
            .expect(409);
    });

    it('GET /parents/me/children — returns both linked children', async () => {
        const res = await request(app)
            .get('/v1/parents/me/children')
            .set('Authorization', `Bearer ${parentToken}`)
            .expect(200);

        expect(res.body.data.length).toBe(2);
    });

    it('GET /parents/me/overview — returns children with stats', async () => {
        const res = await request(app)
            .get('/v1/parents/me/overview')
            .set('Authorization', `Bearer ${parentToken}`)
            .expect(200);

        expect(res.body.data.totalChildren).toBe(2);
        expect(Array.isArray(res.body.data.children)).toBe(true);
        expect(res.body.data).toHaveProperty('totalXP');
    });

    it('GET /parents/me/children/:childId/settings — returns flat shape', async () => {
        const res = await request(app)
            .get(`/v1/parents/me/children/${child1Id}/settings`)
            .set('Authorization', `Bearer ${parentToken}`)
            .expect(200);

        expect(res.body.data).toEqual({
            lockOverrideEnabled: false,
            customLockDurationHours: null,
        });
        // Must not leak DB fields
        expect(res.body.data).not.toHaveProperty('id');
        expect(res.body.data).not.toHaveProperty('parentId');
        expect(res.body.data).not.toHaveProperty('createdAt');
    });

    it('PUT /parents/me/children/:childId/settings — updates and returns flat shape', async () => {
        const res = await request(app)
            .put(`/v1/parents/me/children/${child1Id}/settings`)
            .set('Authorization', `Bearer ${parentToken}`)
            .send({ lockOverrideEnabled: true, customLockDurationHours: 3 })
            .expect(200);

        expect(res.body.data).toEqual({
            lockOverrideEnabled: true,
            customLockDurationHours: 3,
        });
    });

    it('GET /parents/me/billing — returns purchases array (no subscriptions key)', async () => {
        const res = await request(app)
            .get('/v1/parents/me/billing')
            .set('Authorization', `Bearer ${parentToken}`)
            .expect(200);

        expect(res.body.data).toHaveProperty('purchases');
        expect(Array.isArray(res.body.data.purchases)).toBe(true);
        expect(res.body.data).not.toHaveProperty('subscriptions');
    });

    it('DELETE /parents/me/children/:childId — unlinks', async () => {
        await request(app)
            .delete(`/v1/parents/me/children/${child1Id}`)
            .set('Authorization', `Bearer ${parentToken}`)
            .expect(200);

        const res = await request(app)
            .get('/v1/parents/me/children')
            .set('Authorization', `Bearer ${parentToken}`)
            .expect(200);
        expect(res.body.data.length).toBe(1);
    });
});