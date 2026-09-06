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

    describe('searchPaths', () => {
        it('should return paginated paths and total', async () => {
        const mockPaths = [{ id: 'c1', title: 'Python', rank: 0.5 }];
        const mockTotal = [{ count: 1 }];
        (prisma.$queryRaw as jest.Mock)
            .mockResolvedValueOnce(mockPaths)
            .mockResolvedValueOnce(mockTotal);

        const result = await searchService.searchPaths(
            { q: 'python', language: 'ar' },
            { page: 1, limit: 10 }
        );

        expect(result.data).toEqual(mockPaths);
        expect(result.pagination.total).toBe(1);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });

        it('should handle short queries without throwing', async () => {
        (prisma.$queryRaw as jest.Mock)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ count: 0 }]);

        await expect(
            searchService.searchPaths(
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
        const searchPathsSpy = jest
            .spyOn(searchService, 'searchPaths')
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

        expect(result.paths).toBeDefined();
        expect(result.posts).toBeDefined();
        expect(result.users).toBeDefined();
        searchPathsSpy.mockRestore();
        searchForumSpy.mockRestore();
        searchUsersSpy.mockRestore();
        });

        it('should only search requested type', async () => {
        const searchPathsSpy = jest
            .spyOn(searchService, 'searchPaths')
            .mockResolvedValue({ data: [], pagination: {} } as any);
        const searchForumSpy = jest
            .spyOn(searchService, 'searchForumPosts')
            .mockResolvedValue({ data: [], pagination: {} } as any);
        const searchUsersSpy = jest
            .spyOn(searchService, 'searchUsers')
            .mockResolvedValue({ data: [], pagination: {} } as any);

        await searchService.globalSearch(
            { q: 'test', type: 'path' },
            { page: 1, limit: 10 }
        );

        expect(searchPathsSpy).toHaveBeenCalled();
        expect(searchForumSpy).not.toHaveBeenCalled();
        expect(searchUsersSpy).not.toHaveBeenCalled();
        searchPathsSpy.mockRestore();
        searchForumSpy.mockRestore();
        searchUsersSpy.mockRestore();
        });
    });
});