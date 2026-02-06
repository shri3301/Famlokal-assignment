import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: RedisClientType;

export const initRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis client error', err);
    });
    
    redisClient.on('connect', () => {
      logger.info('Redis client connecting...');
    });
    
    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });
    
    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis', error);
    throw error;
  }
};

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedis first.');
  }
  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
};

// Cache helper functions
export const cacheGet = async (key: string): Promise<string | null> => {
  const client = getRedisClient();
  const prefixedKey = `${config.redis.keyPrefix}${key}`;
  return await client.get(prefixedKey);
};

export const cacheSet = async (
  key: string,
  value: string,
  ttl?: number
): Promise<void> => {
  const client = getRedisClient();
  const prefixedKey = `${config.redis.keyPrefix}${key}`;
  
  if (ttl) {
    await client.setEx(prefixedKey, ttl, value);
  } else {
    await client.set(prefixedKey, value);
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  const client = getRedisClient();
  const prefixedKey = `${config.redis.keyPrefix}${key}`;
  await client.del(prefixedKey);
};

// Distributed lock helper (for concurrency-safe operations like token refresh)
export const acquireLock = async (
  lockKey: string,
  ttl: number
): Promise<boolean> => {
  const client = getRedisClient();
  const prefixedKey = `${config.redis.keyPrefix}lock:${lockKey}`;
  
  // SET NX EX - Set if Not eXists with EXpiry
  const result = await client.set(prefixedKey, '1', {
    NX: true,
    EX: ttl,
  });
  
  return result === 'OK';
};

export const releaseLock = async (lockKey: string): Promise<void> => {
  const client = getRedisClient();
  const prefixedKey = `${config.redis.keyPrefix}lock:${lockKey}`;
  await client.del(prefixedKey);
};
