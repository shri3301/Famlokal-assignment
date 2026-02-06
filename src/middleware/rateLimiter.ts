import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../infrastructure/redis';
import { config } from '../config';
import { TooManyRequestsError } from '../types/errors';
import { logger } from '../utils/logger';

/**
 * Redis-based sliding window rate limiter
 * Uses sorted sets to track request timestamps
 */
export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Identify client (use IP or API key if available)
    const clientId = req.ip || req.get('x-forwarded-for') || 'unknown';
    const key = `ratelimit:${clientId}`;
    
    const now = Date.now();
    const windowStart = now - config.rateLimit.windowMs;
    
    const redisClient = getRedisClient();
    
    // Remove old entries outside the window
    await redisClient.zRemRangeByScore(key, 0, windowStart);
    
    // Count requests in current window
    const requestCount = await redisClient.zCard(key);
    
    if (requestCount >= config.rateLimit.maxRequests) {
      logger.warn('Rate limit exceeded', { clientId, requestCount });
      throw new TooManyRequestsError('Rate limit exceeded. Please try again later.');
    }
    
    // Add current request
    await redisClient.zAdd(key, {
      score: now,
      value: `${now}`,
    });
    
    // Set expiry on the key
    await redisClient.expire(key, Math.ceil(config.rateLimit.windowMs / 1000));
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', config.rateLimit.maxRequests);
    res.setHeader('X-RateLimit-Remaining', config.rateLimit.maxRequests - requestCount - 1);
    res.setHeader('X-RateLimit-Reset', new Date(now + config.rateLimit.windowMs).toISOString());
    
    next();
  } catch (error) {
    next(error);
  }
};
