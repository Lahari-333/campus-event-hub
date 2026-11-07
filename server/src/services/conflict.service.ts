import { EventStatus, PrismaClient } from '@prisma/client';

export interface ConflictCheckParams {
  venueId: string;
  startTime: Date;
  endTime: Date;
  excludeEventId?: string;
  statuses?: EventStatus[];
}

export interface ConflictingEventSummary {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: EventStatus;
  venueName?: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingEvent?: ConflictingEventSummary;
}

/**
 * Temporal Venue Conflict Resolution Engine
 *
 * Checks if a requested venue is already occupied by an overlapping event
 * during the proposed time window.
 *
 * Conflict condition:
 *   venueId == targetVenueId
 *   AND (newStartTime < existingEndTime AND newEndTime > existingStartTime)
 *   AND status IN ('APPROVED', 'PENDING_APPROVAL')
 *
 * @param prisma Prisma client instance (or transaction client)
 * @param params Query parameters for checking conflicts
 * @returns ConflictCheckResult indicating whether a conflict exists
 */
export async function findVenueConflict(
  prisma: Pick<PrismaClient, 'event'>,
  params: ConflictCheckParams,
): Promise<ConflictCheckResult> {
  const {
    venueId,
    startTime,
    endTime,
    excludeEventId,
    statuses = [EventStatus.APPROVED, EventStatus.PENDING_APPROVAL],
  } = params;

  // Query for overlapping events in the target venue
  const conflict = await prisma.event.findFirst({
    where: {
      venueId,
      status: {
        in: statuses,
      },
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      // Overlapping slot condition:
      // (newStartTime < existingEndTime) AND (newEndTime > existingStartTime)
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } },
      ],
    },
    include: {
      venue: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!conflict) {
    return { hasConflict: false };
  }

  return {
    hasConflict: true,
    conflictingEvent: {
      id: conflict.id,
      title: conflict.title,
      startTime: conflict.startTime,
      endTime: conflict.endTime,
      status: conflict.status,
      venueName: conflict.venue?.name,
    },
  };
}
