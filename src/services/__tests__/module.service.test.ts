import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as moduleService from '../module.service';

jest.mock('../../config/database', () => ({
    prisma: {
        course: { findUnique: jest.fn() },
        module: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        },
    },
}));

describe('Module Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createModule', () => {
        it('should create module if course exists', async () => {
        const mockCourse = { id: 'course-1' };
        const mockData = { courseId: 'course-1', title: 'Module 1' };
        const mockModule = { id: 'mod-1', ...mockData };
        (prisma.course.findUnique as jest.Mock).mockResolvedValue(mockCourse);
        (prisma.module.create as jest.Mock).mockResolvedValue(mockModule);

        const result = await moduleService.createModule(mockData);
        expect(prisma.module.create).toHaveBeenCalledWith({
            data: mockData,
            include: { course: { select: { id: true, title: true } } },
        });
        expect(result).toEqual(mockModule);
        });

        it('should throw 404 if course not found', async () => {
        (prisma.course.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(moduleService.createModule({ courseId: 'bad' })).rejects.toThrow(AppError);
        });
    });

    describe('listModulesByCourse', () => {
        it('should return published modules for public', async () => {
        const mockModules = [{ id: 'm1', title: 'A' }];
        (prisma.module.findMany as jest.Mock).mockResolvedValue(mockModules);
        (prisma.module.count as jest.Mock).mockResolvedValue(1);

        const result = await moduleService.listModulesByCourse('course-1', { page: 1, limit: 10 }, false);
        expect(prisma.module.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
            where: expect.objectContaining({ courseId: 'course-1', isPublished: true }),
            })
        );
        expect(result.modules).toHaveLength(1);
        });

        it('should include unpublished for admin', async () => {
        (prisma.module.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.module.count as jest.Mock).mockResolvedValue(0);

        await moduleService.listModulesByCourse('course-1', { page: 1, limit: 10, isPublished: undefined }, true);
        const whereArg = (prisma.module.findMany as jest.Mock).mock.calls[0][0].where;
        expect(whereArg.isPublished).toBeUndefined();
        });
    });

    describe('getModuleById', () => {
        it('should return published module for public', async () => {
        const mockModule = { id: 'm1', title: 'Test' };
        (prisma.module.findFirst as jest.Mock).mockResolvedValue(mockModule);

        const result = await moduleService.getModuleById('m1', false);
        expect(prisma.module.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
            where: expect.objectContaining({ id: 'm1', isPublished: true }),
            })
        );
        expect(result).toEqual(mockModule);
        });

        it('should return module for admin even unpublished', async () => {
        const mockModule = { id: 'm1', title: 'Test' };
        (prisma.module.findFirst as jest.Mock).mockResolvedValue(mockModule);
        await moduleService.getModuleById('m1', true);
        const whereArg = (prisma.module.findFirst as jest.Mock).mock.calls[0][0].where;
        expect(whereArg.isPublished).toBeUndefined();
        });

        it('should throw 404 if not found', async () => {
        (prisma.module.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(moduleService.getModuleById('bad', false)).rejects.toThrow(AppError);
        });
    });

    describe('updateModule', () => {
        it('should update module', async () => {
        const mockModule = { id: 'm1', title: 'Updated' };
        (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'm1' });
        (prisma.module.update as jest.Mock).mockResolvedValue(mockModule);

        const result = await moduleService.updateModule('m1', { title: 'Updated' });
        expect(prisma.module.update).toHaveBeenCalledWith({
            where: { id: 'm1' },
            data: { title: 'Updated' },
        });
        expect(result).toEqual(mockModule);
        });

        it('should throw 404 if module not found', async () => {
        (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(moduleService.updateModule('bad', {})).rejects.toThrow(AppError);
        });
    });

    describe('deleteModule', () => {
        it('should delete module', async () => {
        const mockDeleted = { id: 'm1' };
        (prisma.module.findUnique as jest.Mock).mockResolvedValue({ id: 'm1' });
        (prisma.module.delete as jest.Mock).mockResolvedValue(mockDeleted);

        const result = await moduleService.deleteModule('m1');
        expect(prisma.module.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
        expect(result).toEqual(mockDeleted);
        });

        it('should throw 404 if module not found', async () => {
        (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(moduleService.deleteModule('bad')).rejects.toThrow(AppError);
        });
    });
});