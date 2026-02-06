Product Listing Backend

A production-ready Node.js (TypeScript) backend designed to handle large-scale product listings (1M+ records) with MySQL, Redis caching, external API integrations, and reliability patterns.

Architecture

The project follows a layered backend architecture:

Controller → Service → Repository → Database


Key patterns implemented:

Cursor-based pagination

Redis caching

OAuth2 client-credentials token caching

Circuit breaker + retry for external APIs

Webhook idempotency

Redis rate limiting

Centralized error handling

Graceful shutdown

Project Structure
src/
  controllers/
  services/
  repositories/
  routes/
  middleware/
  infrastructure/
  config/
  utils/

Core Features
Product Listing API

GET /api/v1/products

Supports:

cursor pagination

filtering (category, price)

search

sorting

Redis caching

validation

rate limiting

Designed for large dataset querying with indexed SQL queries.

External API Integration

Demonstrates:

timeout handling

retry with exponential backoff

circuit breaker

error classification

Webhook Receiver

POST /api/v1/webhooks/events

Implements:

HMAC signature verification

idempotency protection

safe retry handling

OAuth2 Token Service

Implements:

client-credentials token retrieval

Redis token caching

distributed refresh locking

Health Endpoints
GET /health
GET /health/readiness
GET /health/liveness

Database Design

Tables:

products

webhook_events

Indexes support:

cursor pagination

category filtering

price filtering

sorting

Schema file:

database/schema.sql

Redis Usage

Redis is used for:

product query caching

OAuth token caching

distributed locking

webhook idempotency tracking

rate limiting

Setup

Install dependencies:

npm install


Configure environment:

cp .env.example .env


Run database schema:

mysql -u root -p < database/schema.sql


Start Redis:

redis-server


Run server:

npm run dev


Server runs at:

http://localhost:3000

Quick API Tests
GET /health
GET /api/v1/products?limit=5
GET /api/v1/external/users/1
POST /api/v1/webhooks/test
GET /api/v1/oauth/mock-test

Deployment

Deploy on Render:

add environment variables

attach MySQL + Redis

use /health as health check

Performance Notes

Designed for scale using:

cursor pagination

Redis caching

database indexing

connection pooling

stateless service design