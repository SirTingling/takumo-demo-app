import { z } from 'zod';
import { trace } from '@opentelemetry/api';
import { queryOne } from '../lib/database.js';
import { stripe } from '../lib/stripe.js';
import { createLogger } from '../lib/logger.js';
import { withCircuitBreaker } from '../lib/circuit-breaker.js';
import { PaymentError, ValidationError, NotFoundError } from '../lib/errors.js';
import { logAudit } from './audit-service.js';
import type { Subscription } from '../models/subscription.js';

const log = createLogger({ service: 'subscription' });
const tracer = trace.getTracer('subscription-service');

const CreateSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  priceId: z.string().min(1),
  stripeCustomerId: z.string().min(1),
  idempotencyKey: z.string().uuid(),
});

type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;

export async function createSubscription(input: unknown): Promise<Subscription> {
  return tracer.startActiveSpan('createSubscription', async (span) => {
    try {
      const parsed = CreateSubscriptionSchema.safeParse(input);
      if (!parsed.success) {
        const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(msg);
      }
      const data: CreateSubscriptionInput = parsed.data;

      span.setAttributes({
        'subscription.user_id': data.userId,
        'subscription.price_id': data.priceId,
      });

      // Idempotency check
      const existing = await queryOne<Subscription>(
        'SELECT * FROM subscriptions WHERE customer_id = $1 AND stripe_price_id = $2 AND status = $3',
        [data.userId, data.priceId, 'active'],
      );
      if (existing) {
        log.info({ userId: data.userId, priceId: data.priceId }, 'Idempotent subscription — already active');
        return existing;
      }

      if (!stripe) {
        throw new PaymentError('Payment processor not configured');
      }

      // Create Stripe subscription with circuit breaker
      const stripeSub = await withCircuitBreaker('stripe', () =>
        stripe!.subscriptions.create(
          {
            customer: data.stripeCustomerId,
            items: [{ price: data.priceId }],
          },
          { idempotencyKey: data.idempotencyKey },
        ),
      );

      // Insert local record
      const subscription = await queryOne<Subscription>(
        `INSERT INTO subscriptions (customer_id, stripe_price_id, stripe_subscription_id, status, current_period_end, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING *`,
        [
          data.userId,
          data.priceId,
          stripeSub.id,
          stripeSub.status,
          new Date(stripeSub.current_period_end * 1000),
        ],
      );

      if (!subscription) {
        throw new PaymentError('Failed to create subscription record');
      }

      await logAudit({
        userId: data.userId,
        action: 'subscription.created',
        resource: 'subscription',
        resourceId: subscription.id,
        metadata: { priceId: data.priceId, stripeSubscriptionId: stripeSub.id },
      });

      log.info({
        event: 'subscription.created',
        subscriptionId: subscription.id,
        userId: data.userId,
        priceId: data.priceId,
      }, 'Subscription created successfully');

      return subscription;
    } catch (error) {
      span.recordException(error as Error);
      if (error instanceof ValidationError) throw error;
      if (error instanceof Error && error.message.includes('Stripe')) {
        throw new PaymentError(`Subscription creation failed: ${error.message}`);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

export async function getSubscription(subscriptionId: string): Promise<Subscription | null> {
  return queryOne<Subscription>('SELECT * FROM subscriptions WHERE id = $1', [subscriptionId]);
}

export async function cancelSubscription(subscriptionId: string, userId: string): Promise<Subscription> {
  return tracer.startActiveSpan('cancelSubscription', async (span) => {
    try {
      const subscription = await queryOne<Subscription>(
        'SELECT * FROM subscriptions WHERE id = $1',
        [subscriptionId],
      );
      if (!subscription) {
        throw new NotFoundError('Subscription not found');
      }

      if (!stripe || !subscription.stripeSubscriptionId) {
        throw new PaymentError('Payment processor not configured');
      }

      await withCircuitBreaker('stripe', () =>
        stripe!.subscriptions.cancel(subscription.stripeSubscriptionId!),
      );

      const updated = await queryOne<Subscription>(
        `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        ['canceled', subscriptionId],
      );

      if (!updated) {
        throw new PaymentError('Failed to update subscription record');
      }

      await logAudit({
        userId,
        action: 'subscription.canceled',
        resource: 'subscription',
        resourceId: subscriptionId,
      });

      log.info({ event: 'subscription.canceled', subscriptionId, userId }, 'Subscription canceled');

      return updated;
    } catch (error) {
      span.recordException(error as Error);
      if (error instanceof NotFoundError) throw error;
      throw error;
    } finally {
      span.end();
    }
  });
}
