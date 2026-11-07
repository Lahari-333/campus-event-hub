import { Request, Response, NextFunction } from 'express';
import { RegistrationService, AppError } from '../services/registration.service';
import { sendSuccess, sendError } from '../utils/response';
import {
  registerParamSchema,
  cancelParamSchema,
  checkInSchema,
} from '../validators/registration.validators';

/**
 * POST /api/registrations/:eventId
 * Concurrency-safe event registration endpoint.
 * Accepts bookings for approved events, assigning CONFIRMED or WAITLISTED status.
 */
export async function registerForEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parseResult = registerParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      sendError(res, 400, 'Invalid event ID parameter', parseResult.error.flatten());
      return;
    }

    const { eventId } = parseResult.data;
    const userId = req.user!.userId;
    const seatNumber = typeof req.body?.seatNumber === 'string' ? req.body.seatNumber.trim() : undefined;

    const result = await RegistrationService.registerUser(userId, eventId, seatNumber);

    sendSuccess(res, 201, result.message, {
      status: result.status,
      registration: result.registration,
      waitlistPosition: result.waitlistPosition,
      remainingSeats: 'remainingSeats' in result ? result.remainingSeats : undefined,
      remainingWaitlistSlots:
        'remainingWaitlistSlots' in result ? result.remainingWaitlistSlots : undefined,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    next(err);
  }
}

/**
 * POST /api/registrations/:id/cancel
 * Student / Admin registration cancellation with automatic FIFO promotion.
 */
export async function cancelRegistration(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parseResult = cancelParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      sendError(res, 400, 'Invalid registration ID parameter', parseResult.error.flatten());
      return;
    }

    const { id } = parseResult.data;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const result = await RegistrationService.cancelRegistration(userId, userRole, id);

    sendSuccess(res, 200, 'Registration cancelled successfully', {
      cancelledRegistration: result.cancelledRegistration,
      promoted: result.promoted,
      remainingWaitlistCount: result.remainingWaitlistCount,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    next(err);
  }
}

/**
 * GET /api/registrations/my-registrations
 * Retrieve all event registrations for the authenticated student.
 */
export async function getMyRegistrations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const registrations = await RegistrationService.getUserRegistrations(userId);

    sendSuccess(res, 200, 'My registrations fetched successfully', {
      registrations,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    next(err);
  }
}

/**
 * GET /api/registrations/event/:eventId
 * Retrieve live capacity, waitlist counters, and current user booking status for an event.
 */
export async function getEventRegistrationStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parseResult = registerParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      sendError(res, 400, 'Invalid event ID parameter', parseResult.error.flatten());
      return;
    }

    const { eventId } = parseResult.data;
    const userId = req.user?.userId;

    const status = await RegistrationService.getEventStatus(eventId, userId);

    sendSuccess(res, 200, 'Event registration status retrieved successfully', status);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    next(err);
  }
}

/**
 * POST /api/registrations/check-in
 * Organizer / Admin check-in scanner verification endpoint.
 */
export async function checkInTicket(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parseResult = checkInSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 400, 'Invalid check-in request', parseResult.error.flatten());
      return;
    }

    const { qrToken } = parseResult.data;
    const performedByUserId = req.user!.userId;

    const result = await RegistrationService.checkInTicket(qrToken, performedByUserId);

    sendSuccess(res, 200, result.message, {
      registration: result.registration,
      student: result.student,
      event: result.event,
      checkedInAt: result.checkedInAt,
      confirmedBadge: result.confirmedBadge,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    next(err);
  }
}
