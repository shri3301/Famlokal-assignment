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

// Import routes
import productRoutes from './routes/product.routes';
import webhookRoutes from './routes/webhook.routes';
import webhookTestRoutes from './routes/webhook.test.routes';
import healthRoutes from './routes/health.routes';
import oauthTestRoutes from './routes/oauth.test.routes';
import oauthMockRoutes from './routes/oauth.mock.routes';
import externalRoutes from './routes/external.routes';

export class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security
    this.app.use(helmet());
    this.app.use(cors());
    
    // Parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Compression
    this.app.use(compression());
    
    // Request logging
    this.app.use(requestLogger);
  }

  private initializeRoutes(): void {
    const apiPrefix = `/api/${config.server.apiVersion}`;
    
    // Health check (no prefix)
    this.app.use('/health', healthRoutes);
    
    // API routes
    this.app.use(`${apiPrefix}/products`, productRoutes);
    this.app.use(`${apiPrefix}/webhooks`, webhookRoutes);
    this.app.use(`${apiPrefix}/webhooks`, webhookTestRoutes);
    this.app.use(`${apiPrefix}/oauth`, oauthTestRoutes);
    this.app.use(`${apiPrefix}/oauth`, oauthMockRoutes);
    this.app.use(`${apiPrefix}/external`, externalRoutes);
    
    // 404 handler
    this.app.use('*', (_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize database
      await initDatabase();
      logger.info('Database initialized');
      
      // Initialize Redis
      await initRedis();
      logger.info('Redis initialized');
      
      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application', error);
      throw error;
    }
  }
}
