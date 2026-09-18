import { prisma } from '../../config/database';
import * as recommendationService from '../recommendation.service';

jest.mock('../../config/database', () => ({
    prisma: {
        path: { findMany: jest.fn() },
        user: { findUnique: jest.fn() },
        enrollment: { findMany: jest.fn() },
        $queryRaw: jest.fn(),
    },
}));

const makePath = (overrides: Partial<any> = {}) => ({
    id: 'path-1',
    title: 'Test Path',
    titleEn: null,
    description: 'desc',
    descriptionEn: null,
    categoryId: 'cat-1',
    difficulty: 'BEGINNER',
    price: 0,
    currency: 'EGP',
    featuredImage: null,
    tags: [],
    prerequisites: [],
    estimatedDuration: 0,
    isPublished: true,
    isFeatured: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    category: null,
    ...overrides,
});

describe('Recommendation Service', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        // Persistent defaults — consumed when a test's `mockResolvedValueOnce`
        // queue drains, so fallback stages in the service resolve to empty
        // arrays instead of `undefined`.
        (prisma.path.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.enrollment.findMany as jest.Mock).mockResolvedValue([]);
    });

    // =====================================================================
    // getPopularPaths
    // =====================================================================
    describe('getPopularPaths', () => {
        it('returns paths with the deterministic triple tie-breaker', async () => {
            (prisma.path.findMany as jest.Mock).mockResolvedValue([makePath()]);

            const result = await recommendationService.getPopularPaths(5);

            expect(result).toHaveLength(1);
            expect(prisma.path.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: [
                        { enrollments: { _count: 'desc' } },
                        { createdAt: 'desc' },
                        { id: 'asc' },
                    ],
                    take: 5,
                })
            );
        });

        it('applies categoryId filter when provided', async () => {
            (prisma.path.findMany as jest.Mock).mockResolvedValue([]);

            await recommendationService.getPopularPaths(5, { categoryId: 'cat-x' });

            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where).toEqual(
                expect.objectContaining({ categoryId: 'cat-x' })
            );
        });

        it('omits categoryId from where when not provided', async () => {
            (prisma.path.findMany as jest.Mock).mockResolvedValue([]);

            await recommendationService.getPopularPaths(5);

            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where.categoryId).toBeUndefined();
        });

        it('applies difficulty filter when provided', async () => {
            (prisma.path.findMany as jest.Mock).mockResolvedValue([]);

            await recommendationService.getPopularPaths(5, { difficulty: 'ADVANCED' });

            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where.difficulty).toBe('ADVANCED');
        });

        it('omits difficulty from where when not provided', async () => {
            (prisma.path.findMany as jest.Mock).mockResolvedValue([]);

            await recommendationService.getPopularPaths(5);

            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where.difficulty).toBeUndefined();
        });

        it('always excludes deleted and unpublished paths', async () => {
            (prisma.path.findMany as jest.Mock).mockResolvedValue([]);

            await recommendationService.getPopularPaths(5);

            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where.deletedAt).toBeNull();
            expect(where.isPublished).toBe(true);
        });

        it('excludes enrolled path IDs when provided', async () => {
            (prisma.path.findMany as jest.Mock).mockResolvedValue([]);

            await recommendationService.getPopularPaths(
                5,
                {},
                ['excluded-1', 'excluded-2']
            );

            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where.id).toEqual({ notIn: ['excluded-1', 'excluded-2'] });
        });

        it('omits the id filter when excludeIds is empty', async () => {
            (prisma.path.findMany as jest.Mock).mockResolvedValue([]);

            await recommendationService.getPopularPaths(5);

            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where.id).toBeUndefined();
        });
    });

    // =====================================================================
    // getTrendingPaths
    // =====================================================================
    describe('getTrendingPaths', () => {
        it('returns paths in the raw SQL rank order', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([
                { id: 'a', recent_enrollments: 10n },
                { id: 'b', recent_enrollments: 5n },
            ]);
            (prisma.path.findMany as jest.Mock).mockResolvedValue([
                makePath({ id: 'b' }),
                makePath({ id: 'a' }),
            ]);

            const result = await recommendationService.getTrendingPaths(5);

            expect(result.map((p) => p.id)).toEqual(['a', 'b']);
        });

        it('returns empty array when the raw query returns nothing', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

            const result = await recommendationService.getTrendingPaths(5);

            expect(result).toEqual([]);
            expect(prisma.path.findMany).not.toHaveBeenCalled();
        });

        it('drops ids from raw SQL that no longer resolve to a visible path', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([
                { id: 'a', recent_enrollments: 10n },
                { id: 'deleted', recent_enrollments: 5n },
            ]);
            (prisma.path.findMany as jest.Mock).mockResolvedValue([makePath({ id: 'a' })]);

            const result = await recommendationService.getTrendingPaths(5);

            expect(result.map((p) => p.id)).toEqual(['a']);
        });

        it('passes categoryId filter into the raw SQL fragment', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

            await recommendationService.getTrendingPaths(5, { categoryId: 'cat-x' });

            expect(prisma.$queryRaw).toHaveBeenCalled();
        });

        it('passes difficulty filter into the raw SQL fragment', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

            await recommendationService.getTrendingPaths(5, { difficulty: 'BEGINNER' });

            expect(prisma.$queryRaw).toHaveBeenCalled();
        });

        it('filters excluded IDs out of the ranked result', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([
                { id: 'a', recent_enrollments: 10n },
                { id: 'excluded', recent_enrollments: 8n },
                { id: 'b', recent_enrollments: 5n },
            ]);
            (prisma.path.findMany as jest.Mock).mockResolvedValue([
                makePath({ id: 'a' }),
                makePath({ id: 'b' }),
            ]);

            const result = await recommendationService.getTrendingPaths(
                5,
                {},
                ['excluded']
            );

            expect(result.map((p) => p.id)).toEqual(['a', 'b']);
        });
    });

    // =====================================================================
    // getRelatedPaths
    // =====================================================================
    describe('getRelatedPaths', () => {
        it('returns co-enrolled paths in rank order', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([
                { id: 'x', co_enrollment_count: 8n },
                { id: 'y', co_enrollment_count: 3n },
            ]);
            (prisma.path.findMany as jest.Mock).mockResolvedValue([
                makePath({ id: 'y' }),
                makePath({ id: 'x' }),
            ]);

            const result = await recommendationService.getRelatedPaths('origin', 5);

            expect(result.map((p) => p.id)).toEqual(['x', 'y']);
        });

        it('returns empty array when there is no co-enrollment', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

            const result = await recommendationService.getRelatedPaths('origin', 5);

            expect(result).toEqual([]);
            expect(prisma.path.findMany).not.toHaveBeenCalled();
        });
    });

    // =====================================================================
    // getPersonalizedRecommendations
    // =====================================================================
    describe('getPersonalizedRecommendations', () => {
        const userId = 'user-1';

        const mockUser = (skillLevel = 'BEGINNER') => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ skillLevel });
        };

        const mockEnrollments = (
            active: Array<{ path: { categoryId: string | null } }>,
            all: Array<{ pathId: string }>
        ) => {
            (prisma.enrollment.findMany as jest.Mock)
                .mockResolvedValueOnce(active)
                .mockResolvedValueOnce(all);
        };

        it('cold-start: returns skill-matched popular for a user with no enrollments', async () => {
            mockUser('BEGINNER');
            mockEnrollments([], []);
            // STAGE 2 (skill-matched)
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'skill-1', difficulty: 'BEGINNER' }),
                makePath({ id: 'skill-2', difficulty: 'ALL_LEVELS' }),
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                5
            );

            expect(result.map((p) => p.id)).toEqual(['skill-1', 'skill-2']);
            const findManyCalls = (prisma.path.findMany as jest.Mock).mock.calls;
            expect(findManyCalls[0][0].where.difficulty.in).toEqual([
                'BEGINNER',
                'ALL_LEVELS',
                'INTERMEDIATE',
            ]);
        });

        it('cold-start: fills from popular when skill-matched is short', async () => {
            mockUser('BEGINNER');
            mockEnrollments([], []);
            // STAGE 2 returns 1
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'skill-1' }),
            ]);
            // STAGE 3 (popular) returns 2 more
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'pop-1' }),
                makePath({ id: 'pop-2' }),
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                3
            );

            expect(result.map((p) => p.id)).toEqual(['skill-1', 'pop-1', 'pop-2']);
        });

        it('cold-start: fills from trending when popular is also short', async () => {
            mockUser('BEGINNER');
            mockEnrollments([], []);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'skill-1' }),
            ]);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'pop-1' }),
            ]);
            // STAGE 4 (trending) — raw SQL then findMany
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([
                { id: 'trend-1', recent_enrollments: 5n },
            ]);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'trend-1' }),
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                3
            );

            expect(result.map((p) => p.id)).toEqual(['skill-1', 'pop-1', 'trend-1']);
        });

        it('cold-start: returns fewer than limit when all stages exhaust', async () => {
            mockUser('BEGINNER');
            mockEnrollments([], []);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([]); // skill
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([]); // popular
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([]); // trending

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                5
            );

            expect(result).toEqual([]);
        });

        it('warm-start: puts category-matched paths first', async () => {
            mockUser('INTERMEDIATE');
            mockEnrollments(
                [{ path: { categoryId: 'cat-python' } }],
                [{ pathId: 'enrolled-1' }]
            );
            // STAGE 1
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                {
                    ...makePath({ id: 'cat-path-1', categoryId: 'cat-python' }),
                    _count: { enrollments: 5 },
                },
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                5
            );

            expect(result[0].id).toBe('cat-path-1');
            expect((result[0] as any)._count).toBeUndefined();
        });

        it('warm-start: ranks by category frequency before enrollment count', async () => {
            mockUser('INTERMEDIATE');
            mockEnrollments(
                [
                    { path: { categoryId: 'cat-python' } },
                    { path: { categoryId: 'cat-python' } },
                    { path: { categoryId: 'cat-web' } },
                ],
                [{ pathId: 'enrolled-1' }]
            );
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                {
                    ...makePath({
                        id: 'web-high',
                        categoryId: 'cat-web',
                        createdAt: new Date('2026-02-01'),
                    }),
                    _count: { enrollments: 100 },
                },
                {
                    ...makePath({
                        id: 'python-low',
                        categoryId: 'cat-python',
                        createdAt: new Date('2026-01-01'),
                    }),
                    _count: { enrollments: 1 },
                },
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                2
            );

            expect(result.map((p) => p.id)).toEqual(['python-low', 'web-high']);
        });

        it('warm-start: tie-breaks by createdAt then id when weights and counts are equal', async () => {
            mockUser('INTERMEDIATE');
            mockEnrollments(
                [{ path: { categoryId: 'cat-python' } }],
                [{ pathId: 'enrolled-1' }]
            );
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                {
                    ...makePath({
                        id: 'b',
                        categoryId: 'cat-python',
                        createdAt: new Date('2026-01-01'),
                    }),
                    _count: { enrollments: 5 },
                },
                {
                    ...makePath({
                        id: 'a',
                        categoryId: 'cat-python',
                        createdAt: new Date('2026-01-01'),
                    }),
                    _count: { enrollments: 5 },
                },
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                2
            );

            expect(result.map((p) => p.id)).toEqual(['a', 'b']);
        });

        it('warm-start: falls back to skill-matched popular when category is short', async () => {
            mockUser('BEGINNER');
            mockEnrollments(
                [{ path: { categoryId: 'cat-python' } }],
                [{ pathId: 'enrolled-1' }]
            );
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                {
                    ...makePath({ id: 'cat-1', categoryId: 'cat-python' }),
                    _count: { enrollments: 5 },
                },
            ]);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'skill-1', difficulty: 'BEGINNER' }),
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                2
            );

            expect(result.map((p) => p.id)).toEqual(['cat-1', 'skill-1']);
        });

        it('warm-start: deduplicates paths that appear in multiple stages', async () => {
            mockUser('BEGINNER');
            mockEnrollments(
                [{ path: { categoryId: 'cat-python' } }],
                [{ pathId: 'enrolled-1' }]
            );
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                {
                    ...makePath({ id: 'shared', categoryId: 'cat-python' }),
                    _count: { enrollments: 5 },
                },
            ]);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'shared' }),
                makePath({ id: 'new-1' }),
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                2
            );

            expect(result.map((p) => p.id)).toEqual(['shared', 'new-1']);
        });

        it('warm-start: ignores expired enrollments for category weighting but excludes their paths', async () => {
            mockUser('BEGINNER');
            mockEnrollments([], [{ pathId: 'expired-path' }]);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'cold-1' }),
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                1
            );

            expect(result[0].id).toBe('cold-1');
            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where.id.notIn).toContain('expired-path');
        });

        it('warm-start: skips null categoryId enrollments from weighting', async () => {
            mockUser('BEGINNER');
            mockEnrollments(
                [
                    { path: { categoryId: null } },
                    { path: { categoryId: 'cat-valid' } },
                ],
                []
            );
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                {
                    ...makePath({ id: 'valid-1', categoryId: 'cat-valid' }),
                    _count: { enrollments: 1 },
                },
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                1
            );

            expect(result[0].id).toBe('valid-1');
        });

        it('warm-start: stage 1 short → stage 2 short → stage 3 fill → returns at limit', async () => {
            mockUser('BEGINNER');
            mockEnrollments(
                [{ path: { categoryId: 'cat-1' } }],
                [{ pathId: 'e1' }]
            );
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                { ...makePath({ id: 'cat-1', categoryId: 'cat-1' }), _count: { enrollments: 1 } },
            ]);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'skill-1' }),
            ]);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'pop-1' }),
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                3
            );

            expect(result.map((p) => p.id)).toEqual(['cat-1', 'skill-1', 'pop-1']);
        });

        it('warm-start: stage 3 (popular fallback) is called with enrolled paths excluded', async () => {
            mockUser('BEGINNER');
            mockEnrollments(
                [{ path: { categoryId: 'cat-1' } }],
                [{ pathId: 'enrolled-x' }, { pathId: 'enrolled-y' }]
            );
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([]); // STAGE 1
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([]); // STAGE 2
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'pop-1' }),
            ]); // STAGE 3

            await recommendationService.getPersonalizedRecommendations(userId, 5);

            // path.findMany call index 2 is Stage 3
            const stage3Where = (prisma.path.findMany as jest.Mock).mock.calls[2][0].where;
            expect(stage3Where.id).toEqual({ notIn: ['enrolled-x', 'enrolled-y'] });
        });

        it('uses BEGINNER defaults when the user record is missing', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            mockEnrollments([], []);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([]);

            await recommendationService.getPersonalizedRecommendations(userId, 5);

            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where.difficulty.in).toEqual([
                'BEGINNER',
                'ALL_LEVELS',
                'INTERMEDIATE',
            ]);
        });

        it('uses ADVANCED adjacency for an advanced user', async () => {
            mockUser('ADVANCED');
            mockEnrollments([], []);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([]);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([]);
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

            await recommendationService.getPersonalizedRecommendations(userId, 5);

            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where.difficulty.in).toEqual([
                'ADVANCED',
                'ALL_LEVELS',
                'INTERMEDIATE',
            ]);
        });

        it('falls back to BEGINNER adjacency for an unknown skillLevel', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                skillLevel: 'MYSTERY',
            });
            mockEnrollments([], []);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([]);

            await recommendationService.getPersonalizedRecommendations(userId, 5);

            const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(where.difficulty.in).toEqual([
                'BEGINNER',
                'ALL_LEVELS',
                'INTERMEDIATE',
            ]);
        });

        it('slices result to exactly the limit', async () => {
            mockUser('BEGINNER');
            mockEnrollments([], []);
            (prisma.path.findMany as jest.Mock).mockResolvedValueOnce([
                makePath({ id: 'p1' }),
                makePath({ id: 'p2' }),
                makePath({ id: 'p3' }),
            ]);

            const result = await recommendationService.getPersonalizedRecommendations(
                userId,
                2
            );

            expect(result).toHaveLength(2);
            expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
        });
    });
});