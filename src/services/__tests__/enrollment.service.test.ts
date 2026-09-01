import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as enrollmentService from '../enrollment.service';

jest.mock('../../config/database', () => ({
    prisma: {
        course: {
        findFirst: jest.fn(),
        },
        enrollment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        },
    },
}));

describe('Enrollment Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('enrollUser', () => {
        it('should create new enrollment if course is published and not enrolled', async () => {
        const userId = 'user-1';
        const courseId = 'course-1';
        (prisma.course.findFirst as jest.Mock).mockResolvedValue({ id: courseId, isPublished: true });
        (prisma.enrollment.findUnique as jest.Mock).mockResolvedValue(null);
        const mockEnrollment = { userId, courseId, id: 'enr-1' };
        (prisma.enrollment.create as jest.Mock).mockResolvedValue(mockEnrollment);

        const result = await enrollmentService.enrollUser(userId, courseId);
        expect(prisma.enrollment.create).toHaveBeenCalledWith({ data: { userId, courseId } });
        expect(result).toEqual(mockEnrollment);
        });

        it('should throw 404 if course not found or unpublished', async () => {
        (prisma.course.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(enrollmentService.enrollUser('user-1', 'bad-course')).rejects.toThrow(AppError);
        });

        it('should throw 409 if already enrolled and active', async () => {
        (prisma.course.findFirst as jest.Mock).mockResolvedValue({ id: 'course-1', isPublished: true });
        (prisma.enrollment.findUnique as jest.Mock).mockResolvedValue({ id: 'enr-1', isActive: true });
        await expect(enrollmentService.enrollUser('user-1', 'course-1')).rejects.toThrow(AppError);
        });

        it('should reactivate enrollment if exists but inactive', async () => {
        const existing = { id: 'enr-1', isActive: false };
        (prisma.course.findFirst as jest.Mock).mockResolvedValue({ id: 'course-1', isPublished: true });
        (prisma.enrollment.findUnique as jest.Mock).mockResolvedValue(existing);
        const mockUpdated = { id: 'enr-1', isActive: true, expiresAt: null };
        (prisma.enrollment.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await enrollmentService.enrollUser('user-1', 'course-1');
        expect(prisma.enrollment.update).toHaveBeenCalledWith({
            where: { id: 'enr-1' },
            data: { isActive: true, expiresAt: null },
        });
        expect(result).toEqual(mockUpdated);
        });
    });

    describe('unenrollUser', () => {
        it('should set enrollment inactive', async () => {
        const enrollment = { id: 'enr-1', isActive: true };
        (prisma.enrollment.findUnique as jest.Mock).mockResolvedValue(enrollment);
        const mockUpdated = { id: 'enr-1', isActive: false, expiresAt: new Date() };
        (prisma.enrollment.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await enrollmentService.unenrollUser('user-1', 'course-1');
        expect(prisma.enrollment.update).toHaveBeenCalledWith({
            where: { id: 'enr-1' },
            data: { isActive: false, expiresAt: expect.any(Date) },
        });
        expect(result).toEqual(mockUpdated);
        });

        it('should throw 404 if enrollment not found or inactive', async () => {
        (prisma.enrollment.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(enrollmentService.unenrollUser('user-1', 'course-1')).rejects.toThrow(AppError);
        });
    });

    describe('listUserEnrollments', () => {
        it('should return paginated active enrollments for user', async () => {
        const mockEnrollments = [{ id: 'e1', course: { id: 'c1', title: 'Test' } }];
        (prisma.enrollment.findMany as jest.Mock).mockResolvedValue(mockEnrollments);
        (prisma.enrollment.count as jest.Mock).mockResolvedValue(1);

        const result = await enrollmentService.listUserEnrollments('user-1', { page: 1, limit: 10 });
        expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
            where: { userId: 'user-1', isActive: true },
            })
        );
        expect(result.enrollments).toHaveLength(1);
        expect(result.total).toBe(1);
        });
    });

    describe('listCourseEnrollments', () => {
        it('should return paginated active enrollments for course', async () => {
        const mockEnrollments = [{ id: 'e1', user: { id: 'u1', fullName: 'User' } }];
        (prisma.enrollment.findMany as jest.Mock).mockResolvedValue(mockEnrollments);
        (prisma.enrollment.count as jest.Mock).mockResolvedValue(1);

        const result = await enrollmentService.listCourseEnrollments('course-1', { page: 1, limit: 10 });
        expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
            where: { courseId: 'course-1', isActive: true },
            })
        );
        expect(result.enrollments).toHaveLength(1);
        expect(result.total).toBe(1);
        });
    });
});