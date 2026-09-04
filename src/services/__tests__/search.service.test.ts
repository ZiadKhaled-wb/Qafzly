import { prisma } from '../../config/database';
import * as searchService from '../search.service';

jest.mock('../../config/database', () => ({
    prisma: {
        $queryRaw: jest.fn(),
        user: {
        findMany: jest.fn(),
        count: jest.fn(),
        },
    },
}));

describe('Search Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('searchCourses', () => {
        it('should return paginated courses and total', async () => {
        const mockCourses = [{ id: 'c1', title: 'Python', rank: 0.5 }];
        const mockTotal = [{ count: 1 }];
        (prisma.$queryRaw as jest.Mock)
            .mockResolvedValueOnce(mockCourses)
            .mockResolvedValueOnce(mockTotal);

        const result = await searchService.searchCourses(
            { q: 'python', language: 'ar' },
            { page: 1, limit: 10 }
        );

        expect(result.data).toEqual(mockCourses);
        expect(result.pagination.total).toBe(1);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should handle short queries without throwing', async () => {
        (prisma.$queryRaw as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ count: 0 }]);

        await expect(
            searchService.searchCourses(
            { q: 'py', language: 'en' },
            { page: 1, limit: 10 }
            )
        ).resolves.toEqual({
            data: [],
            pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            },
        });
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });
    });

    describe('searchForumPosts', () => {
        it('should return paginated posts', async () => {
        const mockPosts = [{ id: 'p1', title: 'Hello', rank: 0.3 }];
        const mockTotal = [{ count: 1 }];
        (prisma.$queryRaw as jest.Mock)
            .mockResolvedValueOnce(mockPosts)
            .mockResolvedValueOnce(mockTotal);

        const result = await searchService.searchForumPosts(
            { q: 'hello', language: 'en' },
            { page: 1, limit: 10 }
        );

        expect(result.data).toEqual(mockPosts);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });
    });

    describe('searchUsers', () => {
        it('should search users by name/email', async () => {
        const mockUsers = [{ id: 'u1', fullName: 'John' }];
        (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
        (prisma.user.count as jest.Mock).mockResolvedValue(1);

        const result = await searchService.searchUsers(
            { q: 'john' },
            { page: 1, limit: 10 }
        );

        expect(result.data).toEqual(mockUsers);
        expect(prisma.user.findMany).toHaveBeenCalled();
        expect(prisma.user.count).toHaveBeenCalled();
        });
    });

    describe('globalSearch', () => {
        it('should return combined results for all types', async () => {
        const searchCoursesSpy = jest
            .spyOn(searchService, 'searchCourses')
            .mockResolvedValue({ data: [], pagination: {} } as any);
        const searchForumSpy = jest
            .spyOn(searchService, 'searchForumPosts')
            .mockResolvedValue({ data: [], pagination: {} } as any);
        const searchUsersSpy = jest
            .spyOn(searchService, 'searchUsers')
            .mockResolvedValue({ data: [], pagination: {} } as any);

        const result = await searchService.globalSearch(
            { q: 'test' },
            { page: 1, limit: 10 }
        );

        expect(result.courses).toBeDefined();
        expect(result.posts).toBeDefined();
        expect(result.users).toBeDefined();
        searchCoursesSpy.mockRestore();
        searchForumSpy.mockRestore();
        searchUsersSpy.mockRestore();
        });

        it('should only search requested type', async () => {
        const searchCoursesSpy = jest
            .spyOn(searchService, 'searchCourses')
            .mockResolvedValue({ data: [], pagination: {} } as any);
        const searchForumSpy = jest
            .spyOn(searchService, 'searchForumPosts')
            .mockResolvedValue({ data: [], pagination: {} } as any);
        const searchUsersSpy = jest
            .spyOn(searchService, 'searchUsers')
            .mockResolvedValue({ data: [], pagination: {} } as any);

        await searchService.globalSearch(
            { q: 'test', type: 'course' },
            { page: 1, limit: 10 }
        );

        expect(searchCoursesSpy).toHaveBeenCalled();
        expect(searchForumSpy).not.toHaveBeenCalled();
        expect(searchUsersSpy).not.toHaveBeenCalled();
        searchCoursesSpy.mockRestore();
        searchForumSpy.mockRestore();
        searchUsersSpy.mockRestore();
        });
    });
});