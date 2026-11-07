import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { z } from 'zod';

const createTeamSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  name: z.string().min(2, 'Team name must be at least 2 characters'),
});

const joinTeamSchema = z.object({
  code: z.string().min(3, 'Invite code is required'),
});

export async function createTeam(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parseResult = createTeamSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 400, 'Invalid team creation data', parseResult.error.flatten());
      return;
    }

    const { eventId, name } = parseResult.data;
    const userId = req.user!.userId;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true },
    });

    if (!event) {
      sendError(res, 404, 'Event not found');
      return;
    }

    // Unique alphanumeric invite code
    const code = `TEAM-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    // Create team and add leader as first member
    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        code,
        leaderId: userId,
        eventId,
        members: {
          create: {
            userId,
          },
        },
      },
      include: {
        leader: { select: { id: true, name: true, email: true, department: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, department: true } },
          },
        },
      },
    });

    sendSuccess(res, 201, `Team "${team.name}" created! Share code: ${team.code}`, { team });
  } catch (err) {
    next(err);
  }
}

export async function joinTeam(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parseResult = joinTeamSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 400, 'Invite code is required', parseResult.error.flatten());
      return;
    }

    const code = parseResult.data.code.trim().toUpperCase();
    const userId = req.user!.userId;

    const team = await prisma.team.findUnique({
      where: { code },
      include: {
        members: true,
      },
    });

    if (!team) {
      sendError(res, 404, 'Invalid team invite code. Team not found.');
      return;
    }

    // Check if already in team
    const alreadyMember = team.members.some((m) => m.userId === userId);
    if (alreadyMember) {
      sendError(res, 409, 'You are already a member of this team');
      return;
    }

    // Max 4 members per hackathon team
    if (team.members.length >= 4) {
      sendError(res, 400, 'This team has reached its maximum roster limit (4 members)');
      return;
    }

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId,
      },
    });

    const updatedTeam = await prisma.team.findUnique({
      where: { id: team.id },
      include: {
        leader: { select: { id: true, name: true, email: true, department: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, department: true } },
          },
        },
      },
    });

    sendSuccess(res, 200, `Successfully joined team "${team.name}"!`, { team: updatedTeam });
  } catch (err) {
    next(err);
  }
}

export async function getEventTeams(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params['id'] as string;

    const teams = await prisma.team.findMany({
      where: { eventId },
      include: {
        leader: { select: { id: true, name: true, email: true, department: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, department: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, 200, 'Event teams retrieved successfully', { teams });
  } catch (err) {
    next(err);
  }
}
