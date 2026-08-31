import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as authService from '../services/auth.service';

export const register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    return apiResponse(res, 201, result, 'تم إنشاء الحساب بنجاح');
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return apiResponse(res, 200, result, 'تم تسجيل الدخول بنجاح');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    return apiResponse(res, 200, result, 'تم تحديث رمز الوصول');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const result = await authService.logout(userId);
    return apiResponse(res, 200, result, 'تم تسجيل الخروج بنجاح');
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return apiResponse(res, 200, result, 'إذا كان البريد الإلكتروني مسجلاً، فسيصلك رابط إعادة التعيين');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword);
    return apiResponse(res, 200, result, 'تم تغيير كلمة المرور بنجاح');
});