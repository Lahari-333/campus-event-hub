import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { z } from 'zod';

const createFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export async function submitFeedback(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params['id'] as string;
    const userId = req.user!.userId;

    const parseResult = createFeedbackSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 400, 'Rating must be an integer between 1 and 5', parseResult.error.flatten());
      return;
    }

    const { rating, comment } = parseResult.data;

    // Check Attendance: Must have CHECKED_IN or ATTENDED status
    const registration = await prisma.registration.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    if (!registration) {
      sendError(res, 403, 'You must be registered for this event to leave feedback');
      return;
    }

    if (registration.status !== 'CHECKED_IN' && registration.status !== 'ATTENDED') {
      sendError(
        res,
        403,
        'Only attendees who physically checked in to the event can submit reviews and ratings.',
      );
      return;
    }

    // Upsert feedback
    const feedback = await prisma.feedback.upsert({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      create: {
        userId,
        eventId,
        rating,
        comment: comment?.trim() || null,
      },
      update: {
        rating,
        comment: comment?.trim() || null,
      },
    });

    sendSuccess(res, 200, 'Thank you! Your feedback has been recorded.', { feedback });
  } catch (err) {
    next(err);
  }
}

export async function getEventFeedback(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params['id'] as string;

    const [feedbacks, stats] = await Promise.all([
      prisma.feedback.findMany({
        where: { eventId },
        include: {
          user: { select: { id: true, name: true, department: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.feedback.aggregate({
        where: { eventId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const avgVal = (stats as any)._avg?.rating;
    const averageRating = typeof avgVal === 'number' ? Number(avgVal.toFixed(1)) : 0;
    const totalReviews = (stats as any)._count?._all ?? feedbacks.length;

    sendSuccess(res, 200, 'Event feedback retrieved', {
      averageRating,
      totalReviews,
      feedbacks,
    });
  } catch (err) {
    next(err);
  }
}
