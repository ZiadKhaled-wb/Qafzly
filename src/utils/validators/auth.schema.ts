import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        email: z.string().email('البريد الإلكتروني غير صالح'),
        password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
        fullName: z.string().min(2, 'الاسم الكامل مطلوب'),
        country: z.string().length(2, 'رمز الدولة يجب أن يكون حرفين').optional(),
        language: z.enum(['ar', 'en']).default('ar'),
        learningGoal: z.string().optional(),
        skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
        // in registerSchema
        role: z.enum(['STUDENT', 'PARENT']).optional(),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email('البريد الإلكتروني غير صالح'),
        password: z.string().min(1, 'كلمة المرور مطلوبة'),
    }),
});

export const refreshSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1, 'رمز التحديث مطلوب'),
    }),
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email('البريد الإلكتروني غير صالح'),
    }),
});

export const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().min(1, 'رمز إعادة التعيين مطلوب'),
        newPassword: z.string().min(8, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'),
    }),
});