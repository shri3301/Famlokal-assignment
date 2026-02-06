/**
 * Product Controller
 * 
 * Handles HTTP requests for product-related operations:
 * - List products with pagination, filtering, and sorting
 * - Get individual product by ID
 * - Input validation and query parameter parsing
 * 
 * @module controllers/product.controller
 */

import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { ProductListQuery } from '../types/product.types';
import { logger } from '../utils/logger';

/** Default page size for product listings */
const DEFAULT_PAGE_LIMIT = 50;

/**
 * Controller for product-related HTTP endpoints.
 * 
 * @class ProductController
 * @description Handles request parsing, validation, and delegates 
 * business logic to ProductService.
 */
export class ProductController {
  private readonly productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  /**
   * Lists products with cursor-based pagination.
   * 
   * @route GET /api/v1/products
   * @query cursor - Pagination cursor (optional)
   * @query limit - Page size (default: 50)
   * @query sortBy - Sort field: name, price, createdAt, updatedAt
   * @query sortOrder - Sort direction: asc, desc
   * @query category - Filter by category (optional)
   * @query search - Search in name/description (optional)
   * @query minPrice - Minimum price filter (optional)
   * @query maxPrice - Maximum price filter (optional)
   * 
   * @returns JSON response with products array and pagination metadata
   */
  public listProducts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Parse and validate query parameters
      const query: ProductListQuery = this.parseListQuery(req);

      logger.info('Fetching products list', { query });

      const result = await this.productService.listProducts(query);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Parses and validates product list query parameters.
   * 
   * @param req - Express request object
   * @returns Validated query object
   * @private
   */
  private parseListQuery(req: Request): ProductListQuery {
    return {
      cursor: req.query.cursor as string | undefined,
      limit: req.query.limit 
        ? parseInt(req.query.limit as string, 10) 
        : DEFAULT_PAGE_LIMIT,
      sortBy: (req.query.sortBy as any) || 'createdAt',
      sortOrder: (req.query.sortOrder as any) || 'desc',
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
      minPrice: req.query.minPrice 
        ? parseFloat(req.query.minPrice as string) 
        : undefined,
      maxPrice: req.query.maxPrice 
        ? parseFloat(req.query.maxPrice as string) 
        : undefined,
    };
  }

  /**
   * Retrieves a single product by ID.
   * 
   * @route GET /api/v1/products/:id
   * @param id - Product unique identifier
   * @returns JSON response with product data
   * @throws {NotFoundError} If product doesn't exist
   */
  public getProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      
      logger.info('Fetching product by ID', { id });

      const product = await this.productService.getProductById(id);

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };
}
