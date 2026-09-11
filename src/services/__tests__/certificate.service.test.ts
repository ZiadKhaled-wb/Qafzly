import { prisma } from '../../config/database';
import * as certificateService from '../certificate.service';
import * as pdfService from '../certificatePdf.service';
import * as storageService from '../certificateStorage.service';
import * as emailService from '../email.service';
import { AppError } from '../../utils/AppError';

jest.mock('../../config/database', () => ({
    prisma: {
        certificate: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        lesson: { findUnique: jest.fn(), count: jest.fn() },
        lessonProgress: { count: jest.fn() },
        user: { findUnique: jest.fn() },
        path: { findUnique: jest.fn() },
    },
}));

jest.mock('../../config/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env', () => ({
    config: { frontendUrl: 'http://test.local' },
}));

jest.mock('../certificatePdf.service', () => ({
    generateCertificatePdf: jest.fn().mockResolvedValue(Buffer.from('fake-pdf')),
}));

jest.mock('../certificateStorage.service', () => ({
    storeCertificatePdf: jest.fn().mockResolvedValue('/uploads/certificates/uid/QFLZ-TEST-CODE.pdf'),
}));

jest.mock('../email.service', () => ({
    sendCertificateIssuedEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('Certificate Service', () => {
    beforeEach(() => jest.clearAllMocks());

    // ------------------------------------------------------------------
    // tryAutoIssueCertificate
    // ------------------------------------------------------------------
    describe('tryAutoIssueCertificate', () => {
        it('returns null when a certificate already exists', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

            const result = await certificateService.tryAutoIssueCertificate('u1', 'p1');

            expect(result).toBeNull();
            expect(prisma.lesson.count).not.toHaveBeenCalled();
        });

        it('returns null when not all lessons are completed', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.lesson.count as jest.Mock).mockResolvedValue(5);
            (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(3);

            const result = await certificateService.tryAutoIssueCertificate('u1', 'p1');

            expect(result).toBeNull();
            expect(prisma.certificate.create).not.toHaveBeenCalled();
        });

        it('returns null when the path has zero published lessons', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.lesson.count as jest.Mock).mockResolvedValue(0);
            (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(0);

            const result = await certificateService.tryAutoIssueCertificate('u1', 'p1');

            expect(result).toBeNull();
            expect(prisma.certificate.create).not.toHaveBeenCalled();
        });

        it('issues a certificate when all lessons are complete', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.lesson.count as jest.Mock).mockResolvedValue(5);
            (prisma.lessonProgress.count as jest.Mock).mockResolvedValue(5);
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                email: 'test@test.com',
                fullName: 'أحمد',
            });
            (prisma.path.findUnique as jest.Mock).mockResolvedValue({ title: 'مسار' });
            (prisma.certificate.create as jest.Mock).mockResolvedValue({
                id: 'cert-1',
                certificateCode: 'QFLZ-ABCD-EFGH',
                userId: 'u1',
            });

            const result = await certificateService.tryAutoIssueCertificate('u1', 'p1');

            expect(result).toEqual(
                expect.objectContaining({ id: 'cert-1', certificateCode: 'QFLZ-ABCD-EFGH' })
            );
            expect(prisma.certificate.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'u1',
                    pathId: 'p1',
                    certificateCode: expect.stringMatching(/^QFLZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
                    metadata: {
                        userName: 'أحمد',
                        pathTitle: 'مسار',
                        completedLessons: 5,
                    },
                }),
            });
        });

        it('returns null on unexpected errors (never throws)', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockRejectedValue(new Error('DB down'));

            const result = await certificateService.tryAutoIssueCertificate('u1', 'p1');

            expect(result).toBeNull();
        });
    });

    // ------------------------------------------------------------------
    // tryAutoIssueCertificateForLesson
    // ------------------------------------------------------------------
    describe('tryAutoIssueCertificateForLesson', () => {
        it('resolves the parent path from the lesson', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
                module: { pathId: 'p1' },
            });
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue({ id: 'cert-1' });

            const result = await certificateService.tryAutoIssueCertificateForLesson('u1', 'l1');

            expect(prisma.lesson.findUnique).toHaveBeenCalledWith({
                where: { id: 'l1' },
                select: { module: { select: { pathId: true } } },
            });
            expect(result).toBeNull(); // existing cert → null
        });

        it('returns null when the lesson is missing', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue(null);
            const result = await certificateService.tryAutoIssueCertificateForLesson('u1', 'missing');
            expect(result).toBeNull();
        });
    });

    // ------------------------------------------------------------------
    // verifyCertificate
    // ------------------------------------------------------------------
    describe('verifyCertificate', () => {
        it('returns valid=true for a valid certificate', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue({
                certificateCode: 'QFLZ-ABCD-EFGH',
                issuedAt: new Date('2026-01-01'),
                revokedAt: null,
                revokedReason: null,
                user: { fullName: 'أحمد' },
                path: { title: 'مسار' },
            });

            const result = await certificateService.verifyCertificate('QFLZ-ABCD-EFGH');

            expect(result.valid).toBe(true);
            if (result.valid) {
                expect(result.certificate.recipientName).toBe('أحمد');
                expect(result.certificate.certificateCode).toBe('QFLZ-ABCD-EFGH');
            }
        });

        it('returns valid=false/REVOKED for a revoked certificate', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue({
                certificateCode: 'QFLZ-ABCD-EFGH',
                issuedAt: new Date('2026-01-01'),
                revokedAt: new Date('2026-02-01'),
                revokedReason: 'تم إلغاء الشهادة',
                user: { fullName: 'أحمد' },
                path: { title: 'مسار' },
            });

            const result = await certificateService.verifyCertificate('QFLZ-ABCD-EFGH');

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.reason).toBe('REVOKED');
            }
        });

        it('returns valid=false/NOT_FOUND for an unknown code', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue(null);
            const result = await certificateService.verifyCertificate('QFLZ-XXXX-XXXX');
            expect(result.valid).toBe(false);
            if (!result.valid) expect(result.reason).toBe('NOT_FOUND');
        });
    });

    // ------------------------------------------------------------------
    // getCertificateById
    // ------------------------------------------------------------------
    describe('getCertificateById', () => {
        const baseCert = {
            id: 'cert-1',
            userId: 'owner',
            certificateCode: 'QFLZ-ABCD-EFGH',
            pdfPath: '/uploads/certificates/owner/QFLZ-ABCD-EFGH.pdf',
            revokedAt: null,
            path: { id: 'p1', title: 'مسار' },
            user: { id: 'owner', fullName: 'أحمد' },
        };

        it('returns the certificate for the owner', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue(baseCert);
            const result = await certificateService.getCertificateById('cert-1', 'owner', false);
            expect(result.id).toBe('cert-1');
        });

        it('returns the certificate for an admin even if not owner', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue(baseCert);
            const result = await certificateService.getCertificateById('cert-1', 'admin-id', true);
            expect(result.id).toBe('cert-1');
        });

        it('throws 403 for a non-owner non-admin', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue(baseCert);
            await expect(
                certificateService.getCertificateById('cert-1', 'someone-else', false)
            ).rejects.toThrow(AppError);
        });

        it('throws 404 when the certificate does not exist', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(
                certificateService.getCertificateById('missing', 'u1', false)
            ).rejects.toThrow(AppError);
        });
    });

    // ------------------------------------------------------------------
    // revokeCertificate
    // ------------------------------------------------------------------
    describe('revokeCertificate', () => {
        it('sets revokedAt and revokedReason', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue({
                id: 'cert-1',
                revokedAt: null,
            });
            (prisma.certificate.update as jest.Mock).mockResolvedValue({
                id: 'cert-1',
                revokedAt: new Date(),
                revokedReason: 'سبب',
            });

            const result = await certificateService.revokeCertificate('cert-1', 'سبب');

            expect(result.revokedReason).toBe('سبب');
            expect(prisma.certificate.update).toHaveBeenCalledWith({
                where: { id: 'cert-1' },
                data: expect.objectContaining({
                    revokedAt: expect.any(Date),
                    revokedReason: 'سبب',
                }),
            });
        });

        it('throws 409 if already revoked', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue({
                id: 'cert-1',
                revokedAt: new Date(),
            });
            await expect(certificateService.revokeCertificate('cert-1', 'سبب')).rejects.toThrow(
                'الشهادة ملغاة بالفعل'
            );
        });

        it('throws 404 if not found', async () => {
            (prisma.certificate.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(certificateService.revokeCertificate('missing', 'سبب')).rejects.toThrow(
                AppError
            );
        });
    });
});