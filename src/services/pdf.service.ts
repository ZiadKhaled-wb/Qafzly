import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { getSignedPdfUrl as getSignedS3Url, uploadPdfToS3, deletePdfFromS3 } from './s3.service';

export const getSignedPdfUrl = async (lessonId: string, userId: string) => {
    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: {
            id: true,
            pdfUrl: true,
            isPublished: true,
            module: {
                select: {
                    pathId: true,
                },
            },
        },
    });
    if (!lesson || !lesson.isPublished) throw new AppError(404, 'الدرس غير موجود');
    if (!lesson.pdfUrl) throw new AppError(404, 'لا يوجد ملف PDF لهذا الدرس');

    // Check access: user is enrolled in the corresponding path OR is parent of an enrolled child
    const enrollment = await prisma.enrollment.findUnique({
        where: {
            userId_pathId: {
                userId,
                pathId: lesson.module.pathId,
            },
        },
        select: { id: true },
    });

    if (!enrollment) {
        // Check if user is a parent of an enrolled child
        const child = await prisma.user.findFirst({
            where: {
                parentId: userId,
                deletedAt: null,
                enrollments: {
                    some: {
                        pathId: lesson.module.pathId,
                        isActive: true,
                    },
                },
            },
            select: { id: true },
        });
        if (!child) {
            throw new AppError(403, 'غير مصرح لك بالوصول إلى هذا الملف');
        }
    }

    // Generate signed URL
    const url = await getSignedS3Url(lesson.pdfUrl, 300);
    return { url, expiresIn: 300 };
};

export const uploadLessonPdf = async (lessonId: string, fileBuffer: Buffer, originalName: string) => {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    const key = `lessons/${lessonId}/${Date.now()}-${originalName}`;
    await uploadPdfToS3(key, fileBuffer);

    await prisma.lesson.update({
        where: { id: lessonId },
        data: { pdfUrl: key },
    });

    return { pdfUrl: key };
};

export const deleteLessonPdf = async (lessonId: string) => {
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new AppError(404, 'الدرس غير موجود');

    if (lesson.pdfUrl) {
        await deletePdfFromS3(lesson.pdfUrl);
    }

    await prisma.lesson.update({
        where: { id: lessonId },
        data: { pdfUrl: null },
    });
};