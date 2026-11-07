import { z } from 'zod';
import { EventStatus } from '@prisma/client';

/**
 * Validation schema for creating a new event proposal.
 * Ensures data integrity, proper dates, and capacity bounds.
 */
export const createEventSchema = z
  .object({
    title: z
      .string({ required_error: 'Event title is required' })
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(120, 'Title cannot exceed 120 characters'),
    description: z
      .string({ required_error: 'Description is required' })
      .trim()
      .min(10, 'Description must be at least 10 characters')
      .max(2000, 'Description cannot exceed 2000 characters'),
    category: z
      .string({ required_error: 'Category is required' })
      .trim()
      .min(2, 'Category must be at least 2 characters')
      .max(50, 'Category cannot exceed 50 characters'),
    venueId: z
      .string({ required_error: 'Venue selection is required' })
      .trim()
      .min(1, 'Venue selection is required'),
    startTime: z.coerce.date({
      required_error: 'Start time is required',
      invalid_type_error: 'Invalid start time format',
    }),
    endTime: z.coerce.date({
      required_error: 'End time is required',
      invalid_type_error: 'Invalid end time format',
    }),
    capacity: z.coerce
      .number({ required_error: 'Capacity is required' })
      .int('Capacity must be an integer')
      .positive('Capacity must be greater than zero')
      .max(50000, 'Capacity cannot exceed 50,000'),
    waitlistCapacity: z.coerce
      .number()
      .int('Waitlist capacity must be an integer')
      .nonnegative('Waitlist capacity cannot be negative')
      .default(0),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'End time must be chronologically after start time',
    path: ['endTime'],
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

/**
 * Validation schema for updating event status (Admin approval/rejection).
 */
export const updateEventStatusSchema = z.object({
  status: z.enum([EventStatus.APPROVED, EventStatus.REJECTED], {
    required_error: 'Status is required (APPROVED or REJECTED)',
  }),
  reason: z
    .string()
    .trim()
    .max(500, 'Reason cannot exceed 500 characters')
    .optional(),
});

export type UpdateEventStatusInput = z.infer<typeof updateEventStatusSchema>;

/**
 * Validation schema for temporal conflict check queries.
 */
export const checkConflictQuerySchema = z
  .object({
    venueId: z.string().trim().min(1, 'Venue ID is required'),
    startTime: z.coerce.date({ required_error: 'Start time is required' }),
    endTime: z.coerce.date({ required_error: 'End time is required' }),
    excludeEventId: z.string().trim().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export type CheckConflictQueryInput = z.infer<typeof checkConflictQuerySchema>;

/**
 * Validation schema for public event listing query parameters.
 */
export const listEventsQuerySchema = z.object({
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListEventsQueryInput = z.infer<typeof listEventsQuerySchema>;
