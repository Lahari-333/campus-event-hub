import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware.
 * Must be registered LAST in the Express middleware chain.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('❌ Unhandled error:', err.message);

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message:
      process.env['NODE_ENV'] === 'production'
        ? 'An internal server error occurred.'
        : err.message,
    stack:
      process.env['NODE_ENV'] !== 'production' ? err.stack : undefined,
  });
}

/**
 * 404 handler for unrecognized routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found.`,
  });
}
