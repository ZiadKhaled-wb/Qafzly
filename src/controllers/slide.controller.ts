import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as slideService from '../services/slide.service';

export const createSlide = asyncHandler(async (req: Request, res: Response) => {
    const lessonId = req.params.lessonId;
    const slide = await slideService.createSlide((lessonId as string), req.body);
    return apiResponse(res, 201, slide, 'تم إنشاء الشريحة');
});

export const updateSlide = asyncHandler(async (req: Request, res: Response) => {
    const slide = await slideService.updateSlide((req.params.slideId as string), req.body);
    return apiResponse(res, 200, slide, 'تم تحديث الشريحة');
});

export const deleteSlide = asyncHandler(async (req: Request, res: Response) => {
    await slideService.deleteSlide(req.params.slideId as string);
    return apiResponse(res, 200, null, 'تم حذف الشريحة');
});

export const reorderSlides = asyncHandler(async (req: Request, res: Response) => {
    const { orderedSlideIds } = req.body;
    await slideService.reorderSlides((req.params.lessonId as string), orderedSlideIds);
    return apiResponse(res, 200, null, 'تم إعادة ترتيب الشرائح');
});

export const completeSlide = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { lessonId, slideId } = req.params;
    const { answer, isCorrect } = req.body;
    const result = await slideService.completeSlide((lessonId as string), (slideId as string), userId, answer, isCorrect);
    return apiResponse(res, 200, result, 'تم إكمال الشريحة');
});