import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before importing the service
vi.mock('../../src/lib/database.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock('../../src/lib/stripe.js', () => ({
  stripe: {
    paymentIntents: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/audit-service.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/circuit-breaker.js', () => ({
  withCircuitBreaker: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}));

import { processPayment } from '../../src/services/payment-service.js';
import { queryOne } from '../../src/lib/database.js';
import { stripe } from '../../src/lib/stripe.js';
import { ValidationError, PaymentError } from '../../src/lib/errors.js';

const mockQueryOne = vi.mocked(queryOne);
const mockStripe = vi.mocked(stripe!.paymentIntents.create);

const validInput = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  amount: 1000,
  currency: 'usd' as const,
  description: 'Test payment',
  idempotencyKey: '660e8400-e29b-41d4-a716-446655440001',
};

describe('payment-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes a valid payment', async () => {
    const mockPayment = { id: 'pay_1', ...validInput, status: 'processing' };

    // No existing payment (idempotency check)
    mockQueryOne.mockResolvedValueOnce(null);
    // Stripe returns payment intent
    mockStripe.mockResolvedValueOnce({ id: 'pi_123' } as never);
    // INSERT returns new payment
    mockQueryOne.mockResolvedValueOnce(mockPayment as never);

    const result = await processPayment(validInput);

    expect(result).toEqual(mockPayment);
    expect(mockStripe).toHaveBeenCalledOnce();
    expect(mockQueryOne).toHaveBeenCalledTimes(2);
  });

  it('throws ValidationError for invalid input', async () => {
    await expect(
      processPayment({ amount: -100, currency: 'invalid' }),
    ).rejects.toThrow(ValidationError);
  });

  it('returns existing payment for duplicate idempotency key', async () => {
    const existingPayment = { id: 'pay_existing', ...validInput, status: 'succeeded' };
    mockQueryOne.mockResolvedValueOnce(existingPayment as never);

    const result = await processPayment(validInput);

    expect(result).toEqual(existingPayment);
    expect(mockStripe).not.toHaveBeenCalled();
  });

  it('throws PaymentError when Stripe fails', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    mockStripe.mockRejectedValueOnce(new Error('Stripe: card_declined'));

    await expect(processPayment(validInput)).rejects.toThrow('Stripe');
  });
});
