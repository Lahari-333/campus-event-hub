import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { z } from 'zod';

const updateRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

/**
 * GET /api/admin/users
 * Returns system user directory, role counts, and metrics.
 */
export async function getAdminUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const [totalUsers, studentCount, organizerCount, adminCount, rawUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: Role.STUDENT } }),
      prisma.user.count({ where: { role: Role.ORGANIZER } }),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          createdAt: true,
          _count: {
            select: {
              registrations: true,
              organizedEvents: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const users = rawUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      createdAt: u.createdAt,
      totalRegistrations: u._count.registrations,
      organizedEventsCount: u._count.organizedEvents,
    }));

    sendSuccess(res, 200, 'User directory fetched successfully', {
      totalUsers,
      roleDistribution: {
        students: studentCount,
        organizers: organizerCount,
        admins: adminCount,
      },
      users,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/users/:id/role
 * Admin update user role (STUDENT <-> ORGANIZER <-> ADMIN)
 */
export async function updateUserRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;
    const parseResult = updateRoleSchema.safeParse(req.body);

    if (!parseResult.success) {
      sendError(res, 400, 'Invalid role specified', parseResult.error.flatten());
      return;
    }

    const { role } = parseResult.data;

    // Check if target user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!existingUser) {
      sendError(res, 404, 'User not found');
      return;
    }

    const previousRole = existingUser.role;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        performedBy: req.user!.userId,
        action: 'USER_ROLE_UPDATED',
        details: {
          targetUserId: id,
          targetEmail: existingUser.email,
          previousRole,
          newRole: role,
        },
      },
    });

    sendSuccess(res, 200, `User role updated to ${role}`, { user: updatedUser });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/users/:id
 * Delete user account with safe cascade handling.
 */
export async function deleteUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'] as string;

    if (id === req.user!.userId) {
      sendError(res, 400, 'Administrators cannot delete their own active account');
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    });

    if (!existingUser) {
      sendError(res, 404, 'User not found');
      return;
    }

    await prisma.user.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        performedBy: req.user!.userId,
        action: 'USER_ACCOUNT_DELETED',
        details: {
          targetUserId: id,
          targetEmail: existingUser.email,
          targetName: existingUser.name,
        },
      },
    });

    sendSuccess(res, 200, `Account for ${existingUser.name} deleted successfully`);
  } catch (err) {
    next(err);
  }
}
