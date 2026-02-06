/**
 * Global Error Handling Middleware
 * 
 * Catches all errors thrown in route handlers and middleware.
 * Provides consistent error response format and logging.
 * 
 * @module middleware/errorHandler
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

/** HTTP status code for internal server errors */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** Default error message for unhandled errors */
const DEFAULT_ERROR_MESSAGE = 'Internal Server Error';

/**
 * Standardized error response structure.
 */
interface ErrorResponse {
  success: false;
  message: string;
  stack?: string;
  details?: {
    statusCode: number;
    isOperational: boolean;
  };
}

/**
 * Global error handling middleware for Express.
 * 
 * @param err - The error object (may be AppError or generic Error)
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function (unused but required for middleware signature)
 * 
 * @remarks
 * - Must have 4 parameters for Express to recognize it as error middleware
 * - Logs errors with appropriate severity based on status code
 * - Distinguishes between operational and programming errors
 * - Includes stack traces only in development mode
 * 
 * @example
 * ```typescript
 * app.use(errorHandler);
 * ```
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Keep 4-parameter signature for Express error middleware detection
  void next;
  
  // Extract error details
  const statusCode = err instanceof AppError 
    ? err.statusCode 
    : HTTP_INTERNAL_SERVER_ERROR;
    
  const message = err instanceof AppError 
    ? err.message 
    : DEFAULT_ERROR_MESSAGE;
    
  const isOperational = err instanceof AppError 
    ? err.isOperational 
    : false;

  // Log error with contextual information
  const errorLog = {
    message: err.message,
    stack: err.stack,
    statusCode,
    isOperational,
    path: req.path,
    method: req.method,
    ip: req.ip,
  };

  // Use appropriate log level based on error severity
  if (statusCode >= 500) {
    logger.error('Server error occurred', errorLog);
  } else {
    logger.warn('Client error occurred', errorLog);
  }

  // Build response object
  const response: ErrorResponse = {
    success: false,
    message,
  };

  // Include debugging information in development
  if (config.server.nodeEnv === 'development') {
    response.stack = err.stack;
    response.details = {
      statusCode,
      isOperational,
    };
  }

  res.status(statusCode).json(response);
};
