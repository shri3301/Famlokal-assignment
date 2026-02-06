/**
 * Custom Error Classes for HTTP Error Handling
 * 
 * Provides a hierarchy of error classes that map to HTTP status codes.
 * All errors extend AppError for consistent error handling middleware.
 * 
 * @module types/errors
 */

/**
 * Base application error class.
 * 
 * @class AppError
 * @extends Error
 * 
 * @property {number} statusCode - HTTP status code for the error
 * @property {boolean} isOperational - True for expected errors, false for bugs
 * 
 * @remarks
 * - Operational errors (expected): validation, not found, unauthorized
 * - Programming errors (unexpected): null reference, type errors
 * - Only operational errors should be sent to clients
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  /**
   * Creates an application error.
   * 
   * @param message - Human-readable error description
   * @param statusCode - HTTP status code (default: 500)
   * @param isOperational - Whether error is expected (default: true)
   */
  constructor(
    message: string, 
    statusCode: number = 500, 
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for debugging
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Invalid client input.
 * Use for validation failures, malformed requests, or invalid parameters.
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized - Authentication required or failed.
 * Use when user is not authenticated or token is invalid/expired.
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * 403 Forbidden - Authenticated but insufficient permissions.
 * Use when user is authenticated but lacks required permissions.
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * 404 Not Found - Requested resource doesn't exist.
 * Use when a specific entity (user, product, etc.) is not found.
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * 409 Conflict - Request conflicts with current state.
 * Use for duplicate resources, optimistic locking failures.
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded.
 * Use when client exceeds API rate limits.
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * 500 Internal Server Error - Unexpected server-side error.
 * Use for unhandled exceptions and programming errors.
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500);
  }
}

/**
 * 503 Service Unavailable - Server temporarily unable to handle request.
 * Use when external dependencies are down or during maintenance.
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503);
  }
}
