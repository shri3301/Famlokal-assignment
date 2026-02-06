import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: Pool;

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
    
    // Test connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    logger.info('MySQL connection pool created successfully');
  } catch (error) {
    logger.error('Failed to create MySQL connection pool', error);
    throw error;
  }
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDatabase first.');
  }
  return pool;
};

export const getConnection = async (): Promise<PoolConnection> => {
  return await getPool().getConnection();
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    logger.info('MySQL connection pool closed');
  }
};

// Query helper with automatic connection management
export const query = async <T = any>(sql: string, params?: any[]): Promise<T> => {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows as T;
  } finally {
    connection.release();
  }
};

// Transaction helper
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
