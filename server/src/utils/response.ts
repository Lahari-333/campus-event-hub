import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
}

/**
 * Send a successful JSON response
 */
export function sendSuccess<T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
): void {
  const response: ApiResponse<T> = { success: true, message };
  if (data !== undefined) response.data = data;
  res.status(statusCode).json(response);
}

/**
 * Send an error JSON response
 */
export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  errors?: unknown,
): void {
  const response: ApiResponse = { success: false, message };
  if (errors !== undefined) response.errors = errors;
  res.status(statusCode).json(response);
}
