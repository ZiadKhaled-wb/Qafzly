import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as bossBattleService from '../services/bossBattle.service';

export const createBossBattle = asyncHandler(async (req: Request, res: Response) => {
    const { moduleId } = req.params;
    const bossBattle = await bossBattleService.createBossBattle((moduleId as string), req.body);
    return apiResponse(res, 201, bossBattle, 'تم إنشاء معركة الزعيم');
});

export const updateBossBattle = asyncHandler(async (req: Request, res: Response) => {
    const bossBattle = await bossBattleService.updateBossBattle((req.params.battleId as string), req.body);
    return apiResponse(res, 200, bossBattle, 'تم تحديث معركة الزعيم');
});

export const deleteBossBattle = asyncHandler(async (req: Request, res: Response) => {
    await bossBattleService.deleteBossBattle(req.params.battleId as string);
    return apiResponse(res, 200, null, 'تم حذف معركة الزعيم');
});

export const getBossBattle = asyncHandler(async (req: Request, res: Response) => {
    const { moduleId } = req.params;
    const userId = (req as any).user?.userId;
    const result = await bossBattleService.getBossBattle((moduleId as string), userId);
    return apiResponse(res, 200, result, 'بيانات معركة الزعيم');
});

export const submitBossBattle = asyncHandler(async (req: Request, res: Response) => {
    const { moduleId } = req.params;
    const userId = (req as any).user.userId;
    const result = await bossBattleService.submitBossBattle((moduleId as string), userId, req.body.answers);
    return apiResponse(res, 200, result, 'مبروك! هزمت الوحش!');
});