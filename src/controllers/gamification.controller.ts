import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as gamificationService from '../services/gamification.service';

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const profile = await gamificationService.getProfile(userId);
    return apiResponse(res, 200, profile, 'تم جلب ملف التعلم');
});

export const getUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const profile = await gamificationService.getProfile(userId as string);
    return apiResponse(res, 200, profile, 'تم جلب ملف التعلم');
});

export const getXpHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { page, limit } = req.query as any;
    const result = await gamificationService.getXpHistory(userId, page, limit);
    return apiResponse(res, 200, result.logs, 'سجل النقاط', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const getLevels = asyncHandler(async (req: Request, res: Response) => {
    const levels = await gamificationService.getLevels();
    return apiResponse(res, 200, levels, 'مستويات المنصة');
});

export const getBadges = asyncHandler(async (req: Request, res: Response) => {
    const badges = await gamificationService.getBadges();
    return apiResponse(res, 200, badges, 'الشارات المتاحة');
});

export const getMyBadges = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const badges = await gamificationService.getUserBadges(userId);
    return apiResponse(res, 200, badges, 'شاراتك');
});

export const getUserBadges = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const badges = await gamificationService.getUserBadges(userId as string);
    return apiResponse(res, 200, badges, 'شارات المستخدم');
});

export const getLeaderboard = asyncHandler(async (req: Request, res: Response) => {
    const { scope, courseId, page, limit } = req.query as any;
    const result = await gamificationService.getLeaderboard(scope, courseId, page, limit);
    return apiResponse(res, 200, result.leaderboard, 'لوحة الصدارة', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const getMyStreak = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const streak = await gamificationService.getStreak(userId);
    return apiResponse(res, 200, streak, 'معلومات السلسلة');
});

export const getDailyQuests = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const quests = await gamificationService.getDailyQuests(userId);
    return apiResponse(res, 200, quests, 'المهام اليومية');
});

export const completeDailyQuest = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { questId } = req.params;
    const result = await gamificationService.completeDailyQuest(userId, questId as string);
    return apiResponse(res, 200, result, 'تم إكمال المهمة');
});

export const freezeStreak = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const result = await gamificationService.freezeStreak(userId);
    return apiResponse(res, 200, result, 'تم استخدام تجميد السلسلة');
});