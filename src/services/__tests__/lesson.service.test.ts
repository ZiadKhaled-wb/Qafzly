import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as lessonService from '../lesson.service';

jest.mock('../../config/database', () => ({
    prisma: {
        module: { findUnique: jest.fn() },
        lesson: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        },
    },
}));

describe('Lesson Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createLesson', () => {
        it('should create lesson if module exists', async () => {
        const mockModule = { id: 'mod-1' };
        const mockData = { moduleId: 'mod-1', title: 'Lesson 1' };
        const mockLesson = { id: 'les-1', ...mockData };
        (prisma.module.findUnique as jest.Mock).mockResolvedValue(mockModule);
        (prisma.lesson.create as jest.Mock).mockResolvedValue(mockLesson);

        const result = await lessonService.createLesson(mockData);
        expect(prisma.lesson.create).toHaveBeenCalledWith({ data: mockData });
        expect(result).toEqual(mockLesson);
        });

        it('should throw 404 if module not found', async () => {
        (prisma.module.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(lessonService.createLesson({ moduleId: 'bad' })).rejects.toThrow(AppError);
        });
    });

    describe('listLessonsByModule', () => {
        it('should return published lessons for public', async () => {
        const mockLessons = [{ id: 'l1', title: 'A' }];
        (prisma.lesson.findMany as jest.Mock).mockResolvedValue(mockLessons);
        (prisma.lesson.count as jest.Mock).mockResolvedValue(1);

        const result = await lessonService.listLessonsByModule('mod-1', { page: 1, limit: 10 }, false);
        expect(prisma.lesson.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
            where: expect.objectContaining({ moduleId: 'mod-1', isPublished: true }),
            })
        );
        expect(result.lessons).toHaveLength(1);
        });

        it('should include unpublished for admin', async () => {
        (prisma.lesson.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.lesson.count as jest.Mock).mockResolvedValue(0);

        await lessonService.listLessonsByModule('mod-1', { page: 1, limit: 10, isPublished: undefined }, true);
        const whereArg = (prisma.lesson.findMany as jest.Mock).mock.calls[0][0].where;
        expect(whereArg.isPublished).toBeUndefined();
        });
    });

    describe('getLessonById', () => {
        it('should return lesson with module and quiz questions', async () => {
        const mockLesson = { id: 'l1', module: {}, quizQuestions: [] };
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(mockLesson);

        const result = await lessonService.getLessonById('l1');
        expect(prisma.lesson.findUnique).toHaveBeenCalledWith({
            where: { id: 'l1' },
            include: {
            module: { select: { id: true, title: true, courseId: true } },
            quizQuestions: { orderBy: { order: 'asc' } },
            },
        });
        expect(result).toEqual(mockLesson);
        });

        it('should throw 404 if not found', async () => {
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(lessonService.getLessonById('bad')).rejects.toThrow(AppError);
        });
    });

    describe('updateLesson', () => {
        it('should update lesson', async () => {
        const mockLesson = { id: 'l1', title: 'Updated' };
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'l1' });
        (prisma.lesson.update as jest.Mock).mockResolvedValue(mockLesson);

        const result = await lessonService.updateLesson('l1', { title: 'Updated' });
        expect(prisma.lesson.update).toHaveBeenCalledWith({
            where: { id: 'l1' },
            data: { title: 'Updated' },
        });
        expect(result).toEqual(mockLesson);
        });

        it('should throw 404 if lesson not found', async () => {
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(lessonService.updateLesson('bad', {})).rejects.toThrow(AppError);
        });
    });

    describe('deleteLesson', () => {
        it('should delete lesson', async () => {
        const mockDeleted = { id: 'l1' };
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'l1' });
        (prisma.lesson.delete as jest.Mock).mockResolvedValue(mockDeleted);

        const result = await lessonService.deleteLesson('l1');
        expect(prisma.lesson.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
        expect(result).toEqual(mockDeleted);
        });

        it('should throw 404 if lesson not found', async () => {
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(lessonService.deleteLesson('bad')).rejects.toThrow(AppError);
        });
    });
});