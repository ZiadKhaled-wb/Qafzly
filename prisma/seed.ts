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

    // ----- Test student for the Student Dashboard -----
    const testStudentPassword = await bcrypt.hash('Student@123456', 12);
    const testStudent = await prisma.user.upsert({
        where: { email: 'test-student@qafzly.com' },
        update: {},
        create: {
            email: 'test-student@qafzly.com',
            passwordHash: testStudentPassword,
            fullName: 'طالب تجريبي',
            displayName: 'Test Student',
            role: Role.STUDENT,
            isEmailVerified: true,
            language: 'ar',
            skillLevel: SkillLevel.INTERMEDIATE,
            isActive: true,
        },
    });

    // ----- Leaderboard filler users -----
    const leaderboardSeed = [
        { email: 'yusuf@qafzly.com', fullName: 'يوسف أحمد', xp: 2500 },
        { email: 'sara@qafzly.com', fullName: 'سارة محمد', xp: 2200 },
        { email: 'omar@qafzly.com', fullName: 'عمر خالد', xp: 1800 },
        { email: 'maryam@qafzly.com', fullName: 'مريم علي', xp: 900 },
        { email: 'ziad@qafzly.com', fullName: 'زياد مصطفى', xp: 400 },
    ];

    const fillerPassword = await bcrypt.hash('Student@123456', 12);
    const fillerUsers = [];
    for (const u of leaderboardSeed) {
        const created = await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: {
                email: u.email,
                passwordHash: fillerPassword,
                fullName: u.fullName,
                role: Role.STUDENT,
                isEmailVerified: true,
                language: 'ar',
                skillLevel: SkillLevel.BEGINNER,
                isActive: true,
            },
        });
        fillerUsers.push({ user: created, xp: u.xp });
    }

    console.log('👤 Test student + 5 leaderboard users ensured');

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

    // NEW: paid published path so the payment flow has a realistic non-zero amount to test against.
    const paidPath = await createPathIfNotExists({
        title: 'مقدمة إلى البرمجة بلغة بايثون',
        titleEn: 'Intro to Python Programming',
        description: 'ابدأ رحلتك في عالم البرمجة بلغة بايثون',
        descriptionEn: 'Start your journey into programming with Python',
        categoryId: programmingCat?.id,
        difficulty: PathDifficulty.BEGINNER,
        price: 150,
        currency: 'EGP',
        isPublished: true,
        isFeatured: true,
        estimatedDuration: 900,
        tags: ['python', 'programming', 'basics'],
        prerequisites: [],
        featuredImage: null,
    });

    console.log('📚 Paid path ensured: مقدمة إلى البرمجة بلغة بايثون (150 EGP)');

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
        // Real public YouTube IDs — safe for screenshots.
        // CONTENT TEAM: replace before pilot with final videos.
        overviewVideoUrl: 'M5QY2_8704o',
        pdfUrl: null,
        explanatoryVideoUrl: 'Z1RJmh_OqeA',
        slidesJson: [
            { concept: 'الحاسوب', question: 'ما هو الحاسوب؟', answer: 'جهاز إلكتروني' },
        ],
        challengeDescription: 'ابحث عن أجزاء الحاسوب في الصورة',
        challengeType: 'quiz',
        challengeData: { imageUrl: null },
        // 0 for testing — students can click through the whole path without waiting.
        // Set to 12 for production.
        lockDurationHours: 0,
        // NEW: lesson-completion XP (Sprint 12)
        completionXpAward: 10,
        // New fields
        warmUpJson: {
            type: 'RIDDLE',
            promptAr:
                'أنا عندي شاشة بس مش تلفزيون. وعندي كيبورد بس مش بيانو. وعندي ماوس بس مش فار. أنا مين؟ 🤔',
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
        rechargeMessageAr:
            'أحسنت! قدراتك بتتشحن دلوقتي. ارجع بكرة عشان تاخد 2x XP Boost!',
        rechargeMessageEn: null,
        rechargeXpBoost: true,
        rechargeBoostMultiplier: 2,
        rechargeBoostWindowHours: 24,
    };
    let lesson1 = await prisma.lesson.findFirst({
        where: { moduleId: module1.id, title: lesson1Data.title },
    });
    if (!lesson1) {
        lesson1 = await prisma.lesson.create({ data: lesson1Data });
    } else {
        // Backfill new fields on existing lesson without recreating
        lesson1 = await prisma.lesson.update({
            where: { id: lesson1.id },
            data: {
                overviewVideoUrl: lesson1Data.overviewVideoUrl,
                explanatoryVideoUrl: lesson1Data.explanatoryVideoUrl,
                lockDurationHours: lesson1Data.lockDurationHours,
                completionXpAward: lesson1Data.completionXpAward,
            },
        });
    }

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
        // NEW: lesson-completion XP (Sprint 12)
        completionXpAward: 10,
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
    if (!lesson2) {
        lesson2 = await prisma.lesson.create({ data: lesson2Data });
    } else {
        lesson2 = await prisma.lesson.update({
            where: { id: lesson2.id },
            data: { completionXpAward: lesson2Data.completionXpAward },
        });
    }

    console.log('🧩 Modules and lessons ensured with new structure');

    // Python path: one module, two lessons so it's navigable after enrollment.
    let pythonModule = await prisma.module.findFirst({
        where: { pathId: paidPath.id, title: 'أساسيات بايثون' },
    });
    if (!pythonModule) {
        pythonModule = await prisma.module.create({
            data: {
                pathId: paidPath.id,
                title: 'أساسيات بايثون',
                titleEn: 'Python Basics',
                description: 'تعرّف على أساسيات البرمجة بلغة بايثون',
                order: 1,
                isPublished: true,
            },
        });
    }

    const pythonLessonData = {
        moduleId: pythonModule.id,
        title: 'ما هي لغة بايثون؟',
        titleEn: 'What is Python?',
        content: 'مقدمة عن لغة بايثون واستخداماتها',
        contentType: ContentType.TEXT,
        order: 1,
        isPublished: true,
        isPreview: true,
        estimatedTime: 15,
        lockDurationHours: 0,
        completionXpAward: 10,
        warmUpJson: null,
        miniQuestJson: null,
        rechargeMessageAr: null,
        rechargeMessageEn: null,
        rechargeXpBoost: true,
        rechargeBoostMultiplier: 2,
        rechargeBoostWindowHours: 24,
    };
    let pythonLesson = await prisma.lesson.findFirst({
        where: { moduleId: pythonModule.id, title: pythonLessonData.title },
    });
    if (!pythonLesson) {
        pythonLesson = await prisma.lesson.create({ data: pythonLessonData });
    }

    console.log('🐍 Python path module + lesson ensured');

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
            questionAr:
                'لما بتضغط زرار في لعبة عشان شخصيتك تقفز، إيه هو "الإدخال" (Input)؟',
            optionsJson: ['قفز الشخصية', 'ضغطتك على الزرار', 'صوت اللعبة', 'الشاشة'],
            correctIndex: 1,
            explanationAr:
                'الإدخال هو الأمر اللي انت بتديه للكمبيوتر، واللي هو ضغطتك على الزرار!',
            xpAward: 5,
            order: 2,
        },
        {
            slideType: 'TRUE_FALSE',
            statementAr:
                'أول كمبيوتر في العالم كان حجمه زي حجم اللابتوب بتاعك دلوقتي.',
            correctAnswer: false,
            explanationAr: 'أول كمبيوتر كان حجمه زي أوضة كاملة! 😱',
            xpAward: 5,
            order: 3,
        },
        {
            slideType: 'FILL_BLANK',
            sentenceAr: 'الترانزستور هو عامل زي ___ البناء في مدينة الكمبيوتر.',
            acceptedAnswersJson: ['الطوبة', 'طوبه', 'طوب'],
            explanationAr:
                'الترانزستورات هي اللبنات الأساسية اللي بنبني بيها كل أجزاء الكمبيوتر.',
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
    // Always recreate the boss battle so seed changes (question count, bonuses)
    // take effect on re-seed. Idempotent — safe to run repeatedly.
    // UserBossBattleProgress rows cascade-delete with the battle.
    await prisma.bossBattleQuestion.deleteMany({
        where: { bossBattle: { moduleId: module1.id } },
    });
    await prisma.bossBattle.deleteMany({
        where: { moduleId: module1.id },
    });

    await prisma.bossBattle.create({
        data: {
            moduleId: module1.id,
            titleAr: 'وحش الفوضى',
            narrativeAr:
                'وحش الفوضى هاجم مدينة الكمبيوتر! 🐉 أنت المحارب الوحيد اللي يقدر يهزمه. كل إجابة صحيحة = ضربة قوية. كل إجابة غلط = الوحش بيقوى!',
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
                    {
                        questionAr: 'ما هي وحدة المعالجة المركزية (CPU)؟',
                        optionsAr: ['المعالج', 'الشاشة', 'الذاكرة', 'القرص الصلب'],
                        correctIndex: 0,
                        explanationAr: 'وحدة المعالجة المركزية هي المعالج الرئيسي في الكمبيوتر.',
                        xpAward: 10,
                        order: 4,
                    },
                    {
                        questionAr: 'ما هي الرامات (RAM)؟',
                        optionsAr: ['ذاكرة الوصول العشوائي', 'القرص الصلب', 'المعالج', 'كرت الشاشة'],
                        correctIndex: 0,
                        explanationAr: 'الرامات هي الذاكرة المؤقتة التي يستخدمها الكمبيوتر أثناء العمل.',
                        xpAward: 10,
                        order: 5,
                    },
                ],
            },
        },
    });
    console.log('👾 Boss battle ensured for module1 (5 questions)');

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

    // ----- Enrollment + partial progress for test student -----
    await prisma.enrollment.upsert({
        where: { userId_pathId: { userId: testStudent.id, pathId: publishedPath.id } },
        update: {},
        create: { userId: testStudent.id, pathId: publishedPath.id, isActive: true },
    });

    // Mark lesson 1 as completed so the test student sees 50% progress in the path
    await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: testStudent.id, lessonId: lesson1.id } },
        update: { completed: true, completedAt: new Date(), timeSpent: 600, quizScore: 95 },
        create: {
            userId: testStudent.id,
            lessonId: lesson1.id,
            completed: true,
            completedAt: new Date(),
            timeSpent: 600,
            quizScore: 95,
        },
    });
    console.log('📝 Test student enrollment and progress ensured');

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

    // ----- UserStats for test student + leaderboard users -----
    await prisma.userStats.upsert({
        where: { userId: testStudent.id },
        update: { xp: 1250, level: 5, streak: 12, longestStreak: 20, streakFreezeAvailable: 2 },
        create: {
            userId: testStudent.id,
            xp: 1250,
            level: 5,
            streak: 12,
            longestStreak: 20,
            totalPathsCompleted: 0,
            totalLessonsCompleted: 8,
            streakFreezeAvailable: 2,
        },
    });

    for (const { user, xp } of fillerUsers) {
        // Level is derived at read time, but store the approximate value for consistency
        const level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
        await prisma.userStats.upsert({
            where: { userId: user.id },
            update: { xp, level },
            create: {
                userId: user.id,
                xp,
                level,
                streak: 0,
                longestStreak: 0,
                totalPathsCompleted: 0,
                totalLessonsCompleted: 0,
                streakFreezeAvailable: 0,
            },
        });
    }
    console.log('🎮 UserStats for test student and leaderboard users ensured');

    // -------------------------------
    // 11. Gamification Seed
    // -------------------------------
    const badges = [
        // === Lesson / streak / path badges ===
        { name: 'أول درس', nameEn: 'First Lesson', description: 'Complete your first lesson', iconUrl: '/badges/first-lesson.svg', criteria: { type: 'lesson_complete', count: 1 } },
        { name: '7 أيام متتالية', nameEn: '7-Day Streak', description: 'Maintain a 7-day streak', iconUrl: '/badges/7-day-streak.svg', criteria: { type: 'streak', days: 7 } },
        { name: '30 يوم متتالي', nameEn: '30-Day Streak', description: 'Maintain a 30-day streak', iconUrl: '/badges/30-day-streak.svg', criteria: { type: 'streak', days: 30 } },
        { name: 'إكمال مسار', nameEn: 'Path Complete', description: 'Complete your first path', iconUrl: '/badges/path-complete.svg', criteria: { type: 'path_complete', count: 1 } },
        { name: '5 مسارات', nameEn: '5 Paths', description: 'Complete 5 paths', iconUrl: '/badges/5-paths.svg', criteria: { type: 'path_complete', count: 5 } },
        { name: 'اختبار مثالي', nameEn: 'Perfect Quiz', description: 'Score 100% on a quiz', iconUrl: '/badges/perfect-quiz.svg', criteria: { type: 'quiz_perfect', count: 1 } },
        { name: '10 اختبارات مثالية', nameEn: '10 Perfect Quizzes', description: 'Score 100% on 10 quizzes', iconUrl: '/badges/10-perfect-quizzes.svg', criteria: { type: 'quiz_perfect', count: 10 } },
        { name: 'متعلم نشط', nameEn: 'Active Learner', description: 'Complete 50 lessons', iconUrl: '/badges/active-learner.svg', criteria: { type: 'lesson_complete', count: 50 } },
        { name: 'متعلم خبير', nameEn: 'Expert Learner', description: 'Complete 200 lessons', iconUrl: '/badges/expert-learner.svg', criteria: { type: 'lesson_complete', count: 200 } },
        { name: 'مساعد المجتمع', nameEn: 'Community Helper', description: 'Get 10 upvotes on forum answers', iconUrl: '/badges/community-helper.svg', criteria: { type: 'forum_upvotes', count: 10 } },

        // === Boss Battle tier badges (Sprint 12) ===
        // Awarded on boss battle submission based on score tier.
        // Names match BOSS_BATTLE_BADGES in bossBattle.service.ts.
        { name: 'أسطورة المدينة', nameEn: 'City Legend', description: 'Scored 80% or higher on a Boss Battle', iconUrl: '/badges/city-legend.svg', criteria: { type: 'boss_battle', tier: 'legend' } },
        { name: 'محارب المدينة', nameEn: 'City Warrior', description: 'Scored 60% or higher on a Boss Battle', iconUrl: '/badges/city-warrior.svg', criteria: { type: 'boss_battle', tier: 'warrior' } },
        { name: 'متدرب المدينة', nameEn: 'City Trainee', description: 'Scored 40% or higher on a Boss Battle', iconUrl: '/badges/city-trainee.svg', criteria: { type: 'boss_battle', tier: 'trainee' } },
        { name: 'مش هستسلم', nameEn: "Won't Give Up", description: 'Attempted a Boss Battle', iconUrl: '/badges/wont-give-up.svg', criteria: { type: 'boss_battle', tier: 'retry' } },
    ];

    for (const badge of badges) {
        const existing = await prisma.badge.findFirst({ where: { name: badge.name } });
        if (!existing) {
            await prisma.badge.create({ data: badge });
        }
    }
    console.log(`🏅 Badges ensured: ${badges.length}`);

    // ----- Grant 2 badges to the test student -----
    const firstLessonBadge = await prisma.badge.findFirst({ where: { name: 'أول درس' } });
    const pathCompleteBadge = await prisma.badge.findFirst({ where: { name: 'إكمال مسار' } });
    if (firstLessonBadge) {
        await prisma.userBadge.upsert({
            where: { userId_badgeId: { userId: testStudent.id, badgeId: firstLessonBadge.id } },
            update: {},
            create: {
                userId: testStudent.id,
                badgeId: firstLessonBadge.id,
                earnedAt: new Date('2026-08-28T09:00:00Z'),
            },
        });
    }
    if (pathCompleteBadge) {
        await prisma.userBadge.upsert({
            where: { userId_badgeId: { userId: testStudent.id, badgeId: pathCompleteBadge.id } },
            update: {},
            create: {
                userId: testStudent.id,
                badgeId: pathCompleteBadge.id,
                earnedAt: new Date('2026-09-01T10:00:00Z'),
            },
        });
    }
    console.log('🏅 Test student badges granted');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Remove old daily quests (cascade deletes UserQuest records)
    await prisma.userQuest.deleteMany({
        where: { quest: { type: 'daily' } },
    });
    await prisma.quest.deleteMany({
        where: { type: 'daily' },
    });

    const dailyQuests = [
        {
            title: 'أكمل درساً واحداً',
            titleEn: 'Complete 1 lesson',
            description: 'أكمل أي درس اليوم',
            xpReward: 20,
            target: 1,
            type: 'daily',
            startDate: today,
            endDate: tomorrow,
        },
        {
            title: 'أكمل 3 دروس',
            titleEn: 'Complete 3 lessons',
            description: 'أكمل ثلاثة دروس اليوم',
            xpReward: 50,
            target: 3,
            type: 'daily',
            startDate: today,
            endDate: tomorrow,
        },
        {
            title: 'حقق 100% في اختبار',
            titleEn: 'Score 100% on a quiz',
            description: 'احصل على علامة كاملة في أي اختبار',
            xpReward: 30,
            target: 1,
            type: 'daily',
            startDate: today,
            endDate: tomorrow,
        },
    ];

    for (const quest of dailyQuests) {
        await prisma.quest.create({ data: quest });
    }

    console.log('🏅 Daily quests seeded');

        // -------------------------------
    // 12. Forum (categories, posts, comments, votes)
    // -------------------------------
    const forumCategorySeed = [
        { nameAr: 'أسئلة عامة', nameEn: 'General Questions', slug: 'general', displayOrder: 1 },
        { nameAr: 'مشاكل تقنية', nameEn: 'Technical Issues', slug: 'technical', displayOrder: 2 },
        { nameAr: 'نقاشات', nameEn: 'Discussions', slug: 'discussions', displayOrder: 3 },
        { nameAr: 'إعلانات', nameEn: 'Announcements', slug: 'announcements', displayOrder: 4 },
        { nameAr: 'اقتراحات', nameEn: 'Suggestions', slug: 'suggestions', displayOrder: 5 },
    ];

    for (const cat of forumCategorySeed) {
        const existing = await prisma.forumCategory.findUnique({ where: { slug: cat.slug } });
        if (!existing) {
            await prisma.forumCategory.create({ data: cat });
        }
    }

    const generalCat = await prisma.forumCategory.findUnique({ where: { slug: 'general' } });
    const technicalCat = await prisma.forumCategory.findUnique({ where: { slug: 'technical' } });
    const discussionsCat = await prisma.forumCategory.findUnique({ where: { slug: 'discussions' } });
    const announcementsCat = await prisma.forumCategory.findUnique({ where: { slug: 'announcements' } });
    const suggestionsCat = await prisma.forumCategory.findUnique({ where: { slug: 'suggestions' } });

    const yusuf = fillerUsers[0].user;
    const sara = fillerUsers[1].user;
    const omar = fillerUsers[2].user;
    const maryam = fillerUsers[3].user;

    const forumPostSeed = [
        { userId: testStudent.id, categoryId: generalCat?.id, title: 'إزاي أبدأ في تعلم البرمجة؟', content: 'أنا مبتدئ وعايز أعرف من فين أبدأ في تعلم البرمجة. تنصحوني بأي لغة؟' },
        { userId: testStudent.id, categoryId: technicalCat?.id, title: 'مشكلة في تشغيل الفيديو', content: 'الفيديو مش بيفتح معايا على المتصفح. حد عنده نفس المشكلة؟' },
        { userId: testStudent.id, categoryId: discussionsCat?.id, title: 'شاركوني تجاربكم مع بايثون', content: 'بدأت أتعلم بايثون من أسبوعين. عايز أعرف تجاربكم وإيه أكتر حاجة ساعدتكم.' },
        { userId: child1.id, categoryId: generalCat?.id, title: 'إزاي أذاكر بفعالية؟', content: 'بحس إني بنسى بسرعة. إيه أفضل طريقة للمراجعة؟' },
        { userId: child2.id, categoryId: technicalCat?.id, title: 'خطأ في تحميل ملف PDF', content: 'لما بحاول أفتح ملف PDF بيظهر لي رسالة خطأ. حد يعرف السبب؟' },
        { userId: yusuf.id, categoryId: discussionsCat?.id, title: 'إيه أفضل لغة للمبتدئين؟', content: 'في ناس بتقول بايثون وفي ناس بتقول جافاسكريبت. إيه رأيكم؟' },
        { userId: sara.id, categoryId: announcementsCat?.id, title: 'اختبارات جديدة قريباً', content: 'قريباً هنضيف اختبارات تفاعلية جديدة لكل الدروس.' },
        { userId: omar.id, categoryId: suggestionsCat?.id, title: 'اقتراح: المزيد من التمارين', content: 'أنا حابب أشوف تمارين تطبيقية أكتر مع كل درس.' },
    ];

    const createdPosts: any[] = [];
    for (const p of forumPostSeed) {
        const existing = await prisma.forumPost.findFirst({
            where: { userId: p.userId, title: p.title },
        });
        if (existing) {
            createdPosts.push(existing);
        } else {
            createdPosts.push(await prisma.forumPost.create({ data: p }));
        }
    }

    const post1 = createdPosts[0]; // testStudent: programming start
    const post3 = createdPosts[2]; // testStudent: python experiences (will get best answer)
    const post6 = createdPosts[5]; // yusuf: best language (will get best answer)
    const post8 = createdPosts[7]; // omar: suggestions

    const forumCommentSeed = [
        // post1
        { postId: post1.id, userId: child1.id, content: 'أنا بدأت ببايثون وكانت سهلة جداً. ابدأ بيها.' },
        { postId: post1.id, userId: yusuf.id, content: 'بايثون اختيار ممتاز للمبتدئين. جرب موقع python.org فيه تمارين.' },
        { postId: post1.id, userId: sara.id, content: 'جافاسكريبت كمان حلوة لو عايز تشتغل على الويب.' },
        // post3
        { postId: post3.id, userId: child1.id, content: 'أنا اتعلمت من تمارين LeetCode. بتساعد كتير.' },
        { postId: post3.id, userId: yusuf.id, content: 'أهم حاجة الممارسة اليومية. لو 20 دقيقة كل يوم هتفرق كتير.' },
        { postId: post3.id, userId: sara.id, content: 'أنصحك بمشروع صغير تطبق فيه اللي اتعلمته.' },
        // post6
        { postId: post6.id, userId: child1.id, content: 'بايثون أسهل، بس جافاسكريبت هتفتحلك مجال الويب.' },
        { postId: post6.id, userId: child2.id, content: 'أنا بدأت ببايثون وهي كانت مناسبة جداً كبداية.' },
        // post8
        { postId: post8.id, userId: child1.id, content: 'فكرة جميلة، أنا كمان بحب التمارين.' },
        { postId: post8.id, userId: maryam.id, content: 'أؤيد الاقتراح.' },
    ];

    const createdComments: any[] = [];
    for (const c of forumCommentSeed) {
        const existing = await prisma.forumComment.findFirst({
            where: { userId: c.userId, postId: c.postId, content: c.content },
        });
        if (existing) {
            createdComments.push(existing);
        } else {
            createdComments.push(await prisma.forumComment.create({ data: c }));
        }
    }

    // Nested replies
    const repliesSeed = [
        { postId: post1.id, userId: testStudent.id, parentCommentId: createdComments[0].id, content: 'شكراً! هبدأ بيها أكيد.' },
        { postId: post3.id, userId: testStudent.id, parentCommentId: createdComments[3].id, content: 'LeetCode مش صعب للبداية؟' },
        { postId: post3.id, userId: child1.id, parentCommentId: createdComments[3].id, content: 'في نسخة للـ beginners، ابدأ بيها.' },
    ];
    for (const r of repliesSeed) {
        const existing = await prisma.forumComment.findFirst({
            where: { userId: r.userId, postId: r.postId, content: r.content },
        });
        if (!existing) {
            await prisma.forumComment.create({ data: r });
        }
    }

    // Mark best answers on post3 and post6
    const markBest = async (postId: string, commentId: string) => {
        await prisma.forumComment.updateMany({
            where: { postId, isBestAnswer: true },
            data: { isBestAnswer: false },
        });
        await prisma.forumComment.update({
            where: { id: commentId },
            data: { isBestAnswer: true },
        });
        await prisma.forumPost.update({
            where: { id: postId },
            data: { isSolved: true },
        });
    };
    await markBest(post3.id, createdComments[4].id); // yusuf's comment
    await markBest(post6.id, createdComments[6].id); // child1's comment

    // Votes
    const voteSeed = [
        { userId: child1.id, targetType: 'post', targetId: post1.id, voteType: 1 },
        { userId: yusuf.id, targetType: 'post', targetId: post1.id, voteType: 1 },
        { userId: sara.id, targetType: 'post', targetId: post1.id, voteType: 1 },
        { userId: omar.id, targetType: 'post', targetId: post1.id, voteType: 1 },
        { userId: child1.id, targetType: 'post', targetId: post3.id, voteType: 1 },
        { userId: child2.id, targetType: 'post', targetId: post3.id, voteType: 1 },
        { userId: yusuf.id, targetType: 'post', targetId: post3.id, voteType: 1 },
        { userId: child1.id, targetType: 'post', targetId: post6.id, voteType: 1 },
        { userId: child2.id, targetType: 'post', targetId: post6.id, voteType: -1 },
        { userId: testStudent.id, targetType: 'post', targetId: post6.id, voteType: 1 },
        { userId: child1.id, targetType: 'comment', targetId: createdComments[3].id, voteType: 1 },
        { userId: yusuf.id, targetType: 'comment', targetId: createdComments[3].id, voteType: 1 },
        { userId: sara.id, targetType: 'comment', targetId: createdComments[4].id, voteType: 1 },
        { userId: child2.id, targetType: 'comment', targetId: createdComments[4].id, voteType: 1 },
        { userId: child1.id, targetType: 'comment', targetId: createdComments[6].id, voteType: 1 },
    ];

    for (const v of voteSeed) {
        const existing = await prisma.forumVote.findUnique({
            where: {
                userId_targetType_targetId: {
                    userId: v.userId,
                    targetType: v.targetType,
                    targetId: v.targetId,
                },
            },
        });
        if (!existing) {
            await prisma.forumVote.create({ data: v });
            if (v.targetType === 'post') {
                await prisma.forumPost.update({
                    where: { id: v.targetId },
                    data: v.voteType === 1 ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
                });
            } else {
                await prisma.forumComment.update({
                    where: { id: v.targetId },
                    data: v.voteType === 1 ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
                });
            }
        }
    }

    console.log('💬 Forum: 5 categories, 8 posts, 13 comments (3 replies), 15 votes seeded');

    console.log('✅ Seed completed successfully.');
    console.log('---');
    console.log('Admin:  admin@qafzly.com / Admin@123456');
    console.log('Parent: parent@qafzly.com / Parent@123456');
    console.log('Child1: child1@qafzly.com / Child1@123456');
    console.log('Child2: child2@qafzly.com / Child2@123456');
    console.log('Published path: مقدمة إلى الحاسوب');
    console.log('Unpublished path: مقدمة إلى الإنترنت');
    console.log('Test Student: test-student@qafzly.com / Student@123456 (XP 1250, Level 5)');
    console.log('---');
    console.log('Lesson 1 (تاريخ الحاسوب): lockDurationHours=0, completionXpAward=10, warmUp.xpAward=5');
    console.log('Boss Battle badge tiers: أسطورة المدينة / محارب المدينة / متدرب المدينة / مش هستسلم');
    console.log('CONTENT TEAM: replace video IDs M5QY2_8704o and Z1RJmh_OqeA before pilot.');
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