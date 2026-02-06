import { Router, Request, Response, NextFunction } from 'express';
import { externalApiClient } from '../services/externalApi.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/external/users/:userId
 * Fetch user data from external API with circuit breaker and retry logic
 */
router.get('/users/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    
    logger.info('Fetching user from external API', { userId });
    
    const user = await externalApiClient.fetchUser(userId);
    
    res.json({
      success: true,
      message: 'User fetched successfully from external API',
      data: user,
      meta: {
        externalApi: 'JSONPlaceholder (Demo API)',
        features: ['Circuit Breaker', 'Retry Logic', 'Timeout Handling'],
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/external/posts
 * Fetch posts from external API with query parameters
 */
router.get('/posts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    logger.info('Fetching posts from external API', { limit });
    
    const posts = await externalApiClient.fetchPosts(limit);
    
    res.json({
      success: true,
      message: `Fetched ${posts.length} posts from external API`,
      data: posts,
      meta: {
        count: posts.length,
        limit,
        externalApi: 'JSONPlaceholder (Demo API)',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/external/posts
 * Create a post via external API (demonstrates POST with retry)
 */
router.post('/posts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const postData = {
      title: req.body.title || 'Test Post',
      body: req.body.body || 'This is a test post',
      userId: req.body.userId || 1,
    };
    
    logger.info('Creating post in external API', { postData });
    
    const result = await externalApiClient.createPost(postData);
    
    res.status(201).json({
      success: true,
      message: 'Post created successfully in external API',
      data: result,
      meta: {
        externalApi: 'JSONPlaceholder (Demo API)',
        note: 'This is a fake API - data is not actually persisted',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/external/health
 * Check external API health and circuit breaker status
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Try a simple call to check if external API is reachable
    await externalApiClient.fetchUser('1');
    
    res.json({
      success: true,
      message: 'External API is healthy',
      circuitBreaker: 'CLOSED (accepting requests)',
      features: {
        timeout: '5000ms',
        retryAttempts: 3,
        retryDelay: '1000ms with exponential backoff',
        circuitBreakerThreshold: 5,
      },
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      message: 'External API is unhealthy',
      error: error.message,
      circuitBreaker: 'May be OPEN (blocking requests)',
    });
  }
});

export default router;
