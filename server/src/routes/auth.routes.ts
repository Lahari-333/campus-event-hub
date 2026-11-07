import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

/**
 * POST /api/auth/register
 * Public — Rate-limited. Creates a new user account.
 */
router.post('/register', authRateLimiter, register);

/**
 * POST /api/auth/login
 * Public — Rate-limited. Authenticates user and sets HTTP-only cookie.
 */
router.post('/login', authRateLimiter, login);

/**
 * POST /api/auth/logout
 * Public. Clears the auth cookie.
 */
router.post('/logout', logout);

/**
 * GET /api/auth/me
 * Protected. Returns the authenticated user's profile.
 */
router.get('/me', authenticate, getMe);

export default router;
