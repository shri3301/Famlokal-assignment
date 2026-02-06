# Product Listing Backend

A production-grade Node.js + TypeScript backend service demonstrating scalable product listing (1M+ records) with Redis caching, external API integrations, and reliability patterns.

## Architecture

**Pattern**: Controller → Service → Repository

- **MySQL**: Source of truth for product data
- **Redis**: Caching, rate limiting, distributed locking, idempotency
- **Express**: HTTP server with middleware pipeline
- **External Integration Layer**: Circuit breaker, retry logic, timeout handling

## Features

### Core APIs
- **Product Listing**: Cursor-based pagination, filtering, sorting, search
- **Health Checks**: `/health`, `/health/liveness`, `/health/readiness`

### Reliability Patterns
- **Redis Caching**: 5-minute TTL for product queries
- **Rate Limiting**: Sliding window (100 req/15min per IP)
- **Circuit Breaker**: Prevents cascading failures in external API calls
- **Retry Logic**: Exponential backoff (3 attempts, 1s delay)
- **Webhook Idempotency**: HMAC signature verification, Redis-based deduplication

### External Integrations
- **Synchronous API**: JSONPlaceholder demo with timeout/retry/circuit breaker
- **Webhook Receiver**: HMAC-SHA256 signature validation, idempotency (24h TTL)
- **OAuth2 Client**: Token caching with distributed lock (optional)

## Database Design

### Products Table
```sql
CREATE TABLE products (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    stock INT DEFAULT 0,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    INDEX idx_cursor (created_at, id),
    INDEX idx_category_cursor (category, created_at, id)
);
```

**Cursor Pagination**: Uses `(created_at, id)` composite for consistent ordering. Cursor encodes last item's timestamp + ID as base64.

### Webhook Events Table
```sql
CREATE TABLE webhook_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    payload JSON,
    processed_at TIMESTAMP,
    UNIQUE KEY uq_event_id (event_id)
);
```

## Redis Usage

| Use Case | Implementation | TTL |
|----------|----------------|-----|
| Product Cache | Key: `app:products:{query_hash}` | 5 min |
| Rate Limiting | ZSET with timestamps | 15 min |
| OAuth Tokens | Key: `app:oauth:access_token` | token expiry - 60s |
| Distributed Lock | SET NX EX pattern | 30s |
| Webhook Idempotency | Key: `app:webhook:idempotency:{event_id}` | 24h |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit: DB_PASSWORD, REDIS_URL, WEBHOOK_SECRET

# 3. Setup database
mysql -u root -p < database/schema.sql

# 4. Start Redis
redis-server

# 5. Run server
npm run dev        # Development with auto-reload
npm run build      # Production build
npm start          # Production server
```

**Server runs on**: `http://localhost:3000`

## API Examples

### Product Listing
```bash
# Get products with pagination
curl "http://localhost:3000/api/v1/products?limit=10&sortBy=price&sortOrder=asc"

# With filters
curl "http://localhost:3000/api/v1/products?category=electronics&minPrice=100&maxPrice=500"

# Next page (use nextCursor from response)
curl "http://localhost:3000/api/v1/products?cursor=<nextCursor>&limit=10"
```

**Response**:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "nextCursor": "YjliNm...",
    "hasMore": true,
    "limit": 10
  }
}
```

### External API Integration
```bash
# Fetch user (with retry + circuit breaker)
curl http://localhost:3000/api/v1/external/users/1

# Create post
curl -X POST http://localhost:3000/api/v1/external/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Content","userId":1}'
```

### Webhook Receiver
```bash
# Generate signature
curl -X POST http://localhost:3000/api/v1/webhooks/generate-signature \
  -H "Content-Type: application/json" \
  -d '{"type":"order.created","id":"123","data":{}}'

# Send webhook (use signature from above)
curl -X POST http://localhost:3000/api/v1/webhooks/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-123" \
  -H "X-Webhook-Signature: <signature>" \
  -d '{"type":"order.created","id":"123","data":{}}'
```

### Health Check
```bash
curl http://localhost:3000/health
```

## Key Technical Decisions

**Cursor Pagination over Offset**: O(1) vs O(n) performance for large datasets. No duplicate/missing records when data changes.

**Redis for State**: In-memory speed + distributed state sharing across instances. ZSET for time-based tracking (rate limiting), atomic ops for locking.

**Circuit Breaker**: Tracks failures, opens after threshold (5), half-opens after timeout (30s), prevents cascading failures.

**HMAC Signature Verification**: SHA256 signature with secret key prevents webhook replay attacks and unauthorized events.

## Environment Variables

Required:
- `DB_PASSWORD` - MySQL password
- `REDIS_URL` - Redis connection (default: `redis://localhost:6379`)
- `WEBHOOK_SECRET` - HMAC secret key for webhook signature verification

Optional:
- `NODE_ENV` - `development` | `production` (affects error responses)
- `PORT` - Server port (default: 3000)
- `CACHE_TTL_SHORT` - Cache TTL in seconds (default: 300)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

See `.env.example` for all options.

## Project Structure

```
src/
├── controllers/      # HTTP handlers
├── services/         # Business logic + external integrations
├── repositories/     # Database queries
├── middleware/       # Rate limiting, validation, error handling
├── infrastructure/   # MySQL pool, Redis client
├── routes/           # API endpoints
└── types/            # TypeScript interfaces
```

## Deployment

Deployed on **Render** (or similar PaaS):

1. Set environment variables in platform
2. Platform uses `npm start` command
3. Health check: `GET /health` (returns 200 if DB + Redis are up)

**Scaling**: Stateless design + Redis for shared state = horizontal scaling ready.

---

**Tech Stack**: Node.js 18+, TypeScript, Express, MySQL 8, Redis 7 , Docker 