import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import * as forumService from '../services/forum.service';

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
    const result = await forumService.listCategories(req.query);
    return apiResponse(res, 200, result.categories, 'تم جلب التصنيفات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const createPost = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const post = await forumService.createPost(userId, req.body);
    return apiResponse(res, 201, post, 'تم إنشاء المنشور بنجاح');
});

export const getPost = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const isAdmin = (req as any).user?.role === 'ADMIN';
    const post = await forumService.getPostById(req.params.id as string, userId, isAdmin);
    return apiResponse(res, 200, post, 'تم جلب المنشور بنجاح');
});

export const listPosts = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const result = await forumService.listPosts(req.query, userId);
    return apiResponse(res, 200, result.posts, 'تم جلب المنشورات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const updatePost = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const isAdmin = (req as any).user.role === 'ADMIN';
    const post = await forumService.updatePost(
        req.params.id as string,
        userId,
        req.body,
        isAdmin
    );
    return apiResponse(res, 200, post, 'تم تحديث المنشور بنجاح');
});

export const deletePost = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const isAdmin = (req as any).user.role === 'ADMIN';
    await forumService.deletePost(req.params.id as string, userId, isAdmin);
    return apiResponse(res, 200, null, 'تم حذف المنشور بنجاح');
});

export const addComment = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const comment = await forumService.addComment(
        req.params.postId as string,
        userId,
        req.body
    );
    return apiResponse(res, 201, comment, 'تم إضافة التعليق بنجاح');
});

export const getComments = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const result = await forumService.getComments(
        req.params.postId as string,
        req.query,
        userId
    );
    return apiResponse(res, 200, result.comments, 'تم جلب التعليقات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const updateComment = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const isAdmin = (req as any).user.role === 'ADMIN';
    const comment = await forumService.updateComment(
        req.params.id as string,
        userId,
        req.body,
        isAdmin
    );
    return apiResponse(res, 200, comment, 'تم تحديث التعليق بنجاح');
});

export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const isAdmin = (req as any).user.role === 'ADMIN';
    await forumService.deleteComment(req.params.id as string, userId, isAdmin);
    return apiResponse(res, 200, null, 'تم حذف التعليق بنجاح');
});

export const upvotePost = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    await forumService.vote('post', req.params.id as string, userId, 1);
    return apiResponse(res, 200, null, 'تم التصويت بنجاح');
});

export const downvotePost = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    await forumService.vote('post', req.params.id as string, userId, -1);
    return apiResponse(res, 200, null, 'تم التصويت بنجاح');
});

export const upvoteComment = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    await forumService.vote('comment', req.params.id as string, userId, 1);
    return apiResponse(res, 200, null, 'تم التصويت بنجاح');
});

export const downvoteComment = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    await forumService.vote('comment', req.params.id as string, userId, -1);
    return apiResponse(res, 200, null, 'تم التصويت بنجاح');
});

export const markBestAnswer = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const post = await forumService.markBestAnswer(
        req.params.id as string,
        req.body.commentId,
        userId
    );
    return apiResponse(res, 200, post, 'تم تحديد أفضل إجابة بنجاح');
});

export const searchPosts = asyncHandler(async (req: Request, res: Response) => {
    const { q, ...pagination } = req.query as any;
    if (!q) throw new AppError(400, 'معامل البحث مطلوب');
    const userId = (req as any).user?.userId;
    const result = await forumService.searchPosts(q, pagination, userId);
    return apiResponse(res, 200, result.posts, 'نتائج البحث', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

// Reporting
export const reportPost = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { reason, details } = req.body;
    const report = await forumService.reportPost(
        req.params.id as string,
        userId,
        reason,
        details
    );
    return apiResponse(res, 201, report, 'تم إرسال البلاغ، شكراً لمساهمتك');
});

export const reportComment = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { reason, details } = req.body;
    const report = await forumService.reportComment(
        req.params.id as string,
        userId,
        reason,
        details
    );
    return apiResponse(res, 201, report, 'تم إرسال البلاغ، شكراً لمساهمتك');
});