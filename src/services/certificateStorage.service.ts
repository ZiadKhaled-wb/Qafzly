import fs from 'fs/promises';
import path from 'path';
import { logger } from '../config/logger';

const CERT_ROOT = path.join(process.cwd(), 'uploads', 'certificates');

/**
 * Persists a certificate PDF and returns the public URL path.
 *
 * Local implementation writes to `uploads/certificates/<userId>/<code>.pdf`
 * which is served by the static `/uploads` mount in app.ts.
 *
 * When AWS is wired up (deferred per PM), swap the body to upload to S3
 * and return a signed URL — the signature stays identical.
 */
export const storeCertificatePdf = async (
    buffer: Buffer,
    userId: string,
    certificateCode: string
): Promise<string> => {
    const userDir = path.join(CERT_ROOT, userId);
    await fs.mkdir(userDir, { recursive: true });

    const filename = `${certificateCode}.pdf`;
    const filepath = path.join(userDir, filename);
    await fs.writeFile(filepath, buffer);

    logger.info({ filepath, size: buffer.length }, 'Certificate PDF stored');
    return `/uploads/certificates/${userId}/${filename}`;
};

/**
 * Removes a stored certificate PDF. Best-effort: logs failures but never throws.
 */
export const deleteCertificatePdf = async (pdfPath: string): Promise<void> => {
    try {
        // pdfPath is a URL path like "/uploads/certificates/<uid>/<file>.pdf"
        const relative = pdfPath.replace(/^\/uploads\//, '');
        const absolute = path.join(process.cwd(), 'uploads', relative);
        await fs.unlink(absolute);
    } catch (err) {
        logger.warn({ err, pdfPath }, 'Failed to delete certificate PDF (non-fatal)');
    }
};