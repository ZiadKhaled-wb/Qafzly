import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import * as authService from '../auth.service';
import { sendPasswordResetEmail } from '../email.service';
import { AppError } from '../../utils/AppError';
import { config } from '../../config/env';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    verifyAccessToken,
} from '../../utils/token';

// Mock dependencies
jest.mock('../../config/database', () => ({
    prisma: {
        user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        },
    },
}));

jest.mock('../../config/redis', () => ({
    redis: {
        set: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
        incr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
    },
}));

jest.mock('../email.service', () => ({
    sendPasswordResetEmail: jest.fn(),
}));

jest.mock('../../utils/token', () => ({
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
}));

describe('Auth Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should create a new user and return tokens', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'Password123',
                fullName: 'Test User',
                country: 'EG',
                language: 'ar',
                learningGoal: 'developer',
                skillLevel: 'BEGINNER',
            };
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.user.create as jest.Mock).mockResolvedValue({
                id: 'user-uuid',
                email: userData.email,
                fullName: userData.fullName,
                language: 'ar',
                skillLevel: 'BEGINNER',
                role: 'STUDENT',
                createdAt: new Date(),
            });
            (redis.set as jest.Mock).mockResolvedValue('OK');
            (generateAccessToken as jest.Mock).mockReturnValue('dummy-access-token');
            (generateRefreshToken as jest.Mock).mockReturnValue('dummy-refresh-token');

            const result = await authService.register(userData);

            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: userData.email } });
            expect(prisma.user.create).toHaveBeenCalled();
            expect(result.accessToken).toBe('dummy-access-token');
            expect(result.refreshToken).toBe('dummy-refresh-token');
            expect(redis.set).toHaveBeenCalled();
        });

        it('should throw 409 if email already exists', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

            await expect(authService.register({ email: 'existing@example.com' })).rejects.toThrow(AppError);
        });
    });

    describe('login', () => {
        it('should return tokens for valid credentials', async () => {
            const user = {
                id: 'user-uuid',
                email: 'test@example.com',
                passwordHash: await bcrypt.hash('Password123', 12),
                fullName: 'Test User',
                role: 'STUDENT',
            };
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
            (redis.get as jest.Mock).mockResolvedValue(null);
            (redis.set as jest.Mock).mockResolvedValue('OK');
            (generateAccessToken as jest.Mock).mockReturnValue('dummy-access-token');
            (generateRefreshToken as jest.Mock).mockReturnValue('dummy-refresh-token');

            const result = await authService.login('test@example.com', 'Password123');

            expect(result.accessToken).toBe('dummy-access-token');
            expect(result.refreshToken).toBe('dummy-refresh-token');
            expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('failed_attempts'));
        });

        it('should throw 401 for wrong password', async () => {
            const user = {
                id: 'user-uuid',
                email: 'test@example.com',
                passwordHash: await bcrypt.hash('CorrectPassword', 12),
                fullName: 'Test User',
                role: 'STUDENT',
            };
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
            (redis.get as jest.Mock).mockResolvedValue(null);
            (redis.incr as jest.Mock).mockResolvedValue(1);
            (redis.expire as jest.Mock).mockResolvedValue(1);

            await expect(authService.login('test@example.com', 'WrongPassword')).rejects.toThrow('بيانات الدخول غير صحيحة');
        });

        it('should lock account after 5 failed attempts', async () => {
            (redis.get as jest.Mock).mockResolvedValue('5');
            (redis.ttl as jest.Mock).mockResolvedValue(900);

            await expect(authService.login('test@example.com', 'Password123')).rejects.toThrow('الحساب مقفل مؤقتاً');
        });
    });

    describe('refreshToken', () => {
        it('should return new access token for valid refresh token', async () => {
            const payload = { userId: 'user-uuid', email: 'test@example.com', role: 'STUDENT' };
            (verifyRefreshToken as jest.Mock).mockReturnValue(payload);
            (redis.get as jest.Mock).mockResolvedValue('valid-refresh-token');
            (generateAccessToken as jest.Mock).mockReturnValue('new-access-token');

            const result = await authService.refreshToken('valid-refresh-token');

            expect(verifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
            expect(redis.get).toHaveBeenCalledWith('refresh_token:user-uuid');
            expect(generateAccessToken).toHaveBeenCalledWith(payload);
            expect(result.accessToken).toBe('new-access-token');
        });

        it('should throw 401 for invalid refresh token', async () => {
            (verifyRefreshToken as jest.Mock).mockImplementation(() => {
                throw new jwt.JsonWebTokenError('invalid token');
            });
            (redis.get as jest.Mock).mockResolvedValue(null);

            await expect(authService.refreshToken('invalid')).rejects.toThrow('رمز التحديث غير صالح');
        });
    });

    describe('logout', () => {
        it('should delete refresh token from redis', async () => {
            (redis.del as jest.Mock).mockResolvedValue(1);

            const result = await authService.logout('user-uuid');

            expect(redis.del).toHaveBeenCalledWith('refresh_token:user-uuid');
            expect(result.success).toBe(true);
        });
    });

    describe('forgotPassword', () => {
        it('should not reveal if user does not exist', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

            const result = await authService.forgotPassword('nonexistent@example.com');

            expect(result.success).toBe(true);
            expect(sendPasswordResetEmail).not.toHaveBeenCalled();
        });

        it('should send reset email for existing user', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-uuid' });
            (redis.set as jest.Mock).mockResolvedValue('OK');

            const result = await authService.forgotPassword('test@example.com');

            expect(sendPasswordResetEmail).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });
    });

    describe('resetPassword', () => {
        it('should update password and invalidate tokens', async () => {
        const token = 'valid-reset-token';
            (verifyAccessToken as jest.Mock).mockReturnValue({ userId: 'user-uuid' });
            (redis.get as jest.Mock).mockResolvedValue('user-uuid');
            (redis.del as jest.Mock).mockResolvedValue(1);
            (prisma.user.update as jest.Mock).mockResolvedValue({});

            const result = await authService.resetPassword(token, 'NewPassword123');

            expect(prisma.user.update).toHaveBeenCalled();
            expect(redis.del).toHaveBeenCalledTimes(2);
            expect(result.success).toBe(true);
        });

        it('should throw 401 for invalid token', async () => {
            (verifyAccessToken as jest.Mock).mockImplementation(() => {
                throw new jwt.JsonWebTokenError('invalid token');
            });
            (redis.get as jest.Mock).mockResolvedValue(null);

            await expect(authService.resetPassword('invalid', 'NewPassword123')).rejects.toThrow('رمز إعادة التعيين غير صالح');
        });
    });
});