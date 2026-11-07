import { Request, Response, NextFunction } from 'express';
import { EventStatus, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { findVenueConflict } from '../services/conflict.service';
import {
  createEventSchema,
  updateEventStatusSchema,
  checkConflictQuerySchema,
} from '../validators/event.validators';

/**
 * POST /api/events
 * Organizer route: Creates a new event proposal.
 * Validates input, enforces temporal venue conflict detection,
 * assigns initial status = PENDING_APPROVAL, and writes to AuditLog.
 */
export async function createEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // 1. Zod input validation
    const parseResult = createEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 400, 'Validation failed for event creation', parseResult.error.flatten());
      return;
    }

    const input = parseResult.data;
    const organizerId = req.user!.userId;

    // 2. Validate that target venue exists and check capacity limits
    const venue = await prisma.venue.findUnique({
      where: { id: input.venueId },
    });

    if (!venue) {
      sendError(res, 404, 'The selected venue does not exist');
      return;
    }

    if (!venue.isAvailable) {
      sendError(res, 400, 'The selected venue is currently marked unavailable for bookings');
      return;
    }

    if (input.capacity > venue.capacity) {
      sendError(
        res,
        400,
        `Event capacity (${input.capacity}) exceeds venue maximum capacity (${venue.capacity})`,
      );
      return;
    }

    // 3. Temporal Venue Conflict Resolution Check
    const conflictResult = await findVenueConflict(prisma, {
      venueId: input.venueId,
      startTime: input.startTime,
      endTime: input.endTime,
      statuses: [EventStatus.APPROVED, EventStatus.PENDING_APPROVAL],
    });

    if (conflictResult.hasConflict && conflictResult.conflictingEvent) {
      const conflict = conflictResult.conflictingEvent;
      sendError(
        res,
        409,
        `Venue conflict detected: "${venue.name}" is already booked for "${conflict.title}" during the requested time window.`,
        {
          conflict: {
            id: conflict.id,
            title: conflict.title,
            startTime: conflict.startTime,
            endTime: conflict.endTime,
            status: conflict.status,
            venueName: venue.name,
          },
        },
      );
      return;
    }

    // 4. Create event with initial status = PENDING_APPROVAL
    const event = await prisma.event.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        venueId: input.venueId,
        startTime: input.startTime,
        endTime: input.endTime,
        capacity: input.capacity,
        waitlistCapacity: input.waitlistCapacity,
        status: EventStatus.PENDING_APPROVAL,
        organizerId,
      },
      include: {
        venue: true,
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
      },
    });

    // 5. Write to AuditLog
    await prisma.auditLog.create({
      data: {
        performedBy: organizerId,
        action: 'CREATE_EVENT_PROPOSAL',
        details: {
          eventId: event.id,
          title: event.title,
          venueId: event.venueId,
          startTime: event.startTime.toISOString(),
          endTime: event.endTime.toISOString(),
          capacity: event.capacity,
          initialStatus: EventStatus.PENDING_APPROVAL,
        },
      },
    });

    sendSuccess(
      res,
      201,
      'Event proposal submitted successfully and is pending approval',
      { event },
    );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/events
 * Public route: Fetches APPROVED events with capacity counters and category/search filters.
 */
export async function getEvents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { category, search } = req.query;

    const whereClause: Record<string, unknown> = {
      status: EventStatus.APPROVED,
    };

    if (typeof category === 'string' && category.trim().length > 0 && category !== 'All') {
      whereClause.category = category.trim();
    }

    if (typeof search === 'string' && search.trim().length > 0) {
      const searchTerm = search.trim();
      whereClause.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        venue: true,
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    // Format output with remaining seats counter
    const formattedEvents = events.map((event) => {
      const registeredCount = event._count?.registrations ?? 0;
      const remainingSeats = Math.max(0, event.capacity - registeredCount);

      return {
        ...event,
        registeredCount,
        remainingSeats,
      };
    });

    sendSuccess(res, 200, 'Approved events retrieved successfully', {
      events: formattedEvents,
      total: formattedEvents.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/events/my-events
 * Organizer route: Returns all events created by the logged-in organizer across all statuses.
 */
export async function getMyEvents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const organizerId = req.user!.userId;

    const events = await prisma.event.findMany({
      where: {
        organizerId,
      },
      include: {
        venue: true,
        _count: {
          select: {
            registrations: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedEvents = events.map((event) => {
      const registeredCount = event._count?.registrations ?? 0;
      const remainingSeats = Math.max(0, event.capacity - registeredCount);

      return {
        ...event,
        registeredCount,
        remainingSeats,
      };
    });

    sendSuccess(res, 200, 'Organizer events retrieved successfully', {
      events: formattedEvents,
      total: formattedEvents.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/events/proposals
 * Admin route: Returns all events pending approval or with any status for administrative review.
 */
export async function getAdminProposals(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { status } = req.query;

    const whereClause: Record<string, unknown> = {};
    if (typeof status === 'string' && status.trim().length > 0 && status !== 'ALL') {
      whereClause.status = status as EventStatus;
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        venue: true,
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    sendSuccess(res, 200, 'Admin event proposals retrieved successfully', {
      events,
      total: events.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/events/check-conflict
 * Public/Organizer utility route: Live verification of venue schedule conflicts.
 */
export async function checkConflict(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parseResult = checkConflictQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      sendError(res, 400, 'Invalid parameters for conflict check', parseResult.error.flatten());
      return;
    }

    const { venueId, startTime, endTime, excludeEventId } = parseResult.data;

    const conflictResult = await findVenueConflict(prisma, {
      venueId,
      startTime,
      endTime,
      excludeEventId,
      statuses: [EventStatus.APPROVED, EventStatus.PENDING_APPROVAL],
    });

    sendSuccess(res, 200, 'Conflict check completed', conflictResult);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/events/:id
 * Public/Organizer route: Retrieves full event details, assigned venue info, and remaining seat count.
 */
export async function getEventById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        venue: true,
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    });

    if (!event) {
      sendError(res, 404, 'Event not found');
      return;
    }

    // If event is not approved, only organizer and admin can view it
    if (event.status !== EventStatus.APPROVED) {
      const user = req.user;
      const isOwner = user && user.userId === event.organizerId;
      const isAdmin = user && user.role === Role.ADMIN;

      if (!isOwner && !isAdmin) {
        sendError(res, 403, 'Access denied: Event proposal is not published');
        return;
      }
    }

    const registeredCount = event._count?.registrations ?? 0;
    const remainingSeats = Math.max(0, event.capacity - registeredCount);

    sendSuccess(res, 200, 'Event details retrieved successfully', {
      event: {
        ...event,
        registeredCount,
        remainingSeats,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/events/:id/status
 * Admin route: Transitions event status to APPROVED or REJECTED.
 * Performs temporal conflict resolution before approving and records outcome in AuditLog.
 */
export async function updateEventStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;

    // 1. Zod input validation
    const parseResult = updateEventStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 400, 'Validation failed for status update', parseResult.error.flatten());
      return;
    }

    const { status, reason } = parseResult.data;
    const adminId = req.user!.userId;

    // 2. Find target event
    const event = await prisma.event.findUnique({
      where: { id },
      include: { venue: true },
    });

    if (!event) {
      sendError(res, 404, 'Event not found');
      return;
    }

    // 3. If approving, check for overlapping approved events
    if (status === EventStatus.APPROVED) {
      const conflictResult = await findVenueConflict(prisma, {
        venueId: event.venueId,
        startTime: event.startTime,
        endTime: event.endTime,
        excludeEventId: event.id,
        statuses: [EventStatus.APPROVED],
      });

      if (conflictResult.hasConflict && conflictResult.conflictingEvent) {
        const conflict = conflictResult.conflictingEvent;
        sendError(
          res,
          409,
          `Cannot approve event: Temporal collision detected with already approved event "${conflict.title}" at "${event.venue.name}".`,
          {
            conflict: {
              id: conflict.id,
              title: conflict.title,
              startTime: conflict.startTime,
              endTime: conflict.endTime,
              status: conflict.status,
              venueName: event.venue.name,
            },
          },
        );
        return;
      }
    }

    // 4. Update event status
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: { status },
      include: {
        venue: true,
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 5. Record action in AuditLog
    await prisma.auditLog.create({
      data: {
        performedBy: adminId,
        action: `EVENT_STATUS_${status}`,
        details: {
          eventId: event.id,
          title: event.title,
          previousStatus: event.status,
          newStatus: status,
          reason: reason || null,
        },
      },
    });

    sendSuccess(
      res,
      200,
      `Event status successfully updated to ${status}`,
      { event: updatedEvent },
    );
  } catch (error) {
    next(error);
  }
}
