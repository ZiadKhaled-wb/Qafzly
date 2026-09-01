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
        const validUserData = {
        email: 'test@example.com',
        password: 'Password123',
        fullName: 'Test User',
        country: 'EG',
        language: 'ar',
        learningGoal: 'developer',
        skillLevel: 'BEGINNER',
        };

        it('should create a new user and return tokens', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.user.create as jest.Mock).mockResolvedValue({
            id: 'user-uuid',
            email: validUserData.email,
            fullName: validUserData.fullName,
            language: 'ar',
            skillLevel: 'BEGINNER',
            role: 'STUDENT',
            createdAt: new Date(),
        });
        (redis.set as jest.Mock).mockResolvedValue('OK');
        (generateAccessToken as jest.Mock).mockReturnValue('dummy-access-token');
        (generateRefreshToken as jest.Mock).mockReturnValue('dummy-refresh-token');

        const result = await authService.register(validUserData);

        expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: validUserData.email } });
        expect(prisma.user.create).toHaveBeenCalled();
        expect(result.accessToken).toBe('dummy-access-token');
        expect(result.refreshToken).toBe('dummy-refresh-token');
        expect(redis.set).toHaveBeenCalledWith(
            `refresh_token:user-uuid`,
            'dummy-refresh-token',
            'EX',
            expect.any(Number)
        );
        });

        it('should throw 409 if email already exists', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

        await expect(authService.register(validUserData)).rejects.toThrow(AppError);
        await expect(authService.register(validUserData)).rejects.toThrow('البريد الإلكتروني مسجل بالفعل');
        });
    });

    describe('login', () => {
        const email = 'test@example.com';
        const password = 'Password123';

        it('should return tokens for valid credentials', async () => {
        const user = {
            id: 'user-uuid',
            email,
            passwordHash: await bcrypt.hash(password, 12),
            fullName: 'Test User',
            role: 'STUDENT',
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
        (redis.get as jest.Mock).mockResolvedValue(null);
        (redis.set as jest.Mock).mockResolvedValue('OK');
        (generateAccessToken as jest.Mock).mockReturnValue('dummy-access-token');
        (generateRefreshToken as jest.Mock).mockReturnValue('dummy-refresh-token');

        const result = await authService.login(email, password);

        expect(result.accessToken).toBe('dummy-access-token');
        expect(result.refreshToken).toBe('dummy-refresh-token');
        expect(redis.del).toHaveBeenCalledWith(`failed_attempts:${email}`);
        });

        it('should throw 401 if user not found', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(authService.login(email, password)).rejects.toThrow('بيانات الدخول غير صحيحة');
        });

        it('should throw 401 if password is wrong', async () => {
        const user = {
            id: 'user-uuid',
            email,
            passwordHash: await bcrypt.hash('CorrectPassword', 12),
            fullName: 'Test User',
            role: 'STUDENT',
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
        (redis.get as jest.Mock).mockResolvedValue(null);
        (redis.incr as jest.Mock).mockResolvedValue(1);
        (redis.expire as jest.Mock).mockResolvedValue(1);

        await expect(authService.login(email, 'WrongPassword')).rejects.toThrow('بيانات الدخول غير صحيحة');
        expect(redis.incr).toHaveBeenCalledWith(`failed_attempts:${email}`);
        expect(redis.expire).toHaveBeenCalled();
        });

        it('should lock account after threshold attempts', async () => {
        (redis.get as jest.Mock).mockResolvedValue('5');
        (redis.ttl as jest.Mock).mockResolvedValue(900);

        await expect(authService.login(email, password)).rejects.toThrow('الحساب مقفل مؤقتاً');
        });

        it('should reset failed attempts on successful login', async () => {
        const user = {
            id: 'user-uuid',
            email,
            passwordHash: await bcrypt.hash(password, 12),
            fullName: 'Test User',
            role: 'STUDENT',
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
        (redis.get as jest.Mock).mockResolvedValue('3'); // some failed attempts
        (redis.del as jest.Mock).mockResolvedValue(1);
        (redis.set as jest.Mock).mockResolvedValue('OK');
        (generateAccessToken as jest.Mock).mockReturnValue('dummy-access-token');
        (generateRefreshToken as jest.Mock).mockReturnValue('dummy-refresh-token');

        await authService.login(email, password);

        expect(redis.del).toHaveBeenCalledWith(`failed_attempts:${email}`);
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
        expect(redis.get).toHaveBeenCalledWith(`refresh_token:user-uuid`);
        expect(generateAccessToken).toHaveBeenCalledWith(payload);
        expect(result.accessToken).toBe('new-access-token');
        });

        it('should throw 401 if refresh token not in Redis', async () => {
        (verifyRefreshToken as jest.Mock).mockReturnValue({ userId: 'user-uuid' });
        (redis.get as jest.Mock).mockResolvedValue(null);

        await expect(authService.refreshToken('valid')).rejects.toThrow('رمز التحديث غير صالح');
        });

        it('should throw 401 if token verification fails', async () => {
        (verifyRefreshToken as jest.Mock).mockImplementation(() => {
            throw new jwt.JsonWebTokenError('invalid');
        });

        await expect(authService.refreshToken('invalid')).rejects.toThrow('رمز التحديث غير صالح');
        });

        it('should throw 401 if token expired', async () => {
        (verifyRefreshToken as jest.Mock).mockImplementation(() => {
            throw new jwt.TokenExpiredError('expired', new Date());
        });

        await expect(authService.refreshToken('expired')).rejects.toThrow('انتهت صلاحية رمز التحديث');
        });
    });

    describe('logout', () => {
        it('should delete refresh token from redis', async () => {
        (redis.del as jest.Mock).mockResolvedValue(1);

        const result = await authService.logout('user-uuid');

        expect(redis.del).toHaveBeenCalledWith(`refresh_token:user-uuid`);
        expect(result.success).toBe(true);
        });
    });

    describe('forgotPassword', () => {
        it('should return success even if user does not exist (no email sent)', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        const result = await authService.forgotPassword('nonexistent@example.com');

        expect(result.success).toBe(true);
        expect(sendPasswordResetEmail).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
        });

        it('should send reset email and store token in Redis for existing user', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-uuid' });
        (redis.set as jest.Mock).mockResolvedValue('OK');

        const result = await authService.forgotPassword('test@example.com');

        expect(sendPasswordResetEmail).toHaveBeenCalled();
        expect(redis.set).toHaveBeenCalled();
        expect(result.success).toBe(true);
        });

        it('should throw error if email service fails', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-uuid' });
        (redis.set as jest.Mock).mockResolvedValue('OK');
        (sendPasswordResetEmail as jest.Mock).mockRejectedValue(new Error('فشل إرسال البريد الإلكتروني'));

        await expect(authService.forgotPassword('test@example.com')).rejects.toThrow('فشل إرسال البريد الإلكتروني');
        });
    });

    describe('resetPassword', () => {
        const token = 'valid-reset-token';
        const newPassword = 'NewPassword123';

        it('should update password and invalidate tokens', async () => {
        (verifyAccessToken as jest.Mock).mockReturnValue({ userId: 'user-uuid' });
        (redis.get as jest.Mock).mockResolvedValue('user-uuid');
        (redis.del as jest.Mock).mockResolvedValue(1);
        (prisma.user.update as jest.Mock).mockResolvedValue({});

        const result = await authService.resetPassword(token, newPassword);

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-uuid' },
            data: { passwordHash: expect.any(String) },
        });
        expect(redis.del).toHaveBeenCalledTimes(2);
        expect(result.success).toBe(true);
        });

        it('should throw 401 if token invalid', async () => {
        (verifyAccessToken as jest.Mock).mockImplementation(() => {
            throw new jwt.JsonWebTokenError('invalid');
        });

        await expect(authService.resetPassword('invalid', newPassword)).rejects.toThrow('رمز إعادة التعيين غير صالح');
        });

        it('should throw 401 if token not in Redis or mismatch', async () => {
        (verifyAccessToken as jest.Mock).mockReturnValue({ userId: 'user-uuid' });
        (redis.get as jest.Mock).mockResolvedValue('different-user');

        await expect(authService.resetPassword(token, newPassword)).rejects.toThrow('رمز إعادة التعيين غير صالح');
        });
    });
});