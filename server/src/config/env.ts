/**
 * Environment configuration with strict type-safety.
 * All secrets stay server-side. Never expose these to the client.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '4000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  isProduction: process.env['NODE_ENV'] === 'production',

  // Database (server-side only)
  databaseUrl: requireEnv('DATABASE_URL'),

  // JWT (server-side only)
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',

  // CORS: accepts process.env.CLIENT_URL with fallback to CLIENT_ORIGIN or localhost:3000
  clientOrigin: process.env['CLIENT_URL'] ?? process.env['CLIENT_ORIGIN'] ?? 'http://localhost:3000',

  // Cookie
  cookieSecret: requireEnv('COOKIE_SECRET'),
} as const;
