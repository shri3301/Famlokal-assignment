import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { ProductListQuery } from '../types/product.types';
import { logger } from '../utils/logger';

export class ProductController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  /**
   * GET /products
   * List products with cursor-based pagination, filtering, sorting, and caching
   */
  public listProducts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query: ProductListQuery = {
        cursor: req.query.cursor as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        category: req.query.category as string | undefined,
        search: req.query.search as string | undefined,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      };

      logger.info('Fetching products', { query });

      const result = await this.productService.listProducts(query);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /products/:id
   * Get single product by ID
   */
  public getProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      
      logger.info('Fetching product', { id });

      // TODO: Implement getProductById in service
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
