import { Router, Request, Response } from 'express';
import { getPool } from '../infrastructure/database';
import { getRedisClient } from '../infrastructure/redis';
import { logger } from '../utils/logger';

const router = Router();

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}

/**
 * GET /health
 * Health check endpoint for load balancers and monitoring
 */
router.get('/', async (req: Request, res: Response) => {
  void req;
  const healthCheck: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'down',
      redis: 'down',
    },
  };

  try {
    // Check database connection
    const pool = getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    healthCheck.services.database = 'up';
  } catch (error) {
    logger.error('Database health check failed', error);
    healthCheck.status = 'unhealthy';
  }

  try {
    // Check Redis connection
    const redisClient = getRedisClient();
    await redisClient.ping();
    healthCheck.services.redis = 'up';
  } catch (error) {
    logger.error('Redis health check failed', error);
    healthCheck.status = 'unhealthy';
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

/**
 * GET /health/liveness
 * Kubernetes liveness probe
 */
router.get('/liveness', (req: Request, res: Response) => {
  void req;
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/readiness
 * Kubernetes readiness probe
 */
router.get('/readiness', async (req: Request, res: Response) => {
  void req;
  try {
    // Quick checks for critical dependencies
    const pool = getPool();
    const redisClient = getRedisClient();
    
    // Simple connection checks without heavy operations
    await Promise.all([
      pool.getConnection().then(conn => conn.release()),
      redisClient.ping(),
    ]);

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
