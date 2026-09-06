import { prisma } from '../../config/database';
import * as recommendationService from '../recommendation.service';

jest.mock('../../config/database', () => ({
    prisma: {
        path: {
        findMany: jest.fn(),
        },
        enrollment: {
        findMany: jest.fn(),
        },
        $queryRaw: jest.fn(),
    },
}));

describe('Recommendation Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getPopularPaths', () => {
        it('should return popular paths', async () => {
        const mockPaths = [{ id: 'c1', totalEnrollments: 10 }];
        (prisma.path.findMany as jest.Mock).mockResolvedValue(mockPaths);

        const result = await recommendationService.getPopularPaths(5);
        expect(result).toEqual(mockPaths);
        expect(prisma.path.findMany).toHaveBeenCalled();
        });

        it('should apply filters', async () => {
        (prisma.path.findMany as jest.Mock).mockResolvedValue([]);
        await recommendationService.getPopularPaths(5, { categoryId: 'cat1', difficulty: 'BEGINNER' });
        const where = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
        expect(where).toEqual(expect.objectContaining({
            categoryId: 'cat1',
            difficulty: 'BEGINNER',
            deletedAt: null,
            isPublished: true,
        }));
        });
    });

    describe('getTrendingPaths', () => {
        it('should return trending paths', async () => {
        const mockTrending = [{ id: 'c1', recent_enrollments: 5 }];
        (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockTrending);

        const result = await recommendationService.getTrendingPaths(5);
        expect(result).toEqual(mockTrending);
        expect(prisma.$queryRaw).toHaveBeenCalled();
        });
    });

    describe('getPersonalizedRecommendations', () => {
        it('should fallback to popular if no enrollments', async () => {
        (prisma.enrollment.findMany as jest.Mock).mockResolvedValue([]);
        const popularSpy = jest
            .spyOn(recommendationService, 'getPopularPaths')
            .mockResolvedValue([{ id: 'pop' }] as any);

        const result = await recommendationService.getPersonalizedRecommendations('user1', 5);
        expect(result).toEqual([{ id: 'pop' }]);
        popularSpy.mockRestore();
        });

        it('should recommend paths from same categories', async () => {
        const enrollments = [
            { path: { categoryId: 'cat1', difficulty: 'BEGINNER' } },
        ];
        const enrolledIds = [{ pathId: 'enrolled1' }];
        (prisma.enrollment.findMany as jest.Mock)
            .mockResolvedValueOnce(enrollments)
            .mockResolvedValueOnce(enrolledIds);
        (prisma.path.findMany as jest.Mock).mockResolvedValue([{ id: 'rec1' }]);

        const result = await recommendationService.getPersonalizedRecommendations('user1', 5);
        expect(result).toHaveLength(1);
        expect(prisma.path.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
            where: expect.objectContaining({
                categoryId: { in: ['cat1'] },
                id: { notIn: ['enrolled1'] },
            }),
            })
        );
        });
    });

    describe('getRelatedPaths', () => {
        it('should return co-enrolled paths', async () => {
        const mockRelated = [{ id: 'c2', co_enrollment_count: 3 }];
        (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockRelated);

        const result = await recommendationService.getRelatedPaths('c1', 5);
        expect(result).toEqual(mockRelated);
        expect(prisma.$queryRaw).toHaveBeenCalled();
        });
    });
});