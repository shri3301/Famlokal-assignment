import { Server } from 'http';
import { logger } from './logger';
import { closeDatabase } from '../infrastructure/database';
import { closeRedis } from '../infrastructure/redis';

/**
 * Graceful shutdown handler
 * Closes all connections properly before exiting
 */
export const gracefulShutdown = async (server: Server): Promise<void> => {
  logger.info('Received shutdown signal, starting graceful shutdown...');

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close database connections
      await closeDatabase();
      
      // Close Redis connection
      await closeRedis();
      
      logger.info('All connections closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', error);
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000); // 30 seconds
};
