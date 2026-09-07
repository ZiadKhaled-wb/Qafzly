// @ts-nocheck

import {
    PrismaClient,
    Role,
    SkillLevel,
    PathDifficulty,
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

    const programmingCat = await prisma.courseCategory.findFirst({
        where: { nameEn: 'Programming' },
    });
    const webCat = await prisma.courseCategory.findFirst({
        where: { nameEn: 'Web Development' },
    });

    // -------------------------------
    // 2. Users (admin, parent, children)
    // -------------------------------
    const adminPassword = await bcrypt.hash('Admin@123456', 12);
    const parentPassword = await bcrypt.hash('Parent@123456', 12);
    const child1Password = await bcrypt.hash('Child1@123456', 12);
    const child2Password = await bcrypt.hash('Child2@123456', 12);

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

    const parent = await prisma.user.upsert({
        where: { email: 'parent@qafzly.com' },
        update: {},
        create: {
            email: 'parent@qafzly.com',
            passwordHash: parentPassword,
            fullName: 'ولي أمر تجريبي',
            displayName: 'Parent',
            role: Role.PARENT,
            isEmailVerified: true,
            language: 'ar',
            skillLevel: SkillLevel.BEGINNER,
            isActive: true,
        },
    });

    const child1 = await prisma.user.upsert({
        where: { email: 'child1@qafzly.com' },
        update: {},
        create: {
            email: 'child1@qafzly.com',
            passwordHash: child1Password,
            fullName: 'طالب تجريبي 1',
            displayName: 'Child1',
            role: Role.STUDENT,
            isEmailVerified: true,
            language: 'ar',
            skillLevel: SkillLevel.BEGINNER,
            isActive: true,
        },
    });

    const child2 = await prisma.user.upsert({
        where: { email: 'child2@qafzly.com' },
        update: {},
        create: {
            email: 'child2@qafzly.com',
            passwordHash: child2Password,
            fullName: 'طالب تجريبي 2',
            displayName: 'Child2',
            role: Role.STUDENT,
            isEmailVerified: true,
            language: 'ar',
            skillLevel: SkillLevel.BEGINNER,
            isActive: true,
        },
    });

    console.log('👤 Users ensured: admin, parent, child1, child2');

    // Link children to parent
    await prisma.user.update({
        where: { id: child1.id },
        data: { parentId: parent.id },
    });
    await prisma.user.update({
        where: { id: child2.id },
        data: { parentId: parent.id },
    });

    // ChildSettings for child1 (lock override enabled)
    await prisma.childSettings.upsert({
        where: { parentId_childId: { parentId: parent.id, childId: child1.id } },
        update: {},
        create: {
            parentId: parent.id,
            childId: child1.id,
            lockOverrideEnabled: true,
            customLockDurationHours: 6,
        },
    });

    console.log('👪 Parent-child links and settings ensured');

    // -------------------------------
    // 3. Paths
    // -------------------------------
    const createPathIfNotExists = async (data: any) => {
        const existing = await prisma.path.findFirst({ where: { title: data.title } });
        if (existing) return existing;
        return prisma.path.create({ data });
    };

    const publishedPath = await createPathIfNotExists({
        title: 'مقدمة إلى الحاسوب',
        titleEn: 'Intro to Computers',
        description: 'رحلة تعليمية لاستكشاف عالم الحاسوب وأساسياته',
        descriptionEn: 'An educational journey to explore the world of computers and its fundamentals',
        categoryId: programmingCat?.id,
        difficulty: PathDifficulty.BEGINNER,
        price: 0,
        currency: 'EGP',
        isPublished: true,
        isFeatured: true,
        estimatedDuration: 600,
        tags: ['computers', 'basics'],
        prerequisites: [],
        featuredImage: null,
    });

    const unpublishedPath = await createPathIfNotExists({
        title: 'مقدمة إلى الإنترنت',
        titleEn: 'Intro to Internet',
        description: 'تعلم كيف يعمل الإنترنت وكيف تتصفح بأمان',
        descriptionEn: 'Learn how the internet works and how to browse safely',
        categoryId: webCat?.id,
        difficulty: PathDifficulty.BEGINNER,
        price: 150,
        currency: 'EGP',
        isPublished: false,
        isFeatured: false,
        estimatedDuration: 450,
        tags: ['internet', 'safety'],
        prerequisites: [],
        featuredImage: null,
    });

    console.log('📚 Paths ensured: published and unpublished');

    // -------------------------------
    // 4. Modules & Lessons with new fields
    // -------------------------------
    let module1 = await prisma.module.findFirst({
        where: { pathId: publishedPath.id, title: 'ما هو الحاسوب؟' },
    });
    if (!module1) {
        module1 = await prisma.module.create({
            data: {
                pathId: publishedPath.id,
                title: 'ما هو الحاسوب؟',
                titleEn: 'What is a Computer?',
                description: 'فهم الأجزاء الأساسية للحاسوب',
                order: 1,
                isPublished: true,
            },
        });
    }

    let module2 = await prisma.module.findFirst({
        where: { pathId: publishedPath.id, title: 'البرمجيات' },
    });
    if (!module2) {
        module2 = await prisma.module.create({
            data: {
                pathId: publishedPath.id,
                title: 'البرمجيات',
                titleEn: 'Software',
                description: 'الفرق بين العتاد والبرمجيات',
                order: 2,
                isPublished: true,
            },
        });
    }

    // Lesson 1 with enhanced content structure
    const lesson1Data = {
        moduleId: module1.id,
        title: 'تاريخ الحاسوب',
        titleEn: 'History of Computers',
        content: 'لمحة تاريخية عن تطور الحواسيب',
        contentType: ContentType.TEXT,
        order: 1,
        isPublished: true,
        isPreview: true,
        estimatedTime: 15,
        overviewVideoUrl: 'youtube_id_1',
        pdfUrl: null,
        explanatoryVideoUrl: 'youtube_id_2',
        slidesJson: [
            { concept: 'الحاسوب', question: 'ما هو الحاسوب؟', answer: 'جهاز إلكتروني' },
        ],
        challengeDescription: 'ابحث عن أجزاء الحاسوب في الصورة',
        challengeType: 'quiz',
        challengeData: { imageUrl: null },
        lockDurationHours: 12,
        // New fields
        warmUpJson: {
            type: 'RIDDLE',
            promptAr: 'أنا عندي شاشة بس مش تلفزيون. وعندي كيبورد بس مش بيانو. وعندي ماوس بس مش فار. أنا مين؟ 🤔',
            promptEn: null,
            answerAr: 'الكمبيوتر!',
            answerEn: null,
            xpAward: 5,
        },
        miniQuestJson: {
            titleAr: 'صياد الكمبيوتر',
            titleEn: null,
            narrativeAr: 'ساعد العمدة بروسيسور في تجميع أجزاء المدينة!',
            narrativeEn: null,
        },
        rechargeMessageAr: 'أحسنت! قدراتك بتتشحن دلوقتي. ارجع بكرة عشان تاخد 2x XP Boost!',
        rechargeMessageEn: null,
        rechargeXpBoost: true,
        rechargeBoostMultiplier: 2,
        rechargeBoostWindowHours: 24,
    };
    let lesson1 = await prisma.lesson.findFirst({
        where: { moduleId: module1.id, title: lesson1Data.title },
    });
    if (!lesson1) lesson1 = await prisma.lesson.create({ data: lesson1Data });

    // Lesson 2
    const lesson2Data = {
        moduleId: module1.id,
        title: 'أجزاء الحاسوب',
        titleEn: 'Computer Parts',
        content: 'التعرف على المكونات المادية',
        contentType: ContentType.TEXT,
        order: 2,
        isPublished: true,
        isPreview: false,
        estimatedTime: 20,
        overviewVideoUrl: 'youtube_id_3',
        pdfUrl: null,
        explanatoryVideoUrl: 'youtube_id_4',
        slidesJson: [
            { concept: 'المعالج', question: 'ما وظيفة المعالج؟', answer: 'تنفيذ العمليات' },
        ],
        challengeDescription: 'سمّ الأجزاء',
        challengeType: 'quiz',
        challengeData: {},
        lockDurationHours: 12,
        // New fields (slightly different)
        warmUpJson: null,
        miniQuestJson: null,
        rechargeMessageAr: null,
        rechargeMessageEn: null,
        rechargeXpBoost: true,
        rechargeBoostMultiplier: 2,
        rechargeBoostWindowHours: 24,
    };
    let lesson2 = await prisma.lesson.findFirst({
        where: { moduleId: module1.id, title: lesson2Data.title },
    });
    if (!lesson2) lesson2 = await prisma.lesson.create({ data: lesson2Data });

    console.log('🧩 Modules and lessons ensured with new structure');

    // -------------------------------
    // 5. Slides for Lesson 1
    // -------------------------------
    const slidesData = [
        {
            slideType: 'INFO',
            titleAr: 'الكمبيوتر هو مدينة!',
            bodyAr: 'فكر في الكمبيوتر كأنه مدينة كاملة. ليها طرق ومباني وناس. المدينة دي بتستقبل طلبات، تعالجها، وتطلع نتايج.',
            xpAward: 5,
            order: 1,
        },
        {
            slideType: 'QUIZ',
            questionAr: 'لما بتضغط زرار في لعبة عشان شخصيتك تقفز، إيه هو "الإدخال" (Input)؟',
            optionsJson: ['قفز الشخصية', 'ضغطتك على الزرار', 'صوت اللعبة', 'الشاشة'],
            correctIndex: 1,
            explanationAr: 'الإدخال هو الأمر اللي انت بتديه للكمبيوتر، واللي هو ضغطتك على الزرار!',
            xpAward: 5,
            order: 2,
        },
        {
            slideType: 'TRUE_FALSE',
            statementAr: 'أول كمبيوتر في العالم كان حجمه زي حجم اللابتوب بتاعك دلوقتي.',
            correctAnswer: false,
            explanationAr: 'أول كمبيوتر كان حجمه زي أوضة كاملة! 😱',
            xpAward: 5,
            order: 3,
        },
        {
            slideType: 'FILL_BLANK',
            sentenceAr: 'الترانزستور هو عامل زي ___ البناء في مدينة الكمبيوتر.',
            acceptedAnswersJson: ['الطوبة', 'طوبه', 'طوب'],
            explanationAr: 'الترانزستورات هي اللبنات الأساسية اللي بنبني بيها كل أجزاء الكمبيوتر.',
            xpAward: 5,
            order: 4,
        },
        {
            slideType: 'DRAG_DROP',
            instructionAr: 'اسحب كل حاجة للمكان الصح بتاعها في رحلة البيانات',
            itemsJson: [
                { label: 'ضغطة الزرار', correctZone: 'input' },
                { label: 'قرار العمدة بروسيسور', correctZone: 'process' },
                { label: 'قفز الشخصية', correctZone: 'output' },
            ],
            xpAward: 5,
            order: 5,
        },
    ];

    for (const slide of slidesData) {
        const existing = await prisma.slide.findFirst({
            where: { lessonId: lesson1.id, order: slide.order },
        });
        if (!existing) {
            await prisma.slide.create({
                data: { ...slide, lessonId: lesson1.id },
            });
        }
    }
    console.log('🖼️ Slides ensured for lesson1');

    // -------------------------------
    // 6. Quest Checkpoints for Lesson 1
    // -------------------------------
    const checkpointsData = [
        {
            titleAr: 'البحث',
            taskAr: 'قوم ولف في البيت. دوّر على أي جهاز فيه "مدينة كمبيوتر" (شاشة + معالج).',
            hintAr: 'فكر في الموبايل، التابلت، اللابتوب، وحتى التلفزيون الذكي.',
            xpAward: 15,
            order: 1,
        },
        {
            titleAr: 'التدوين',
            taskAr: 'اكتب أسماء 3 أجهزة لقتها. جنب كل جهاز، اكتب إيه هي "النتيجة" (Output) اللي بتخرج منه.',
            hintAr: 'الموبايل بيطلع صور، اللابتوب بيطلع ملفات.',
            xpAward: 15,
            order: 2,
        },
        {
            titleAr: 'التحدي الإبداعي',
            taskAr: 'تخيل إنك صممت جهاز كمبيوتر جديد. إيه هي الوظيفة الغريبة اللي هيدّيها؟',
            hintAr: 'الجهاز بتاعي هيكون قادر يشم الورود من على النت! 😂',
            xpAward: 20,
            order: 3,
        },
    ];

    for (const cp of checkpointsData) {
        const existing = await prisma.questCheckpoint.findFirst({
            where: { lessonId: lesson1.id, order: cp.order },
        });
        if (!existing) {
            await prisma.questCheckpoint.create({
                data: { ...cp, lessonId: lesson1.id },
            });
        }
    }
    console.log('🛡️ Quest checkpoints ensured for lesson1');

    // -------------------------------
    // 7. Boss Battle for Module 1
    // -------------------------------
    const existingBoss = await prisma.bossBattle.findFirst({
        where: { moduleId: module1.id },
    });
    if (!existingBoss) {
        await prisma.bossBattle.create({
            data: {
                moduleId: module1.id,
                titleAr: 'وحش الفوضى',
                narrativeAr: 'وحش الفوضى هاجم مدينة الكمبيوتر! 🐉 أنت المحارب الوحيد اللي يقدر يهزمه. كل إجابة صحيحة = ضربة قوية. كل إجابة غلط = الوحش بيقوى!',
                monsterNameAr: 'وحش الفوضى',
                victoryBonusPerfect: 50,
                victoryBonusGood: 30,
                victoryBonusFair: 15,
                victoryBonusRetry: 5,
                questions: {
                    create: [
                        {
                            questionAr: 'ما هي وظيفة البروسيسور؟',
                            optionsAr: ['معالجة البيانات', 'تخزين الملفات', 'عرض الصور', 'تشغيل الصوت'],
                            correctIndex: 0,
                            explanationAr: 'البروسيسور هو عقل الكمبيوتر المسؤول عن معالجة البيانات.',
                            xpAward: 10,
                            order: 1,
                        },
                        {
                            questionAr: 'أين يتم تخزين الملفات بشكل دائم؟',
                            optionsAr: ['الرامات', 'الهارد ديسك', 'الشاشة', 'الكيبورد'],
                            correctIndex: 1,
                            explanationAr: 'الهارد ديسك يخزن البيانات بشكل دائم.',
                            xpAward: 10,
                            order: 2,
                        },
                        {
                            questionAr: 'ما هو الإدخال (Input)؟',
                            optionsAr: ['النتيجة', 'الأمر الذي تعطيه للكمبيوتر', 'الصوت', 'الصورة'],
                            correctIndex: 1,
                            explanationAr: 'الإدخال هو الأمر الذي يعطيه المستخدم.',
                            xpAward: 10,
                            order: 3,
                        },
                    ],
                },
            },
        });
    }
    console.log('👾 Boss battle ensured for module1');

    // -------------------------------
    // 8. Quiz Question for lesson2 (existing)
    // -------------------------------
    const quizExists = await prisma.quizQuestion.findFirst({
        where: { lessonId: lesson2.id },
    });
    if (!quizExists) {
        await prisma.quizQuestion.create({
            data: {
                lessonId: lesson2.id,
                question: 'ما هي وحدة المعالجة المركزية؟',
                options: [
                    { id: 'a', text: 'المعالج', isCorrect: true },
                    { id: 'b', text: 'الشاشة', isCorrect: false },
                    { id: 'c', text: 'الذاكرة', isCorrect: false },
                ],
                order: 1,
            },
        });
    }
    console.log('❓ Quiz question ensured');

    // -------------------------------
    // 9. Enrollment & Progress for children
    // -------------------------------
    await prisma.enrollment.upsert({
        where: { userId_pathId: { userId: child1.id, pathId: publishedPath.id } },
        update: {},
        create: {
            userId: child1.id,
            pathId: publishedPath.id,
            isActive: true,
        },
    });
    await prisma.enrollment.upsert({
        where: { userId_pathId: { userId: child2.id, pathId: publishedPath.id } },
        update: {},
        create: {
            userId: child2.id,
            pathId: publishedPath.id,
            isActive: true,
        },
    });
    console.log('📝 Enrollments ensured for children');

    await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: child1.id, lessonId: lesson1.id } },
        update: {
            completed: true,
            completedAt: new Date(),
            timeSpent: 300,
            quizScore: 90,
        },
        create: {
            userId: child1.id,
            lessonId: lesson1.id,
            completed: true,
            completedAt: new Date(),
            timeSpent: 300,
            quizScore: 90,
        },
    });

    await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: child1.id, lessonId: lesson2.id } },
        update: {
            completed: false,
            timeSpent: 120,
            quizScore: null,
        },
        create: {
            userId: child1.id,
            lessonId: lesson2.id,
            completed: false,
            timeSpent: 120,
            quizScore: null,
        },
    });

    await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: child2.id, lessonId: lesson1.id } },
        update: {
            completed: false,
            timeSpent: 60,
            quizScore: null,
        },
        create: {
            userId: child2.id,
            lessonId: lesson1.id,
            completed: false,
            timeSpent: 60,
            quizScore: null,
        },
    });

    console.log('📊 Progress data ensured');

    // -------------------------------
    // 10. UserStats for children
    // -------------------------------
    await prisma.userStats.upsert({
        where: { userId: child1.id },
        update: {
            xp: 150,
            level: 2,
            streak: 1,
            longestStreak: 1,
            totalPathsCompleted: 0,
            totalLessonsCompleted: 1,
        },
        create: {
            userId: child1.id,
            xp: 150,
            level: 2,
            streak: 1,
            longestStreak: 1,
            totalPathsCompleted: 0,
            totalLessonsCompleted: 1,
        },
    });

    await prisma.userStats.upsert({
        where: { userId: child2.id },
        update: {
            xp: 20,
            level: 1,
            streak: 0,
            longestStreak: 0,
            totalPathsCompleted: 0,
            totalLessonsCompleted: 0,
        },
        create: {
            userId: child2.id,
            xp: 20,
            level: 1,
            streak: 0,
            longestStreak: 0,
            totalPathsCompleted: 0,
            totalLessonsCompleted: 0,
        },
    });

    console.log('🎮 UserStats ensured');

    // -------------------------------
    // 11. Gamification Seed
    // -------------------------------
    const badges = [
        { name: 'أول درس', description: 'Complete your first lesson', iconUrl: '/badges/first-lesson.svg', criteria: { type: 'lesson_complete', count: 1 } },
        { name: '7 أيام متتالية', description: 'Maintain a 7-day streak', iconUrl: '/badges/7-day-streak.svg', criteria: { type: 'streak', days: 7 } },
        { name: '30 يوم متتالي', description: 'Maintain a 30-day streak', iconUrl: '/badges/30-day-streak.svg', criteria: { type: 'streak', days: 30 } },
        { name: 'إكمال مسار', description: 'Complete your first path', iconUrl: '/badges/path-complete.svg', criteria: { type: 'path_complete', count: 1 } },
        { name: '5 مسارات', description: 'Complete 5 paths', iconUrl: '/badges/5-paths.svg', criteria: { type: 'path_complete', count: 5 } },
        { name: 'اختبار مثالي', description: 'Score 100% on a quiz', iconUrl: '/badges/perfect-quiz.svg', criteria: { type: 'quiz_perfect', count: 1 } },
        { name: '10 اختبارات مثالية', description: 'Score 100% on 10 quizzes', iconUrl: '/badges/10-perfect-quizzes.svg', criteria: { type: 'quiz_perfect', count: 10 } },
        { name: 'متعلم نشط', description: 'Complete 50 lessons', iconUrl: '/badges/active-learner.svg', criteria: { type: 'lesson_complete', count: 50 } },
        { name: 'متعلم خبير', description: 'Complete 200 lessons', iconUrl: '/badges/expert-learner.svg', criteria: { type: 'lesson_complete', count: 200 } },
        { name: 'مساعد المجتمع', description: 'Get 10 upvotes on forum answers', iconUrl: '/badges/community-helper.svg', criteria: { type: 'forum_upvotes', count: 10 } },
    ];

    for (const badge of badges) {
        const existing = await prisma.badge.findFirst({ where: { name: badge.name } });
        if (!existing) {
            await prisma.badge.create({ data: badge });
        }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dailyQuests = [
        { title: 'أكمل درساً واحداً', titleEn: 'Complete 1 lesson', description: 'أكمل أي درس اليوم', xpReward: 20, target: 1, type: 'daily', startDate: today, endDate: tomorrow },
        { title: 'أكمل 3 دروس', titleEn: 'Complete 3 lessons', description: 'أكمل ثلاثة دروس اليوم', xpReward: 50, target: 3, type: 'daily', startDate: today, endDate: tomorrow },
        { title: 'حقق 100% في اختبار', titleEn: 'Score 100% on a quiz', description: 'احصل على علامة كاملة في أي اختبار', xpReward: 30, target: 1, type: 'daily', startDate: today, endDate: tomorrow },
    ];

    for (const quest of dailyQuests) {
        const existing = await prisma.quest.findFirst({ where: { title: quest.title, type: 'daily' } });
        if (!existing) {
            await prisma.quest.create({ data: quest });
        }
    }

    console.log('🏅 Badges and daily quests seeded');

    console.log('✅ Seed completed successfully.');
    console.log('---');
    console.log('Admin:  admin@qafzly.com / Admin@123456');
    console.log('Parent: parent@qafzly.com / Parent@123456');
    console.log('Child1: child1@qafzly.com / Child1@123456');
    console.log('Child2: child2@qafzly.com / Child2@123456');
    console.log('Published path: مقدمة إلى الحاسوب');
    console.log('Unpublished path: مقدمة إلى الإنترنت');
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