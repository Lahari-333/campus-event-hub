import { z } from 'zod';

export const registerParamSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
});

export const cancelParamSchema = z.object({
  id: z.string().min(1, 'Registration ID is required'),
});

export const checkInSchema = z.object({
  qrToken: z.string().min(1, 'QR token is required'),
});

export type RegisterParamInput = z.infer<typeof registerParamSchema>;
export type CancelParamInput = z.infer<typeof cancelParamSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
