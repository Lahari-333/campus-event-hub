/**
 * Events Lifecycle & Temporal Venue Conflict Resolution Integration Tests
 *
 * Tests:
 *   1. Organizer can create an event proposal (201 Created).
 *   2. Submitting an overlapping booking for the same venue returns 409 Conflict.
 *   3. Student role attempting to call PATCH /api/events/:id/status receives 403 Forbidden.
 *   4. Admin role can approve an event proposal (200 OK).
 *   5. Input validation error (e.g. endTime <= startTime) returns 400 Bad Request.
 *   6. Admin conflict detection: approving an event that collides with an approved event returns 409.
 *   7. Public GET /api/events returns approved events with capacity counters.
 *   8. Organizer GET /api/events/my-events returns organizer's proposals across all statuses.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { signToken } from '../src/utils/jwt';
import { Role, EventStatus } from '@prisma/client';

// ─── Mock Prisma Client ───────────────────────────────────────────────────────
jest.mock('../src/config/prisma', () => {
  return {
    prisma: {
      venue: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      event: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    },
  };
});

import { prisma } from '../src/config/prisma';

const app = createApp();

const mockVenueFindUnique = prisma.venue.findUnique as jest.Mock;
const mockEventFindFirst = prisma.event.findFirst as jest.Mock;
const mockEventFindUnique = prisma.event.findUnique as jest.Mock;
const mockEventFindMany = prisma.event.findMany as jest.Mock;
const mockEventCreate = prisma.event.create as jest.Mock;
const mockEventUpdate = prisma.event.update as jest.Mock;
const mockAuditLogCreate = prisma.auditLog.create as jest.Mock;

// ─── Helper: Forge signed auth cookie ─────────────────────────────────────────
function makeAuthCookie(role: Role, userId = 'test-user-id', email = 'test@campus.edu'): string {
  const token = signToken({
    userId,
    email,
    role,
  });
  return `auth_token=${token}`;
}

describe('Campus Event Hub — Events Lifecycle & Conflict Resolution Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleVenue = {
    id: 'venue-auditorium-1',
    name: 'Main Auditorium',
    capacity: 500,
    location: 'Block A, Ground Floor',
    isAvailable: true,
  };

  const sampleEventProposal = {
    title: 'Autonomous Robotics Symposium',
    description: 'An in-depth conference exploring bleeding edge robotics, computer vision, and ROS2.',
    category: 'Technical',
    venueId: 'venue-auditorium-1',
    startTime: '2026-12-10T10:00:00.000Z',
    endTime: '2026-12-10T16:00:00.000Z',
    capacity: 250,
    waitlistCapacity: 50,
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Organizer can create an event proposal (201 Created)
  // ──────────────────────────────────────────────────────────────────────────
  describe('POST /api/events', () => {
    it('Organizer can create an event proposal (201 Created with status PENDING_APPROVAL)', async () => {
      // Mock: Venue exists and is available
      mockVenueFindUnique.mockResolvedValueOnce(sampleVenue);
      // Mock: No conflicting event exists
      mockEventFindFirst.mockResolvedValueOnce(null);
      // Mock: Created event record
      mockEventCreate.mockResolvedValueOnce({
        id: 'event-robotics-1',
        ...sampleEventProposal,
        startTime: new Date(sampleEventProposal.startTime),
        endTime: new Date(sampleEventProposal.endTime),
        status: EventStatus.PENDING_APPROVAL,
        organizerId: 'organizer-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        venue: sampleVenue,
        organizer: {
          id: 'organizer-user-id',
          name: 'Lead Organizer',
          email: 'organizer@campus.edu',
          department: 'Robotics',
        },
      });
      // Mock: AuditLog created
      mockAuditLogCreate.mockResolvedValueOnce({ id: 'audit-log-1' });

      const response = await request(app)
        .post('/api/events')
        .set('Cookie', makeAuthCookie(Role.ORGANIZER, 'organizer-user-id'))
        .send(sampleEventProposal);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toBeDefined();
      expect(response.body.data.event.title).toBe(sampleEventProposal.title);
      expect(response.body.data.event.status).toBe(EventStatus.PENDING_APPROVAL);

      // Verify AuditLog creation was invoked
      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            performedBy: 'organizer-user-id',
            action: 'CREATE_EVENT_PROPOSAL',
          }),
        }),
      );
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 2: Submitting an overlapping booking returns 409 Conflict
    // ────────────────────────────────────────────────────────────────────────
    it('Submitting an overlapping booking for the same venue returns 409 Conflict', async () => {
      // Mock: Venue exists
      mockVenueFindUnique.mockResolvedValueOnce(sampleVenue);
      // Mock: Conflicting event occupies venue during that time window
      const conflictingEvent = {
        id: 'existing-event-1',
        title: 'National Hackathon 2026',
        startTime: new Date('2026-12-10T12:00:00.000Z'),
        endTime: new Date('2026-12-10T18:00:00.000Z'),
        status: EventStatus.APPROVED,
        venue: { name: sampleVenue.name },
      };
      mockEventFindFirst.mockResolvedValueOnce(conflictingEvent);

      const response = await request(app)
        .post('/api/events')
        .set('Cookie', makeAuthCookie(Role.ORGANIZER, 'organizer-user-id'))
        .send(sampleEventProposal);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/conflict/i);
      expect(response.body.errors.conflict).toBeDefined();
      expect(response.body.errors.conflict.title).toBe('National Hackathon 2026');

      // Ensure creation was blocked
      expect(mockEventCreate).not.toHaveBeenCalled();
    });

    it('returns 400 Bad Request when endTime is before startTime', async () => {
      const invalidProposal = {
        ...sampleEventProposal,
        startTime: '2026-12-10T16:00:00.000Z',
        endTime: '2026-12-10T10:00:00.000Z', // inverted
      };

      const response = await request(app)
        .post('/api/events')
        .set('Cookie', makeAuthCookie(Role.ORGANIZER))
        .send(invalidProposal);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/validation failed/i);
    });

    it('returns 403 Forbidden when STUDENT role attempts to create an event', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Cookie', makeAuthCookie(Role.STUDENT))
        .send(sampleEventProposal);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3 & 4: Status Transition (PATCH /api/events/:id/status)
  // ──────────────────────────────────────────────────────────────────────────
  describe('PATCH /api/events/:id/status', () => {
    const existingProposal = {
      id: 'prop-123',
      title: 'AI Workshop',
      venueId: 'venue-auditorium-1',
      startTime: new Date('2026-12-15T10:00:00.000Z'),
      endTime: new Date('2026-12-15T14:00:00.000Z'),
      status: EventStatus.PENDING_APPROVAL,
      organizerId: 'organizer-user-id',
      capacity: 100,
      venue: sampleVenue,
    };

    // TEST 3: Student role receives 403 Forbidden
    it('Student role attempting to call PATCH /api/events/:id/status receives 403 Forbidden', async () => {
      const response = await request(app)
        .patch('/api/events/prop-123/status')
        .set('Cookie', makeAuthCookie(Role.STUDENT))
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/access denied/i);
    });

    // TEST 4: Admin role can approve an event proposal (200 OK)
    it('Admin role can approve an event proposal (200 OK)', async () => {
      // Mock: Find target proposal
      mockEventFindUnique.mockResolvedValueOnce(existingProposal);
      // Mock: Conflict resolution check finds no approved overlapping events
      mockEventFindFirst.mockResolvedValueOnce(null);
      // Mock: Successful status update
      mockEventUpdate.mockResolvedValueOnce({
        ...existingProposal,
        status: EventStatus.APPROVED,
        venue: sampleVenue,
        organizer: {
          id: 'organizer-user-id',
          name: 'Organizer Name',
          email: 'org@campus.edu',
        },
      });
      // Mock: AuditLog created
      mockAuditLogCreate.mockResolvedValueOnce({ id: 'audit-log-2' });

      const response = await request(app)
        .patch('/api/events/prop-123/status')
        .set('Cookie', makeAuthCookie(Role.ADMIN, 'admin-user-id'))
        .send({ status: 'APPROVED', reason: 'Meets campus policy guidelines' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event.status).toBe(EventStatus.APPROVED);

      // Verify AuditLog record logged the admin action
      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            performedBy: 'admin-user-id',
            action: 'EVENT_STATUS_APPROVED',
          }),
        }),
      );
    });

    it('Admin approval fails with 409 Conflict if another event was approved for the same venue/slot', async () => {
      mockEventFindUnique.mockResolvedValueOnce(existingProposal);
      // Mock: Conflict found during approval
      mockEventFindFirst.mockResolvedValueOnce({
        id: 'conflicting-approved-event',
        title: 'Already Approved Workshop',
        startTime: new Date('2026-12-15T11:00:00.000Z'),
        endTime: new Date('2026-12-15T15:00:00.000Z'),
        status: EventStatus.APPROVED,
        venue: { name: sampleVenue.name },
      });

      const response = await request(app)
        .patch('/api/events/prop-123/status')
        .set('Cookie', makeAuthCookie(Role.ADMIN, 'admin-user-id'))
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/temporal collision/i);
      expect(mockEventUpdate).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Public Discovery GET /api/events
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /api/events', () => {
    it('Public route fetches APPROVED events with capacity counters', async () => {
      mockEventFindMany.mockResolvedValueOnce([
        {
          id: 'event-1',
          title: 'Campus Hackathon',
          description: 'A 24hr build festival',
          category: 'Hackathon',
          capacity: 100,
          status: EventStatus.APPROVED,
          startTime: new Date('2026-12-01T09:00:00.000Z'),
          endTime: new Date('2026-12-01T21:00:00.000Z'),
          venue: sampleVenue,
          organizer: { id: 'org-1', name: 'John', email: 'john@campus.edu' },
          _count: { registrations: 45 },
        },
      ]);

      const response = await request(app).get('/api/events');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.events[0].registeredCount).toBe(45);
      expect(response.body.data.events[0].remainingSeats).toBe(55);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Organizer My-Events GET /api/events/my-events
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /api/events/my-events', () => {
    it('returns organizer events across all statuses', async () => {
      mockEventFindMany.mockResolvedValueOnce([
        {
          id: 'event-1',
          title: 'Draft Event',
          capacity: 50,
          status: EventStatus.DRAFT,
          venue: sampleVenue,
          _count: { registrations: 0 },
        },
        {
          id: 'event-2',
          title: 'Pending Proposal',
          capacity: 100,
          status: EventStatus.PENDING_APPROVAL,
          venue: sampleVenue,
          _count: { registrations: 0 },
        },
      ]);

      const response = await request(app)
        .get('/api/events/my-events')
        .set('Cookie', makeAuthCookie(Role.ORGANIZER, 'organizer-user-id'));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Live Conflict Check GET /api/events/check-conflict
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /api/events/check-conflict', () => {
    it('reports hasConflict: false when venue slot is completely free', async () => {
      mockEventFindFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/events/check-conflict')
        .query({
          venueId: 'venue-auditorium-1',
          startTime: '2026-12-20T10:00:00.000Z',
          endTime: '2026-12-20T14:00:00.000Z',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.hasConflict).toBe(false);
    });

    it('reports hasConflict: true with collision details when slot overlaps', async () => {
      mockEventFindFirst.mockResolvedValueOnce({
        id: 'existing-slot-id',
        title: 'Dance Auditions',
        startTime: new Date('2026-12-20T12:00:00.000Z'),
        endTime: new Date('2026-12-20T16:00:00.000Z'),
        status: EventStatus.APPROVED,
        venue: { name: 'Main Auditorium' },
      });

      const response = await request(app)
        .get('/api/events/check-conflict')
        .query({
          venueId: 'venue-auditorium-1',
          startTime: '2026-12-20T10:00:00.000Z',
          endTime: '2026-12-20T14:00:00.000Z',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.hasConflict).toBe(true);
      expect(response.body.data.conflictingEvent.title).toBe('Dance Auditions');
    });
  });
});
