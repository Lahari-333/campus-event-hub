/**
 * Auth Routes Integration Tests
 * Uses Supertest to verify authentication behavior without a live DB.
 * 
 * Test cases:
 *   1. POST /register — Duplicate email → 409 Conflict
 *   2. GET  /me       — No cookie      → 401 Unauthorized
 *   3. GET  /me       — Valid cookie but insufficient role → 403 Forbidden
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { signToken } from '../../src/utils/jwt';
import { Role } from '@prisma/client';

// ─── Mock Prisma to avoid DB dependency in unit tests ────────────────────────
jest.mock('../../src/config/prisma', () => {
  return {
    prisma: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    },
  };
});

// Import after mock is set up
import { prisma } from '../../src/config/prisma';

const app = createApp();
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;

// ─── Helper: forge a signed JWT cookie string for a given role ───────────────
function makeAuthCookie(role: Role): string {
  const token = signToken({
    userId: 'test-user-id',
    email: 'test@campus.edu',
    role,
  });
  return `auth_token=${token}`;
}

// ─── Helper route for RBAC testing (Admin-only) ──────────────────────────────
// We'll test RBAC by calling GET /api/auth/me with a STUDENT token
// and a custom admin-only endpoint. Since we don't have an admin-only
// route in Phase 1, we simulate it by testing the requireRole middleware directly.

describe('Campus Event Hub — Auth API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Duplicate Email Registration → 409 Conflict
  // ──────────────────────────────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('should return 409 when email is already registered', async () => {
      // Mock: user with this email already exists
      mockFindUnique.mockResolvedValueOnce({
        id: 'existing-user-id',
        email: 'alice@campus.edu',
        name: 'Alice',
        role: 'STUDENT',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Duplicate',
          email: 'alice@campus.edu',
          password: 'Password@123',
          role: 'STUDENT',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/already exists/i);
    });

    it('should return 400 when input validation fails', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A', // too short
          email: 'not-an-email',
          password: '123', // too short, no uppercase/lowercase/number pattern
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/validation/i);
    });

    it('should return 201 and set auth cookie on successful registration', async () => {
      // Mock: no existing user
      mockFindUnique.mockResolvedValueOnce(null);
      // Mock: created user
      mockCreate.mockResolvedValueOnce({
        id: 'new-user-id',
        name: 'Bob New',
        email: 'bob.new@campus.edu',
        role: 'STUDENT',
        department: 'CS',
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bob New',
          email: 'bob.new@campus.edu',
          password: 'Password@123',
          role: 'STUDENT',
          department: 'CS',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      // Verify auth cookie is set
      const setCookieHeader = response.headers['set-cookie'] as string[] | string;
      const cookieStr = Array.isArray(setCookieHeader)
        ? setCookieHeader.join('; ')
        : setCookieHeader ?? '';
      expect(cookieStr).toContain('auth_token');
      expect(cookieStr).toContain('HttpOnly');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Protected Route Without Cookie → 401 Unauthorized
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /api/auth/me (protected route)', () => {
    it('should return 401 when no auth cookie is provided', async () => {
      const response = await request(app)
        .get('/api/auth/me');
      // No cookie set

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/authentication required/i);
    });

    it('should return 401 when an invalid token is in the cookie', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'auth_token=this.is.a.tampered.token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 200 when a valid auth cookie is provided', async () => {
      // Mock: user found in DB
      mockFindUnique.mockResolvedValueOnce({
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@campus.edu',
        role: 'STUDENT',
        department: 'IT',
        createdAt: new Date(),
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', makeAuthCookie(Role.STUDENT));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data?.user?.email).toBe('test@campus.edu');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Role Authorization — STUDENT Token on ADMIN/ORGANIZER Route → 403
  // ──────────────────────────────────────────────────────────────────────────
  describe('RBAC Middleware', () => {
    it('should return 403 when a STUDENT token attempts an ADMIN-only action', async () => {
      // We use the Express router directly to test requireRole.
      // We'll add a temporary test route via the app factory for this check.
      // Instead, we test indirectly: a request with a STUDENT token to 
      // a hypothetical ADMIN endpoint returns 403.
      //
      // Since requireRole is middleware, we verify it via the auth middleware
      // chain: a STUDENT cookie on a route that only allows ADMIN should → 403.
      
      // We test this by calling an endpoint that uses requireRole(['ADMIN'])
      // We'll create a minimal test express instance with the middleware
      const express = require('express');
      const { authenticate, requireRole } = require('../../src/middleware/auth.middleware');
      
      const testApp = express();
      const cookieParser = require('cookie-parser');
      testApp.use(cookieParser());
      testApp.use(express.json());
      
      testApp.get(
        '/admin-only',
        authenticate,
        requireRole([Role.ADMIN]),
        (_req: unknown, res: { json: (arg: unknown) => void; status: (code: number) => { json: (arg: unknown) => void } }) => {
          res.status(200).json({ success: true, message: 'Admin area' });
        },
      );

      const response = await request(testApp)
        .get('/admin-only')
        .set('Cookie', makeAuthCookie(Role.STUDENT));

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/access denied/i);
    });

    it('should return 200 when an ADMIN token accesses an ADMIN-only route', async () => {
      const express = require('express');
      const { authenticate, requireRole } = require('../../src/middleware/auth.middleware');

      const testApp = express();
      const cookieParser = require('cookie-parser');
      testApp.use(cookieParser());
      testApp.use(express.json());

      testApp.get(
        '/admin-only',
        authenticate,
        requireRole([Role.ADMIN]),
        (_req: unknown, res: { status: (code: number) => { json: (data: unknown) => void } }) => {
          res.status(200).json({ success: true, message: 'Admin area' });
        },
      );

      const response = await request(testApp)
        .get('/admin-only')
        .set('Cookie', makeAuthCookie(Role.ADMIN));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: POST /api/auth/logout
  // ──────────────────────────────────────────────────────────────────────────
  describe('POST /api/auth/logout', () => {
    it('should clear the auth cookie and return 200', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const setCookieHeader = response.headers['set-cookie'] as string[] | string;
      const cookieStr = Array.isArray(setCookieHeader)
        ? setCookieHeader.join('; ')
        : setCookieHeader ?? '';
      // Cookie should be set with max-age=0 to clear it
      expect(cookieStr).toContain('auth_token');
      expect(cookieStr).toMatch(/max-age=0/i);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Health Check
  // ──────────────────────────────────────────────────────────────────────────
  describe('GET /health', () => {
    it('should return 200 and service status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });
});
