// @ts-nocheck

import {
    PrismaClient,
    Role,
    SkillLevel,
    CourseDifficulty,
    ContentType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // -------------------------------
    // 1. Categories
    // -------------------------------
    const categories = await prisma.courseCategory.createMany({
        data: [
            { name: 'برمجة', nameEn: 'Programming' },
            { name: 'تطوير الويب', nameEn: 'Web Development' },
            { name: 'علوم البيانات', nameEn: 'Data Science' },
            { name: 'الذكاء الاصطناعي', nameEn: 'Artificial Intelligence' },
        ],
        skipDuplicates: true,
    });
    console.log(`📁 Categories ensured: ${categories.count} new`);

    // Retrieve category IDs
    const programmingCat = await prisma.courseCategory.findFirst({
        where: { nameEn: 'Programming' },
    });
    const webCat = await prisma.courseCategory.findFirst({
        where: { nameEn: 'Web Development' },
    });

    // -------------------------------
    // 2. Users (admin + regular student)
    // -------------------------------
    const adminPassword = await bcrypt.hash('Admin@123456', 12);
    const studentPassword = await bcrypt.hash('Student@123456', 12);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@qafzly.com' },
        update: {},
        create: {
        email: 'admin@qafzly.com',
        passwordHash: adminPassword,
        fullName: 'مدير النظام',
        role: Role.ADMIN,
        isEmailVerified: true,
        language: 'ar',
        skillLevel: SkillLevel.ADVANCED,
        isActive: true,
        },
    });

    const student = await prisma.user.upsert({
        where: { email: 'student@qafzly.com' },
        update: {},
        create: {
        email: 'student@qafzly.com',
        passwordHash: studentPassword,
        fullName: 'طالب تجريبي',
        displayName: 'Student',
        role: Role.STUDENT,
        isEmailVerified: true,
        language: 'ar',
        skillLevel: SkillLevel.BEGINNER,
        isActive: true,
        },
    });

    console.log('👤 Users ensured: admin@qafzly.com, student@qafzly.com');

    // -------------------------------
    // 3. Courses
    // -------------------------------
    // Helper to create course if not exists by title
    const createCourseIfNotExists = async (data: any) => {
        const existing = await prisma.course.findFirst({ where: { title: data.title } });
        if (existing) return existing;
        return prisma.course.create({ data });
    };

    const publishedCourse = await createCourseIfNotExists({
        title: 'أساسيات البرمجة بلغة بايثون',
        titleEn: 'Python Programming Basics',
        description: 'دورة شاملة لتعلم أساسيات البرمجة باستخدام لغة بايثون من الصفر',
        descriptionEn: 'Comprehensive course to learn programming basics with Python from scratch',
        categoryId: programmingCat?.id,
        difficulty: CourseDifficulty.BEGINNER,
        price: 0,
        currency: 'EGP',
        isPublished: true,
        isFeatured: true,
        estimatedDuration: 600, // minutes
        tags: ['python', 'programming', 'beginners'],
        prerequisites: [],
        featuredImage: null,
    });

    const unpublishedCourse = await createCourseIfNotExists({
        title: 'تطوير مواقع الويب المتقدمة',
        titleEn: 'Advanced Web Development',
        description: 'دورة متقدمة في تطوير الويب تشمل React و Node.js',
        descriptionEn: 'Advanced web development course covering React and Node.js',
        categoryId: webCat?.id,
        difficulty: CourseDifficulty.ADVANCED,
        price: 199.99,
        currency: 'EGP',
        isPublished: false,
        isFeatured: false,
        estimatedDuration: 1200,
        tags: ['web', 'react', 'node'],
        prerequisites: ['HTML', 'CSS', 'JavaScript'],
        featuredImage: null,
    });

    console.log('📚 Courses ensured: published and unpublished');

    // -------------------------------
    // 4. Modules & Lessons for published course
    // -------------------------------
    // Module 1
    let module1 = await prisma.module.findFirst({
        where: { courseId: publishedCourse.id, title: 'مقدمة إلى بايثون' },
    });
    if (!module1) {
        module1 = await prisma.module.create({
        data: {
            courseId: publishedCourse.id,
            title: 'مقدمة إلى بايثون',
            titleEn: 'Introduction to Python',
            description: 'تعلم أساسيات اللغة وبيئة العمل',
            order: 1,
            isPublished: true,
        },
        });
    }

    // Module 2
    let module2 = await prisma.module.findFirst({
        where: { courseId: publishedCourse.id, title: 'التحكم في التدفق' },
    });
    if (!module2) {
        module2 = await prisma.module.create({
        data: {
            courseId: publishedCourse.id,
            title: 'التحكم في التدفق',
            titleEn: 'Control Flow',
            description: 'الجمل الشرطية والحلقات',
            order: 2,
            isPublished: true,
        },
        });
    }

    // Lessons for Module 1
    const lesson1Data = {
        moduleId: module1.id,
        title: 'تثبيت بايثون',
        titleEn: 'Installing Python',
        content: 'شرح كيفية تثبيت بايثون على نظام التشغيل',
        contentType: ContentType.TEXT,
        order: 1,
        isPublished: true,
        isPreview: true,
        estimatedTime: 15,
    };
    let lesson1 = await prisma.lesson.findFirst({
        where: { moduleId: module1.id, title: lesson1Data.title },
    });
    if (!lesson1) lesson1 = await prisma.lesson.create({ data: lesson1Data });

    const lesson2Data = {
        moduleId: module1.id,
        title: 'كتابة أول برنامج',
        titleEn: 'Writing Your First Program',
        content: 'إنشاء برنامج Hello World',
        contentType: ContentType.TEXT,
        order: 2,
        isPublished: true,
        isPreview: false,
        estimatedTime: 20,
    };
    let lesson2 = await prisma.lesson.findFirst({
        where: { moduleId: module1.id, title: lesson2Data.title },
    });
    if (!lesson2) lesson2 = await prisma.lesson.create({ data: lesson2Data });

    // Lessons for Module 2
    const lesson3Data = {
        moduleId: module2.id,
        title: 'الجمل الشرطية',
        titleEn: 'Conditional Statements',
        content: 'if, else, elif',
        contentType: ContentType.TEXT,
        order: 1,
        isPublished: true,
        isPreview: false,
        estimatedTime: 30,
    };
    let lesson3 = await prisma.lesson.findFirst({
        where: { moduleId: module2.id, title: lesson3Data.title },
    });
    if (!lesson3) lesson3 = await prisma.lesson.create({ data: lesson3Data });

    console.log('🧩 Modules and lessons ensured for published course');

    // -------------------------------
    // 5. Quiz Question for lesson2
    // -------------------------------
    const quizExists = await prisma.quizQuestion.findFirst({
        where: { lessonId: lesson2.id },
    });
    if (!quizExists) {
        await prisma.quizQuestion.create({
        data: {
            lessonId: lesson2.id,
            question: 'ما هي لغة البرمجة التي نتعلمها؟',
            options: [
            { id: 'a', text: 'Python', isCorrect: true },
            { id: 'b', text: 'Java', isCorrect: false },
            { id: 'c', text: 'C++', isCorrect: false },
            ],
            order: 1,
        },
        });
    }
    console.log('❓ Quiz question ensured');

    // -------------------------------
    // 6. Enrollment & Progress for student
    // -------------------------------
    const enrollment = await prisma.enrollment.upsert({
        where: {
        userId_courseId: { userId: student.id, courseId: publishedCourse.id },
        },
        update: {},
        create: {
        userId: student.id,
        courseId: publishedCourse.id,
        isActive: true,
        },
    });
    console.log('📝 Enrollment ensured for student');

    // Progress for lesson1 (completed)
    await prisma.lessonProgress.upsert({
        where: {
        userId_lessonId: { userId: student.id, lessonId: lesson1.id },
        },
        update: {
        completed: true,
        timeSpent: 300,
        quizScore: null,
        },
        create: {
        userId: student.id,
        lessonId: lesson1.id,
        completed: true,
        timeSpent: 300,
        },
    });

    // Progress for lesson2 (in progress)
    await prisma.lessonProgress.upsert({
        where: {
        userId_lessonId: { userId: student.id, lessonId: lesson2.id },
        },
        update: {
        completed: false,
        timeSpent: 120,
        quizScore: 80,
        },
        create: {
        userId: student.id,
        lessonId: lesson2.id,
        completed: false,
        timeSpent: 120,
        quizScore: 80,
        },
    });

    console.log('📊 Progress data ensured');

    // -------------------------------
    // 7. UserStats
    // -------------------------------
    await prisma.userStats.upsert({
        where: { userId: student.id },
        update: {
        xp: 150,
        level: 2,
        streak: 1,
        longestStreak: 1,
        totalCoursesCompleted: 0,
        totalLessonsCompleted: 1,
        },
        create: {
        userId: student.id,
        xp: 150,
        level: 2,
        streak: 1,
        longestStreak: 1,
        totalCoursesCompleted: 0,
        totalLessonsCompleted: 1,
        },
    });

    console.log('🎮 UserStats ensured');

    console.log('✅ Seed completed successfully.');
    console.log('---');
    console.log('Admin user:    admin@qafzly.com / Admin@123456');
    console.log('Student user:  student@qafzly.com / Student@123456');
    console.log('Published course: أساسيات البرمجة بلغة بايثون');
    console.log('Unpublished course: تطوير مواقع الويب المتقدمة');
    console.log('---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });