import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as pdfService from '../pdf.service';
import { getSignedPdfUrl as getSignedS3Url, uploadPdfToS3, deletePdfFromS3 } from '../s3.service';

jest.mock('../../config/database', () => ({
    prisma: {
        lesson: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        enrollment: {
            findUnique: jest.fn(),
        },
        user: {
            findFirst: jest.fn(),
        },
    },
}));

jest.mock('../s3.service', () => ({
    getSignedPdfUrl: jest.fn(),
    uploadPdfToS3: jest.fn(),
    deletePdfFromS3: jest.fn(),
}));

describe('PDF Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getSignedPdfUrl', () => {
        it('should return signed URL for enrolled student', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
                id: 'lesson-1',
                pdfUrl: 'lessons/lesson-1/test.pdf',
                isPublished: true,
                module: { pathId: 'path-1' },
            });
            (prisma.enrollment.findUnique as jest.Mock).mockResolvedValue({ id: 'enr-1' });
            (getSignedS3Url as jest.Mock).mockResolvedValue('https://signed-url');

            const result = await pdfService.getSignedPdfUrl('lesson-1', 'user-1');
            expect(result.url).toBe('https://signed-url');
            expect(getSignedS3Url).toHaveBeenCalledWith('lessons/lesson-1/test.pdf', 300);
        });

        it('should return signed URL for parent of enrolled child', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
                id: 'lesson-1',
                pdfUrl: 'key',
                isPublished: true,
                module: { pathId: 'path-1' },
            });
            (prisma.enrollment.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'child-1' });
            (getSignedS3Url as jest.Mock).mockResolvedValue('https://signed-url');

            const result = await pdfService.getSignedPdfUrl('lesson-1', 'parent-1');
            expect(result.url).toBe('https://signed-url');
        });

        it('should throw 403 for unauthorized user', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
                id: 'lesson-1',
                pdfUrl: 'key',
                isPublished: true,
                module: { pathId: 'path-1' },
            });
            (prisma.enrollment.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(pdfService.getSignedPdfUrl('lesson-1', 'user-1')).rejects.toThrow(AppError);
        });
    });
    describe('uploadLessonPdf', () => {
        it('should upload PDF and update lesson', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'lesson-1' });
            (uploadPdfToS3 as jest.Mock).mockResolvedValue(undefined);
            (prisma.lesson.update as jest.Mock).mockResolvedValue({ pdfUrl: 'key' });

            const result = await pdfService.uploadLessonPdf('lesson-1', Buffer.from('pdf'), 'test.pdf');
            expect(uploadPdfToS3).toHaveBeenCalled();
            expect(prisma.lesson.update).toHaveBeenCalledWith({
                where: { id: 'lesson-1' },
                data: { pdfUrl: expect.any(String) },
            });
            expect(result).toEqual({ pdfUrl: expect.any(String) });
        });
    });

    describe('deleteLessonPdf', () => {
        it('should delete PDF and clear lesson.pdfUrl', async () => {
            (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'lesson-1', pdfUrl: 'key' });
            (deletePdfFromS3 as jest.Mock).mockResolvedValue(undefined);
            (prisma.lesson.update as jest.Mock).mockResolvedValue({ pdfUrl: null });

            await pdfService.deleteLessonPdf('lesson-1');
            expect(deletePdfFromS3).toHaveBeenCalledWith('key');
            expect(prisma.lesson.update).toHaveBeenCalledWith({
                where: { id: 'lesson-1' },
                data: { pdfUrl: null },
            });
        });
    });
});