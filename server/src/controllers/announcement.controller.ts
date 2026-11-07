import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { z } from 'zod';

const createAnnouncementSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  message: z.string().min(3, 'Message must be at least 3 characters'),
});

export async function createAnnouncement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params['id'] as string;
    const parseResult = createAnnouncementSchema.safeParse(req.body);

    if (!parseResult.success) {
      sendError(res, 400, 'Invalid announcement payload', parseResult.error.flatten());
      return;
    }

    const { title, message } = parseResult.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true },
    });

    if (!event) {
      sendError(res, 404, 'Event not found');
      return;
    }

    const announcement = await prisma.announcement.create({
      data: {
        eventId,
        title: title.trim(),
        message: message.trim(),
      },
    });

    await prisma.auditLog.create({
      data: {
        performedBy: req.user!.userId,
        action: 'EVENT_ANNOUNCEMENT_PUBLISHED',
        details: {
          eventId,
          announcementId: announcement.id,
          title: announcement.title,
        },
      },
    });

    sendSuccess(res, 201, 'Broadcast announcement published', { announcement });
  } catch (err) {
    next(err);
  }
}

export async function getEventAnnouncements(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params['id'] as string;

    const announcements = await prisma.announcement.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, 200, 'Announcements retrieved', { announcements });
  } catch (err) {
    next(err);
  }
}
