import { z } from 'zod';

export const bossBattleSchema = z.object({
    body: z.object({
        titleAr: z.string().min(1, 'العنوان مطلوب'),
        titleEn: z.string().optional(),
        narrativeAr: z.string().min(1, 'القصة مطلوبة'),
        narrativeEn: z.string().optional(),
        monsterNameAr: z.string().min(1, 'اسم الوحش مطلوب'),
        monsterNameEn: z.string().optional(),
        victoryBonusPerfect: z.number().int().default(50),
        victoryBonusGood: z.number().int().default(30),
        victoryBonusFair: z.number().int().default(15),
        victoryBonusRetry: z.number().int().default(5),
        questions: z.array(z.object({
        questionAr: z.string().min(1),
        questionEn: z.string().optional(),
        optionsAr: z.array(z.string()).min(4).max(6),
        optionsEn: z.array(z.string()).optional(),
        correctIndex: z.number().int().min(0).max(5),
        explanationAr: z.string().optional(),
        explanationEn: z.string().optional(),
        xpAward: z.number().int().default(10),
        order: z.number().int(),
        })).min(3, 'يجب أن يكون هناك 3 أسئلة على الأقل'),
    }),
});

export const submitBossBattleSchema = z.object({
    params: z.object({ moduleId: z.string().uuid() }),
    body: z.object({
        answers: z.array(z.object({
        questionId: z.string().uuid(),
        selectedIndex: z.number().int().min(0),
        })).min(1),
    }),
});

export const getBossBattleSchema = z.object({
    params: z.object({ moduleId: z.string().uuid() }),
});