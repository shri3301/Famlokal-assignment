/**
 * Product Business Logic Service
 * 
 * Implements business logic for product operations:
 * - Cursor-based pagination for large datasets (1M+ records)
 * - Redis caching with intelligent cache key generation
 * - Error handling and validation
 * 
 * @module services/product.service
 */

import { ProductRepository } from '../repositories/product.repository';
import { Product, ProductListQuery, ProductListResponse } from '../types/product.types';
import { cacheGet, cacheSet } from '../infrastructure/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { NotFoundError } from '../types/errors';

/** Default page size for product listings */
const DEFAULT_PAGE_LIMIT = 50;

/** Cache key namespace for product lists */
const CACHE_NAMESPACE_PRODUCTS = 'products';

/** Cache key prefix for individual products */
const CACHE_PREFIX_PRODUCT = 'product';

/**
 * Service layer for product operations.
 * 
 * @class ProductService
 * @description Coordinates between controllers and repositories,
 * implements caching, and handles business logic.
 */
export class ProductService {
  private readonly productRepository: ProductRepository;

  constructor() {
    this.productRepository = new ProductRepository();
  }

  /**
   * Retrieves a paginated list of products with caching.
   * 
   * @param query - Query parameters for filtering, sorting, and pagination
   * @returns Promise resolving to paginated product list
   * 
   * @remarks
   * - Implements cache-aside pattern (check cache, then database)
   * - Uses cursor-based pagination for consistent results
   * - Cache TTL is short-lived due to frequent updates
   * - Fetches limit+1 records to determine if more pages exist
   */
  public async listProducts(query: ProductListQuery): Promise<ProductListResponse> {
    try {
      // Generate deterministic cache key from query parameters
      const cacheKey = this.generateCacheKey(query);
      
      // Attempt cache retrieval first
      const cachedData = await cacheGet(cacheKey);
      if (cachedData) {
        logger.info('Cache hit for products list', { cacheKey });
        return JSON.parse(cachedData);
      }

      logger.info('Cache miss - fetching from database', { cacheKey });

      // Fetch from database with one extra record for hasMore detection
      const products = await this.productRepository.findMany(query);
      
      // Determine pagination metadata
      const limit = query.limit || DEFAULT_PAGE_LIMIT;
      const hasMore = products.length > limit;
      
      // Remove extra record used for hasMore detection
      if (hasMore) {
        products.pop();
      }

      // Generate cursor for next page
      const nextCursor = this.generateNextCursor(products, hasMore, query);

      const response: ProductListResponse = {
        success: true,
        data: products,
        pagination: {
          nextCursor,
          hasMore,
          limit,
        },
      };

      // Cache result with short TTL (data changes frequently)
      await cacheSet(
        cacheKey, 
        JSON.stringify(response), 
        config.cache.ttl.short
      );

      return response;
    } catch (error) {
      logger.error('Failed to retrieve products list', { error, query });
      throw error;
    }
  }

  /**
   * Retrieves a single product by ID with caching.
   * 
   * @param id - Product unique identifier
   * @returns Promise resolving to product data
   * @throws {NotFoundError} If product doesn't exist
   * 
   * @remarks
   * - Uses medium TTL cache (1 hour) as individual products change less frequently
   * - Implements cache-aside pattern
   */
  public async getProductById(id: string): Promise<Product> {
    const cacheKey = `${CACHE_PREFIX_PRODUCT}:${id}`;
    
    // Check cache first
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      logger.info('Cache hit for product', { id });
      return JSON.parse(cachedData);
    }

    // Fetch from database
    logger.info('Cache miss - fetching product from database', { id });
    const product = await this.productRepository.findById(id);
    
    if (!product) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }

    // Cache for medium duration
    await cacheSet(
      cacheKey, 
      JSON.stringify(product), 
      config.cache.ttl.medium
    );

    return product;
  }

  /**
   * Generates a deterministic cache key from query parameters.
   * 
   * @param query - Product list query parameters
   * @returns Cache key string
   * @private
   * 
   * @remarks
   * - Creates a stable key from all query parameters
   * - Filters out empty values to reduce key variations
   * - Uses colon-separated format for readability
   */
  private generateCacheKey(query: ProductListQuery): string {
    const parts = [
      CACHE_NAMESPACE_PRODUCTS,
      `cursor:${query.cursor || 'none'}`,
      `limit:${query.limit || DEFAULT_PAGE_LIMIT}`,
      `sort:${query.sortBy || 'createdAt'}:${query.sortOrder || 'desc'}`,
      query.category ? `cat:${query.category}` : '',
      query.search ? `search:${query.search}` : '',
      query.minPrice !== undefined ? `minp:${query.minPrice}` : '',
      query.maxPrice !== undefined ? `maxp:${query.maxPrice}` : '',
    ];
    
    return parts.filter(Boolean).join(':');
  }

  /**
   * Generates cursor for next page if more results exist.
   * 
   * @param products - Current page of products
   * @param hasMore - Whether more pages exist
   * @param query - Original query parameters
   * @returns Base64-encoded cursor or null if no more pages
   * @private
   */
  private generateNextCursor(
    products: Product[],
    hasMore: boolean,
    query: ProductListQuery
  ): string | null {
    if (!hasMore || products.length === 0) {
      return null;
    }

    const lastProduct = products[products.length - 1];
    return this.encodeCursor(lastProduct, query.sortBy || 'createdAt');
  }

  /**
   * Encodes product cursor for pagination.
   * 
   * @param product - Last product from current page
   * @param sortBy - Sort field (currently unused, for future enhancement)
   * @returns Base64-encoded cursor string
   * @private
   * 
   * @remarks
   * Current implementation: Encodes ID and timestamp
   * Future: Could encode any sort field for flexible pagination
   */
  private encodeCursor(product: Product, sortBy: string): string {
    void sortBy; // Reserved for future sort field support
    
    const cursorData = `${product.id}:${product.createdAt.getTime()}`;
    return Buffer.from(cursorData).toString('base64');
  }
}
