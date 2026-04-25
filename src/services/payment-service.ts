import { z } from 'zod';
import { trace } from '@opentelemetry/api';
import { query, queryOne } from '../lib/database.js';
import { stripe } from '../lib/stripe.js';
import { createLogger } from '../lib/logger.js';
import { withCircuitBreaker } from '../lib/circuit-breaker.js';
import { PaymentError, ValidationError, ConflictError } from '../lib/errors.js';
import { logAudit } from './audit-service.js';
import { CURRENCIES } from '../config/constants.js';
import type { Payment } from '../models/payment.js';

const log = createLogger({ service: 'payment' });
const tracer = trace.getTracer('payment-service');

const CreateChargeSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().positive(),
  currency: z.enum(CURRENCIES),
  description: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
  metadata: z.record(z.string()).optional(),
});

type CreateChargeInput = z.infer<typeof CreateChargeSchema>;

export async function processPayment(input: unknown): Promise<Payment> {
  return tracer.startActiveSpan('processPayment', async (span) => {
    try {
      // 1. Validate input with Zod
      const parsed = CreateChargeSchema.safeParse(input);
      if (!parsed.success) {
        const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(msg);
      }
      const data: CreateChargeInput = parsed.data;

      span.setAttributes({
        'payment.amount': data.amount,
        'payment.currency': data.currency,
        'payment.user_id': data.userId,
      });

      // 2. Idempotency check with parameterized query
      const existing = await queryOne<Payment>(
        'SELECT * FROM payments WHERE idempotency_key = $1',
        [data.idempotencyKey],
      );
      if (existing) {
        log.info({ idempotencyKey: data.idempotencyKey }, 'Idempotent request — returning existing payment');
        return existing;
      }

      // 3. Create Stripe payment intent with circuit breaker
      if (!stripe) {
        throw new PaymentError('Payment processor not configured');
      }

      const paymentIntent = await withCircuitBreaker('stripe', () =>
        stripe!.paymentIntents.create(
          {
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            metadata: data.metadata ?? {},
          },
          { idempotencyKey: data.idempotencyKey },
        ),
      );

      // 4. Insert payment record with parameterized query
      const payment = await queryOne<Payment>(
        `INSERT INTO payments (user_id, amount, currency, stripe_payment_intent_id, idempotency_key, status, description, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          data.userId,
          data.amount,
          data.currency,
          paymentIntent.id,
          data.idempotencyKey,
          'processing',
          data.description ?? null,
          JSON.stringify(data.metadata ?? {}),
        ],
      );

      if (!payment) {
        throw new PaymentError('Failed to create payment record');
      }

      // 5. Audit trail
      await logAudit({
        userId: data.userId,
        action: 'payment.created',
        resource: 'payment',
        resourceId: payment.id,
        metadata: { amount: data.amount, currency: data.currency, stripeId: paymentIntent.id },
      });

      // 6. Structured logging
      log.info({
        event: 'payment.created',
        paymentId: payment.id,
        userId: data.userId,
        amount: data.amount,
        currency: data.currency,
        stripePaymentIntentId: paymentIntent.id,
      }, 'Payment processed successfully');

      return payment;
    } catch (error) {
      span.recordException(error as Error);

      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('Stripe')) {
        throw new PaymentError(`Payment processing failed: ${error.message}`);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

export async function getPayment(paymentId: string): Promise<Payment | null> {
  return queryOne<Payment>('SELECT * FROM payments WHERE id = $1', [paymentId]);
}
