import 'dotenv/config';
import { createApp } from './app';
import { config } from './config/env';
import { prisma } from './config/prisma';

async function bootstrap() {
  try {
    // Verify database connectivity at startup
    await prisma.$connect();
    console.log('✅ Database connection established');

    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`🚀 Campus Event Hub API running on http://localhost:${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   CORS origin:  ${config.clientOrigin}`);
    });

    // ─── Graceful Shutdown ───────────────────────────────────────────────────
    const shutdown = async (signal: string) => {
      console.log(`\n📴 ${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Database disconnected. Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
