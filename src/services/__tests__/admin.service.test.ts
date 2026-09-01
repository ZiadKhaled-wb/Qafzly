import { prisma } from '../../config/database';
import { AppError } from '../../utils/AppError';
import * as adminService from '../admin.service';

// Mock Prisma
jest.mock('../../config/database', () => ({
    prisma: {
        user: {
            findMany: jest.fn(),
            count: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    },
}));

describe('Admin Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('listUsers', () => {
        it('should return paginated users', async () => {
            const mockUsers = [
                { id: '1', email: 'a@example.com', fullName: 'A' },
                { id: '2', email: 'b@example.com', fullName: 'B' },
            ];
            (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
            (prisma.user.count as jest.Mock).mockResolvedValue(2);

            const result = await adminService.listUsers({ page: 1, limit: 10, search: '', role: null, status: null });

            expect(prisma.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                skip: 0,
                take: 10,
                })
            );
            expect(result.users).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.totalPages).toBe(1);
        });

        it('should apply search and role filters', async () => {
            (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.user.count as jest.Mock).mockResolvedValue(0);

            await adminService.listUsers({ page: 1, limit: 10, search: 'test', role: 'STUDENT', status: null });

            const whereArg = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
            expect(whereArg.OR).toBeDefined();
            expect(whereArg.role).toBe('STUDENT');
        });
    });

    describe('getUserById', () => {
        it('should return user details', async () => {
            const mockUser = { id: 'user-1', email: 'test@example.com' };
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

            const result = await adminService.getUserById('user-1');

            expect(result).toEqual(mockUser);
        });

        it('should throw 404 if user not found', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

            await expect(adminService.getUserById('bad-id')).rejects.toThrow(AppError);
        });
    });

    describe('updateUser', () => {
        it('should update user and return selected fields', async () => {
            const mockUpdated = {
                id: 'user-1',
                email: 'test@example.com',
                fullName: 'Updated',
                displayName: null,
                role: 'INSTRUCTOR',
                isActive: true,
                isEmailVerified: true,
                createdAt: new Date(),
            };
            (prisma.user.update as jest.Mock).mockResolvedValue(mockUpdated);

            const result = await adminService.updateUser('user-1', { role: 'INSTRUCTOR' });

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { role: 'INSTRUCTOR' },
                select: expect.any(Object),
            });
            expect(result.role).toBe('INSTRUCTOR');
        });
    });

    describe('suspendUser', () => {
        it('should set isActive false', async () => {
            const mockUser = { id: 'user-1', isActive: false };
            (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

            const result = await adminService.suspendUser('user-1', 'reason');

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { isActive: false },
                select: { id: true, isActive: true },
            });
            expect(result.isActive).toBe(false);
        });
    });

    describe('activateUser', () => {
        it('should set isActive true', async () => {
            const mockUser = { id: 'user-1', isActive: true };
            (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

            const result = await adminService.activateUser('user-1');

            expect(result.isActive).toBe(true);
        });
    });

    describe('changeRole', () => {
        it('should update role', async () => {
        const mockUser = { id: 'user-1', role: 'ADMIN' };
            (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

            const result = await adminService.changeRole('user-1', 'ADMIN');

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { role: 'ADMIN' },
                select: { id: true, role: true },
            });
            expect(result.role).toBe('ADMIN');
        });
    });
});