import { z } from 'zod';
import { trace } from '@opentelemetry/api';
import { query, queryOne } from '../lib/database.js';
import { stripe } from '../lib/stripe.js';
import { createLogger } from '../lib/logger.js';
import { withCircuitBreaker } from '../lib/circuit-breaker.js';
import { PaymentError, ValidationError, NotFoundError } from '../lib/errors.js';
import { logAudit } from './audit-service.js';
import type { Payment } from '../models/payment.js';

const log = createLogger({ service: 'refund' });
const tracer = trace.getTracer('refund-service');

const RefundSchema = z.object({
  paymentId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
});

type RefundInput = z.infer<typeof RefundSchema>;

export async function processRefund(input: unknown): Promise<Payment> {
  return tracer.startActiveSpan('processRefund', async (span) => {
    try {
      const parsed = RefundSchema.safeParse(input);
      if (!parsed.success) {
        const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(msg);
      }
      const data: RefundInput = parsed.data;

      span.setAttributes({
        'refund.payment_id': data.paymentId,
        'refund.user_id': data.userId,
      });

      // Check idempotency
      const existingRefund = await queryOne<Payment>(
        'SELECT * FROM payments WHERE id = $1 AND status = $2',
        [data.paymentId, 'refunded'],
      );
      if (existingRefund) {
        log.info({ paymentId: data.paymentId }, 'Idempotent refund — already refunded');
        return existingRefund;
      }

      // Find the original payment
      const payment = await queryOne<Payment>(
        'SELECT * FROM payments WHERE id = $1',
        [data.paymentId],
      );
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      if (!stripe) {
        throw new PaymentError('Payment processor not configured');
      }

      if (!payment.stripePaymentIntentId) {
        throw new PaymentError('Payment has no associated Stripe payment intent');
      }

      // Create Stripe refund with circuit breaker
      const refund = await withCircuitBreaker('stripe', () =>
        stripe!.refunds.create(
          {
            payment_intent: payment.stripePaymentIntentId!,
            reason: 'requested_by_customer',
          },
          { idempotencyKey: data.idempotencyKey },
        ),
      );

      // Update payment status
      const updated = await queryOne<Payment>(
        `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        ['refunded', data.paymentId],
      );

      if (!updated) {
        throw new PaymentError('Failed to update payment record');
      }

      await logAudit({
        userId: data.userId,
        action: 'payment.refunded',
        resource: 'payment',
        resourceId: data.paymentId,
        metadata: { stripeRefundId: refund.id, reason: data.reason },
      });

      log.info({
        event: 'payment.refunded',
        paymentId: data.paymentId,
        userId: data.userId,
        stripeRefundId: refund.id,
      }, 'Refund processed successfully');

      return updated;
    } catch (error) {
      span.recordException(error as Error);
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('Stripe')) {
        throw new PaymentError(`Refund processing failed: ${error.message}`);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

