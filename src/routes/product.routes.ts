import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validation';
import { query } from 'express-validator';

const router = Router();
const productController = new ProductController();

// Apply rate limiting to all product routes
router.use(rateLimiter);

/**
 * GET /api/v1/products
 * List products with pagination, filtering, sorting
 */
router.get(
  '/',
  validate([
    query('cursor').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['name', 'price', 'createdAt', 'updatedAt']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('category').optional().isString(),
    query('search').optional().isString(),
    query('minPrice').optional().isFloat({ min: 0 }),
    query('maxPrice').optional().isFloat({ min: 0 }),
  ]),
  productController.listProducts
);

/**
 * GET /api/v1/products/:id
 * Get single product by ID
 */
router.get('/:id', productController.getProduct);

export default router;
