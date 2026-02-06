import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiVersion: process.env.API_VERSION || 'v1',
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'product_db',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0', 10),
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'app:',
  },
  
  cache: {
    ttl: {
      short: parseInt(process.env.CACHE_TTL_SHORT || '300', 10),
      medium: parseInt(process.env.CACHE_TTL_MEDIUM || '3600', 10),
      long: parseInt(process.env.CACHE_TTL_LONG || '86400', 10),
    },
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  oauth: {
    tokenUrl: process.env.OAUTH_TOKEN_URL || '',
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    scope: process.env.OAUTH_SCOPE || '',
    tokenCacheKey: process.env.OAUTH_TOKEN_CACHE_KEY || 'oauth:access_token',
    tokenLockKey: process.env.OAUTH_TOKEN_LOCK_KEY || 'oauth:token_refresh_lock',
    tokenLockTTL: parseInt(process.env.OAUTH_TOKEN_LOCK_TTL || '30', 10),
  },
  
  externalApi: {
    baseUrl: process.env.EXTERNAL_API_BASE_URL || '',
    timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT || '5000', 10),
    retryAttempts: parseInt(process.env.EXTERNAL_API_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.EXTERNAL_API_RETRY_DELAY || '1000', 10),
  },
  
  circuitBreaker: {
    threshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000', 10),
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000', 10),
  },
  
  webhook: {
    secret: process.env.WEBHOOK_SECRET || '',
    idempotencyTTL: parseInt(process.env.WEBHOOK_IDEMPOTENCY_TTL || '86400', 10),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '7', 10),
  },
};
