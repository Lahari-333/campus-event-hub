import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { prisma } from '../config/prisma';

export const attendanceEvents = new EventEmitter();
attendanceEvents.setMaxListeners(100);

/**
 * GET /api/events/:id/live-attendance
 * Native Server-Sent Events (SSE) live counter endpoint.
 * Pushes real-time checked-in metrics on every ticket scan.
 */
export async function streamLiveAttendance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params['id'] as string;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, capacity: true, title: true },
    });

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    // Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Helper to calculate & send live attendance snapshot
    const sendSnapshot = async () => {
      try {
        const [checkedInCount, confirmedCount] = await Promise.all([
          prisma.registration.count({
            where: {
              eventId,
              status: { in: ['CHECKED_IN', 'ATTENDED'] },
            },
          }),
          prisma.registration.count({
            where: {
              eventId,
              status: 'CONFIRMED',
            },
          }),
        ]);

        const percentage =
          event.capacity > 0 ? Math.round((checkedInCount / event.capacity) * 100) : 0;

        const payload = JSON.stringify({
          eventId,
          eventTitle: event.title,
          capacity: event.capacity,
          checkedInCount,
          confirmedCount,
          attendancePercentage: percentage,
          timestamp: new Date().toISOString(),
        });

        res.write(`data: ${payload}\n\n`);
      } catch (err) {
        console.error('SSE snapshot error:', err);
      }
    };

    // Send initial snapshot immediately upon client connection
    await sendSnapshot();

    // Keep-alive heartbeat every 15s to prevent intermediary timeout
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    // Event listener for live scan events emitted from checkInTicket
    const handleCheckInEvent = async (data: { eventId: string }) => {
      if (data.eventId === eventId) {
        await sendSnapshot();
      }
    };

    const eventKey = `checkin:${eventId}`;
    attendanceEvents.on(eventKey, handleCheckInEvent);

    // Cleanup when client disconnects
    req.on('close', () => {
      clearInterval(heartbeat);
      attendanceEvents.off(eventKey, handleCheckInEvent);
      res.end();
    });
  } catch (err) {
    next(err);
  }
}
