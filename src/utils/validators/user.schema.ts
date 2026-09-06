import { z } from 'zod';

// Common fields for profile update
const profileFields = {
    fullName: z.string().min(2, 'الاسم الكامل يجب أن يكون حرفين على الأقل').max(100),
    displayName: z.string().max(100).optional().nullable(),
    bio: z.string().max(500).optional().nullable(),
    country: z.string().length(2, 'رمز الدولة يجب أن يكون حرفين').optional().nullable(),
    language: z.enum(['ar', 'en']).optional(),
    timezone: z.string().optional().nullable(),
    learningGoal: z.string().optional().nullable(),
    skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
    isPublic: z.boolean().optional(),
};

export const updateProfileSchema = z.object({
    body: z.object({
        ...profileFields,
        // For PUT, we may require fullName; but we'll keep flexible, recommend using PATCH for partial
    }),
});

export const updateProfilePartialSchema = z.object({
    body: z.object(profileFields).partial(),
});

export const updatePrivacySchema = z.object({
    body: z.object({
        profileVisibility: z.enum(['public', 'private', 'followers']).optional(),
        showProgress: z.boolean().optional(),
        showBadges: z.boolean().optional(),
        allowMessages: z.enum(['everyone', 'followers', 'none']).optional(),
        emailNotifications: z.boolean().optional(),
        pushNotifications: z.boolean().optional(),
    }),
});

export const adminUpdateUserSchema = z.object({
    body: z.object({
        role: z.enum(['STUDENT', 'PARENT', 'ADMIN']).optional(),
        isActive: z.boolean().optional(),
        isEmailVerified: z.boolean().optional(),
        // any other admin-only fields
    }),
});

export const adminListUsersQuerySchema = z.object({
    query: z.object({
        page: z.string().optional().transform(Number).default(1),
        limit: z.string().optional().transform(Number).default(20),
        search: z.string().optional(),
        role: z.enum(['STUDENT', 'PARENT', 'ADMIN']).optional(),
        status: z.enum(['active', 'suspended', 'deleted']).optional(),
    }),
});