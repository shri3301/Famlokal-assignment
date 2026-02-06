/**
 * MySQL Database Connection Pool Manager
 * 
 * Provides:
 * - Connection pool management with automatic reconnection
 * - Query execution with automatic connection handling
 * - Transaction support with rollback on errors
 * - Type-safe query helpers
 * 
 * @module infrastructure/database
 */

import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { config } from '../config';
import { logger } from '../utils/logger';

/** Global connection pool instance (singleton pattern) */
let pool: Pool | null = null;

/**
 * Initializes the MySQL connection pool.
 * 
 * Creates a connection pool with the following features:
 * - Automatic connection recycling
 * - Connection health monitoring (keep-alive)
 * - Queue management for connection requests
 * - Connection limit enforcement
 * 
 * @throws {Error} If unable to establish database connection
 * @returns Promise that resolves when pool is initialized and tested
 * 
 * @remarks
 * Should be called once during application startup before any queries.
 * The pool is reused for all subsequent database operations.
 */
export const initDatabase = async (): Promise<void> => {
  try {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      connectionLimit: config.database.connectionLimit,
      queueLimit: config.database.queueLimit,
      waitForConnections: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    
    // Verify connection by executing a test query
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    logger.info('MySQL connection pool created', {
      host: config.database.host,
      database: config.database.database,
      connectionLimit: config.database.connectionLimit,
    });
  } catch (error) {
    logger.error('Failed to initialize MySQL connection pool', { error });
    throw error;
  }
};

/**
 * Retrieves the connection pool instance.
 * 
 * @throws {Error} If pool hasn't been initialized via initDatabase()
 * @returns The MySQL connection pool
 */
export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDatabase() first.');
  }
  return pool;
};

/**
 * Acquires a connection from the pool.
 * 
 * @throws {Error} If pool is not initialized or no connections available
 * @returns Promise that resolves to a pool connection
 * 
 * @remarks
 * Always release the connection after use to return it to the pool.
 * Consider using the `query()` helper for automatic connection management.
 */
export const getConnection = async (): Promise<PoolConnection> => {
  return await getPool().getConnection();
};

/**
 * Closes the connection pool and releases all connections.
 * 
 * @returns Promise that resolves when all connections are closed
 * 
 * @remarks
 * Should be called during graceful shutdown to clean up resources.
 */
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('MySQL connection pool closed');
  }
};

/**
 * Executes a SQL query with automatic connection management.
 * 
 * @template T - Expected return type of the query result
 * @param sql - SQL query string (use placeholders for parameters)
 * @param params - Query parameters (prevents SQL injection)
 * @returns Promise that resolves to the query result
 * 
 * @example
 * ```typescript
 * const users = await query<User[]>(
 *   'SELECT * FROM users WHERE age > ?',
 *   [18]
 * );
 * ```
 * 
 * @remarks
 * - Connection is automatically acquired and released
 * - Use parameterized queries to prevent SQL injection
 * - Type parameter should match your expected result structure
 */
export const query = async <T = any>(sql: string, params?: any[]): Promise<T> => {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows as T;
  } finally {
    connection.release();
  }
};

/**
 * Executes multiple queries within a transaction.
 * 
 * @template T - Expected return type of the transaction result
 * @param callback - Async function that performs database operations
 * @returns Promise that resolves to the callback result
 * 
 * @throws Rolls back transaction and rethrows any errors from callback
 * 
 * @example
 * ```typescript
 * await transaction(async (conn) => {
 *   await conn.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);
 *   await conn.execute('INSERT INTO logs (message) VALUES (?)', ['User created']);
 * });
 * ```
 * 
 * @remarks
 * - Automatically commits on success
 * - Automatically rolls back on error
 * - Connection is always released
 */
export const transaction = async <T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
