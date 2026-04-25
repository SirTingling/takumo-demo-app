import { trace } from '@opentelemetry/api';
import { query } from '../lib/database.js';
import { createLogger } from '../lib/logger.js';
import { withCircuitBreaker } from '../lib/circuit-breaker.js';
import { ExternalServiceError } from '../lib/errors.js';

const log = createLogger({ service: 'notification' });
const tracer = trace.getTracer('notification-service');

interface NotificationPayload {
  userId: string;
  type: 'payment_success' | 'payment_failed' | 'refund_completed' | 'subscription_created' | 'subscription_canceled';
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

async function sendToProvider(payload: NotificationPayload): Promise<void> {
  // In production, this would call an email/SMS/push provider
  // Circuit breaker protects against provider outages
  log.info({ type: payload.type, userId: payload.userId }, 'Notification sent');
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  return tracer.startActiveSpan('sendNotification', async (span) => {
    try {
      span.setAttributes({
        'notification.type': payload.type,
        'notification.user_id': payload.userId,
      });

      // Send via external provider with circuit breaker
      await withCircuitBreaker('notification-provider', () =>
        sendToProvider(payload),
      );

      // Log notification to database with parameterized query
      await query(
        `INSERT INTO notifications (user_id, type, subject, body, metadata, sent_at, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [payload.userId, payload.type, payload.subject, payload.body, JSON.stringify(payload.metadata ?? {})],
      );

      log.info({
        event: 'notification.sent',
        type: payload.type,
        userId: payload.userId,
      }, 'Notification sent and logged');
    } catch (error) {
      span.recordException(error as Error);
      log.error({ err: error, type: payload.type, userId: payload.userId }, 'Failed to send notification');
      throw new ExternalServiceError('notification', (error as Error).message);
    } finally {
      span.end();
    }
  });
}

