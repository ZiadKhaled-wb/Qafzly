import crypto from 'crypto';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import { config } from '../config/env';
import { generateCertificatePdf } from './certificatePdf.service';
import { storeCertificatePdf } from './certificateStorage.service';
import { sendCertificateIssuedEmail } from './email.service';

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I/L

const generateCertificateCode = (): string => {
    const bytes = crypto.randomBytes(8);
    let raw = '';
    for (let i = 0; i < 8; i++) {
        raw += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
    return `QFLZ-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
};

interface CertificateMetadata {
    userName: string;
    pathTitle: string;
    completedLessons: number;
}

/**
 * Discriminated union for certificate verification.
 *
 * The `valid` field must be a **literal** boolean (not `boolean`) so
 * TypeScript can narrow the union at the call site. An inferred return type
 * widens it to `boolean` and breaks discrimination — hence the explicit
 * annotation on `verifyCertificate` below.
 */
type VerifyCertificateResult =
    | {
          valid: true;
          certificate: {
              certificateCode: string;
              recipientName: string;
              pathTitle: string;
              issuedAt: Date;
              revokedAt: null;
              revokedReason: null;
          };
      }
    | {
          valid: false;
          reason: 'NOT_FOUND';
      }
    | {
          valid: false;
          reason: 'REVOKED';
          certificate: {
              certificateCode: string;
              recipientName: string;
              pathTitle: string;
              issuedAt: Date;
              revokedAt: Date;
              revokedReason: string | null;
          };
      };

// -------------------------------
// Auto-issue
// -------------------------------

/**
 * Attempts to issue a certificate after a lesson is completed.
 *
 * Idempotent:
 *   - If a certificate already exists for (user, path), returns null.
 *   - If not all published lessons in the path are completed, returns null.
 *   - Otherwise creates the certificate, generates the PDF, and sends email.
 *
 * NEVER throws — all errors are logged. Callers can safely `await` without
 * a try/catch; a failure here must not break the progress update.
 */
export const tryAutoIssueCertificate = async (userId: string, pathId: string) => {
    try {
        const existing = await prisma.certificate.findUnique({
            where: { userId_pathId: { userId, pathId } },
            select: { id: true },
        });
        if (existing) return null;

        const [totalLessons, completedLessons] = await Promise.all([
            prisma.lesson.count({
                where: {
                    isPublished: true,
                    module: { pathId, isPublished: true },
                },
            }),
            prisma.lessonProgress.count({
                where: {
                    userId,
                    completed: true,
                    lesson: {
                        isPublished: true,
                        module: { pathId, isPublished: true },
                    },
                },
            }),
        ]);

        if (totalLessons === 0 || completedLessons < totalLessons) return null;

        const [user, path] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, fullName: true },
            }),
            prisma.path.findUnique({
                where: { id: pathId },
                select: { title: true },
            }),
        ]);
        if (!user || !path) return null;

        const metadata: CertificateMetadata = {
            userName: user.fullName,
            pathTitle: path.title,
            completedLessons,
        };

        const certificate = await prisma.certificate.create({
            data: {
                userId,
                pathId,
                certificateCode: generateCertificateCode(),
                metadata: metadata as any,
            },
        });

        logger.info(
            { certificateId: certificate.id, userId, pathId, code: certificate.certificateCode },
            'Certificate issued'
        );

        // Best-effort PDF + email — failures do not undo the DB row
        void finalizeCertificate(certificate.id).catch((err) => {
            logger.error({ err, certificateId: certificate.id }, 'Certificate finalization failed');
        });

        return certificate;
    } catch (err) {
        logger.error({ err, userId, pathId }, 'tryAutoIssueCertificate failed');
        return null;
    }
};

/**
 * Called from progress.service after a lesson is marked complete.
 * Resolves the parent path from the lesson and delegates to `tryAutoIssueCertificate`.
 */
export const tryAutoIssueCertificateForLesson = async (userId: string, lessonId: string) => {
    const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { module: { select: { pathId: true } } },
    });
    if (!lesson) return null;
    return tryAutoIssueCertificate(userId, lesson.module.pathId);
};

/**
 * Generates the PDF and sends the notification email. Errors are logged,
 * never thrown — the DB certificate exists regardless.
 */
const finalizeCertificate = async (certificateId: string): Promise<void> => {
    const cert = await prisma.certificate.findUnique({
        where: { id: certificateId },
        include: { user: true, path: true },
    });
    if (!cert) return;

    const verifyUrl = `${config.frontendUrl}/verify/${cert.certificateCode}`;

    try {
        const pdfBuffer = await generateCertificatePdf({
            userName: cert.user.fullName,
            pathTitle: cert.path.title,
            certificateCode: cert.certificateCode,
            issuedAt: cert.issuedAt,
            verifyUrl,
        });

        const pdfPath = await storeCertificatePdf(pdfBuffer, cert.userId, cert.certificateCode);

        await prisma.certificate.update({
            where: { id: cert.id },
            data: { pdfPath },
        });
    } catch (err) {
        logger.error({ err, certificateId: cert.id }, 'Certificate PDF generation/storage failed');
    }

    try {
        await sendCertificateIssuedEmail(cert.user.email, {
            userName: cert.user.fullName,
            pathTitle: cert.path.title,
            certificateCode: cert.certificateCode,
            downloadUrl: verifyUrl,
        });
    } catch (err) {
        logger.error({ err, certificateId: cert.id }, 'Certificate email failed');
    }
};

// -------------------------------
// User-facing reads
// -------------------------------

export const listUserCertificates = async (
    userId: string,
    params: { page: number; limit: number }
) => {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [certificates, total] = await Promise.all([
        prisma.certificate.findMany({
            where: { userId },
            orderBy: { issuedAt: 'desc' },
            skip,
            take: limit,
            include: { path: { select: { id: true, title: true, titleEn: true } } },
        }),
        prisma.certificate.count({ where: { userId } }),
    ]);

    return {
        certificates,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};

export const getCertificateById = async (id: string, userId: string, isAdmin: boolean) => {
    const certificate = await prisma.certificate.findUnique({
        where: { id },
        include: {
            path: { select: { id: true, title: true, titleEn: true } },
            user: { select: { id: true, fullName: true } },
        },
    });
    if (!certificate) throw new AppError(404, 'الشهادة غير موجودة');

    if (!isAdmin && certificate.userId !== userId) {
        throw new AppError(403, 'غير مصرح لك بالوصول إلى هذه الشهادة');
    }
    return certificate;
};

export const getCertificateDownloadUrl = async (id: string, userId: string, isAdmin: boolean) => {
    const certificate = await getCertificateById(id, userId, isAdmin);
    if (!certificate.pdfPath) {
        throw new AppError(404, 'ملف الشهادة غير متاح حالياً');
    }
    return {
        downloadUrl: certificate.pdfPath,
        fileName: `${certificate.certificateCode}.pdf`,
    };
};

// -------------------------------
// Public verification
// -------------------------------

export const verifyCertificate = async (
    code: string
): Promise<VerifyCertificateResult> => {
    const certificate = await prisma.certificate.findUnique({
        where: { certificateCode: code },
        include: {
            user: { select: { fullName: true } },
            path: { select: { title: true, titleEn: true } },
        },
    });

    if (!certificate) {
        return { valid: false, reason: 'NOT_FOUND' };
    }

    if (certificate.revokedAt) {
        return {
            valid: false,
            reason: 'REVOKED',
            certificate: {
                certificateCode: certificate.certificateCode,
                recipientName: certificate.user.fullName,
                pathTitle: certificate.path.title,
                issuedAt: certificate.issuedAt,
                revokedAt: certificate.revokedAt,
                revokedReason: certificate.revokedReason,
            },
        };
    }

    return {
        valid: true,
        certificate: {
            certificateCode: certificate.certificateCode,
            recipientName: certificate.user.fullName,
            pathTitle: certificate.path.title,
            issuedAt: certificate.issuedAt,
            revokedAt: null,
            revokedReason: null,
        },
    };
};

// -------------------------------
// Admin
// -------------------------------

export const adminIssueCertificate = async (userId: string, pathId: string, _adminId: string) => {
    const existing = await prisma.certificate.findUnique({
        where: { userId_pathId: { userId, pathId } },
    });
    if (existing) {
        throw new AppError(409, 'توجد شهادة صادرة بالفعل لهذا المستخدم في هذا المسار');
    }

    const [user, path] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
        prisma.path.findUnique({ where: { id: pathId }, select: { title: true } }),
    ]);
    if (!user) throw new AppError(404, 'المستخدم غير موجود');
    if (!path) throw new AppError(404, 'المسار غير موجود');

    const certificate = await prisma.certificate.create({
        data: {
            userId,
            pathId,
            certificateCode: generateCertificateCode(),
            metadata: {
                userName: user.fullName,
                pathTitle: path.title,
                completedLessons: 0,
            } as any,
        },
    });

    void finalizeCertificate(certificate.id).catch((err) => {
        logger.error(
            { err, certificateId: certificate.id },
            'Admin certificate finalization failed'
        );
    });

    return certificate;
};

export const revokeCertificate = async (id: string, reason: string) => {
    const certificate = await prisma.certificate.findUnique({ where: { id } });
    if (!certificate) throw new AppError(404, 'الشهادة غير موجودة');
    if (certificate.revokedAt) throw new AppError(409, 'الشهادة ملغاة بالفعل');

    return prisma.certificate.update({
        where: { id },
        data: {
            revokedAt: new Date(),
            revokedReason: reason,
        },
    });
};