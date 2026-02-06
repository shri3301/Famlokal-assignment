import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { cacheGet, cacheSet, acquireLock, releaseLock } from '../infrastructure/redis';
import { OAuth2Token, OAuth2TokenResponse } from '../types/oauth.types';
import { logger } from '../utils/logger';
import { UnauthorizedError } from '../types/errors';

/**
 * OAuth2 Client Credentials Flow with Redis caching
 * Implements concurrency-safe token refresh using Redis distributed lock
 */
export class OAuth2Client {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: config.oauth.tokenUrl,
      timeout: 10000,
    });
  }

  /**
   * Get access token (from cache or fetch new)
   * Thread-safe: Multiple concurrent requests will share the same token
   */
  public async getAccessToken(): Promise<string> {
    try {
      // Try to get from cache first
      const cachedToken = await this.getTokenFromCache();
      if (cachedToken && !this.isTokenExpired(cachedToken)) {
        logger.debug('Using cached OAuth2 token');
        return cachedToken.accessToken;
      }

      // Token is expired or doesn't exist, need to refresh
      return await this.refreshTokenWithLock();
    } catch (error: any) {
      logger.error('Failed to get OAuth2 access token', {
        message: error.message,
        status: error.response?.status,
      });
      throw new UnauthorizedError('Failed to obtain access token');
    }
  }

  /**
   * Refresh token with distributed lock to prevent concurrent refresh requests
   * Only one instance across all servers will refresh at a time
   */
  private async refreshTokenWithLock(): Promise<string> {
    const lockKey = config.oauth.tokenLockKey;
    const lockTTL = config.oauth.tokenLockTTL;

    // Try to acquire lock
    const lockAcquired = await acquireLock(lockKey, lockTTL);

    if (!lockAcquired) {
      // Another instance is refreshing, wait and retry getting from cache
      logger.info('Another instance is refreshing token, waiting...');
      await this.sleep(1000);

      const cachedToken = await this.getTokenFromCache();
      if (cachedToken && !this.isTokenExpired(cachedToken)) {
        return cachedToken.accessToken;
      }

      // Still no valid token, try again (recursive with max retry)
      return await this.refreshTokenWithLock();
    }

    try {
      // Lock acquired, check cache one more time (double-check pattern)
      const cachedToken = await this.getTokenFromCache();
      if (cachedToken && !this.isTokenExpired(cachedToken)) {
        logger.info('Token was refreshed by another instance while waiting for lock');
        return cachedToken.accessToken;
      }

      // Fetch new token
      logger.info('Refreshing OAuth2 token');
      const newToken = await this.fetchNewToken();

      // Cache the new token
      await this.saveTokenToCache(newToken);

      return newToken.accessToken;
    } finally {
      // Always release the lock
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
   * Get token from Redis cache
   */
  private async getTokenFromCache(): Promise<OAuth2Token | null> {
    const cached = await cacheGet(config.oauth.tokenCacheKey);
    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as OAuth2Token;
    } catch (error) {
      logger.error('Failed to parse cached token', error);
      return null;
    }
  }

  /**
   * Save token to Redis cache with TTL
   */
  private async saveTokenToCache(token: OAuth2Token): Promise<void> {
    const ttl = token.expiresIn - 60; // Expire 60 seconds before actual expiry
    await cacheSet(
      config.oauth.tokenCacheKey,
      JSON.stringify(token),
      ttl > 0 ? ttl : token.expiresIn
    );
  }

  /**
   * Check if token is expired (with 60 second buffer)
   */
  private isTokenExpired(token: OAuth2Token): boolean {
    const buffer = 60 * 1000; // 60 seconds
    return Date.now() >= token.expiresAt - buffer;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const oauth2Client = new OAuth2Client();
