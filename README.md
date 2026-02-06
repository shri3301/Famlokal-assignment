# Product Listing Backend - Production-Grade Architecture

A scalable, production-ready Node.js + TypeScript backend service for managing product listings at scale (1M+ records) with Redis caching, external integrations, and reliability patterns.

## 🏗️ Architecture Overview

This project follows **Clean Architecture** principles with clear separation of concerns:

```
Controller → Service → Repository → Database
```

### Key Design Patterns

- **Clean Architecture**: Controller, Service, Repository layers
- **Circuit Breaker**: Prevents cascading failures in external API calls
- **OAuth2 Client Credentials**: Token management with Redis caching and distributed locking
- **Cursor-based Pagination**: Efficient pagination for large datasets
- **Rate Limiting**: Redis-based sliding window rate limiter
- **Idempotency**: Webhook receiver with duplicate prevention
- **Graceful Shutdown**: Proper connection cleanup on shutdown

---

## 📁 Project Structure

```
├── src/
│   ├── config/                    # Configuration management
│   │   └── index.ts              # Centralized config from environment variables
│   │
│   ├── infrastructure/            # External systems (Database, Redis)
│   │   ├── database.ts           # MySQL connection pool & query helpers
│   │   └── redis.ts              # Redis client & cache utilities
│   │
│   ├── controllers/               # HTTP request handlers
│   │   ├── product.controller.ts # Product API endpoints
│   │   └── webhook.controller.ts # Webhook receiver
│   │
│   ├── services/                  # Business logic layer
│   │   ├── product.service.ts    # Product business logic + caching
│   │   ├── oauth2.service.ts     # OAuth2 token management
│   │   └── externalApi.service.ts# External API with retry + circuit breaker
│   │
│   ├── repositories/              # Data access layer
│   │   └── product.repository.ts # Product database queries
│   │
│   ├── routes/                    # Express route definitions
│   │   ├── product.routes.ts     # Product API routes
│   │   ├── webhook.routes.ts     # Webhook routes
│   │   └── health.routes.ts      # Health check endpoints
│   │
│   ├── middleware/                # Express middleware
│   │   ├── errorHandler.ts       # Centralized error handling
│   │   ├── rateLimiter.ts        # Redis-based rate limiting
│   │   ├── requestLogger.ts      # Request/response logging
│   │   └── validation.ts         # Request validation middleware
│   │
│   ├── types/                     # TypeScript type definitions
│   │   ├── errors.ts             # Custom error classes
│   │   ├── product.types.ts      # Product interfaces
│   │   └── oauth.types.ts        # OAuth2 interfaces
│   │
│   ├── utils/                     # Utility functions
│   │   ├── logger.ts             # Winston logger configuration
│   │   └── shutdown.ts           # Graceful shutdown handler
│   │
│   ├── app.ts                     # Express app setup & middleware registration
│   └── server.ts                  # Server entry point & initialization
│
├── logs/                          # Application logs (auto-created)
├── .env.example                   # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json                  # TypeScript configuration
└── README.md
```

---

## 🎯 Core Features Explained

### 1. **Product Listing API** (`GET /api/v1/products`)

**Purpose**: Efficiently query and return products from a database with 1M+ records.

**Key Features**:
- **Cursor-based pagination**: More efficient than offset pagination for large datasets
- **Redis caching**: Results cached to reduce database load
- **Filtering**: By category, price range, search term
- **Sorting**: By name, price, createdAt, updatedAt
- **Rate limiting**: Prevents abuse

**Flow**:
```
Controller → Service (check cache) → Repository (SQL query) → Redis (cache result) → Response
```

**Files**:
- [src/controllers/product.controller.ts](src/controllers/product.controller.ts)
- [src/services/product.service.ts](src/services/product.service.ts)
- [src/repositories/product.repository.ts](src/repositories/product.repository.ts)
- [src/routes/product.routes.ts](src/routes/product.routes.ts)

---

### 2. **OAuth2 Client Credentials Flow**

**Purpose**: Securely obtain and cache access tokens for calling protected external APIs.

**Key Features**:
- **Redis token caching**: Avoids unnecessary token requests
- **Distributed locking**: Prevents concurrent token refresh across multiple server instances
- **Automatic refresh**: Token refreshed before expiry
- **Thread-safe**: Multiple requests share the same token

**Flow**:
```
Request → Check Cache → Token Valid? → Return Token
                     ↓
              Acquire Lock → Fetch New Token → Cache → Release Lock
```

**Files**:
- [src/services/oauth2.service.ts](src/services/oauth2.service.ts)
- [src/types/oauth.types.ts](src/types/oauth.types.ts)

---

### 3. **External API Integration with Circuit Breaker**

**Purpose**: Call external APIs reliably with automatic retry and failure protection.

**Key Features**:
- **Circuit Breaker**: Stops requests to failing services (OPEN → HALF_OPEN → CLOSED states)
- **Retry with exponential backoff**: Retries failed requests with increasing delays
- **Timeout handling**: Prevents hanging requests
- **Error classification**: Doesn't retry client errors (4xx)

**Flow**:
```
Request → Circuit Breaker Check → Execute with Retry → Success/Failure
                ↓
        Track Failures → Open Circuit if threshold exceeded
```

**Files**:
- [src/services/externalApi.service.ts](src/services/externalApi.service.ts)

---

### 4. **Webhook Receiver with Idempotency**

**Purpose**: Safely receive and process webhook events from external systems.

**Key Features**:
- **Signature verification**: HMAC-SHA256 signature validation
- **Idempotency**: Prevents duplicate processing using Redis
- **Safe retry handling**: Returns 200 even on processing errors to stop unnecessary retries
- **Audit trail**: Logs all webhook events

**Flow**:
```
Webhook → Verify Signature → Check Idempotency → Process → Mark as Processed → Return 200
```

**Files**:
- [src/controllers/webhook.controller.ts](src/controllers/webhook.controller.ts)
- [src/routes/webhook.routes.ts](src/routes/webhook.routes.ts)

---

### 5. **Redis-based Rate Limiting**

**Purpose**: Prevent API abuse using a sliding window rate limiter.

**Key Features**:
- **Sliding window**: More accurate than fixed window
- **Per-client tracking**: Rate limit by IP or API key
- **Redis sorted sets**: Efficient time-based tracking
- **Rate limit headers**: Returns X-RateLimit-* headers

**Implementation**:
- Uses Redis ZSET (sorted set) to track request timestamps
- Removes old entries outside the time window
- Checks if request count exceeds limit

**Files**:
- [src/middleware/rateLimiter.ts](src/middleware/rateLimiter.ts)

---

### 6. **Health Check Endpoints**

**Purpose**: Enable load balancers and monitoring systems to check service health.

**Endpoints**:
- `GET /health` - Overall health (database + Redis)
- `GET /health/liveness` - Service is alive
- `GET /health/readiness` - Service is ready to accept traffic

**Files**:
- [src/routes/health.routes.ts](src/routes/health.routes.ts)

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.x
- MySQL 8.x
- Redis 7.x

### Installation

1. **Clone and install dependencies**:
```bash
cd Famlocal
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your actual configuration
```

3. **Set up MySQL database**:
```sql
CREATE DATABASE product_db;

-- TODO: Create products table
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_price (price),
    INDEX idx_created_at (created_at)
);
```

4. **Start Redis**:
```bash
redis-server
```

5. **Run the application**:

Development mode:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

---

## 🧪 API Examples

### Get Products (with pagination and filters)

```bash
# Basic request
curl http://localhost:3000/api/v1/products

# With filters
curl "http://localhost:3000/api/v1/products?category=electronics&minPrice=100&maxPrice=500&limit=20"

# With cursor pagination
curl "http://localhost:3000/api/v1/products?cursor=eyJpZCI6IjEyMyIsInRpbWVzdGFtcCI6MTYwMDAwMDAwMH0="

# With search
curl "http://localhost:3000/api/v1/products?search=laptop&sortBy=price&sortOrder=asc"
```

### Health Check

```bash
curl http://localhost:3000/health
```

---

## 🛠️ Key Infrastructure Components

### MySQL Connection Pool
- Automatically manages database connections
- Reuses connections for better performance
- Handles connection failures gracefully
- File: [src/infrastructure/database.ts](src/infrastructure/database.ts)

### Redis Client
- Single client instance shared across the app
- Handles reconnection automatically
- Provides helper functions for caching and locking
- File: [src/infrastructure/redis.ts](src/infrastructure/redis.ts)

### Centralized Error Handling
- Custom error classes for different HTTP status codes
- Automatic error logging
- Proper error responses in production vs development
- Files: [src/types/errors.ts](src/types/errors.ts), [src/middleware/errorHandler.ts](src/middleware/errorHandler.ts)

### Winston Logger
- Structured logging with metadata
- File rotation (7 days retention)
- Separate error logs
- Captures uncaught exceptions and unhandled rejections
- File: [src/utils/logger.ts](src/utils/logger.ts)

---

## 🔐 Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Input validation**: Using express-validator
- **Rate limiting**: Prevents abuse
- **Webhook signature verification**: HMAC-SHA256
- **Environment variables**: Sensitive data in .env

---

## 🎯 TODO: Implementation Tasks

Each file includes `TODO` comments indicating where business logic should be implemented:

1. **Product Repository**: Complete SQL queries for CRUD operations
2. **OAuth2 Client**: Configure actual OAuth2 provider endpoints
3. **External API**: Replace placeholder with actual API endpoints
4. **Webhook Processing**: Implement actual event processing logic
5. **Cursor Encoding**: Implement proper cursor encoding/decoding for pagination
6. **Database Schema**: Create and optimize indexes for queries
7. **Tests**: Add unit and integration tests

---

## 📊 Performance Considerations

### For 1M+ Records

1. **Database Indexes**: Create indexes on frequently queried columns (category, price, created_at)
2. **Cursor Pagination**: More efficient than offset for large datasets
3. **Redis Caching**: Reduces database load significantly
4. **Connection Pooling**: Reuses database connections
5. **Query Optimization**: Select only needed columns

### Horizontal Scaling

- **Stateless design**: No in-memory state (uses Redis for shared state)
- **Distributed locking**: Token refresh safe across multiple instances
- **Load balancer ready**: Health checks for traffic routing

---

## 📝 Environment Variables

See [.env.example](.env.example) for all available configuration options.

Key variables:
- `NODE_ENV`: Environment (development, production)
- `PORT`: Server port
- `DB_*`: MySQL connection settings
- `REDIS_*`: Redis connection settings
- `OAUTH_*`: OAuth2 client credentials
- `RATE_LIMIT_*`: Rate limiting configuration

---

## 🏛️ Architecture Decisions

### Why Clean Architecture?
- **Maintainability**: Easy to understand and modify
- **Testability**: Each layer can be tested independently
- **Flexibility**: Easy to swap implementations (e.g., switch databases)

### Why Cursor-based Pagination?
- **Performance**: O(1) complexity vs O(n) for offset pagination
- **Consistency**: No missing/duplicate records when data changes
- **Scalability**: Efficient for millions of records

### Why Redis for Everything?
- **Speed**: In-memory caching for fast reads
- **Distributed State**: Shared across multiple server instances
- **Built-in Features**: Sorted sets for rate limiting, atomic operations for locking

### Why Circuit Breaker?
- **Resilience**: Prevents cascading failures
- **Fast Failure**: Fails fast when service is down
- **Automatic Recovery**: Attempts recovery after timeout

---

## 🤝 Contributing

When adding new features:
1. Follow the existing architecture patterns
2. Add appropriate error handling
3. Include logging
4. Update this README if needed
5. Add TODO comments for incomplete logic

---

## 📄 License

MIT

---

## 📞 Support

For questions or issues, please contact the development team.

---

**Built with ❤️ using Node.js, TypeScript, Express, MySQL, and Redis**
#   F a m l o c a l - B a c k e n d  
 