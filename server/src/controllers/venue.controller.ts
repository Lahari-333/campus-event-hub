import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';

/**
 * GET /api/venues
 * Public/Organizer route: Lists all venues with capacities and locations.
 */
export async function getVenues(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const venues = await prisma.venue.findMany({
      orderBy: { name: 'asc' },
    });

    sendSuccess(res, 200, 'Venues retrieved successfully', { venues });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/venues/:id
 * Public route: Retrieves details of a specific venue.
 */
export async function getVenueById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const venue = await prisma.venue.findUnique({
      where: { id },
    });

    if (!venue) {
      sendError(res, 404, 'Venue not found');
      return;
    }

    sendSuccess(res, 200, 'Venue details retrieved', { venue });
  } catch (error) {
    next(error);
  }
}
