import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/database';

describe('Search and Recommendations', () => {
    beforeAll(async () => {
        // Ensure we have at least one published path with a known title
        const path = await prisma.path.findFirst({ where: { isPublished: true } });
        expect(path).toBeDefined();
    });

    it('GET /search/paths?q=... should return matching paths', async () => {
        const res = await request(app)
            .get('/v1/search/paths')
            .query({ q: 'الحاسوب' })
            .expect(200);

        // The API returns { success: true, data: { data: [...], pagination: {...} } }
        expect(res.body.data).toHaveProperty('data');
        expect(Array.isArray(res.body.data.data)).toBe(true);
        // Seeded path title contains "الحاسوب"
        expect(res.body.data.data.length).toBeGreaterThan(0);
    });

    it('GET /recommendations/popular should return popular paths', async () => {
        const res = await request(app)
            .get('/v1/recommendations/popular')
            .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
    });
});