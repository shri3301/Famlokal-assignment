import { Router, Request, Response } from 'express';
import { cacheGet, cacheSet } from '../infrastructure/redis';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/oauth/mock-test
 * Test OAuth flow with mock token (no real OAuth provider needed)
 */
router.get('/mock-test', async (req: Request, res: Response) => {
  void req;
  try {
    const cacheKey = 'oauth:mock_token';
    
    // Check if token exists in cache
    let token = await cacheGet(cacheKey);
    
    if (!token) {
      logger.info('Generating mock OAuth token');
      
      // Generate mock token
      token = `mock_token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Cache for 5 minutes
      await cacheSet(cacheKey, token, 300);
      
      res.json({
        success: true,
        message: 'Mock OAuth token generated and cached',
        token: {
          value: token,
          source: 'generated',
          cached: true,
          expiresIn: 300,
        },
      });
    } else {
      logger.info('Using cached mock OAuth token');
      
      res.json({
        success: true,
        message: 'Using cached mock OAuth token',
        token: {
          value: token,
          source: 'cache',
          cached: true,
        },
      });
    }
  } catch (error) {
    logger.error('Error in mock OAuth test', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test OAuth',
    });
  }
});

export default router;
