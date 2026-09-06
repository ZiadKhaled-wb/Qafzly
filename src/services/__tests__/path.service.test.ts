import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as pathService from '../path.service';

jest.mock('../../config/database', () => ({
    prisma: {
        path: {
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
        },
    },
}));

describe('Path Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createPath', () => {
        it('should create a path with included category', async () => {
            const mockData = { title: 'Intro to Computers', description: 'Learn Computers', price: 0 };
            const mockPath = { id: 'path-1', ...mockData, category: null };
            (prisma.path.create as jest.Mock).mockResolvedValue(mockPath);

            const result = await pathService.createPath(mockData);

            expect(prisma.path.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    title: mockData.title,
                    description: mockData.description,
                    price: 0,
                    currency: 'EGP',
                    tags: [],
                    prerequisites: [],
                    isPublished: false,
                    isFeatured: false,
                }),
                include: { category: true },
            });
            expect(result).toEqual(mockPath);
        });
    });

    describe('listPaths', () => {
        it('should return paginated public paths (only published)', async () => {
            const mockPaths = [{ id: 'p1', title: 'A', isPublished: true }];
            (prisma.path.findMany as jest.Mock).mockResolvedValue(mockPaths);
            (prisma.path.count as jest.Mock).mockResolvedValue(1);

            const params = { page: 1, limit: 10, search: '', categoryId: undefined, difficulty: undefined };
            const result = await pathService.listPaths(params);

            expect(prisma.path.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ isPublished: true, deletedAt: null }),
                })
            );
            expect(result.paths).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.totalPages).toBe(1);
        });

        it('should apply filters correctly', async () => {
            (prisma.path.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.path.count as jest.Mock).mockResolvedValue(0);

            const params = {
                page: 1,
                limit: 10,
                search: 'computer',
                categoryId: 'cat-1',
                difficulty: 'BEGINNER',
                minPrice: 0,
                maxPrice: 100,
                isFeatured: true,
                sortBy: 'price',
                order: 'asc'
            };
            await pathService.listPaths(params);

            const whereArg = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(whereArg.OR).toBeDefined();
            expect(whereArg.categoryId).toBe('cat-1');
            expect(whereArg.difficulty).toBe('BEGINNER');
            expect(whereArg.price).toEqual({ gte: 0, lte: 100 });
            expect(whereArg.isFeatured).toBe(true);
        });
    });

    describe('listAllPathsAdmin', () => {
        it('should return all paths including unpublished for admin', async () => {
            (prisma.path.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.path.count as jest.Mock).mockResolvedValue(0);

            await pathService.listAllPathsAdmin({ page: 1, limit: 10, isPublished: false });

            const whereArg = (prisma.path.findMany as jest.Mock).mock.calls[0][0].where;
            expect(whereArg.deletedAt).toBeNull();
            expect(whereArg.isPublished).toBe(false);
        });
    });

    describe('getPathById', () => {
        it('should return published path for non-admin', async () => {
            const mockPath = { id: 'p1', title: 'Test', isPublished: true };
            (prisma.path.findFirst as jest.Mock).mockResolvedValue(mockPath);

            const result = await pathService.getPathById('p1', false);
            expect(prisma.path.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: 'p1', isPublished: true, deletedAt: null }),
                })
            );
            expect(result).toEqual(mockPath);
        });

        it('should return path even if unpublished for admin', async () => {
            const mockPath = { id: 'p1', title: 'Test', isPublished: false };
            (prisma.path.findFirst as jest.Mock).mockResolvedValue(mockPath);

            await pathService.getPathById('p1', true);
            const whereArg = (prisma.path.findFirst as jest.Mock).mock.calls[0][0].where;
            expect(whereArg.isPublished).toBeUndefined();
            expect(whereArg.deletedAt).toBeNull();
        });

        it('should throw 404 if not found', async () => {
            (prisma.path.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(pathService.getPathById('bad-id', false)).rejects.toThrow(AppError);
        });
    });

    describe('updatePath', () => {
        it('should update path and return result', async () => {
            const mockPath = { id: 'p1', title: 'Updated' };
            (prisma.path.findUnique as jest.Mock).mockResolvedValue({ id: 'p1' });
            (prisma.path.update as jest.Mock).mockResolvedValue(mockPath);

            const result = await pathService.updatePath('p1', { title: 'Updated' });
            expect(prisma.path.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { title: 'Updated' },
                include: { category: true },
            });
            expect(result).toEqual(mockPath);
        });

        it('should throw 404 if path not found', async () => {
            (prisma.path.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(pathService.updatePath('bad-id', {})).rejects.toThrow(AppError);
        });
    });

    describe('deletePath', () => {
        it('should soft-delete path by setting deletedAt and unpublish', async () => {
            const mockPath = { id: 'p1', deletedAt: new Date(), isPublished: false };
            (prisma.path.findUnique as jest.Mock).mockResolvedValue({ id: 'p1' });
            (prisma.path.update as jest.Mock).mockResolvedValue(mockPath);

            const result = await pathService.deletePath('p1');
            expect(prisma.path.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { deletedAt: expect.any(Date), isPublished: false },
            });
            expect(result).toEqual(mockPath);
        });

        it('should throw 404 if path not found', async () => {
            (prisma.path.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(pathService.deletePath('bad-id')).rejects.toThrow(AppError);
        });
    });

    describe('publishPath', () => {
        it('should update isPublished', async () => {
            const mockPath = { id: 'p1', isPublished: true };
            (prisma.path.findUnique as jest.Mock).mockResolvedValue({ id: 'p1' });
            (prisma.path.update as jest.Mock).mockResolvedValue(mockPath);

            const result = await pathService.publishPath('p1', true);
            expect(prisma.path.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { isPublished: true },
            });
            expect(result).toEqual(mockPath);
        });
    });
});