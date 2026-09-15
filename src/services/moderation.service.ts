import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { ForumPostStatus, ForumCommentStatus } from '@prisma/client';

/**
 * List pending (or resolved/dismissed) forum reports.
 *
 * Returns reports, not posts. Each report embeds the target (post or comment)
 * and the reporter's identity so moderators have full context without a
 * second round trip.
 */
export const listReports = async (params: any) => {
    const { page, limit, status } = params;
    const where: any = { status: status ?? 'pending' };

    const [reports, total] = await Promise.all([
        prisma.forumReport.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                reporter: { select: { id: true, fullName: true, email: true } },
                resolvedBy: { select: { id: true, fullName: true } },
                post: {
                    select: {
                        id: true,
                        title: true,
                        content: true,
                        status: true,
                        flaggedCount: true,
                        createdAt: true,
                        user: { select: { id: true, fullName: true, email: true } },
                    },
                },
                comment: {
                    select: {
                        id: true,
                        postId: true,
                        content: true,
                        status: true,
                        createdAt: true,
                        user: { select: { id: true, fullName: true, email: true } },
                    },
                },
            },
        }),
        prisma.forumReport.count({ where }),
    ]);

    return {
        reports,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};

/**
 * Mark a report as resolved. Decrements the associated post's flaggedCount
 * so the denormalized counter stays truthful (it now represents "number of
 * pending reports on this post").
 */
export const resolveReport = async (reportId: string, adminId: string) => {
    const report = await prisma.forumReport.findUnique({ where: { id: reportId } });
    if (!report) throw new AppError(404, 'البلاغ غير موجود');
    if (report.status !== 'pending') {
        throw new AppError(409, 'تمت معالجة هذا البلاغ بالفعل');
    }

    await prisma.$transaction(async (tx) => {
        await tx.forumReport.update({
            where: { id: reportId },
            data: {
                status: 'resolved',
                resolvedAt: new Date(),
                resolvedByUserId: adminId,
            },
        });

        if (report.postId) {
            await tx.forumPost.update({
                where: { id: report.postId },
                data: { flaggedCount: { decrement: 1 } },
            });
        }
    });

    return { success: true };
};

export const hidePost = async (postId: string) => {
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, 'المنشور غير موجود');
    await prisma.forumPost.update({
        where: { id: postId },
        data: { status: ForumPostStatus.hidden },
    });
    return { success: true };
};

export const unhidePost = async (postId: string) => {
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, 'المنشور غير موجود');
    await prisma.forumPost.update({
        where: { id: postId },
        data: { status: ForumPostStatus.published },
    });
    return { success: true };
};

export const hideComment = async (commentId: string) => {
    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new AppError(404, 'التعليق غير موجود');
    await prisma.forumComment.update({
        where: { id: commentId },
        data: { status: ForumCommentStatus.hidden },
    });
    return { success: true };
};

export const unhideComment = async (commentId: string) => {
    const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new AppError(404, 'التعليق غير موجود');
    await prisma.forumComment.update({
        where: { id: commentId },
        data: { status: ForumCommentStatus.published },
    });
    return { success: true };
};