/**
 * Application Entry Point
 * 
 * Bootstraps the Express server with proper:
 * - Infrastructure initialization (DB, cache)
 * - Error handling and logging
 * - Graceful shutdown handlers
 * 
 * @module server
 */

import { App } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { gracefulShutdown } from './utils/shutdown';

/** Exit code for initialization failures */
const EXIT_CODE_FAILURE = 1;

/**
 * Starts the HTTP server and initializes application infrastructure.
 * 
 * Initialization steps:
 * 1. Create Express app instance
 * 2. Initialize database and cache connections
 * 3. Start HTTP server
 * 4. Register shutdown handlers
 * 
 * @throws Process exits with code 1 if startup fails
 * @returns Promise that resolves when server is listening
 */
const startServer = async (): Promise<void> => {
  try {
    // Create application instance
    const app = new App();
    
    // Initialize infrastructure dependencies (database, cache, etc.)
    await app.initialize();
    
    // Start HTTP server
    const server = app.app.listen(config.server.port, () => {
      logger.info('Server started successfully', {
        environment: config.server.nodeEnv,
        port: config.server.port,
        apiVersion: config.server.apiVersion,
      });
    });
    
    // Register graceful shutdown handlers for clean termination
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));
    
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(EXIT_CODE_FAILURE);
  }
};

// Bootstrap the application
startServer();
