import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import authRoutes from './routes/auth.routes';
import eventRoutes from './routes/event.routes';
import venueRoutes from './routes/venue.routes';
import registrationRoutes from './routes/registration.routes';
import adminRoutes from './routes/admin.routes';
import teamRoutes from './routes/team.routes';
import { apiRateLimiter } from './middleware/rateLimiter.middleware';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/error.middleware';

export function createApp(): Application {
  const app = express();

  // ─── Security Headers (Helmet) ─────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ─── CORS (dynamic origin configuration) ──────────────────────────────────
  const allowedOrigins = [
    config.clientOrigin,
    'http://localhost:3000',
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ];

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) return callback(null, true);
        if (
          allowedOrigins.includes(requestOrigin) ||
          requestOrigin.endsWith('.vercel.app') ||
          requestOrigin.includes('localhost')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true, // Required for cookies
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // ─── Body Parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10kb' })); // Prevents large-payload attacks
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // ─── Cookie Parser ─────────────────────────────────────────────────────────
  app.use(cookieParser(config.cookieSecret));

  // ─── Global Rate Limiter ───────────────────────────────────────────────────
  app.use('/api', apiRateLimiter);

  // ─── Health Check ──────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'Campus Event Hub API',
      timestamp: new Date().toISOString(),
    });
  });

  // ─── API Routes ────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/venues', venueRoutes);
  app.use('/api/registrations', registrationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/teams', teamRoutes);

  // ─── 404 & Error Handlers (must be last) ───────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
