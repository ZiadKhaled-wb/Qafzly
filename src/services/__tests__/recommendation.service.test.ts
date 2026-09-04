import { prisma } from '../../config/database';
import * as recommendationService from '../recommendation.service';

jest.mock('../../config/database', () => ({
    prisma: {
        course: {
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

    describe('getPopularCourses', () => {
        it('should return popular courses', async () => {
        const mockCourses = [{ id: 'c1', totalEnrollments: 10 }];
        (prisma.course.findMany as jest.Mock).mockResolvedValue(mockCourses);

        const result = await recommendationService.getPopularCourses(5);
        expect(result).toEqual(mockCourses);
        expect(prisma.course.findMany).toHaveBeenCalled();
        });

        it('should apply filters', async () => {
        (prisma.course.findMany as jest.Mock).mockResolvedValue([]);
        await recommendationService.getPopularCourses(5, { categoryId: 'cat1', difficulty: 'BEGINNER' });
        const where = (prisma.course.findMany as jest.Mock).mock.calls[0][0].where;
        expect(where).toEqual(expect.objectContaining({
            categoryId: 'cat1',
            difficulty: 'BEGINNER',
            deletedAt: null,
            isPublished: true,
        }));
        });
    });

    describe('getTrendingCourses', () => {
        it('should return trending courses', async () => {
        const mockTrending = [{ id: 'c1', recent_enrollments: 5 }];
        (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockTrending);

        const result = await recommendationService.getTrendingCourses(5);
        expect(result).toEqual(mockTrending);
        expect(prisma.$queryRaw).toHaveBeenCalled();
        });
    });

    describe('getPersonalizedRecommendations', () => {
        it('should fallback to popular if no enrollments', async () => {
        (prisma.enrollment.findMany as jest.Mock).mockResolvedValue([]);
        const popularSpy = jest
            .spyOn(recommendationService, 'getPopularCourses')
            .mockResolvedValue([{ id: 'pop' }] as any);

        const result = await recommendationService.getPersonalizedRecommendations('user1', 5);
        expect(result).toEqual([{ id: 'pop' }]);
        popularSpy.mockRestore();
        });

        it('should recommend courses from same categories', async () => {
        const enrollments = [
            { course: { categoryId: 'cat1', difficulty: 'BEGINNER' } },
        ];
        const enrolledIds = [{ courseId: 'enrolled1' }];
        (prisma.enrollment.findMany as jest.Mock)
            .mockResolvedValueOnce(enrollments)
            .mockResolvedValueOnce(enrolledIds);
        (prisma.course.findMany as jest.Mock).mockResolvedValue([{ id: 'rec1' }]);

        const result = await recommendationService.getPersonalizedRecommendations('user1', 5);
        expect(result).toHaveLength(1);
        expect(prisma.course.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
            where: expect.objectContaining({
                categoryId: { in: ['cat1'] },
                id: { notIn: ['enrolled1'] },
            }),
            })
        );
        });
    });

    describe('getRelatedCourses', () => {
        it('should return co-enrolled courses', async () => {
        const mockRelated = [{ id: 'c2', co_enrollment_count: 3 }];
        (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockRelated);

        const result = await recommendationService.getRelatedCourses('c1', 5);
        expect(result).toEqual(mockRelated);
        expect(prisma.$queryRaw).toHaveBeenCalled();
        });
    });
});