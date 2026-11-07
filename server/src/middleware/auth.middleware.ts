import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { sendError } from '../utils/response';
import { AUTH_COOKIE_NAME } from '../utils/cookies';
import { Role } from '@prisma/client';

// Augment the Express Request interface to carry authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware: Verifies the HTTP-only JWT cookie.
 * Attaches `req.user` on success, returns 401 on failure.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token: string | undefined = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    sendError(res, 401, 'Authentication required. Please log in.');
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    sendError(res, 401, 'Invalid or expired session. Please log in again.');
  }
}

/**
 * Middleware: Optional JWT cookie verification.
 * Attaches `req.user` if valid token present; never blocks.
 */
export function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token: string | undefined = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
  } catch {
    // Token is invalid/expired; proceed as unauthenticated visitor
  }
  next();
}

/**
 * Middleware factory: Enforces role-based access control (RBAC).
 * Must be used AFTER `authenticate`.
 *
 * Usage: router.get('/admin', authenticate, requireRole(['ADMIN']), handler)
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'Authentication required.');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        403,
        `Access denied. Required role(s): ${allowedRoles.join(', ')}.`,
      );
      return;
    }

    next();
  };
}
