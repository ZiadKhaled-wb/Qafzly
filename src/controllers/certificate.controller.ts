import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { apiResponse } from '../utils/apiResponse';
import * as certificateService from '../services/certificate.service';

export const listMyCertificates = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { page, limit } = req.query as any;
    const result = await certificateService.listUserCertificates(userId, { page, limit });
    return apiResponse(res, 200, result.certificates, 'تم جلب الشهادات', null, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
    });
});

export const getCertificate = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const certificate = await certificateService.getCertificateById(
        req.params.id as string,
        user.userId,
        user.role === 'ADMIN'
    );
    return apiResponse(res, 200, certificate, 'تم جلب الشهادة');
});

export const getCertificateDownloadUrl = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const result = await certificateService.getCertificateDownloadUrl(
        req.params.id as string,
        user.userId,
        user.role === 'ADMIN'
    );
    return apiResponse(res, 200, result, 'رابط التحميل');
});

export const verifyCertificate = asyncHandler(async (req: Request, res: Response) => {
    const result = await certificateService.verifyCertificate(req.params.code as string);
    return apiResponse(res, 200, result, result.valid ? 'شهادة صالحة' : 'شهادة غير صالحة');
});

export const adminIssueCertificate = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user.userId;
    const { userId, pathId } = req.body;
    const certificate = await certificateService.adminIssueCertificate(userId, pathId, adminId);
    return apiResponse(res, 201, certificate, 'تم إصدار الشهادة');
});

export const revokeCertificate = asyncHandler(async (req: Request, res: Response) => {
    const { reason } = req.body;
    const certificate = await certificateService.revokeCertificate(req.params.id as string, reason);
    return apiResponse(res, 200, certificate, 'تم إلغاء الشهادة');
});