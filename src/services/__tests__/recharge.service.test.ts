import { prisma } from '../../config/database';
import * as rechargeService from '../recharge.service';

jest.mock('../../config/database', () => ({
    prisma: {
        lesson: { findUnique: jest.fn() },
        lessonProgress: { findUnique: jest.fn() },
        userStats: { upsert: jest.fn() },
    },
}));

describe('Recharge Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getRechargeStatus', () => {
        it('should return no recharge for first lesson', async () => {
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
            id: 'l1',
            rechargeMessageAr: null,
            rechargeMessageEn: null,
            rechargeXpBoost: true,
            rechargeBoostMultiplier: 2,
            rechargeBoostWindowHours: 24,
            module: { lessons: [{ id: 'l1', order: 1 }] },
        });

        const result = await rechargeService.getRechargeStatus('l1', 'user-1');
        expect(result.isRecharging).toBe(false);
        expect(result.xpBoostAvailable).toBe(false);
        expect(result.xpBoostMultiplier).toBe(1);
        });

        it('should return recharging and boost available if previous completed within window', async () => {
        const now = new Date();
        const completedAt = new Date(now.getTime() - 1 * 60 * 60 * 1000);
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
            id: 'l2',
            rechargeMessageAr: 'msg',
            rechargeMessageEn: null,
            rechargeXpBoost: true,
            rechargeBoostMultiplier: 2,
            rechargeBoostWindowHours: 24,
            module: {
            lessons: [
                { id: 'l1', order: 1 },
                { id: 'l2', order: 2 },
            ],
            },
        });
        (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue({ completedAt });

        const result = await rechargeService.getRechargeStatus('l2', 'user-1');
        expect(result.isRecharging).toBe(true);
        expect(result.xpBoostAvailable).toBe(true);
        expect(result.xpBoostMultiplier).toBe(2);
        expect(result.remainingSeconds).toBeGreaterThan(0);
        });
    });

    describe('awardXpWithRecharge', () => {
        it('should apply multiplier if boost active', async () => {
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
            id: 'l2',
            rechargeXpBoost: true,
            rechargeBoostMultiplier: 2,
            rechargeBoostWindowHours: 24,
            module: { lessons: [{ id: 'l1', order: 1 }, { id: 'l2', order: 2 }] },
        });
        (prisma.lessonProgress.findUnique as jest.Mock).mockResolvedValue({ completedAt: new Date() });
        (prisma.userStats.upsert as jest.Mock).mockResolvedValue({});

        const awarded = await rechargeService.awardXpWithRecharge('user-1', 10, 'l2');
        expect(awarded).toBe(20);
        expect(prisma.userStats.upsert).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            update: { xp: { increment: 20 } },
            create: { userId: 'user-1', xp: 20 },
        });
        });

        it('should not apply multiplier if boost disabled', async () => {
        (prisma.lesson.findUnique as jest.Mock).mockResolvedValue({
            id: 'l2',
            rechargeXpBoost: false,
            rechargeBoostMultiplier: 2,
            rechargeBoostWindowHours: 24,
            module: { lessons: [{ id: 'l1', order: 1 }, { id: 'l2', order: 2 }] },
        });
        (prisma.userStats.upsert as jest.Mock).mockResolvedValue({});

        const awarded = await rechargeService.awardXpWithRecharge('user-1', 10, 'l2');
        expect(awarded).toBe(10);
        });
    });
});