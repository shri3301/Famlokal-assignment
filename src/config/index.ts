import dotenv from 'dotenv';

/**
 * Load and validate environment variables on module initialization.
 * This ensures configuration is available before any other modules load.
 */
dotenv.config();

/**
 * Type-safe environment variable parser with validation.
 * Provides fallback values and type coercion for configuration.
 */
class ConfigParser {
  /**
   * Parse integer from environment variable with validation.
   * @param key - Environment variable name
   * @param defaultValue - Fallback value if parsing fails
   * @param min - Minimum allowed value (optional)
   * @returns Parsed integer value
   */
  public static parseInt(key: string, defaultValue: number, min?: number): number {
    const value = parseInt(process.env[key] || String(defaultValue), 10);
    if (isNaN(value)) return defaultValue;
    if (min !== undefined && value < min) return defaultValue;
    return value;
  }

  /**
   * Get string from environment with fallback.
   * @param key - Environment variable name
   * @param defaultValue - Fallback value
   * @returns Environment value or default
   */
  public static getString(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }
}

/**
 * Application configuration object.
 * Centralizes all environment-based settings with type safety and defaults.
 * 
 * @remarks
 * Configuration is loaded once at startup and remains immutable.
 * All values are validated and coerced to the correct type.
 * 
 * @example
 * ```typescript
 * import { config } from './config';
 * console.log(config.server.port); // 3000
 * ```
 */
export const config = {
  /** Server and runtime configuration */
  server: {
    /** Node environment: 'development', 'production', or 'test' */
    nodeEnv: ConfigParser.getString('NODE_ENV', 'development'),
    
    /** HTTP server port (1-65535) */
    port: ConfigParser.parseInt('PORT', 3000, 1),
    
    /** API version prefix for routes (e.g., 'v1' -> '/api/v1') */
    apiVersion: ConfigParser.getString('API_VERSION', 'v1'),
  },
  
  /** MySQL database connection configuration */
  database: {
    /** Database server hostname or IP address */
    host: ConfigParser.getString('DB_HOST', 'localhost'),
    
    /** MySQL server port (typically 3306) */
    port: ConfigParser.parseInt('DB_PORT', 3306, 1),
    
    /** Database authentication username */
    user: ConfigParser.getString('DB_USER', 'root'),
    
    /** Database authentication password */
    password: ConfigParser.getString('DB_PASSWORD', ''),
    
    /** Target database name */
    database: ConfigParser.getString('DB_NAME', 'product_db'),
    
    /** Maximum number of connections in the pool (recommended: CPU cores * 2) */
    connectionLimit: ConfigParser.parseInt('DB_CONNECTION_LIMIT', 10, 1),
    
    /** Maximum queued connection requests (0 = unlimited) */
    queueLimit: ConfigParser.parseInt('DB_QUEUE_LIMIT', 0, 0),
  },
  
  /** Redis configuration for caching and distributed locking */
  redis: {
    /** Redis connection URL (e.g., 'redis://localhost:6379') */
    url: ConfigParser.getString('REDIS_URL', 'redis://localhost:6379'),
    
    /** Key prefix to namespace all cache keys (prevents collisions) */
    keyPrefix: ConfigParser.getString('REDIS_KEY_PREFIX', 'app:'),
  },
  
  /** Cache Time-To-Live settings (in seconds) */
  cache: {
    ttl: {
      /** Short-lived cache (5 minutes) - for frequently changing data */
      short: ConfigParser.parseInt('CACHE_TTL_SHORT', 300, 1),
      
      /** Medium-lived cache (1 hour) - for semi-static data */
      medium: ConfigParser.parseInt('CACHE_TTL_MEDIUM', 3600, 1),
      
      /** Long-lived cache (24 hours) - for rarely changing data */
      long: ConfigParser.parseInt('CACHE_TTL_LONG', 86400, 1),
    },
  },
  
  /** Rate limiting configuration to prevent API abuse */
  rateLimit: {
    /** Time window in milliseconds (default: 15 minutes) */
    windowMs: ConfigParser.parseInt('RATE_LIMIT_WINDOW_MS', 900000, 1),
    
    /** Maximum requests allowed per window */
    maxRequests: ConfigParser.parseInt('RATE_LIMIT_MAX_REQUESTS', 100, 1),
  },
  
  /** OAuth 2.0 Client Credentials Flow configuration */
  oauth: {
    /** OAuth token endpoint URL */
    tokenUrl: ConfigParser.getString('OAUTH_TOKEN_URL', ''),
    
    /** OAuth client ID for authentication */
    clientId: ConfigParser.getString('OAUTH_CLIENT_ID', ''),
    
    /** OAuth client secret (keep confidential) */
    clientSecret: ConfigParser.getString('OAUTH_CLIENT_SECRET', ''),
    
    /** OAuth scope permissions */
    scope: ConfigParser.getString('OAUTH_SCOPE', ''),
    
    /** Redis cache key for storing access token */
    tokenCacheKey: ConfigParser.getString('OAUTH_TOKEN_CACHE_KEY', 'oauth:access_token'),
    
    /** Redis lock key for token refresh synchronization */
    tokenLockKey: ConfigParser.getString('OAUTH_TOKEN_LOCK_KEY', 'oauth:token_refresh_lock'),
    
    /** Token refresh lock TTL in seconds (prevents deadlock) */
    tokenLockTTL: ConfigParser.parseInt('OAUTH_TOKEN_LOCK_TTL', 30, 5),
  },
  
  /** External API integration configuration */
  externalApi: {
    /** Base URL for external API endpoints */
    baseUrl: ConfigParser.getString('EXTERNAL_API_BASE_URL', ''),
    
    /** Request timeout in milliseconds */
    timeout: ConfigParser.parseInt('EXTERNAL_API_TIMEOUT', 5000, 1000),
    
    /** Number of retry attempts on failure */
    retryAttempts: ConfigParser.parseInt('EXTERNAL_API_RETRY_ATTEMPTS', 3, 0),
    
    /** Delay between retries in milliseconds (exponential backoff) */
    retryDelay: ConfigParser.parseInt('EXTERNAL_API_RETRY_DELAY', 1000, 100),
  },
  
  /** Circuit breaker pattern configuration for fault tolerance */
  circuitBreaker: {
    /** Failure threshold before opening circuit */
    threshold: ConfigParser.parseInt('CIRCUIT_BREAKER_THRESHOLD', 5, 1),
    
    /** Circuit breaker timeout in milliseconds */
    timeout: ConfigParser.parseInt('CIRCUIT_BREAKER_TIMEOUT', 60000, 1000),
    
    /** Time before attempting to close circuit in milliseconds */
    resetTimeout: ConfigParser.parseInt('CIRCUIT_BREAKER_RESET_TIMEOUT', 30000, 1000),
  },
  
  /** Webhook processing configuration */
  webhook: {
    /** Secret key for webhook signature verification */
    secret: ConfigParser.getString('WEBHOOK_SECRET', ''),
    
    /** Idempotency key TTL in seconds (prevents duplicate processing) */
    idempotencyTTL: ConfigParser.parseInt('WEBHOOK_IDEMPOTENCY_TTL', 86400, 60),
  },
  
  /** Application logging configuration */
  logging: {
    /** Log level: 'error' | 'warn' | 'info' | 'debug' */
    level: ConfigParser.getString('LOG_LEVEL', 'info'),
    
    /** Log file path for persistent storage */
    filePath: ConfigParser.getString('LOG_FILE_PATH', './logs/app.log'),
    
    /** Maximum log file size before rotation (e.g., '10m' = 10 megabytes) */
    maxSize: ConfigParser.getString('LOG_MAX_SIZE', '10m'),
    
    /** Number of rotated log files to keep */
    maxFiles: ConfigParser.parseInt('LOG_MAX_FILES', 7, 1),
  },
} as const; // Make configuration immutable
