import { ProductRepository } from '../repositories/product.repository';
import { Product, ProductListQuery, ProductListResponse } from '../types/product.types';
import { cacheGet, cacheSet } from '../infrastructure/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { NotFoundError } from '../types/errors';

export class ProductService {
  private productRepository: ProductRepository;

  constructor() {
    this.productRepository = new ProductRepository();
  }

  /**
   * List products with cursor-based pagination
   * Implements Redis caching for performance with 1M+ records
   */
  public async listProducts(query: ProductListQuery): Promise<ProductListResponse> {
    try {
      // Generate cache key based on query parameters
      const cacheKey = this.generateCacheKey(query);
      
      // Try to get from cache first
      const cachedData = await cacheGet(cacheKey);
      if (cachedData) {
        logger.info('Cache hit for products list', { cacheKey });
        return JSON.parse(cachedData);
      }

      logger.info('Cache miss for products list', { cacheKey });

      // Fetch from database
      const products = await this.productRepository.findMany(query);
      
      // Determine if there are more results
      const limit = query.limit || 50;
      const hasMore = products.length > limit;
      
      // Remove the extra item used for hasMore check
      if (hasMore) {
        products.pop();
      }

      // Generate next cursor (last item's ID or timestamp depending on sort)
      let nextCursor: string | null = null;
      if (hasMore && products.length > 0) {
        const lastProduct = products[products.length - 1];
        // TODO: Implement proper cursor encoding based on sort field
        nextCursor = this.encodeCursor(lastProduct, query.sortBy || 'createdAt');
      }

      const response: ProductListResponse = {
        success: true,
        data: products,
        pagination: {
          nextCursor,
          hasMore,
          limit,
        },
      };

      // Cache the result
      await cacheSet(cacheKey, JSON.stringify(response), config.cache.ttl.short);

      return response;
    } catch (error) {
      logger.error('Error in listProducts service', error);
      throw error;
    }
  }

  /**
   * Get product by ID
   */
  public async getProductById(id: string): Promise<Product> {
    // Try cache first
    const cacheKey = `product:${id}`;
    const cachedData = await cacheGet(cacheKey);
    
    if (cachedData) {
      logger.info('Cache hit for product', { id });
      return JSON.parse(cachedData);
    }

    // Fetch from database
    const product = await this.productRepository.findById(id);
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Cache the result
    await cacheSet(cacheKey, JSON.stringify(product), config.cache.ttl.medium);

    return product;
  }

  /**
   * Generate cache key from query parameters
   */
  private generateCacheKey(query: ProductListQuery): string {
    const parts = [
      'products',
      `cursor:${query.cursor || 'none'}`,
      `limit:${query.limit || 50}`,
      `sort:${query.sortBy || 'createdAt'}:${query.sortOrder || 'desc'}`,
      query.category ? `cat:${query.category}` : '',
      query.search ? `search:${query.search}` : '',
      query.minPrice ? `minp:${query.minPrice}` : '',
      query.maxPrice ? `maxp:${query.maxPrice}` : '',
    ];
    
    return parts.filter(Boolean).join(':');
  }

  /**
   * Encode cursor for pagination
   * TODO: Implement proper cursor encoding (e.g., base64 encode timestamp + ID)
   */
  private encodeCursor(product: Product, sortBy: string): string {
    void sortBy;
    // Placeholder implementation
    return Buffer.from(`${product.id}:${product.createdAt.getTime()}`).toString('base64');
  }
}
