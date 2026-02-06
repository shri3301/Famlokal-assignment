/**
 * Express Application Configuration Module
 * 
 * Configures and initializes the Express application with:
 * - Security middleware (helmet, cors)
 * - Request parsing and compression
 * - API route registration
 * - Error handling middleware
 * - Database and cache initialization
 * 
 * @module app
 */

import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { initDatabase } from './infrastructure/database';
import { initRedis } from './infrastructure/redis';

// Route imports - organized alphabetically
import externalRoutes from './routes/external.routes';
import healthRoutes from './routes/health.routes';
import oauthMockRoutes from './routes/oauth.mock.routes';
import oauthTestRoutes from './routes/oauth.test.routes';
import productRoutes from './routes/product.routes';
import webhookRoutes from './routes/webhook.routes';
import webhookTestRoutes from './routes/webhook.test.routes';

/** Request body size limit for JSON and URL-encoded payloads */
const REQUEST_SIZE_LIMIT = '10mb';

/**
 * Main application class that encapsulates Express configuration.
 * 
 * @class App
 * @description Handles middleware initialization, route registration, 
 * and infrastructure setup in a structured, testable manner.
 * 
 * @example
 * ```typescript
 * const app = new App();
 * await app.initialize();
 * app.app.listen(3000);
 * ```
 */
export class App {
  /** Express application instance */
  public readonly app: Application;

  /**
   * Initializes the Express application and configures all middleware.
   * Order of initialization: middleware -> routes -> error handlers
   */
  constructor() {
    this.app = express();
    this.configureMiddleware();
    this.registerRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configures application-level middleware.
   * 
   * Middleware order is critical:
   * 1. Security (helmet, cors) - applied first
   * 2. Body parsing - before route handlers
   * 3. Compression - after parsing
   * 4. Logging - tracks all requests
   * 
   * @private
   */
  private configureMiddleware(): void {
    // Security: Set HTTP headers to prevent common vulnerabilities
    this.app.use(helmet());
    
    // CORS: Allow cross-origin requests (configure domains in production)
    this.app.use(cors());
    
    // Body parsers: Support JSON and URL-encoded payloads
    this.app.use(express.json({ limit: REQUEST_SIZE_LIMIT }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: REQUEST_SIZE_LIMIT 
    }));
    
    // Compression: Reduce response size for better performance
    this.app.use(compression());
    
    // Request logging: Track all incoming requests
    this.app.use(requestLogger);
  }

  /**
   * Registers all application routes with appropriate prefixes.
   * 
   * Routes are organized by feature:
   * - Health check (no versioning) - for load balancers
   * - API routes (versioned) - for client applications
   * - 404 handler (catch-all) - for undefined routes
   * 
   * @private
   */
  private registerRoutes(): void {
    const apiPrefix = `/api/${config.server.apiVersion}`;
    
    // Health check endpoint - no API versioning for monitoring tools
    this.app.use('/health', healthRoutes);
    
    // Versioned API routes - grouped by resource
    this.app.use(`${apiPrefix}/products`, productRoutes);
    this.app.use(`${apiPrefix}/webhooks`, webhookRoutes);
    this.app.use(`${apiPrefix}/webhooks`, webhookTestRoutes);
    this.app.use(`${apiPrefix}/oauth`, oauthTestRoutes);
    this.app.use(`${apiPrefix}/oauth`, oauthMockRoutes);
    this.app.use(`${apiPrefix}/external`, externalRoutes);
    
    // Catch-all 404 handler - must be registered last
    this.registerNotFoundHandler();
  }

  /**
   * Registers 404 handler for undefined routes.
   * @private
   */
  private registerNotFoundHandler(): void {
    this.app.use('*', (_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    });
  }

  /**
   * Registers global error handling middleware.
   * Must be the last middleware registered.
   * @private
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Initializes application infrastructure dependencies.
   * 
   * Performs async initialization of:
   * - Database connection pool
   * - Redis client and cache
   * 
   * @throws {Error} If any infrastructure component fails to initialize
   * @returns Promise that resolves when all infrastructure is ready
   * 
   * @example
   * ```typescript
   * const app = new App();
   * await app.initialize(); // Wait for DB and Redis
   * ```
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize database connection pool
      await initDatabase();
      logger.info('Database connection pool initialized');
      
      // Initialize Redis client and cache
      await initRedis();
      logger.info('Redis cache initialized');
      
      logger.info('Application infrastructure ready');
    } catch (error) {
      logger.error('Failed to initialize application infrastructure', { error });
      throw error;
    }
  }
}
