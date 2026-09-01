import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as categoryService from '../category.service';

// Mock Prisma
jest.mock('../../config/database', () => ({
    prisma: {
        courseCategory: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
        },
        course: {
        updateMany: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

describe('Category Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createCategory', () => {
        it('should create a category', async () => {
        const mockData = { name: 'Programming', nameEn: 'Programming' };
        const mockCategory = { id: 'cat-1', ...mockData };
        (prisma.courseCategory.create as jest.Mock).mockResolvedValue(mockCategory);

        const result = await categoryService.createCategory(mockData);

        expect(prisma.courseCategory.create).toHaveBeenCalledWith({ data: mockData });
        expect(result).toEqual(mockCategory);
        });
    });

    describe('listCategories', () => {
        it('should return paginated categories with filters', async () => {
        const mockCategories = [{ id: 'cat-1', name: 'A' }, { id: 'cat-2', name: 'B' }];
        (prisma.courseCategory.findMany as jest.Mock).mockResolvedValue(mockCategories);
        (prisma.courseCategory.count as jest.Mock).mockResolvedValue(2);

        const params = { page: 1, limit: 10, search: 'a', parentId: null };
        const result = await categoryService.listCategories(params);

        expect(prisma.courseCategory.findMany).toHaveBeenCalled();
        expect(result.categories).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.totalPages).toBe(1);
        });

        it('should apply search and parentId filters', async () => {
        (prisma.courseCategory.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.courseCategory.count as jest.Mock).mockResolvedValue(0);

        await categoryService.listCategories({ page: 1, limit: 10, search: 'web', parentId: 'parent-1' });

        const whereArg = (prisma.courseCategory.findMany as jest.Mock).mock.calls[0][0].where;
        expect(whereArg.OR).toBeDefined();
        expect(whereArg.parentId).toBe('parent-1');
        });
    });

    describe('getCategoryById', () => {
        it('should return category with children and published courses', async () => {
        const mockCategory = { id: 'cat-1', name: 'Test', children: [], courses: [] };
        (prisma.courseCategory.findUnique as jest.Mock).mockResolvedValue(mockCategory);

        const result = await categoryService.getCategoryById('cat-1');
        expect(result).toEqual(mockCategory);
        });

        it('should throw 404 if category not found', async () => {
        (prisma.courseCategory.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(categoryService.getCategoryById('bad-id')).rejects.toThrow(AppError);
        });
    });

    describe('updateCategory', () => {
        it('should update category and return result', async () => {
        const mockUpdated = { id: 'cat-1', name: 'Updated' };
        (prisma.courseCategory.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-1' });
        (prisma.courseCategory.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await categoryService.updateCategory('cat-1', { name: 'Updated' });
        expect(prisma.courseCategory.update).toHaveBeenCalledWith({
            where: { id: 'cat-1' },
            data: { name: 'Updated' },
        });
        expect(result).toEqual(mockUpdated);
        });

        it('should throw 404 if category not found', async () => {
        (prisma.courseCategory.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(categoryService.updateCategory('bad-id', {})).rejects.toThrow(AppError);
        });
    });

    describe('deleteCategory', () => {
        it('should soft-delete by setting categoryId to null and delete category', async () => {
        (prisma.courseCategory.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-1' });
        (prisma.course.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
        (prisma.courseCategory.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prisma.courseCategory.delete as jest.Mock).mockResolvedValue({ id: 'cat-1' });
        (prisma.$transaction as jest.Mock).mockImplementation(async (ops: any[]) => {
            for (const op of ops) await op;
        });

        await categoryService.deleteCategory('cat-1');

        expect(prisma.course.updateMany).toHaveBeenCalledWith({
            where: { categoryId: 'cat-1' },
            data: { categoryId: null },
        });
        expect(prisma.courseCategory.updateMany).toHaveBeenCalledWith({
            where: { parentId: 'cat-1' },
            data: { parentId: null },
        });
        expect(prisma.courseCategory.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
        });

        it('should throw 404 if category not found', async () => {
        (prisma.courseCategory.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(categoryService.deleteCategory('bad-id')).rejects.toThrow(AppError);
        });
    });
});