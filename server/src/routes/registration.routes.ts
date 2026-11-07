import { Router } from 'express';
import {
  registerForEvent,
  cancelRegistration,
  getMyRegistrations,
  getEventRegistrationStatus,
  checkInTicket,
} from '../controllers/registration.controller';
import { downloadCertificate } from '../controllers/certificate.controller';
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
} from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Phase 4: Organizer QR Code Check-In (must be registered before /:eventId to prevent param collision)
router.post(
  '/check-in',
  authenticate,
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  checkInTicket,
);

// Student registration for an event (concurrency-safe)
router.post('/:eventId', authenticate, registerForEvent);

// Cancel registration with FIFO auto-promotion
router.post('/:id/cancel', authenticate, cancelRegistration);

// Download verified participation certificate PDF
router.get('/:id/certificate', authenticate, downloadCertificate);

// Get student's registrations
router.get('/my-registrations', authenticate, getMyRegistrations);

// Get registration metrics and status for an event
router.get('/event/:eventId', optionalAuthenticate, getEventRegistrationStatus);

export default router;
