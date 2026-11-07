import { CookieOptions } from 'express';
import { config } from '../config/env';

export const AUTH_COOKIE_NAME = 'auth_token';

/**
 * Returns strict, secure cookie options.
 * httpOnly: true  — JavaScript cannot access the cookie (XSS protection)
 * secure: true    — HTTPS only in production
 * sameSite: lax   — CSRF protection while supporting normal navigation
 */
export function getAuthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  };
}

/**
 * Returns options to immediately expire / clear the auth cookie.
 */
export function getClearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  };
}
