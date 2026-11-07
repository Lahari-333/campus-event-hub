import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  createEvent,
  getEvents,
  getMyEvents,
  getEventById,
  updateEventStatus,
  checkConflict,
  getAdminProposals,
} from '../controllers/event.controller';
import { generateAiSuggestions } from '../controllers/ai.controller';
import { streamLiveAttendance } from '../controllers/sse.controller';
import { exportEventRoster } from '../controllers/export.controller';
import {
  createAnnouncement,
  getEventAnnouncements,
} from '../controllers/announcement.controller';
import { submitFeedback, getEventFeedback } from '../controllers/feedback.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// ─── Public Routes ────────────────────────────────────────────────────────────

// GET /api/events — List APPROVED events with filters & capacity counters
router.get('/', getEvents);

// GET /api/events/check-conflict — Real-time venue collision verification
router.get('/check-conflict', checkConflict);

// POST /api/events/ai-suggest — Smart AI event metadata generator
router.post(
  '/ai-suggest',
  authenticate,
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  generateAiSuggestions,
);

// ─── Live SSE Stream ──────────────────────────────────────────────────────────
// GET /api/events/:id/live-attendance — Real-time attendance counter stream
router.get('/:id/live-attendance', streamLiveAttendance);

// ─── CSV Export ───────────────────────────────────────────────────────────────
// GET /api/events/:id/export — Download attendee roster CSV
router.get(
  '/:id/export',
  authenticate,
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  exportEventRoster,
);

// ─── Announcements ────────────────────────────────────────────────────────────
router.post(
  '/:id/announcements',
  authenticate,
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  createAnnouncement,
);
router.get('/:id/announcements', getEventAnnouncements);

// ─── Feedback & Reviews ───────────────────────────────────────────────────────
router.post('/:id/feedback', authenticate, submitFeedback);
router.get('/:id/feedback', getEventFeedback);

// ─── Organizer Routes ─────────────────────────────────────────────────────────

// GET /api/events/my-events — Organizer's events across all statuses
router.get(
  '/my-events',
  authenticate,
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  getMyEvents,
);

// POST /api/events — Create a new event proposal (initial status: PENDING_APPROVAL)
router.post(
  '/',
  authenticate,
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  createEvent,
);

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// GET /api/events/proposals — Admin review queue
router.get(
  '/proposals',
  authenticate,
  requireRole([Role.ADMIN]),
  getAdminProposals,
);

// PATCH /api/events/:id/status — Admin approves or rejects event proposal
router.patch(
  '/:id/status',
  authenticate,
  requireRole([Role.ADMIN]),
  updateEventStatus,
);

// ─── Parametric Routes (Must come after specific static paths) ────────────────

// GET /api/events/:id — Single event details & remaining seat count
router.get('/:id', getEventById);

export default router;
