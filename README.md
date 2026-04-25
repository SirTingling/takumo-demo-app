<p align="center">
  <a href="https://takumo.io">
    <img src="https://takumo.io/takumo-icon-white.svg" height="48" alt="Takumo" />
  </a>
</p>

<p align="center">
  <strong>Acme Payments API</strong><br/>
  A reference payment processing API built with the security patterns Takumo learns and enforces.
</p>

<p align="center">
  <a href="https://takumo.io">Website</a> &middot;
  <a href="https://cloud.takumo.io">Dashboard</a> &middot;
  <a href="https://docs.takumo.io">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-6366F1?style=flat-square" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-6366F1?style=flat-square" />
  <img src="https://img.shields.io/badge/Node.js-22-6366F1?style=flat-square" />
</p>

---

## What This Is

A production-quality fintech payment processing API ("Acme Payments") that demonstrates the 10 governance patterns Takumo's Brain learns from real codebases. Every service, middleware, and library in this repo follows the same conventions a real engineering team would enforce — and Takumo indexes them automatically.

This isn't a toy example. It's a complete Express + TypeScript API with Stripe integration, PostgreSQL persistence, Redis caching, OpenTelemetry tracing, and structured logging. The kind of codebase where security and reliability patterns actually matter.

## Architecture

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22, TypeScript 5.6 |
| Framework | Express 4 |
| Payments | Stripe API |
| Database | PostgreSQL (pg) |
| Cache | Redis (ioredis) |
| Validation | Zod |
| Logging | Pino (structured, redacted) |
| Tracing | OpenTelemetry |
| Auth | JWT + bcrypt |
| Resilience | Circuit breaker, retry, timeout |

## Team Conventions

These are the 10 patterns Takumo's Brain indexes from this codebase:

1. **Input validation** — Every external input is validated with Zod schemas before processing
2. **Circuit breakers** — All external service calls (Stripe, notifications) are wrapped in circuit breakers with failure thresholds and automatic recovery
3. **OpenTelemetry tracing** — Every service method creates a span with structured attributes for distributed tracing
4. **Parameterized queries** — All SQL uses parameterized queries (`$1`, `$2`) — never string interpolation
5. **Idempotency keys** — Payment and subscription operations use UUID idempotency keys to prevent duplicate processing
6. **Typed error hierarchy** — `AppError` base class with domain-specific subclasses (`PaymentError`, `ValidationError`, etc.) that map to HTTP status codes
7. **Structured logging** — Pino logger with automatic redaction of sensitive fields (passwords, credit cards, auth headers)
8. **Audit trail** — Every state-changing operation logs to an audit table with actor, action, resource, and metadata
9. **TypeScript strict mode** — Full strict mode with explicit types, Zod-inferred types, and no `any`
10. **Environment-only secrets** — All secrets loaded from environment variables via Zod-validated config — never hardcoded

## Getting Started

```bash
cp .env.example .env     # Configure your environment
npm install              # Install dependencies
npm run dev              # Start dev server with hot reload
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with tsx watch |
| `npm run build` | Compile TypeScript to dist/ |
| `npm start` | Run compiled production build |
| `npm test` | Run test suite with vitest |
| `npm run typecheck` | Type-check without emitting |

## Project Layout

```
src/
├── config/
│   ├── index.ts              # Zod-validated env config
│   └── constants.ts          # HTTP codes, rate limits, thresholds
├── lib/
│   ├── errors.ts             # Typed error hierarchy
│   ├── logger.ts             # Pino structured logger
│   ├── database.ts           # PostgreSQL pool + query helpers
│   ├── redis.ts              # Redis client (lazy connect)
│   ├── stripe.ts             # Stripe client
│   ├── crypto.ts             # AES-256-GCM encrypt/decrypt
│   └── circuit-breaker.ts    # Circuit breaker + retry + timeout
├── middleware/
│   ├── auth.ts               # JWT authentication + role guard
│   ├── rate-limiter.ts       # Redis-backed rate limiting
│   ├── error-handler.ts      # Global error handler
│   └── request-validator.ts  # Zod validation middleware
├── models/
│   ├── user.ts               # User types + schemas
│   ├── payment.ts            # Payment types + schemas
│   └── subscription.ts       # Subscription types + schemas
├── services/
│   ├── payment-service.ts    # Payment processing (all 10 patterns)
│   ├── refund-service.ts     # Refund processing
│   ├── subscription-service.ts # Subscription management
│   ├── user-service.ts       # Registration, login, auth
│   ├── notification-service.ts # External notifications
│   └── audit-service.ts      # Audit trail logging
├── routes/
│   ├── payments.ts           # POST/GET /api/v1/payments
│   ├── subscriptions.ts      # POST/GET/DELETE /api/v1/subscriptions
│   ├── users.ts              # Register, login, profile
│   └── webhooks.ts           # Stripe webhook handler
└── index.ts                  # Express app entry point
```

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

This codebase is monitored by [Takumo](https://takumo.io):
- **Aegis Shield** scans every commit for hardcoded secrets and known vulnerabilities
- **Sentinel** validates inbound pull requests against team governance patterns
- **Brain** learns the 10 conventions above and enforces them on new code

---

<p align="center">
  <img src="https://img.shields.io/badge/Protected%20by-Takumo-6366F1?style=flat-square" />
</p>
