import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import * as userService from '../services/user.service';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const data = await userService.getMe(userId);
    return apiResponse(res, 200, data, 'تم جلب الملف الشخصي بنجاح');
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const updatedUser = await userService.updateProfile(userId, req.body, false);
    return apiResponse(res, 200, { user: updatedUser }, 'تم تحديث الملف الشخصي');
});

export const patchMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const updatedUser = await userService.updateProfile(userId, req.body, true);
    return apiResponse(res, 200, { user: updatedUser }, 'تم تحديث الملف الشخصي');
});

export const deleteMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const result = await userService.deleteMe(userId);
    return apiResponse(res, 200, result, 'تم حذف الحساب بنجاح');
});

export const updatePrivacy = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const result = await userService.updatePrivacy(userId, req.body);
    return apiResponse(res, 200, result, 'تم تحديث إعدادات الخصوصية');
});

export const getPrivacy = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const privacy = await userService.getPrivacy(userId);
    return apiResponse(res, 200, { privacySettings: privacy }, 'تم جلب إعدادات الخصوصية');
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    if (!req.file) {
        throw new AppError(400, 'لم يتم رفع أي ملف');
    }
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    const updated = await userService.updateAvatar(userId, avatarPath);
    return apiResponse(res, 200, { profilePictureUrl: avatarPath }, 'تم تحديث الصورة الشخصية بنجاح');
});

export const removeAvatar = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const updated = await userService.removeAvatar(userId);
    return apiResponse(res, 200, updated, 'تم حذف الصورة الشخصية');
});