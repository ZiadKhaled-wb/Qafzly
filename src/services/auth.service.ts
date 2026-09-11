import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { config } from '../config/env';
import { AppError } from '../utils/AppError';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken } from '../utils/token';
import { sendPasswordResetEmail } from './email.service';

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const RESET_TOKEN_PREFIX = 'reset_token:';
const FAILED_ATTEMPTS_PREFIX = 'failed_attempts:';

export const register = async (data: any) => {
    const { email, password, fullName, country, language, learningGoal, skillLevel, role } = data;

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new AppError(409, 'البريد الإلكتروني مسجل بالفعل');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user with a transaction to also create UserStats (and assign daily quests)
    const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
            data: {
                email,
                passwordHash,
                fullName,
                country,
                language,
                learningGoal,
                skillLevel,
                role: role || 'STUDENT',
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                language: true,
                skillLevel: true,
                role: true,
                createdAt: true,
            },
        });

        // Create UserStats record (gamification profile)
        await tx.userStats.create({
            data: {
                userId: newUser.id,
                xp: 0,
                level: 1,
                streak: 0,
                longestStreak: 0,
                totalPathsCompleted: 0,
                totalLessonsCompleted: 0,
                streakFreezeAvailable: 0,
            },
        });

        // Assign active daily quests to the new user
        const activeDailyQuests = await tx.quest.findMany({
            where: {
                type: 'daily',
                isActive: true,
                startDate: { lte: new Date() },
                OR: [
                    { endDate: { gte: new Date() } },
                    { endDate: null },
                ],
            },
            select: { id: true },
        });

        if (activeDailyQuests.length > 0) {
            await tx.userQuest.createMany({
                data: activeDailyQuests.map((quest) => ({
                    userId: newUser.id,
                    questId: quest.id,
                    progress: 0,
                    completed: false,
                })),
                skipDuplicates: true, // In case some already exist (should not happen for new user)
            });
        }

        return newUser;
    });

    // Generate tokens
    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in Redis
    await redis.set(
        REFRESH_TOKEN_PREFIX + user.id,
        refreshToken,
        'EX',
        7 * 24 * 60 * 60 // 7 days
    );

    return { user, accessToken, refreshToken };
};

export const login = async (email: string, password: string) => {
    // Check if account is locked
    const failedKey = FAILED_ATTEMPTS_PREFIX + email;
    const failedCount = await redis.get(failedKey);
    if (failedCount && parseInt(failedCount, 10) >= config.accountLockoutThreshold) {
        const ttl = await redis.ttl(failedKey);
        throw new AppError(423, `الحساب مقفل مؤقتاً. حاول مرة أخرى بعد ${Math.ceil(ttl / 60)} دقيقة`);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
        throw new AppError(401, 'بيانات الدخول غير صحيحة');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
        // Increment failed attempts
        const newCount = await redis.incr(failedKey);
        if (newCount === 1) {
            await redis.expire(failedKey, config.accountLockoutDurationMinutes * 60);
        }
        throw new AppError(401, 'بيانات الدخول غير صحيحة');
    }

    // Reset failed attempts
    await redis.del(failedKey);

    // Generate tokens
    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in Redis
    await redis.set(
        REFRESH_TOKEN_PREFIX + user.id,
        refreshToken,
        'EX',
        7 * 24 * 60 * 60
    );

    return { user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role }, accessToken, refreshToken };
};

export const refreshToken = async (refreshToken: string) => {
    try {
        const payload = verifyRefreshToken(refreshToken);
        const storedToken = await redis.get(REFRESH_TOKEN_PREFIX + payload.userId);
        if (!storedToken || storedToken !== refreshToken) {
            throw new AppError(401, 'رمز التحديث غير صالح');
        }

        // Build a clean payload with only the fields needed for the access token
        const accessTokenPayload = {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
        };

        const newAccessToken = generateAccessToken(accessTokenPayload);
        return { accessToken: newAccessToken };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new AppError(401, 'انتهت صلاحية رمز التحديث');
        }
        throw new AppError(401, 'رمز التحديث غير صالح');
    }
};

export const logout = async (userId: string) => {
    await redis.del(REFRESH_TOKEN_PREFIX + userId);
    return { success: true };
};

export const forgotPassword = async (email: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        // Do not reveal if user exists
        return { success: true };
    }

    const resetToken = jwt.sign({ userId: user.id }, config.jwtAccessSecret, { expiresIn: '15m' });
    await redis.set(RESET_TOKEN_PREFIX + resetToken, user.id, 'EX', 15 * 60);

    await sendPasswordResetEmail(email, resetToken);
    return { success: true };
};

export const resetPassword = async (token: string, newPassword: string) => {
    try {
        const payload = verifyAccessToken(token) as { userId: string };
        const userId = await redis.get(RESET_TOKEN_PREFIX + token);
        if (!userId || userId !== payload.userId) {
            throw new AppError(401, 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية');
        }

        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });

        // Invalidate reset token and refresh tokens
        await redis.del(RESET_TOKEN_PREFIX + token);
        await redis.del(REFRESH_TOKEN_PREFIX + userId);

        return { success: true };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new AppError(401, 'انتهت صلاحية رمز إعادة التعيين');
        }
        throw new AppError(401, 'رمز إعادة التعيين غير صالح');
    }
};