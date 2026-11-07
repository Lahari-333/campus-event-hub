/**
 * Automated High-Concurrency Booking Engine & FIFO Promotion Stress Test Suite
 *
 * Verifies:
 *   1. Exactly 5 requests receive HTTP 201 with status 'CONFIRMED' under a 25-request surge.
 *   2. Exactly 5 requests receive HTTP 201 with status 'WAITLISTED' with ordered sequence 1-5.
 *   3. Exactly 15 requests receive HTTP 409 Conflict (zero overbooking guarantee).
 *   4. FIFO Cancellation: Cancelling 1 confirmed registration automatically promotes waitlist student #1.
 *   5. Total active confirmed count remains exactly 5 after promotion.
 *   6. AuditLog records USER_PROMOTED_FROM_WAITLIST.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { signToken } from '../src/utils/jwt';
import { Role } from '@prisma/client';

// ─── In-Memory Datastore for Mocking Prisma ───────────────────────────────────
interface MockRegistration {
  id: string;
  userId: string;
  eventId: string;
  status: 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED';
  qrToken: string | null;
  waitlistPosition: number | null;
  registeredAt: Date;
}

interface MockAuditLog {
  id: string;
  performedBy: string;
  action: string;
  details: any;
  timestamp: Date;
}

const mockEvent = {
  id: 'event-concurrency-stress-001',
  title: 'Distributed Systems & Concurrency Summit 2026',
  capacity: 5,
  waitlistCapacity: 5,
  status: 'APPROVED',
};

let registrations: MockRegistration[] = [];
let auditLogs: MockAuditLog[] = [];

// ─── Prisma Mock Definition ───────────────────────────────────────────────────
jest.mock('../src/config/prisma', () => {
  const mockTx = {
    $queryRaw: jest.fn(async () => [mockEvent]),
    event: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === mockEvent.id) return mockEvent;
        return null;
      }),
    },
    registration: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { id?: string; userId_eventId?: { userId: string; eventId: string } };
        }) => {
          if (where.id) {
            return registrations.find((r) => r.id === where.id) || null;
          }
          if (where.userId_eventId) {
            return (
              registrations.find(
                (r) =>
                  r.userId === where.userId_eventId!.userId &&
                  r.eventId === where.userId_eventId!.eventId,
              ) || null
            );
          }
          return null;
        },
      ),
      findFirst: jest.fn(
        async ({
          where,
          orderBy,
        }: {
          where: { eventId: string; status: string };
          orderBy?: any;
        }) => {
          let list = registrations.filter(
            (r) => r.eventId === where.eventId && r.status === where.status,
          );
          if (orderBy) {
            list = [...list].sort((a, b) => {
              const posA = a.waitlistPosition ?? 9999;
              const posB = b.waitlistPosition ?? 9999;
              if (posA !== posB) return posA - posB;
              return a.registeredAt.getTime() - b.registeredAt.getTime();
            });
          }
          return list[0] || null;
        },
      ),
      findMany: jest.fn(
        async ({
          where,
          orderBy,
        }: {
          where: { eventId?: string; status?: string; userId?: string };
          orderBy?: any;
        }) => {
          let list = registrations.filter((r) => {
            if (where.eventId && r.eventId !== where.eventId) return false;
            if (where.status && r.status !== where.status) return false;
            if (where.userId && r.userId !== where.userId) return false;
            return true;
          });
          if (orderBy) {
            list = [...list].sort((a, b) => {
              const posA = a.waitlistPosition ?? 9999;
              const posB = b.waitlistPosition ?? 9999;
              if (posA !== posB) return posA - posB;
              return a.registeredAt.getTime() - b.registeredAt.getTime();
            });
          }
          return list;
        },
      ),
      count: jest.fn(async ({ where }: { where: { eventId: string; status: string } }) => {
        return registrations.filter(
          (r) => r.eventId === where.eventId && r.status === where.status,
        ).length;
      }),
      create: jest.fn(async ({ data }: { data: any }) => {
        const item: MockRegistration = {
          id: `reg-${Math.random().toString(36).substring(2, 9)}`,
          userId: data.userId,
          eventId: data.eventId,
          status: data.status,
          qrToken: data.qrToken ?? null,
          waitlistPosition: data.waitlistPosition ?? null,
          registeredAt: data.registeredAt || new Date(),
        };
        registrations.push(item);
        return item;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const item = registrations.find((r) => r.id === where.id);
        if (!item) throw new Error(`Registration ${where.id} not found`);
        Object.assign(item, data);
        return item;
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: { data: any }) => {
        const log: MockAuditLog = {
          id: `log-${Math.random().toString(36).substring(2, 9)}`,
          performedBy: data.performedBy,
          action: data.action,
          details: data.details,
          timestamp: new Date(),
        };
        auditLogs.push(log);
        return log;
      }),
    },
  };

  return {
    prisma: {
      ...mockTx,
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockTx);
      }),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    },
  };
});

const app = createApp();

function makeAuthCookie(
  role: Role = Role.STUDENT,
  userId = 'student-test-01',
  email = 'student@campus.edu',
): string {
  const token = signToken({
    userId,
    email,
    role,
  });
  return `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

describe('PHASE 3: High-Concurrency Booking Engine & FIFO Queue Pipeline', () => {
  beforeEach(() => {
    registrations = [];
    auditLogs = [];
    jest.clearAllMocks();
  });

  it('handles a 25-request concurrent booking surge with zero overbooking', async () => {
    const totalSimulatedStudents = 25;
    const studentIds = Array.from(
      { length: totalSimulatedStudents },
      (_, i) => `student-${String(i + 1).padStart(2, '0')}`,
    );

    // Concurrency Surge: Fire 25 simultaneous registration requests
    const promises = studentIds.map((studentId) => {
      const cookie = makeAuthCookie(Role.STUDENT, studentId, `${studentId}@campus.edu`);
      return request(app)
        .post(`/api/registrations/${mockEvent.id}`)
        .set('Cookie', cookie);
    });

    const responses = await Promise.all(promises);

    // ─── 1. Filter Responses by HTTP Outcome ─────────────────────────────────
    const confirmedResponses = responses.filter(
      (res) => res.status === 201 && res.body.data?.status === 'CONFIRMED',
    );
    const waitlistedResponses = responses.filter(
      (res) => res.status === 201 && res.body.data?.status === 'WAITLISTED',
    );
    const conflictResponses = responses.filter((res) => res.status === 409);

    // ─── 2. Assert Exact Capacities ──────────────────────────────────────────
    // Exactly 5 requests receive HTTP 201 with status 'CONFIRMED'
    expect(confirmedResponses).toHaveLength(5);

    // Exactly 5 requests receive HTTP 201 with status 'WAITLISTED'
    expect(waitlistedResponses).toHaveLength(5);

    // Exactly 15 requests receive HTTP 409 Conflict
    expect(conflictResponses).toHaveLength(15);
    conflictResponses.forEach((res) => {
      expect(res.body.message).toMatch(/Event and waitlist are completely full/i);
    });

    // ─── 3. Assert Ordered Waitlist Sequence Numbers (1 - 5) ─────────────────
    const waitlistPositions = waitlistedResponses
      .map((res) => res.body.data?.waitlistPosition)
      .sort((a, b) => a - b);

    expect(waitlistPositions).toEqual([1, 2, 3, 4, 5]);

    // ─── 4. Assert QR Tokens Issued Only for Confirmed Tickets ────────────────
    confirmedResponses.forEach((res) => {
      expect(res.body.data?.registration?.qrToken).toBeDefined();
      expect(res.body.data?.registration?.qrToken).toMatch(/^QR-/);
      expect(res.body.data?.registration?.waitlistPosition).toBeNull();
    });

    waitlistedResponses.forEach((res) => {
      expect(res.body.data?.registration?.qrToken).toBeNull();
      expect(res.body.data?.registration?.waitlistPosition).toBeGreaterThanOrEqual(1);
    });

    // ─── 5. Database Consistency Assertions ──────────────────────────────────
    const activeConfirmed = registrations.filter((r) => r.status === 'CONFIRMED');
    const activeWaitlisted = registrations.filter((r) => r.status === 'WAITLISTED');

    expect(activeConfirmed).toHaveLength(5);
    expect(activeWaitlisted).toHaveLength(5);
    expect(registrations).toHaveLength(10);
  });

  it('prevents duplicate bookings by the same student', async () => {
    const studentId = 'student-unique-01';
    const cookie = makeAuthCookie(Role.STUDENT, studentId, 'student@campus.edu');

    // First booking: Successful
    const firstRes = await request(app)
      .post(`/api/registrations/${mockEvent.id}`)
      .set('Cookie', cookie);

    expect(firstRes.status).toBe(201);
    expect(firstRes.body.data.status).toBe('CONFIRMED');

    // Second booking: Rejected with 409 Conflict
    const secondRes = await request(app)
      .post(`/api/registrations/${mockEvent.id}`)
      .set('Cookie', cookie);

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.message).toMatch(/already registered/i);
  });

  it('executes FIFO cancellation and auto-promotes waitlist student #1', async () => {
    // Fill 5 confirmed seats
    for (let i = 1; i <= 5; i++) {
      const studentId = `student-confirmed-${i}`;
      await request(app)
        .post(`/api/registrations/${mockEvent.id}`)
        .set('Cookie', makeAuthCookie(Role.STUDENT, studentId, `${studentId}@campus.edu`));
    }

    // Add 2 waitlisted students
    const waitlist1Res = await request(app)
      .post(`/api/registrations/${mockEvent.id}`)
      .set('Cookie', makeAuthCookie(Role.STUDENT, 'waitlist-student-01', 'w1@campus.edu'));

    const waitlist2Res = await request(app)
      .post(`/api/registrations/${mockEvent.id}`)
      .set('Cookie', makeAuthCookie(Role.STUDENT, 'waitlist-student-02', 'w2@campus.edu'));

    expect(waitlist1Res.body.data.waitlistPosition).toBe(1);
    expect(waitlist2Res.body.data.waitlistPosition).toBe(2);

    // Check pre-cancellation count
    expect(registrations.filter((r) => r.status === 'CONFIRMED')).toHaveLength(5);
    expect(registrations.filter((r) => r.status === 'WAITLISTED')).toHaveLength(2);

    // Cancel registration for confirmed student #1
    const confirmedRegToCancel = registrations.find(
      (r) => r.userId === 'student-confirmed-1' && r.status === 'CONFIRMED',
    )!;

    const cancelRes = await request(app)
      .post(`/api/registrations/${confirmedRegToCancel.id}/cancel`)
      .set(
        'Cookie',
        makeAuthCookie(Role.STUDENT, 'student-confirmed-1', 'student-confirmed-1@campus.edu'),
      );

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.cancelledRegistration.status).toBe('CANCELLED');

    // ─── Promotion Verification ──────────────────────────────────────────────
    // Assert waitlist student #1 is automatically promoted to 'CONFIRMED'
    expect(cancelRes.body.data.promoted).not.toBeNull();
    expect(cancelRes.body.data.promoted.userId).toBe('waitlist-student-01');
    expect(cancelRes.body.data.promoted.status).toBe('CONFIRMED');
    expect(cancelRes.body.data.promoted.qrToken).toMatch(/^QR-/);

    // Assert that new confirmed count remains exactly 5
    const confirmedAfter = registrations.filter((r) => r.status === 'CONFIRMED');
    expect(confirmedAfter).toHaveLength(5);

    // Assert promoted user in memory now has CONFIRMED status
    const promotedUserInDb = registrations.find((r) => r.userId === 'waitlist-student-01')!;
    expect(promotedUserInDb.status).toBe('CONFIRMED');
    expect(promotedUserInDb.qrToken).toBeDefined();
    expect(promotedUserInDb.waitlistPosition).toBeNull();

    // Assert remaining waitlist position for student #2 was recalculated to #1
    const waitlist2InDb = registrations.find((r) => r.userId === 'waitlist-student-02')!;
    expect(waitlist2InDb.waitlistPosition).toBe(1);

    // Assert AuditLog recorded the promotion
    const promotionAuditLog = auditLogs.find(
      (l) => l.action === 'USER_PROMOTED_FROM_WAITLIST',
    );
    expect(promotionAuditLog).toBeDefined();
    expect(promotionAuditLog!.details.promotedUserId).toBe('waitlist-student-01');
    expect(promotionAuditLog!.details.cancelledRegistrationId).toBe(confirmedRegToCancel.id);
  });
});
