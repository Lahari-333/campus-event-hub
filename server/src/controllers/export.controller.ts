import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { sendError } from '../utils/response';

/**
 * GET /api/events/:id/export
 * Streams a formatted RFC 4180 CSV attendee and check-in roster.
 * Protected to Organizer of the event or Admin.
 */
export async function exportEventRoster(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params['id'] as string;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { venue: true },
    });

    if (!event) {
      sendError(res, 404, 'Event not found');
      return;
    }

    if (req.user!.role !== 'ADMIN' && event.organizerId !== req.user!.userId) {
      sendError(res, 403, 'You are only authorized to export rosters for your own events');
      return;
    }

    const registrations: any[] = await prisma.registration.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { registeredAt: 'asc' }],
    });

    const escapeCsv = (val: string | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const filename = `Roster_${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write CSV Header
    res.write('Student Name,Email,Department,Status,Seat Number,Queue Position,Registered At,Checked In At\n');

    // Write Data Rows
    registrations.forEach((reg) => {
      const row = [
        escapeCsv(reg.user.name),
        escapeCsv(reg.user.email),
        escapeCsv(reg.user.department || 'N/A'),
        escapeCsv(reg.status),
        escapeCsv(reg.seatNumber || 'General Admission'),
        escapeCsv(reg.waitlistPosition ? `#${reg.waitlistPosition}` : 'N/A'),
        escapeCsv(reg.registeredAt ? new Date(reg.registeredAt).toISOString() : ''),
        escapeCsv(reg.checkedInAt ? new Date(reg.checkedInAt).toISOString() : 'Not Checked In'),
      ].join(',');
      res.write(`${row}\n`);
    });

    res.end();
  } catch (err) {
    next(err);
  }
}
