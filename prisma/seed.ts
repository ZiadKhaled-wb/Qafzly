// @ts-nocheck

import { PrismaClient, Role, SkillLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // 1. Create course categories
    await prisma.courseCategory.createMany({
        data: [
        { name: 'برمجة', nameEn: 'Programming' },
        { name: 'تطوير الويب', nameEn: 'Web Development' },
        { name: 'علوم البيانات', nameEn: 'Data Science' },
        { name: 'الذكاء الاصطناعي', nameEn: 'Artificial Intelligence' },
        ],
        skipDuplicates: true,
    });

    // 2. Create admin user
    const passwordHash = await bcrypt.hash('Admin@123456', 12);
    await prisma.user.upsert({
        where: { email: 'admin@qafzly.com' },
        update: {},
        create: {
            email: 'admin@qafzly.com',
            passwordHash,
            fullName: 'مدير النظام',
            role: Role.ADMIN,
            isEmailVerified: true,
            language: 'ar',
            skillLevel: SkillLevel.ADVANCED,
            isActive: true,
        },
    });

    console.log('✅ Seed completed: admin user and categories created.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });