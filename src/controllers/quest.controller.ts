import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as questService from '../services/quest.service';

export const createCheckpoint = asyncHandler(async (req: Request, res: Response) => {
    const lessonId = req.params.lessonId;
    const checkpoint = await questService.createCheckpoint((lessonId as string), req.body);
    return apiResponse(res, 201, checkpoint, 'تم إنشاء نقطة التحقق');
});

export const updateCheckpoint = asyncHandler(async (req: Request, res: Response) => {
    const checkpoint = await questService.updateCheckpoint((req.params.checkpointId as string), req.body);
    return apiResponse(res, 200, checkpoint, 'تم تحديث نقطة التحقق');
});

export const deleteCheckpoint = asyncHandler(async (req: Request, res: Response) => {
    await questService.deleteCheckpoint(req.params.checkpointId as string);
    return apiResponse(res, 200, null, 'تم حذف نقطة التحقق');
});

export const reorderCheckpoints = asyncHandler(async (req: Request, res: Response) => {
    const { orderedCheckpointIds } = req.body;
    await questService.reorderCheckpoints((req.params.lessonId as string), orderedCheckpointIds);
    return apiResponse(res, 200, null, 'تم إعادة ترتيب نقاط التحقق');
});

export const completeCheckpoint = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { lessonId, checkpointId } = req.params;
    const result = await questService.completeCheckpoint((lessonId as string), (checkpointId as string), userId, req.body);
    return apiResponse(res, 200, result, 'تم إكمال نقطة التحقق');
});