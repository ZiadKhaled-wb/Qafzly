import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as courseService from '../course.service';

jest.mock('../../config/database', () => ({
    prisma: {
        course: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        },
    },
}));

describe('Course Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createCourse', () => {
        it('should create a course with included category', async () => {
        const mockData = { title: 'React', description: 'Learn React' };
        const mockCourse = { id: 'course-1', ...mockData, category: null };
        (prisma.course.create as jest.Mock).mockResolvedValue(mockCourse);

        const result = await courseService.createCourse(mockData);
        expect(prisma.course.create).toHaveBeenCalledWith({
            data: mockData,
            include: { category: true },
        });
        expect(result).toEqual(mockCourse);
        });
    });

    describe('listCourses', () => {
        it('should return paginated courses for public (only published)', async () => {
        const mockCourses = [{ id: 'c1', title: 'A', isPublished: true }];
        (prisma.course.findMany as jest.Mock).mockResolvedValue(mockCourses);
        (prisma.course.count as jest.Mock).mockResolvedValue(1);

        const params = { page: 1, limit: 10, search: '', categoryId: null, difficulty: null, isPublished: undefined };
        const result = await courseService.listCourses(params, false);

        expect(prisma.course.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
            where: expect.objectContaining({ isPublished: true, deletedAt: null }),
            })
        );
        expect(result.courses).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.totalPages).toBe(1);
        });

        it('should include unpublished for admin when isAdmin=true', async () => {
        (prisma.course.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.course.count as jest.Mock).mockResolvedValue(0);

        await courseService.listCourses({ page: 1, limit: 10, search: '', categoryId: null, difficulty: null }, true);

        const whereArg = (prisma.course.findMany as jest.Mock).mock.calls[0][0].where;
        expect(whereArg.isPublished).toBeUndefined(); // admin sees all
        expect(whereArg.deletedAt).toBeNull();
        });

        it('should apply filters correctly', async () => {
        (prisma.course.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.course.count as jest.Mock).mockResolvedValue(0);

        const params = {
            page: 1,
            limit: 10,
            search: 'react',
            categoryId: 'cat-1',
            difficulty: 'BEGINNER',
            minPrice: 0,
            maxPrice: 100,
            isPublished: true,
            sortBy: 'price',
            order: 'asc'
        };
        await courseService.listCourses(params, false);

        const whereArg = (prisma.course.findMany as jest.Mock).mock.calls[0][0].where;
        expect(whereArg.OR).toBeDefined();
        expect(whereArg.categoryId).toBe('cat-1');
        expect(whereArg.difficulty).toBe('BEGINNER');
        expect(whereArg.price).toEqual({ gte: 0, lte: 100 });
        expect(whereArg.isPublished).toBe(true);
        });
    });

    describe('getCourseById', () => {
        it('should return published course for non-admin', async () => {
        const mockCourse = { id: 'c1', title: 'Test', isPublished: true };
        (prisma.course.findFirst as jest.Mock).mockResolvedValue(mockCourse);

        const result = await courseService.getCourseById('c1', false);
        expect(prisma.course.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
            where: expect.objectContaining({ id: 'c1', isPublished: true, deletedAt: null }),
            })
        );
        expect(result).toEqual(mockCourse);
        });

        it('should return course even if unpublished for admin', async () => {
        const mockCourse = { id: 'c1', title: 'Test', isPublished: false };
        (prisma.course.findFirst as jest.Mock).mockResolvedValue(mockCourse);

        await courseService.getCourseById('c1', true);
        const whereArg = (prisma.course.findFirst as jest.Mock).mock.calls[0][0].where;
        expect(whereArg.isPublished).toBeUndefined();
        expect(whereArg.deletedAt).toBeNull();
        });

        it('should throw 404 if not found', async () => {
        (prisma.course.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(courseService.getCourseById('bad-id', false)).rejects.toThrow(AppError);
        });
    });

    describe('updateCourse', () => {
        it('should update course and return result', async () => {
        const mockCourse = { id: 'c1', title: 'Updated' };
        (prisma.course.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' });
        (prisma.course.update as jest.Mock).mockResolvedValue(mockCourse);

        const result = await courseService.updateCourse('c1', { title: 'Updated' });
        expect(prisma.course.update).toHaveBeenCalledWith({
            where: { id: 'c1' },
            data: { title: 'Updated' },
            include: { category: true },
        });
        expect(result).toEqual(mockCourse);
        });

        it('should throw 404 if course not found', async () => {
        (prisma.course.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(courseService.updateCourse('bad-id', {})).rejects.toThrow(AppError);
        });
    });

    describe('deleteCourse', () => {
        it('should soft-delete course by setting deletedAt and unpublish', async () => {
        const mockCourse = { id: 'c1', deletedAt: new Date(), isPublished: false };
        (prisma.course.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' });
        (prisma.course.update as jest.Mock).mockResolvedValue(mockCourse);

        const result = await courseService.deleteCourse('c1');
        expect(prisma.course.update).toHaveBeenCalledWith({
            where: { id: 'c1' },
            data: { deletedAt: expect.any(Date), isPublished: false },
        });
        expect(result).toEqual(mockCourse);
        });

        it('should throw 404 if course not found', async () => {
        (prisma.course.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(courseService.deleteCourse('bad-id')).rejects.toThrow(AppError);
        });
    });

    describe('publishCourse', () => {
        it('should update isPublished', async () => {
        const mockCourse = { id: 'c1', isPublished: true };
        (prisma.course.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' });
        (prisma.course.update as jest.Mock).mockResolvedValue(mockCourse);

        const result = await courseService.publishCourse('c1', true);
        expect(prisma.course.update).toHaveBeenCalledWith({
            where: { id: 'c1' },
            data: { isPublished: true },
        });
        expect(result).toEqual(mockCourse);
        });
    });
});