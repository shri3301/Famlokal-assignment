/**
 * Winston Logger Configuration
 * 
 * Provides centralized logging with:
 * - Multiple transports (console, file, error file)
 * - Custom formatting with timestamps and metadata
 * - Circular reference handling
 * - Log rotation and retention
 * - Uncaught exception/rejection handling
 * 
 * @module utils/logger
 */

import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/** Log file size before rotation (10 MB) */
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Custom log formatter with metadata serialization.
 * 
 * @param level - Log level (error, warn, info, debug)
 * @param message - Primary log message
 * @param timestamp - ISO timestamp string
 * @param stack - Error stack trace (if present)
 * @param metadata - Additional context data
 * @returns Formatted log string
 */
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  // Append metadata if present
  if (Object.keys(metadata).length > 0) {
    try {
      // Safe stringify with circular reference handling
      msg += ` ${JSON.stringify(metadata, getCircularReplacer())}`;
    } catch (error) {
      msg += ` [Unable to stringify metadata]`;
    }
  }
  
  // Append stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }
  
  return msg;
});

/**
 * Creates a replacer function for JSON.stringify that handles circular references.
 * 
 * @returns Replacer function compatible with JSON.stringify
 * 
 * @remarks
 * Uses WeakSet to track visited objects and prevent infinite recursion.
 */
const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (_key: string, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
};

/**
 * Application logger instance.
 * 
 * @remarks
 * Configured with three transports:
 * - Console: Colorized output for development
 * - Error file: Errors only (logs/error.log)
 * - Combined file: All logs (configured path)
 * 
 * All files use rotation with size and retention limits.
 * 
 * @example
 * ```typescript
 * logger.info('User logged in', { userId: 123 });
 * logger.error('Database connection failed', { error });
 * ```
 */
export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Console transport with colorization for development
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      ),
    }),
    
    // Dedicated error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: MAX_LOG_FILE_SIZE,
      maxFiles: 7,
    }),
    
    // Combined log file for all levels
    new winston.transports.File({
      filename: config.logging.filePath,
      maxsize: MAX_LOG_FILE_SIZE,
      maxFiles: config.logging.maxFiles,
    }),
  ],
});

/**
 * Handle uncaught exceptions and unhandled rejections.
 * Logs to separate files for easier debugging.
 */
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: 'logs/exceptions.log',
    maxsize: MAX_LOG_FILE_SIZE,
  })
);

logger.rejections.handle(
  new winston.transports.File({ 
    filename: 'logs/rejections.log',
    maxsize: MAX_LOG_FILE_SIZE,
  })
);
