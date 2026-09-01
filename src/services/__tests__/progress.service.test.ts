import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as progressService from '../progress.service';

jest.mock('../../config/database', () => ({
    prisma: {
        lesson: {
        findUnique: jest.fn(),
        },
        lessonProgress: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        },
        course: {
        findUnique: jest.fn(),
        },
        module: {
        findMany: jest.fn(),
        },
    },
}));

describe('Progress Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('updateLessonProgress', () => {
        it('should create progress if not exists', async () => {
        const userId = 'user-1';
        const lessonId = 'lesson-1';
        const data = { completed: true, timeSpent: 60, quizScore: 80 };
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: lessonId });
        (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue(null);
        const mockCreated = { id: 'prog-1', ...data };
        (prisma.lessonProgress.create as jest.Mock).mockResolvedValue(mockCreated);

        const result = await progressService.updateLessonProgress(userId, lessonId, data);
        expect(prisma.lessonProgress.create).toHaveBeenCalledWith({
            data: {
            userId,
            lessonId,
            completed: true,
            timeSpent: 60,
            quizScore: 80,
            },
        });
        expect(result).toEqual(mockCreated);
        });

        it('should update existing progress', async () => {
        const existing = { id: 'prog-1', completed: false, timeSpent: 10, quizScore: null };
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'lesson-1' });
        (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue(existing);
        const mockUpdated = { id: 'prog-1', completed: true, timeSpent: 60, quizScore: 80 };
        (prisma.lessonProgress.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await progressService.updateLessonProgress('user-1', 'lesson-1', { completed: true, timeSpent: 60, quizScore: 80 });
        expect(prisma.lessonProgress.update).toHaveBeenCalledWith({
            where: { id: 'prog-1' },
            data: {
            completed: true,
            timeSpent: 60,
            quizScore: 80,
            lastAccessedAt: expect.any(Date),
            },
        });
        expect(result).toEqual(mockUpdated);
        });

        it('should throw 404 if lesson not found', async () => {
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(progressService.updateLessonProgress('user-1', 'bad', {})).rejects.toThrow(AppError);
        });
    });

    describe('getCourseProgress', () => {
        it('should return progress summary', async () => {
        const userId = 'user-1';
        const courseId = 'course-1';
        const mockCourse = { id: courseId };
        const mockModules = [
            {
            id: 'mod-1',
            lessons: [
                { id: 'l1', title: 'Lesson 1', order: 1, progress: [{ completed: true }] },
                { id: 'l2', title: 'Lesson 2', order: 2, progress: [] },
            ],
            },
            {
            id: 'mod-2',
            lessons: [{ id: 'l3', title: 'Lesson 3', order: 1, progress: [{ completed: true }] }],
            },
        ];
        (prisma.course.findUnique as jest.Mock).mockResolvedValue(mockCourse);
        (prisma.module.findMany as jest.Mock).mockResolvedValue(mockModules);

        const result = await progressService.getCourseProgress(userId, courseId);
        expect(result.totalLessons).toBe(3);
        expect(result.completedLessons).toBe(2);
        expect(result.progressPercent).toBe(67); // 2/3*100
        });

        it('should throw 404 if course not found', async () => {
        (prisma.course.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(progressService.getCourseProgress('user-1', 'bad-course')).rejects.toThrow(AppError);
        });
    });
});