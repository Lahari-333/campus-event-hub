import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { signToken } from '../utils/jwt';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearCookieOptions,
} from '../utils/cookies';
import {
  registerSchema,
  loginSchema,
} from '../validators/auth.validators';

const BCRYPT_SALT_ROUNDS = 12;

// ─── POST /api/auth/register ──────────────────────────────────────────────────

export async function register(req: Request, res: Response): Promise<void> {
  // 1. Validate & parse input
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'Validation failed', parsed.error.flatten().fieldErrors);
    return;
  }

  const { name, email, password, role, department } = parsed.data;

  try {
    // 2. Check for existing email (409 Conflict)
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      sendError(res, 409, 'An account with this email already exists.');
      return;
    }

    // 3. Hash password with bcrypt (12 salt rounds)
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 4. Create user in database
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, department },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
      },
    });

    // 5. Issue JWT cookie
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    sendSuccess(res, 201, 'Account created successfully.', { user });
  } catch (err) {
    console.error('[register] Error:', err);
    sendError(res, 500, 'Registration failed. Please try again later.');
  }
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  // 1. Validate & parse input
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, 'Validation failed', parsed.error.flatten().fieldErrors);
    return;
  }

  const { email, password } = parsed.data;

  try {
    // 2. Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    // 3. Generic error — do NOT distinguish between "user not found" and
    //    "wrong password" to prevent user enumeration attacks.
    if (!user) {
      sendError(res, 401, 'Invalid email or password.');
      return;
    }

    // 4. Constant-time password comparison
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      sendError(res, 401, 'Invalid email or password.');
      return;
    }

    // 5. Issue JWT cookie
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    sendSuccess(res, 200, 'Logged in successfully.', {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (err) {
    console.error('[login] Error:', err);
    sendError(res, 500, 'Login failed. Please try again later.');
  }
}

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

export async function logout(_req: Request, res: Response): Promise<void> {
  res.cookie(AUTH_COOKIE_NAME, '', getClearCookieOptions());
  sendSuccess(res, 200, 'Logged out successfully.');
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    sendError(res, 401, 'Authentication required.');
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
      },
    });

    if (!user) {
      sendError(res, 404, 'User profile not found.');
      return;
    }

    sendSuccess(res, 200, 'Profile retrieved successfully.', { user });
  } catch (err) {
    console.error('[getMe] Error:', err);
    sendError(res, 500, 'Failed to retrieve profile.');
  }
}
