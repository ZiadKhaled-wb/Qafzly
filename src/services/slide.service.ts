import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { awardXpWithRecharge } from './recharge.service';

export const createSlide = async (lessonId: string, data: any) => {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    const order = data.order ?? (await prisma.slide.count({ where: { lessonId } })) + 1;

    return prisma.slide.create({
        data: {
        lessonId,
        slideType: data.slideType,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        bodyAr: data.bodyAr,
        bodyEn: data.bodyEn,
        questionAr: data.questionAr,
        questionEn: data.questionEn,
        optionsJson: data.optionsJson,
        correctIndex: data.correctIndex,
        explanationAr: data.explanationAr,
        explanationEn: data.explanationEn,
        instructionAr: data.instructionAr,
        instructionEn: data.instructionEn,
        itemsJson: data.itemsJson,
        statementAr: data.statementAr,
        statementEn: data.statementEn,
        correctAnswer: data.correctAnswer,
        sentenceAr: data.sentenceAr,
        sentenceEn: data.sentenceEn,
        acceptedAnswersJson: data.acceptedAnswersJson,
        xpAward: data.xpAward ?? 5,
        order,
        },
    });
};

export const updateSlide = async (slideId: string, data: any) => {
    const slide = await prisma.slide.findUnique({ where: { id: slideId } });
    if (!slide) throw new AppError(404, 'الشريحة غير موجودة');

    return prisma.slide.update({
        where: { id: slideId },
        data,
    });
};

export const deleteSlide = async (slideId: string) => {
    const slide = await prisma.slide.findUnique({ where: { id: slideId } });
    if (!slide) throw new AppError(404, 'الشريحة غير موجودة');

    await prisma.slide.delete({ where: { id: slideId } });
};

export const reorderSlides = async (lessonId: string, orderedSlideIds: string[]) => {
    const slides = await prisma.slide.findMany({ where: { lessonId } });
    const slideMap = new Map(slides.map(s => [s.id, s]));

    for (let i = 0; i < orderedSlideIds.length; i++) {
        const id = orderedSlideIds[i];
        if (!slideMap.has(id)) throw new AppError(400, 'قائمة الشرائح غير صحيحة');
        await prisma.slide.update({
        where: { id },
        data: { order: i + 1 },
        });
    }
};

export const getSlidesForLesson = async (lessonId: string, userId?: string) => {
    const slides = await prisma.slide.findMany({
        where: { lessonId },
        orderBy: { order: 'asc' },
    });

    if (!userId) return slides;

    const progress = await prisma.userSlideProgress.findMany({
        where: { userId, lessonId },
        select: { slideId: true, completed: true },
    });
    const progressMap = new Map(progress.map(p => [p.slideId, p.completed]));

    return slides.map(slide => ({
        ...slide,
        completed: progressMap.get(slide.id) ?? false,
    }));
};

export const completeSlide = async (lessonId: string, slideId: string, userId: string, answer: any, isCorrect: boolean) => {
    const slide = await prisma.slide.findFirst({
        where: { id: slideId, lessonId },
    });
    if (!slide) throw new AppError(404, 'الشريحة غير موجودة');

    const existing = await prisma.userSlideProgress.findUnique({
        where: { userId_slideId: { userId, slideId } },
    });
    if (existing?.completed) throw new AppError(400, 'تم إكمال هذه الشريحة بالفعل');

    const xpEarned = isCorrect ? slide.xpAward : 0;

    await prisma.userSlideProgress.upsert({
        where: { userId_slideId: { userId, slideId } },
        update: { completed: true, completedAt: new Date(), xpEarned },
        create: {
        userId,
        lessonId,
        slideId,
        completed: true,
        completedAt: new Date(),
        xpEarned,
        },
    });

    if (xpEarned > 0) {
        await awardXpWithRecharge(userId, xpEarned, lessonId);
    }

    return {
        slideId,
        completed: true,
        xpEarned,
    };
};