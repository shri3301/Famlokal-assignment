-- ===============================
-- PRODUCT LISTING BACKEND SCHEMA
-- MySQL 8.x
-- ===============================

CREATE DATABASE IF NOT EXISTS product_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE product_db;

-- ===============================
-- PRODUCTS TABLE
-- ===============================
CREATE TABLE IF NOT EXISTS products (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_category (category),
    INDEX idx_price (price),
    INDEX idx_created_at (created_at),
    INDEX idx_updated_at (updated_at),
    INDEX idx_cursor (created_at, id),
    INDEX idx_category_cursor (category, created_at, id)
) ENGINE=InnoDB;

-- ===============================
-- WEBHOOK IDEMPOTENCY TABLE
-- ===============================
CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    payload JSON,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_event_id (event_id)
) ENGINE=InnoDB;

-- ===============================
-- OPTIONAL: RATE LIMIT TABLE (fallback if Redis unavailable)
-- ===============================
CREATE TABLE IF NOT EXISTS rate_limit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(255),
    endpoint VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_client_time (client_id, created_at)
) ENGINE=InnoDB;

-- ===============================
-- OPTIONAL: API LOG TABLE
-- ===============================
CREATE TABLE IF NOT EXISTS api_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    response_time_ms INT,
    status_code INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ===============================
-- SAMPLE DATA
-- ===============================
INSERT INTO products (id, name, description, price, category, stock)
VALUES
(UUID(), 'Laptop Pro 15', 'High-performance laptop with 16GB RAM', 1299.99, 'electronics', 50),
(UUID(), 'Wireless Mouse', 'Ergonomic wireless mouse', 29.99, 'electronics', 200),
(UUID(), 'Office Chair', 'Comfortable office chair', 249.99, 'furniture', 30),
(UUID(), 'Desk Lamp', 'LED desk lamp', 39.99, 'furniture', 100);
