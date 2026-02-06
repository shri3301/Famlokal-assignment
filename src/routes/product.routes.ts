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
    query('cursor').optional().isString().withMessage('cursor must be a string'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100'),
    query('sortBy').optional().isIn(['name', 'price', 'createdAt', 'updatedAt']).withMessage('sortBy must be one of: name, price, createdAt, updatedAt'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be either asc or desc'),
    query('category').optional().isString().withMessage('category must be a string'),
    query('search').optional().isString().withMessage('search must be a string'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a number >= 0'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a number >= 0'),
  ]),
  productController.listProducts
);

/**
 * GET /api/v1/products/:id
 * Get single product by ID
 */
router.get('/:id', productController.getProduct);

export default router;
