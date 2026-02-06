import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Keep the 4-arg signature so Express treats this as error middleware.
  void next;
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  // Handle known operational errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Log error
  const errorLog = {
    message: err.message,
    stack: err.stack,
    statusCode,
    isOperational,
    path: req.path,
    method: req.method,
    ip: req.ip,
  };

  if (statusCode >= 500) {
    logger.error('Server error', errorLog);
  } else {
    logger.warn('Client error', errorLog);
  }

  // Send error response
  const response: any = {
    success: false,
    message,
  };

  // Only include stack trace and details in development mode
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = {
      statusCode,
      isOperational,
    };
  }

  res.status(statusCode).json(response);
};
