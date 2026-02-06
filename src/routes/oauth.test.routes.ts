import { Router, Request, Response, NextFunction } from 'express';
import { oauth2Client } from '../services/oauth2.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/oauth/test
 * Test OAuth2 token retrieval
 */
router.get('/test', async (req: Request, res: Response, next: NextFunction) => {
  void req;
  try {
    logger.info('Testing OAuth2 token retrieval');
    
    // Get access token
    const accessToken = await oauth2Client.getAccessToken();
    
    res.json({
      success: true,
      message: 'OAuth2 token retrieved successfully',
      token: {
        value: accessToken.substring(0, 20) + '...', // Show partial token
        length: accessToken.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
