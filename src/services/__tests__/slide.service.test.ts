import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as slideService from '../slide.service';
import { awardXpWithRecharge } from '../recharge.service';

jest.mock('../../config/database', () => ({
    prisma: {
        lesson: { findUnique: jest.fn() },
        slide: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        userSlideProgress: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
        },
    },
}));

jest.mock('../recharge.service', () => ({
    awardXpWithRecharge: jest.fn(),
}));

describe('Slide Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createSlide', () => {
        it('should create slide with auto order when order not provided', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'lesson-1' });
            (prisma.slide.count as jest.Mock).mockResolvedValue(2);
            (prisma.slide.create as jest.Mock).mockResolvedValue({ id: 'slide-1', order: 3 });

            const result = await slideService.createSlide('lesson-1', { slideType: 'INFO', titleAr: 'Title' });
            expect(prisma.slide.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ order: 3, xpAward: 5 }) })
            );
            expect(result.id).toBe('slide-1');
        });

        it('should use provided order if given', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'lesson-1' });
            (prisma.slide.create as jest.Mock).mockResolvedValue({ id: 'slide-1', order: 7 });

            await slideService.createSlide('lesson-1', { slideType: 'QUIZ', order: 7, xpAward: 10 });
            expect(prisma.slide.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ order: 7, xpAward: 10 }) })
            );
        });

        it('should throw 404 if lesson not found', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(slideService.createSlide('bad', {})).rejects.toThrow(AppError);
        });
    });

    describe('updateSlide', () => {
        it('should update slide', async () => {
            (prisma.slide.findUnique as jest.Mock).mockResolvedValue({ id: 'slide-1' });
            (prisma.slide.update as jest.Mock).mockResolvedValue({ id: 'slide-1', titleAr: 'Updated' });

            const result = await slideService.updateSlide('slide-1', { titleAr: 'Updated' });
            expect(prisma.slide.update).toHaveBeenCalledWith({ where: { id: 'slide-1' }, data: { titleAr: 'Updated' } });
            expect(result.titleAr).toBe('Updated');
        });

        it('should throw 404 if slide not found', async () => {
            (prisma.slide.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(slideService.updateSlide('bad', {})).rejects.toThrow(AppError);
        });
    });

    describe('deleteSlide', () => {
        it('should delete slide', async () => {
            (prisma.slide.findUnique as jest.Mock).mockResolvedValue({ id: 'slide-1' });
            await slideService.deleteSlide('slide-1');
            expect(prisma.slide.delete).toHaveBeenCalledWith({ where: { id: 'slide-1' } });
        });

        it('should throw 404 if slide not found', async () => {
            (prisma.slide.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(slideService.deleteSlide('bad')).rejects.toThrow(AppError);
        });
    });

    describe('reorderSlides', () => {
        it('should reorder slides successfully', async () => {
            const mockSlides = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
            (prisma.slide.findMany as jest.Mock).mockResolvedValue(mockSlides);
            (prisma.slide.update as jest.Mock).mockResolvedValue({});

            await slideService.reorderSlides('lesson-1', ['s3', 's1', 's2']);

            expect(prisma.slide.update).toHaveBeenCalledTimes(3);
            expect(prisma.slide.update).toHaveBeenNthCalledWith(1, { where: { id: 's3' }, data: { order: 1 } });
            expect(prisma.slide.update).toHaveBeenNthCalledWith(2, { where: { id: 's1' }, data: { order: 2 } });
            expect(prisma.slide.update).toHaveBeenNthCalledWith(3, { where: { id: 's2' }, data: { order: 3 } });
        });

        it('should throw 400 if orderedSlideIds contains unknown id', async () => {
            const mockSlides = [{ id: 's1' }, { id: 's2' }];
            (prisma.slide.findMany as jest.Mock).mockResolvedValue(mockSlides);

            await expect(slideService.reorderSlides('lesson-1', ['s1', 'bad'])).rejects.toThrow(AppError);
        });
    });

    describe('getSlidesForLesson', () => {
        it('should return slides without completion for anonymous', async () => {
            const mockSlides = [{ id: 's1', order: 1 }, { id: 's2', order: 2 }];
            (prisma.slide.findMany as jest.Mock).mockResolvedValue(mockSlides);

            const result = await slideService.getSlidesForLesson('lesson-1');
            expect(result).toEqual(mockSlides);
            expect(prisma.userSlideProgress.findMany).not.toHaveBeenCalled();
        });

        it('should return slides with completion status for user', async () => {
            const mockSlides = [{ id: 's1', order: 1 }, { id: 's2', order: 2 }];
            (prisma.slide.findMany as jest.Mock).mockResolvedValue(mockSlides);
            (prisma.userSlideProgress.findMany as jest.Mock).mockResolvedValue([
                { slideId: 's1', completed: true },
            ]);

            const result = await slideService.getSlidesForLesson('lesson-1', 'user-1') as any[];
            expect(result[0].completed).toBe(true);
            expect(result[1].completed).toBe(false);
        });
    });

    describe('completeSlide', () => {
        it('should award XP via recharge service and mark complete', async () => {
            (prisma.slide.findFirst as jest.Mock).mockResolvedValue({ id: 'slide-1', xpAward: 5 });
            (prisma.userSlideProgress.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.userSlideProgress.upsert as jest.Mock).mockResolvedValue({ slideId: 'slide-1', completed: true, xpEarned: 5 });
            (awardXpWithRecharge as jest.Mock).mockResolvedValue(5);

            const result = await slideService.completeSlide('lesson-1', 'slide-1', 'user-1', {}, true);
            expect(result.xpEarned).toBe(5);
            expect(awardXpWithRecharge).toHaveBeenCalledWith('user-1', 5, 'lesson-1');
        });

        it('should not award XP if isCorrect false', async () => {
            (prisma.slide.findFirst as jest.Mock).mockResolvedValue({ id: 'slide-1', xpAward: 5 });
            (prisma.userSlideProgress.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.userSlideProgress.upsert as jest.Mock).mockResolvedValue({ slideId: 'slide-1', completed: true, xpEarned: 0 });

            const result = await slideService.completeSlide('lesson-1', 'slide-1', 'user-1', {}, false);
            expect(result.xpEarned).toBe(0);
            expect(awardXpWithRecharge).not.toHaveBeenCalled();
        });

        it('should throw 400 if already completed', async () => {
            (prisma.slide.findFirst as jest.Mock).mockResolvedValue({ id: 'slide-1' });
            (prisma.userSlideProgress.findUnique as jest.Mock).mockResolvedValue({ completed: true });
            await expect(slideService.completeSlide('lesson-1', 'slide-1', 'user-1', {}, true)).rejects.toThrow(AppError);
        });

        it('should throw 404 if slide not found', async () => {
            (prisma.slide.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(slideService.completeSlide('lesson-1', 'bad', 'user-1', {}, true)).rejects.toThrow(AppError);
        });
    });
});