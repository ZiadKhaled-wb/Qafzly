import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as adminService from '../services/admin.service';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search, role, status } = req.query as any;
    const result = await adminService.listUsers({ page, limit, search, role, status });
    return apiResponse(res, 200, result.users, 'تم جلب المستخدمين', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.getUserById(req.params.id as string);
    return apiResponse(res, 200, user, 'تم جلب بيانات المستخدم');
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.updateUser((req.params.id as string), req.body);
    return apiResponse(res, 200, user, 'تم تحديث المستخدم');
});

export const suspendUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.suspendUser((req.params.id as string), req.body.reason);
    return apiResponse(res, 200, user, 'تم إيقاف المستخدم');
});

export const activateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.activateUser(req.params.id as string);
    return apiResponse(res, 200, user, 'تم تفعيل المستخدم');
});

export const changeRole = asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.changeRole((req.params.id as string), req.body.role);
    return apiResponse(res, 200, user, 'تم تغيير دور المستخدم');
});