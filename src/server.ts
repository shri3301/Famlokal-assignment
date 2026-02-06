import { App } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { gracefulShutdown } from './utils/shutdown';

const startServer = async (): Promise<void> => {
  try {
    const app = new App();
    
    // Initialize infrastructure (DB, Redis, etc.)
    await app.initialize();
    
    // Start server
    const server = app.app.listen(config.server.port, () => {
      logger.info(`Server started in ${config.server.nodeEnv} mode`);
      logger.info(`Listening on port ${config.server.port}`);
      logger.info(`API version: ${config.server.apiVersion}`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();
