import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as paymentRequestService from '../payment.service';
import * as emailService from '../email.service';

jest.mock('../../config/database', () => ({
    prisma: {
        course: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
        },
        enrollment: {
            findFirst: jest.fn(),
            create: jest.fn(),
        },
        paymentRequest: {
            create: jest.fn(),
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
        },
        purchase: {
            create: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

jest.mock('../email.service', () => ({
    sendPaymentInstructions: jest.fn(),
    sendPaymentActivationConfirmation: jest.fn(),
    sendPaymentRejection: jest.fn(),
}));

describe('PaymentRequest Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createPaymentRequest', () => {
        const courseData = {
            id: 'course-1',
            title: 'Test Course',
            price: 250,
            currency: 'EGP',
            isPublished: true,
            deletedAt: null,
        };
        const userData = { id: 'user-1', email: 'user@example.com' };

        it('should create a payment request and send email', async () => {
            (prisma.course.findFirst as jest.Mock).mockResolvedValue(courseData);
            (prisma.enrollment.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.paymentRequest.create as jest.Mock).mockResolvedValue({
                id: 'request-1',
                userId: 'user-1',
                courseId: 'course-1',
                amountCents: 25000,
                currency: 'EGP',
                referenceCode: 'PAY-TEST-TEST-ABC',
                status: 'PENDING',
                expiresAt: new Date(),
            });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(userData);
            (emailService.sendPaymentInstructions as jest.Mock).mockResolvedValue(undefined);

            const result = await paymentRequestService.createPaymentRequest('user-1', 'course-1');

            expect(prisma.course.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ id: 'course-1' }) })
            );
            expect(prisma.enrollment.findFirst).toHaveBeenCalled();
            expect(prisma.paymentRequest.create).toHaveBeenCalled();
            expect(emailService.sendPaymentInstructions).toHaveBeenCalled();
            expect(result.requestId).toBe('request-1');
            expect(result.amount).toBe(250);
            expect(result.referenceCode).toBeDefined();
            expect(result.instructions).toBeInstanceOf(Array);
        });

        it('should throw 404 if course not found', async () => {
            (prisma.course.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(paymentRequestService.createPaymentRequest('user-1', 'bad-course'))
                .rejects.toThrow(AppError);
        });

        it('should throw 409 if user already enrolled', async () => {
            (prisma.course.findFirst as jest.Mock).mockResolvedValue(courseData);
            (prisma.enrollment.findFirst as jest.Mock).mockResolvedValue({ id: 'enroll-1' });
            await expect(paymentRequestService.createPaymentRequest('user-1', 'course-1'))
                .rejects.toThrow(AppError);
        });
    });

    describe('markPaymentAsSent', () => {
        const pendingRequest = {
            id: 'request-1',
            userId: 'user-1',
            status: 'PENDING',
        };

        it('should update user notes for pending request', async () => {
            (prisma.paymentRequest.findFirst as jest.Mock).mockResolvedValue(pendingRequest);
            (prisma.paymentRequest.update as jest.Mock).mockResolvedValue({ ...pendingRequest, userNotes: 'sent' });

            const result = await paymentRequestService.markPaymentAsSent('request-1', 'user-1', 'sent');

            expect(prisma.paymentRequest.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ id: 'request-1', userId: 'user-1' }) })
            );
            expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
                where: { id: 'request-1' },
                data: { userNotes: 'sent' },
            });
            expect(result).toEqual({ success: true });
        });

        it('should throw 404 if request not found', async () => {
            (prisma.paymentRequest.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(paymentRequestService.markPaymentAsSent('bad', 'user-1'))
                .rejects.toThrow(AppError);
        });

        it('should throw 422 if request is not PENDING', async () => {
            (prisma.paymentRequest.findFirst as jest.Mock).mockResolvedValue({ ...pendingRequest, status: 'ACTIVATED' });
            await expect(paymentRequestService.markPaymentAsSent('request-1', 'user-1'))
                .rejects.toThrow(AppError);
        });
    });

    describe('listUserPaymentRequests', () => {
        it('should return paginated list for user without status filter', async () => {
            const mockRequests = [
                { id: 'req-1', userId: 'user-1', status: 'PENDING', course: { title: 'Course A' } },
                { id: 'req-2', userId: 'user-1', status: 'ACTIVATED', course: { title: 'Course B' } },
            ];
            (prisma.paymentRequest.findMany as jest.Mock).mockResolvedValue(mockRequests);
            (prisma.paymentRequest.count as jest.Mock).mockResolvedValue(2);

            const result = await paymentRequestService.listUserPaymentRequests('user-1', { page: 1, limit: 10 });

            expect(prisma.paymentRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1' },
                    skip: 0,
                    take: 10,
                })
            );
            expect(result.requests).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.totalPages).toBe(1);
        });

        it('should apply status filter', async () => {
            (prisma.paymentRequest.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.paymentRequest.count as jest.Mock).mockResolvedValue(0);

            await paymentRequestService.listUserPaymentRequests('user-1', { page: 1, limit: 10, status: 'PENDING' });

            const whereArg = (prisma.paymentRequest.findMany as jest.Mock).mock.calls[0][0].where;
            expect(whereArg).toEqual({ userId: 'user-1', status: 'PENDING' });
        });
    });

    describe('listAllPaymentRequests', () => {
        it('should return paginated list with default filters', async () => {
            const mockRequests = [
                { id: 'req-1', user: { fullName: 'User 1' }, course: { title: 'Course A' }, status: 'PENDING' },
            ];
            (prisma.paymentRequest.findMany as jest.Mock).mockResolvedValue(mockRequests);
            (prisma.paymentRequest.count as jest.Mock).mockResolvedValue(1);

            const result = await paymentRequestService.listAllPaymentRequests({ page: 1, limit: 10 });

            expect(prisma.paymentRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {},
                    skip: 0,
                    take: 10,
                })
            );
            expect(result.total).toBe(1);
        });

        it('should apply status filter', async () => {
            (prisma.paymentRequest.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.paymentRequest.count as jest.Mock).mockResolvedValue(0);

            await paymentRequestService.listAllPaymentRequests({ page: 1, limit: 10, status: 'REJECTED' });

            const whereArg = (prisma.paymentRequest.findMany as jest.Mock).mock.calls[0][0].where;
            expect(whereArg).toEqual({ status: 'REJECTED' });
        });

        it('should apply search filter', async () => {
            (prisma.paymentRequest.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.paymentRequest.count as jest.Mock).mockResolvedValue(0);

            await paymentRequestService.listAllPaymentRequests({ page: 1, limit: 10, search: 'test' });

            const whereArg = (prisma.paymentRequest.findMany as jest.Mock).mock.calls[0][0].where;
            expect(whereArg.OR).toBeDefined();
            expect(whereArg.OR.length).toBeGreaterThan(0);
        });
    });

    describe('activatePaymentRequest', () => {
        const request = {
            id: 'request-1',
            userId: 'user-1',
            courseId: 'course-1',
            amountCents: 25000,
            currency: 'EGP',
            referenceCode: 'PAY-ABC-123',
            status: 'PENDING',
            course: { id: 'course-1', title: 'Test Course' },
        };
        const userData = { id: 'user-1', email: 'user@example.com' };

        it('should activate request, create purchase and enrollment, send email', async () => {
            (prisma.paymentRequest.findUnique as jest.Mock).mockResolvedValue(request);
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(userData);
            (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
                const tx = {
                    paymentRequest: { update: jest.fn().mockResolvedValue({ ...request, status: 'ACTIVATED' }) },
                    purchase: { create: jest.fn().mockResolvedValue({}) },
                    enrollment: { create: jest.fn().mockResolvedValue({}) },
                };
                return fn(tx);
            });

            const result = await paymentRequestService.activatePaymentRequest('request-1', 'admin-1', 12, 'ok');

            expect(prisma.$transaction).toHaveBeenCalled();
            expect(emailService.sendPaymentActivationConfirmation).toHaveBeenCalled();
            expect(result.status).toBe('ACTIVATED');
        });

        it('should throw 404 if request not found', async () => {
            (prisma.paymentRequest.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(paymentRequestService.activatePaymentRequest('bad', 'admin', 1))
                .rejects.toThrow(AppError);
        });

        it('should throw 422 if request already processed', async () => {
            (prisma.paymentRequest.findUnique as jest.Mock).mockResolvedValue({ ...request, status: 'ACTIVATED' });
            await expect(paymentRequestService.activatePaymentRequest('request-1', 'admin', 1))
                .rejects.toThrow(AppError);
        });
    });

    describe('rejectPaymentRequest', () => {
        it('should reject a pending request and send email', async () => {
            const request = {
                id: 'request-1',
                userId: 'user-1',
                courseId: 'course-1',
                status: 'PENDING',
            };
            (prisma.paymentRequest.findUnique as jest.Mock).mockResolvedValue(request);
            (prisma.paymentRequest.update as jest.Mock).mockResolvedValue({ ...request, status: 'REJECTED' });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'user@example.com' });
            (prisma.course.findUnique as jest.Mock).mockResolvedValue({ title: 'Test Course' });

            const result = await paymentRequestService.rejectPaymentRequest('request-1', 'admin', 'wrong amount');

            expect(prisma.paymentRequest.update).toHaveBeenCalled();
            expect(emailService.sendPaymentRejection).toHaveBeenCalled();
            expect(result.status).toBe('REJECTED');
        });

        it('should throw 404 if request not found', async () => {
            (prisma.paymentRequest.findUnique as jest.Mock).mockResolvedValue(null);
            await expect(paymentRequestService.rejectPaymentRequest('bad', 'admin', 'reason'))
                .rejects.toThrow(AppError);
        });

        it('should throw 422 if request already processed', async () => {
            const request = { id: 'request-1', status: 'ACTIVATED' };
            (prisma.paymentRequest.findUnique as jest.Mock).mockResolvedValue(request);
            await expect(paymentRequestService.rejectPaymentRequest('request-1', 'admin', 'reason'))
                .rejects.toThrow(AppError);
        });
    });

    // Optional: if checkExpiredRequests exists, add tests here
});