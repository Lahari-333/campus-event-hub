/**
 * Phase 4: Organizer QR Code Check-In Engine Integration Tests
 *
 * Verifies:
 *   1. Organizer can verify and check in a confirmed ticket (200 OK).
 *   2. Admin can verify and check in a confirmed ticket (200 OK).
 *   3. Student role calling check-in receives 403 Forbidden.
 *   4. Unauthenticated request receives 401 Unauthorized.
 *   5. Non-existent QR token returns 404 Not Found.
 *   6. Waitlisted or cancelled ticket returns 400 Bad Request.
 *   7. Re-scanning an already checked-in ticket returns 409 Conflict with timestamp.
 *   8. Missing QR token payload returns 400 Validation Error.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { signToken } from '../src/utils/jwt';
import { Role } from '@prisma/client';

// ─── Mock In-Memory Registrations & Data ──────────────────────────────────────
const mockStudent = {
  id: 'student-charlie-01',
  name: 'Charlie Brown',
  email: 'charlie@campus.edu',
  department: 'Computer Science',
  role: Role.STUDENT,
};

const mockEvent = {
  id: 'event-phase4-001',
  title: 'Annual Tech Hackathon 2026',
  category: 'Hackathon',
  startTime: new Date('2026-12-01T09:00:00Z'),
  endTime: new Date('2026-12-02T18:00:00Z'),
  organizerId: 'org-user-01',
  venue: {
    name: 'Main Convention Hall',
    location: 'Building C, Level 2',
  },
};

let registrations: Array<any> = [];
let auditLogs: Array<any> = [];

jest.mock('../src/config/prisma', () => {
  const mockPrisma = {
    registration: {
      findUnique: jest.fn(async ({ where }: { where: { qrToken?: string; id?: string } }) => {
        if (where.qrToken) {
          return registrations.find((r) => r.qrToken === where.qrToken) || null;
        }
        if (where.id) {
          return registrations.find((r) => r.id === where.id) || null;
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const item = registrations.find((r) => r.id === where.id);
        if (!item) throw new Error('Registration not found');
        Object.assign(item, data);
        return item;
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: { data: any }) => {
        const log = { id: `log-${Date.now()}`, ...data, timestamp: new Date() };
        auditLogs.push(log);
        return log;
      }),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  return { prisma: mockPrisma };
});

const app = createApp();

function makeAuthCookie(
  role: Role,
  userId = 'test-organizer-01',
  email = 'organizer@campus.edu',
): string {
  const token = signToken({
    userId,
    email,
    role,
  });
  return `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

describe('Phase 4: Organizer QR Code Check-In & Scanner API', () => {
  beforeEach(() => {
    registrations = [
      {
        id: 'reg-valid-001',
        userId: mockStudent.id,
        eventId: mockEvent.id,
        qrToken: 'QR-VALID-TOKEN-001',
        status: 'CONFIRMED',
        checkedInAt: null,
        registeredAt: new Date('2026-11-01T10:00:00Z'),
        user: mockStudent,
        event: mockEvent,
      },
      {
        id: 'reg-waitlisted-002',
        userId: 'student-waitlisted-02',
        eventId: mockEvent.id,
        qrToken: 'QR-WAITLISTED-002',
        status: 'WAITLISTED',
        checkedInAt: null,
        registeredAt: new Date('2026-11-01T11:00:00Z'),
        user: { ...mockStudent, id: 'student-waitlisted-02', name: 'Waitlist Wally' },
        event: mockEvent,
      },
      {
        id: 'reg-already-scanned-003',
        userId: 'student-checked-03',
        eventId: mockEvent.id,
        qrToken: 'QR-ALREADY-SCANNED-003',
        status: 'CHECKED_IN',
        checkedInAt: new Date('2026-11-07T08:30:00Z'),
        registeredAt: new Date('2026-11-01T09:00:00Z'),
        user: { ...mockStudent, id: 'student-checked-03', name: 'Early Bird' },
        event: mockEvent,
      },
      {
        id: 'reg-cancelled-004',
        userId: 'student-cancelled-04',
        eventId: mockEvent.id,
        qrToken: 'QR-CANCELLED-004',
        status: 'CANCELLED',
        checkedInAt: null,
        registeredAt: new Date('2026-11-01T12:00:00Z'),
        user: { ...mockStudent, id: 'student-cancelled-04', name: 'Cancelled Carl' },
        event: mockEvent,
      },
    ];
    auditLogs = [];
    jest.clearAllMocks();
  });

  it('allows ORGANIZER to successfully check in a confirmed student ticket', async () => {
    const res = await request(app)
      .post('/api/registrations/check-in')
      .set('Cookie', makeAuthCookie(Role.ORGANIZER, 'organizer-01'))
      .send({ qrToken: 'QR-VALID-TOKEN-001' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/Check-in successful! Welcome, Charlie Brown/i);
    expect(res.body.data.student.name).toBe('Charlie Brown');
    expect(res.body.data.event.title).toBe('Annual Tech Hackathon 2026');
    expect(res.body.data.confirmedBadge).toBe(true);
    expect(res.body.data.registration.status).toBe('CHECKED_IN');
    expect(res.body.data.checkedInAt).toBeDefined();

    // Verify AuditLog
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('TICKET_CHECKED_IN');
    expect(auditLogs[0].details.qrToken).toBe('QR-VALID-TOKEN-001');
  });

  it('allows ADMIN to successfully check in a confirmed ticket', async () => {
    const res = await request(app)
      .post('/api/registrations/check-in')
      .set('Cookie', makeAuthCookie(Role.ADMIN, 'admin-01'))
      .send({ qrToken: 'QR-VALID-TOKEN-001' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student.email).toBe('charlie@campus.edu');
  });

  it('rejects STUDENT role with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/registrations/check-in')
      .set('Cookie', makeAuthCookie(Role.STUDENT, 'student-fraud-01'))
      .send({ qrToken: 'QR-VALID-TOKEN-001' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Access denied/i);
  });

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/registrations/check-in')
      .send({ qrToken: 'QR-VALID-TOKEN-001' });

    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent or invalid QR tokens', async () => {
    const res = await request(app)
      .post('/api/registrations/check-in')
      .set('Cookie', makeAuthCookie(Role.ORGANIZER))
      .send({ qrToken: 'QR-DOES-NOT-EXIST-999' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Invalid ticket QR code/i);
  });

  it('returns 409 Conflict when scanning an already checked-in ticket', async () => {
    const res = await request(app)
      .post('/api/registrations/check-in')
      .set('Cookie', makeAuthCookie(Role.ORGANIZER))
      .send({ qrToken: 'QR-ALREADY-SCANNED-003' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Ticket already scanned and checked in at/i);
  });

  it('returns 400 Bad Request when scanning a waitlisted ticket', async () => {
    const res = await request(app)
      .post('/api/registrations/check-in')
      .set('Cookie', makeAuthCookie(Role.ORGANIZER))
      .send({ qrToken: 'QR-WAITLISTED-002' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Ticket is waitlisted or cancelled/i);
  });

  it('returns 400 Bad Request when scanning a cancelled ticket', async () => {
    const res = await request(app)
      .post('/api/registrations/check-in')
      .set('Cookie', makeAuthCookie(Role.ORGANIZER))
      .send({ qrToken: 'QR-CANCELLED-004' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Ticket is waitlisted or cancelled/i);
  });

  it('returns 400 when qrToken is empty or missing', async () => {
    const res = await request(app)
      .post('/api/registrations/check-in')
      .set('Cookie', makeAuthCookie(Role.ORGANIZER))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid check-in request/i);
  });
});
