import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as questService from '../services/quest.service';

/**
 * List quest checkpoints for a lesson.
 *
 * Public endpoint with optional auth:
 *   - Anonymous callers get checkpoints without a `completed` flag
 *   - Authenticated callers get checkpoints enriched with their per-checkpoint
 *     `completed` boolean from UserQuestProgress
 *
 * Used by the Lesson Player to render the Mini-Quest timeline. The companion
 * POST /lessons/:lessonId/checkpoints/:checkpointId/complete endpoint handles
 * completions.
 */
export const listCheckpointsForLesson = asyncHandler(async (req: Request, res: Response) => {
    const lessonId = req.params.lessonId as string;
    const userId = (req as any).user?.userId;

    const checkpoints = await questService.getCheckpointsForLesson(lessonId, userId);
    return apiResponse(res, 200, checkpoints, 'نقاط تحقق المهمة');
});

export const createCheckpoint = asyncHandler(async (req: Request, res: Response) => {
    const lessonId = req.params.lessonId;
    const checkpoint = await questService.createCheckpoint((lessonId as string), req.body);
    return apiResponse(res, 201, checkpoint, 'تم إنشاء نقطة التحقق');
});

export const updateCheckpoint = asyncHandler(async (req: Request, res: Response) => {
    const checkpoint = await questService.updateCheckpoint(
        (req.params.checkpointId as string),
        req.body
    );
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
    const result = await questService.completeCheckpoint(
        (lessonId as string),
        (checkpointId as string),
        userId,
        req.body
    );
    return apiResponse(res, 200, result, 'تم إكمال نقطة التحقق');
});