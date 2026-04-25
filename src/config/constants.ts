/** Standard HTTP status codes used across the API. */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const RATE_LIMIT = {
  WINDOW_MS: 60_000,
  MAX_REQUESTS: 100,
  AUTH_WINDOW_MS: 900_000, // 15 minutes
  AUTH_MAX_REQUESTS: 5,
} as const;

export const CIRCUIT_BREAKER = {
  FAILURE_THRESHOLD: 5,
  RESET_TIMEOUT_MS: 30_000,
  HALF_OPEN_MAX_CALLS: 1,
} as const;

export const STRIPE_EVENTS = {
  CHARGE_SUCCEEDED: 'charge.succeeded',
  CHARGE_FAILED: 'charge.failed',
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
  CUSTOMER_SUBSCRIPTION_CREATED: 'customer.subscription.created',
  CUSTOMER_SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  CUSTOMER_SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
} as const;

export const ACCOUNT_LOCKOUT = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 1_800_000, // 30 minutes
} as const;

export const CURRENCIES = ['usd', 'eur', 'gbp'] as const;
export type Currency = (typeof CURRENCIES)[number];

