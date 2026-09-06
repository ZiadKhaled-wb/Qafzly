import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const listLessons = async (moduleId: string) => {
    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) throw new AppError(404, 'الوحدة غير موجودة');

    return prisma.lesson.findMany({
        where: { moduleId, isPublished: true },
        orderBy: { order: 'asc' },
        select: {
        id: true,
        title: true,
        titleEn: true,
        contentType: true,
        videoUrl: true,
        isPreview: true,
        estimatedTime: true,
        order: true,
        overviewVideoUrl: true,
        pdfUrl: true,
        explanatoryVideoUrl: true,
        challengeType: true,
        lockDurationHours: true,
        },
    });
};

export const getLessonById = async (id: string, userId?: string) => {
    const lesson = await prisma.lesson.findUnique({
        where: { id },
        include: {
        quizQuestions: true,
        module: {
            select: {
            id: true,
            title: true,
            pathId: true,
            },
        },
        },
    });
    if (!lesson || !lesson.isPublished) throw new AppError(404, 'الدرس غير موجود');

    let lockStatus = null;
    if (userId) {
        lockStatus = await getLessonLockStatus(id, userId);
    }

    return { ...lesson, lockStatus };
};

export const createLesson = async (data: any) => {
    const module = await prisma.module.findUnique({ where: { id: data.moduleId } });
    if (!module) throw new AppError(404, 'الوحدة غير موجودة');

    return prisma.lesson.create({
        data: {
            moduleId: data.moduleId,
            title: data.title,
            titleEn: data.titleEn,
            content: data.content,
            contentEn: data.contentEn,
            contentType: data.contentType || 'TEXT',
            videoUrl: data.videoUrl,
            videoDuration: data.videoDuration,
            hasQuiz: data.hasQuiz,
            order: data.order,
            isPreview: data.isPreview,
            isPublished: data.isPublished,
            estimatedTime: data.estimatedTime,
            overviewVideoUrl: data.overviewVideoUrl,
            pdfUrl: data.pdfUrl,
            explanatoryVideoUrl: data.explanatoryVideoUrl,
            slidesJson: data.slidesJson,
            challengeDescription: data.challengeDescription,
            challengeType: data.challengeType || 'quiz',
            challengeData: data.challengeData,
            lockDurationHours: data.lockDurationHours ?? 12,
        },
    });
};

export const updateLesson = async (id: string, data: any) => {
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    return prisma.lesson.update({
        where: { id },
        data: {
        ...data,
        },
    });
};

export const deleteLesson = async (id: string) => {
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    return prisma.lesson.delete({ where: { id } });
};
// -------------------------------
// Lock Logic
// -------------------------------

export const getLessonLockStatus = async (lessonId: string, userId: string) => {
    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { module: { include: { lessons: { orderBy: { order: 'asc' } } } } },
    });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    // If it's the first lesson in the module, no lock
    const lessons = lesson.module.lessons;
    const lessonIndex = lessons.findIndex(l => l.id === lessonId);
    if (lessonIndex <= 0) {
        return { isLocked: false, remainingSeconds: 0, message: 'الدرس متاح' };
    }

    const previousLesson = lessons[lessonIndex - 1];

    // Check previous lesson completion
    const prevProgress = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId: previousLesson.id } },
    });

    if (!prevProgress || !prevProgress.completed) {
        return { isLocked: true, remainingSeconds: null, message: 'يجب إكمال الدرس السابق أولاً' };
    }

    // Check parent override for custom lock duration
    let lockDuration = lesson.lockDurationHours; // current lesson's lock duration? Actually should be previous lesson's lock duration? Handoff says lock_duration_hours on lesson, but lock applies after previous lesson completion.
    // We'll use the current lesson's lockDurationHours as the delay after previous lesson completion? Or previous lesson's lock? Typically next lesson becomes available after lock_duration_hours of the completed lesson. We'll use previousLesson.lockDurationHours.
    lockDuration = previousLesson.lockDurationHours;

    // Fetch parent settings if user has a parent
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { parentId: true },
    });

    if (user?.parentId) {
        const settings = await prisma.childSettings.findUnique({
        where: { parentId_childId: { parentId: user.parentId, childId: userId } },
        });
        if (settings?.lockOverrideEnabled) {
        lockDuration = settings.customLockDurationHours ?? 0; // 0 means no lock
        }
    }

    if (lockDuration === 0) {
        return { isLocked: false, remainingSeconds: 0, message: 'قفل معطل من قبل ولي الأمر' };
    }

    const completedAt = prevProgress.completedAt ?? prevProgress.lastAccessedAt ?? new Date();
    const unlockTime = new Date(completedAt.getTime() + lockDuration * 60 * 60 * 1000);
    const now = new Date();
    const remainingMs = unlockTime.getTime() - now.getTime();

    if (remainingMs > 0) {
        return { isLocked: true, remainingSeconds: Math.ceil(remainingMs / 1000), message: 'الدرس مقفل مؤقتًا' };
    }

    return { isLocked: false, remainingSeconds: 0, message: 'الدرس متاح' };
};