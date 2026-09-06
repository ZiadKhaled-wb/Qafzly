import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export const getSignedPdfUrl = async (lessonId: string) => {
    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { id: true, pdfUrl: true, isPublished: true },
    });
    if (!lesson || !lesson.isPublished) throw new AppError(404, 'الدرس غير موجود');
    if (!lesson.pdfUrl) throw new AppError(404, 'لا يوجد ملف PDF لهذا الدرس');

    // For MVP, we simply return the stored URL/path.
    // When AWS S3 is configured, replace this with actual signed URL generation.
    return {
        url: lesson.pdfUrl,
        expiresIn: 300, // 5 minutes
    };
};