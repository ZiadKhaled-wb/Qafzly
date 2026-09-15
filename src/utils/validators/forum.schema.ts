import { z } from 'zod';

export const listCategoriesSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
        isActive: z.boolean().optional(),
    }),
});

export const createPostSchema = z.object({
    body: z.object({
        title: z.string().min(3, 'العنوان يجب ألا يقل عن 3 أحرف').max(255),
        content: z.string().min(10, 'المحتوى يجب ألا يقل عن 10 أحرف'),
        categoryId: z.string().uuid().optional(),
        pathId: z.string().uuid().optional(),
        lessonId: z.string().uuid().optional(),
    }),
});

export const updatePostSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(255).optional(),
        content: z.string().min(10).optional(),
        categoryId: z.string().uuid().nullable().optional(),
    }),
    params: z.object({
        id: z.string().uuid('معرف المنشور غير صالح'),
    }),
});

export const createCommentSchema = z.object({
    body: z.object({
        content: z.string().min(1, 'التعليق لا يمكن أن يكون فارغاً'),
        parentCommentId: z.string().uuid().optional(),
    }),
    params: z.object({
        postId: z.string().uuid('معرف المنشور غير صالح'),
    }),
});

export const updateCommentSchema = z.object({
    body: z.object({
        content: z.string().min(1).optional(),
    }),
    params: z.object({
        id: z.string().uuid('معرف التعليق غير صالح'),
    }),
});

export const voteSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف غير صالح'),
    }),
});

export const markBestAnswerSchema = z.object({
    body: z.object({
        commentId: z.string().uuid('معرف التعليق غير صالح'),
    }),
    params: z.object({
        id: z.string().uuid('معرف المنشور غير صالح'),
    }),
});

export const reportSchema = z.object({
    body: z.object({
        reason: z.string().min(1, 'سبب التبليغ مطلوب').max(500),
    }),
    params: z.object({
        id: z.string().uuid('معرف المنشور غير صالح'),
    }),
});

export const listPostsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        categoryId: z.string().uuid().optional(),
        pathId: z.string().uuid().optional(),
        lessonId: z.string().uuid().optional(),
        status: z.enum(['published', 'hidden', 'deleted']).optional(),
        search: z.string().optional(),
        sortBy: z.enum(['createdAt', 'upvotes', 'viewCount']).default('createdAt'),
        order: z.enum(['asc', 'desc']).default('desc'),
    }),
});

export const listCommentsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

// -----------------------------------------------------------------------------
// Reporting
// -----------------------------------------------------------------------------

const reportReasonEnum = z.enum(
    ['spam', 'harassment', 'inappropriate', 'misinformation', 'off-topic', 'other'],
    { error: 'سبب الإبلاغ غير صالح' }
);

export const reportPostSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف المنشور غير صالح'),
    }),
    body: z.object({
        reason: reportReasonEnum,
        details: z.string().max(500, 'التفاصيل يجب أن تكون 500 حرف أو أقل').optional(),
    }),
});

export const reportCommentSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف التعليق غير صالح'),
    }),
    body: z.object({
        reason: reportReasonEnum,
        details: z.string().max(500, 'التفاصيل يجب أن تكون 500 حرف أو أقل').optional(),
    }),
});

export const listReportsQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        status: z.enum(['pending', 'resolved', 'dismissed']).default('pending'),
    }),
});

export const resolveReportSchema = z.object({
    params: z.object({
        id: z.string().uuid('معرف البلاغ غير صالح'),
    }),
});