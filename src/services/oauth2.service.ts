/**
 * OAuth 2.0 Client Credentials Flow Implementation
 * 
 * Implements secure token management with:
 * - Distributed locking to prevent concurrent refresh requests
 * - Redis caching for token reuse across instances
 * - Automatic token expiry handling with safety buffer
 * - Thread-safe token refresh across multiple servers
 * 
 * @module services/oauth2.service
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { cacheGet, cacheSet, acquireLock, releaseLock } from '../infrastructure/redis';
import { OAuth2Token, OAuth2TokenResponse } from '../types/oauth.types';
import { logger } from '../utils/logger';
import { UnauthorizedError } from '../types/errors';

/** Token expiry buffer in milliseconds (refresh 60s before actual expiry) */
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

/** Retry delay when waiting for another instance to refresh token */
const REFRESH_RETRY_DELAY_MS = 1000;

/** HTTP timeout for OAuth requests */
const OAUTH_REQUEST_TIMEOUT_MS = 10000;

/**
 * OAuth 2.0 client for Client Credentials flow.
 * 
 * @class OAuth2Client
 * @description Manages access tokens with distributed locking
 * to ensure only one server refreshes at a time.
 * 
 * @remarks
 * In a multi-server environment, this prevents the "thundering herd"
 * problem where all servers refresh tokens simultaneously.
 */
export class OAuth2Client {
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: config.oauth.tokenUrl,
      timeout: OAUTH_REQUEST_TIMEOUT_MS,
    });
  }

  /**
   * Retrieves a valid access token (from cache or OAuth server).
   * 
   * @returns Promise resolving to valid access token string
   * @throws {UnauthorizedError} If unable to obtain token
   * 
   * @remarks
   * - Checks cache first for existing valid token
   * - Refreshes if token is expired or missing
   * - Uses distributed lock to prevent concurrent refreshes
   * - Thread-safe across multiple server instances
   */
  public async getAccessToken(): Promise<string> {
    try {
      // Check cache for valid token
      const cachedToken = await this.getTokenFromCache();
      if (cachedToken && !this.isTokenExpired(cachedToken)) {
        logger.debug('Using cached OAuth2 token');
        return cachedToken.accessToken;
      }

      // Token expired or missing - refresh with distributed lock
      return await this.refreshTokenWithLock();
    } catch (error: any) {
      logger.error('Failed to obtain OAuth2 access token', {
        message: error.message,
        status: error.response?.status,
      });
      throw new UnauthorizedError('Failed to obtain access token');
    }
  }

  /**
   * Refreshes access token using distributed lock pattern.
   * 
   * @returns Promise resolving to new access token
   * @private
   * 
   * @remarks
   * Lock acquisition ensures only ONE server instance refreshes at a time.
   * If lock is held by another instance:
   * 1. Wait briefly (1 second)
   * 2. Check cache for newly refreshed token
   * 3. Retry lock acquisition if still invalid
   * 
   * This prevents N servers making N token requests simultaneously.
   */
  private async refreshTokenWithLock(): Promise<string> {
    const lockKey = config.oauth.tokenLockKey;
    const lockTTL = config.oauth.tokenLockTTL;

    // Attempt to acquire distributed lock
    const lockAcquired = await acquireLock(lockKey, lockTTL);

    if (!lockAcquired) {
      // Another instance is refreshing - wait and retry
      logger.info('Another instance is refreshing token, waiting...');
      await this.sleep(REFRESH_RETRY_DELAY_MS);

      // Check if token was refreshed by other instance
      const cachedToken = await this.getTokenFromCache();
      if (cachedToken && !this.isTokenExpired(cachedToken)) {
        return cachedToken.accessToken;
      }

      // Still no valid token - recursive retry
      return await this.refreshTokenWithLock();
    }

    try {
      // Lock acquired - double-check cache (another instance may have refreshed)
      const cachedToken = await this.getTokenFromCache();
      if (cachedToken && !this.isTokenExpired(cachedToken)) {
        logger.info('Token refreshed by another instance during lock acquisition');
        return cachedToken.accessToken;
      }

      // Fetch new token from OAuth server
      logger.info('Refreshing OAuth2 token from server');
      const newToken = await this.fetchNewToken();

      // Cache with TTL
      await this.saveTokenToCache(newToken);

      return newToken.accessToken;
    } finally {
      // Always release lock (even on error)
      await releaseLock(lockKey);
    }
  }

  /**
   * Fetch new token from OAuth2 server
   */
  private async fetchNewToken(): Promise<OAuth2Token> {
    try {
      const response = await this.httpClient.post<OAuth2TokenResponse>('', {
        grant_type: 'client_credentials',
        client_id: config.oauth.clientId,
        client_secret: config.oauth.clientSecret,
        scope: config.oauth.scope,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, token_type, expires_in } = response.data;

      const token: OAuth2Token = {
        accessToken: access_token,
        tokenType: token_type,
        expiresIn: expires_in,
        expiresAt: Date.now() + expires_in * 1000,
      };

      logger.info('OAuth2 token fetched successfully', {
        expiresIn: expires_in,
        expiresAt: new Date(token.expiresAt).toISOString(),
      });

      return token;
    } catch (error: any) {
      logger.error('Failed to fetch OAuth2 token', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Retrieves token from Redis cache.
   * @returns Promise resolving to cached token or null
   * @private
   */
  private async getTokenFromCache(): Promise<OAuth2Token | null> {
    const cached = await cacheGet(config.oauth.tokenCacheKey);
    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as OAuth2Token;
    } catch (error) {
      logger.error('Failed to parse cached token JSON', { error });
      return null;
    }
  }

  /**
   * Saves token to Redis cache with smart TTL.
   * 
   * @param token - Token object to cache
   * @returns Promise that resolves when cached
   * @private
   * 
   * @remarks
   * TTL is set to token expiry minus 60 seconds to force refresh
   * before actual expiry (prevents expired token usage).
   */
  private async saveTokenToCache(token: OAuth2Token): Promise<void> {
    // Cache for slightly less than actual expiry to force early refresh
    const safeTTL = Math.max(token.expiresIn - 60, 0);
    
    await cacheSet(
      config.oauth.tokenCacheKey,
      JSON.stringify(token),
      safeTTL || token.expiresIn
    );
  }

  /**
   * Checks if token is expired or about to expire.
   * 
   * @param token - Token to validate
   * @returns True if expired or within 60-second buffer
   * @private
   * 
   * @remarks
   * Uses 60-second safety buffer to prevent race conditions
   * where token expires during request processing.
   */
  private isTokenExpired(token: OAuth2Token): boolean {
    return Date.now() >= token.expiresAt - TOKEN_EXPIRY_BUFFER_MS;
  }

  /**
   * Promisified sleep utility.
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after delay
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton OAuth2 client instance.
 * 
 * @remarks
 * Use this exported instance throughout the application
 * to ensure shared token cache and distributed locking.
 * 
 * @example
 * ```typescript
 * const token = await oauth2Client.getAccessToken();
 * ```
 */
export const oauth2Client = new OAuth2Client();
