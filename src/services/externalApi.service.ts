import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ServiceUnavailableError } from '../types/errors';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerStats {
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  state: CircuitState;
}

/**
 * Circuit Breaker pattern for external API calls
 * Prevents cascading failures by stopping requests to failing services
 */
export class CircuitBreaker {
  private stats: CircuitBreakerStats;
  private threshold: number;
  private timeout: number;
  private resetTimeout: number;

  constructor(
    threshold: number = config.circuitBreaker.threshold,
    timeout: number = config.circuitBreaker.timeout,
    resetTimeout: number = config.circuitBreaker.resetTimeout
  ) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.resetTimeout = resetTimeout;
    this.stats = {
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      state: CircuitState.CLOSED,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    void this.timeout;
    if (this.stats.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.stats.state = CircuitState.HALF_OPEN;
        logger.info('Circuit breaker transitioning to HALF_OPEN');
      } else {
        throw new ServiceUnavailableError('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.stats.failures = 0;
    this.stats.successes++;

    if (this.stats.state === CircuitState.HALF_OPEN) {
      this.stats.state = CircuitState.CLOSED;
      logger.info('Circuit breaker CLOSED');
    }
  }

  private onFailure(): void {
    this.stats.failures++;
    this.stats.lastFailureTime = Date.now();

    if (this.stats.failures >= this.threshold) {
      this.stats.state = CircuitState.OPEN;
      logger.error('Circuit breaker OPEN', {
        failures: this.stats.failures,
        threshold: this.threshold,
      });
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.stats.lastFailureTime !== null &&
      Date.now() - this.stats.lastFailureTime >= this.resetTimeout
    );
  }

  public getState(): CircuitState {
    return this.stats.state;
  }
}

/**
 * External API client with retry logic and circuit breaker
 */
export class ExternalApiClient {
  private httpClient: AxiosInstance;
  private circuitBreaker: CircuitBreaker;
  private retryAttempts: number;
  private retryDelay: number;

  constructor() {
    this.httpClient = axios.create({
      baseURL: config.externalApi.baseUrl,
      timeout: config.externalApi.timeout,
    });

    this.circuitBreaker = new CircuitBreaker();
    this.retryAttempts = config.externalApi.retryAttempts;
    this.retryDelay = config.externalApi.retryDelay;
  }

  /**
   * Make API call with retry and circuit breaker
   */
  public async get<T>(url: string, params?: any): Promise<T> {
    return await this.executeWithRetry(async () => {
      return await this.circuitBreaker.execute(async () => {
        const response = await this.httpClient.get<T>(url, { params });
        return response.data;
      });
    });
  }

  /**
   * POST request with retry and circuit breaker
   */
  public async post<T>(url: string, data?: any): Promise<T> {
    return await this.executeWithRetry(async () => {
      return await this.circuitBreaker.execute(async () => {
        const response = await this.httpClient.post<T>(url, data);
        return response.data;
      });
    });
  }

  /**
   * Retry logic with exponential backoff
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
          throw error;
        }

        // Don't retry if circuit breaker is open
        if (error instanceof ServiceUnavailableError) {
          throw error;
        }

        const delay = this.retryDelay * Math.pow(2, attempt);
        logger.warn(`External API call failed, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          maxAttempts: this.retryAttempts,
          error: (error as Error).message,
        });

        await this.sleep(delay);
      }
    }

    logger.error('External API call failed after all retries', lastError);
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch user data from JSONPlaceholder API (demo external API)
   */
  public async fetchUser(userId: string): Promise<any> {
    logger.info('Fetching user from external API', { userId });
    
    const data = await this.get(`/users/${userId}`);
    
    return data;
  }

  /**
   * Fetch posts from JSONPlaceholder API (demo external API)
   */
  public async fetchPosts(limit: number = 10): Promise<any> {
    logger.info('Fetching posts from external API', { limit });
    
    const data = await this.get('/posts', { _limit: limit });
    
    return data;
  }

  /**
   * Create a post (demo POST request)
   */
  public async createPost(postData: any): Promise<any> {
    logger.info('Creating post in external API', { postData });
    
    const data = await this.post('/posts', postData);
    
    return data;
  }
}

export const externalApiClient = new ExternalApiClient();
