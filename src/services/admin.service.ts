import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { Role } from '@prisma/client';

export const listUsers = async (params: any) => {
    const { page, limit, search, role, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
        where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        ];
    }
    if (role) where.role = role;
    if (status === 'active') where.isActive = true;
    if (status === 'suspended') where.isActive = false;
    if (status === 'deleted') where.deletedAt = { not: null };

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                fullName: true,
                displayName: true,
                role: true,
                isActive: true,
                isEmailVerified: true,
                createdAt: true,
                lastLoginAt: true,
            },
        }),
        prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getUserById = async (id: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
        include: {
        stats: true,
        purchases: true,
        },
    });
    if (!user) throw new AppError(404, 'المستخدم غير موجود');
    return user;
};

export const updateUser = async (id: string, data: any) => {
    const user = await prisma.user.update({
        where: { id },
        data,
        select: {
        id: true,
        email: true,
        fullName: true,
        displayName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        },
    });
    return user;
};

export const suspendUser = async (id: string, reason?: string) => {
    const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: { id: true, isActive: true },
    });
    // TODO: store reason in audit log or a separate field
    return user;
};

export const activateUser = async (id: string) => {
    const user = await prisma.user.update({
        where: { id },
        data: { isActive: true },
        select: { id: true, isActive: true },
    });
    return user;
};

export const changeRole = async (id: string, role: string) => {
    const user = await prisma.user.update({
        where: { id },
        data: { role: role as Role},
        select: { id: true, role: true },
    });
    return user;
};