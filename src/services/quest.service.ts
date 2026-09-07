import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { awardXpWithRecharge } from './recharge.service';

export const createCheckpoint = async (lessonId: string, data: any) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new AppError(404, 'الدرس غير موجود');

  const order = data.order ?? (await prisma.questCheckpoint.count({ where: { lessonId } })) + 1;

  return prisma.questCheckpoint.create({
    data: {
      lessonId,
      titleAr: data.titleAr,
      titleEn: data.titleEn,
      taskAr: data.taskAr,
      taskEn: data.taskEn,
      hintAr: data.hintAr,
      hintEn: data.hintEn,
      xpAward: data.xpAward ?? 15,
      order,
    },
  });
};

export const updateCheckpoint = async (checkpointId: string, data: any) => {
  const checkpoint = await prisma.questCheckpoint.findUnique({ where: { id: checkpointId } });
  if (!checkpoint) throw new AppError(404, 'نقطة التحقق غير موجودة');

  return prisma.questCheckpoint.update({
    where: { id: checkpointId },
    data,
  });
};

export const deleteCheckpoint = async (checkpointId: string) => {
  const checkpoint = await prisma.questCheckpoint.findUnique({ where: { id: checkpointId } });
  if (!checkpoint) throw new AppError(404, 'نقطة التحقق غير موجودة');

  await prisma.questCheckpoint.delete({ where: { id: checkpointId } });
};

export const reorderCheckpoints = async (lessonId: string, orderedIds: string[]) => {
  const checkpoints = await prisma.questCheckpoint.findMany({ where: { lessonId } });
  const map = new Map(checkpoints.map(c => [c.id, c]));

  for (let i = 0; i < orderedIds.length; i++) {
    if (!map.has(orderedIds[i])) throw new AppError(400, 'قائمة نقاط التحقق غير صحيحة');
    await prisma.questCheckpoint.update({
      where: { id: orderedIds[i] },
      data: { order: i + 1 },
    });
  }
};

export const getCheckpointsForLesson = async (lessonId: string, userId?: string) => {
  const checkpoints = await prisma.questCheckpoint.findMany({
    where: { lessonId },
    orderBy: { order: 'asc' },
  });

  if (!userId) return checkpoints;

  const progress = await prisma.userQuestProgress.findMany({
    where: { userId, lessonId },
    select: { checkpointId: true, completed: true },
  });
  const progressMap = new Map(progress.map(p => [p.checkpointId, p.completed]));

  return checkpoints.map(c => ({
    ...c,
    completed: progressMap.get(c.id) ?? false,
  }));
};

export const completeCheckpoint = async (lessonId: string, checkpointId: string, userId: string, data: any) => {
  const checkpoint = await prisma.questCheckpoint.findFirst({
    where: { id: checkpointId, lessonId },
  });
  if (!checkpoint) throw new AppError(404, 'نقطة التحقق غير موجودة');

  const existing = await prisma.userQuestProgress.findUnique({
    where: { userId_checkpointId: { userId, checkpointId } },
  });
  if (existing?.completed) throw new AppError(400, 'تم إكمال نقطة التحقق بالفعل');

  const xpEarned = data.completed ? checkpoint.xpAward : 0;

  await prisma.userQuestProgress.upsert({
    where: { userId_checkpointId: { userId, checkpointId } },
    update: { completed: data.completed, completedAt: new Date(), xpEarned },
    create: {
      userId,
      lessonId,
      checkpointId,
      completed: data.completed,
      completedAt: new Date(),
      xpEarned,
    },
  });

  if (xpEarned > 0) {
    await awardXpWithRecharge(userId, xpEarned, lessonId);
  }

  const allCheckpoints = await prisma.questCheckpoint.findMany({
    where: { lessonId },
    select: { id: true, order: true, titleAr: true },
    orderBy: { order: 'asc' },
  });
  const completedProgress = await prisma.userQuestProgress.findMany({
    where: { userId, lessonId, completed: true },
    select: { checkpointId: true },
  });
  const completedIds = new Set(completedProgress.map(p => p.checkpointId));
  const questCompleted = allCheckpoints.every(c => completedIds.has(c.id));

  const nextCheckpoint = allCheckpoints.find(c => !completedIds.has(c.id));

  return {
    checkpointId,
    completed: true,
    xpEarned,
    questCompleted,
    nextCheckpoint: nextCheckpoint
      ? { id: nextCheckpoint.id, titleAr: nextCheckpoint.titleAr, order: nextCheckpoint.order }
      : null,
  };
};