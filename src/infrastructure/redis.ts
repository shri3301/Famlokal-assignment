/**
 * Redis Client Manager for Caching and Distributed Locking
 * 
 * Provides:
 * - Redis connection management with event handling
 * - Key-value caching with TTL support
 * - Distributed locking for concurrency control
 * - Automatic key prefixing for namespace isolation
 * 
 * @module infrastructure/redis
 */

import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

/** Global Redis client instance (singleton pattern) */
let redisClient: RedisClientType | null = null;

/**
 * Initializes the Redis client with event handlers.
 * 
 * @throws {Error} If unable to connect to Redis server
 * @returns Promise that resolves when client is connected and ready
 * 
 * @remarks
 * Registers event handlers for:
 * - Connection lifecycle (connect, ready)
 * - Error handling
 * - Connection status monitoring
 */
export const initRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      url: config.redis.url,
    });
    
    // Error handler - log all Redis errors
    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err });
    });
    
    // Connection lifecycle events
    redisClient.on('connect', () => {
      logger.info('Redis client connecting...');
    });
    
    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });
    
    // Establish connection
    await redisClient.connect();
    
    // Verify connection with ping
    await redisClient.ping();
    
    logger.info('Redis connected successfully', {
      url: config.redis.url,
    });
  } catch (error) {
    logger.error('Failed to connect to Redis', { error });
    throw error;
  }
};

/**
 * Retrieves the Redis client instance.
 * 
 * @throws {Error} If client hasn't been initialized via initRedis()
 * @returns The Redis client
 */
export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
};

/**
 * Closes the Redis connection gracefully.
 * 
 * @returns Promise that resolves when connection is closed
 * 
 * @remarks
 * Should be called during graceful shutdown to clean up resources.
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

/**
 * Retrieves a value from the cache.
 * 
 * @param key - Cache key (without prefix)
 * @returns Promise resolving to the cached value or null if not found
 * 
 * @example
 * ```typescript
 * const userData = await cacheGet('user:123');
 * if (userData) {
 *   return JSON.parse(userData);
 * }
 * ```
 * 
 * @remarks
 * - Key is automatically prefixed with config.redis.keyPrefix
 * - Returns null if key doesn't exist or has expired
 */
export const cacheGet = async (key: string): Promise<string | null> => {
  const client = getRedisClient();
  const prefixedKey = `${config.redis.keyPrefix}${key}`;
  return await client.get(prefixedKey);
};

/**
 * Stores a value in the cache with optional TTL.
 * 
 * @param key - Cache key (without prefix)
 * @param value - Value to cache (typically JSON string)
 * @param ttl - Time-to-live in seconds (optional)
 * @returns Promise that resolves when value is stored
 * 
 * @example
 * ```typescript
 * await cacheSet('user:123', JSON.stringify(user), 3600);
 * ```
 * 
 * @remarks
 * - Key is automatically prefixed with config.redis.keyPrefix
 * - If TTL is not provided, key persists until manually deleted
 * - Use appropriate TTL from config.cache.ttl for consistency
 */
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

/**
 * Deletes a key from the cache.
 * 
 * @param key - Cache key to delete (without prefix)
 * @returns Promise that resolves when key is deleted
 * 
 * @example
 * ```typescript
 * await cacheDel('user:123');
 * ```
 */
export const cacheDel = async (key: string): Promise<void> => {
  const client = getRedisClient();
  const prefixedKey = `${config.redis.keyPrefix}${key}`;
  await client.del(prefixedKey);
};

/**
 * Acquires a distributed lock across all server instances.
 * 
 * @param lockKey - Lock identifier (without prefix)
 * @param ttl - Lock expiry time in seconds (prevents deadlock)
 * @returns Promise resolving to true if lock acquired, false otherwise
 * 
 * @example
 * ```typescript
 * const lockAcquired = await acquireLock('token-refresh', 30);
 * if (lockAcquired) {
 *   try {
 *     // Critical section - only one instance executes
 *     await refreshToken();
 *   } finally {
 *     await releaseLock('token-refresh');
 *   }
 * }
 * ```
 * 
 * @remarks
 * - Uses Redis SET NX (set if not exists) for atomic lock acquisition
 * - TTL prevents deadlock if process crashes while holding lock
 * - Always release lock in finally block to prevent stale locks
 */
export const acquireLock = async (
  lockKey: string,
  ttl: number
): Promise<boolean> => {
  const client = getRedisClient();
  const prefixedKey = `${config.redis.keyPrefix}lock:${lockKey}`;
  
  // SET NX EX: Set if Not eXists with EXpiry
  const result = await client.set(prefixedKey, '1', {
    NX: true,
    EX: ttl,
  });
  
  return result === 'OK';
};

/**
 * Releases a distributed lock.
 * 
 * @param lockKey - Lock identifier to release (without prefix)
 * @returns Promise that resolves when lock is released
 * 
 * @remarks
 * Should always be called in a finally block after acquireLock
 */
export const releaseLock = async (lockKey: string): Promise<void> => {
  const client = getRedisClient();
  const prefixedKey = `${config.redis.keyPrefix}lock:${lockKey}`;
  await client.del(prefixedKey);
};
