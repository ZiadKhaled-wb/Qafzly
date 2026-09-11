import request from 'supertest';
import app from '../../app';

describe('Gamification Endpoints', () => {
    let accessToken: string;

    beforeAll(async () => {
        // Register a new user (UserStats should be created automatically)
        const email = `gamify_${Date.now()}@example.com`;
        const password = 'Gamify@123456';
        const fullName = 'Gamification Test User';

        const res = await request(app)
            .post('/v1/auth/register')
            .send({ email, password, fullName, language: 'ar', skillLevel: 'BEGINNER' })
            .expect(201);
        accessToken = res.body.data.accessToken;
    });

    it('GET /gamification/me should return profile with XP and level', async () => {
        const res = await request(app)
            .get('/v1/gamification/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.data).toHaveProperty('totalXp');
        expect(res.body.data).toHaveProperty('level');
        expect(res.body.data).toHaveProperty('currentLevelXp');
        expect(res.body.data).toHaveProperty('nextLevelXp');
        expect(res.body.data).toHaveProperty('rank');
        expect(res.body.data).toHaveProperty('badges');
    });

    it('GET /gamification/me/streak should return streak info', async () => {
        const res = await request(app)
            .get('/v1/gamification/me/streak')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.data).toHaveProperty('currentStreak');
    });

    it('GET /gamification/daily-quests should return active quests', async () => {
        const res = await request(app)
            .get('/v1/gamification/daily-quests')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
        // Since seed creates quests, there should be some
        expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /gamification/leaderboard should return leaderboard entries', async () => {
        const res = await request(app)
            .get('/v1/gamification/leaderboard?scope=global&limit=5')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
    });
});