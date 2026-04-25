import { Router } from 'express';
import express from 'express';
import { stripe } from '../lib/stripe.js';
import { config } from '../config/index.js';
import { createLogger } from '../lib/logger.js';
import { queryOne } from '../lib/database.js';
import { STRIPE_EVENTS, HTTP_STATUS } from '../config/constants.js';
import type { Payment } from '../models/payment.js';

const log = createLogger({ service: 'webhooks' });
const router = Router();

// Stripe webhooks need raw body for signature verification
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe) {
      log.warn('Stripe not configured — ignoring webhook');
      res.sendStatus(HTTP_STATUS.OK);
      return;
    }

    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      log.warn('Missing stripe-signature header');
      res.sendStatus(HTTP_STATUS.BAD_REQUEST);
      return;
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret,
      );
    } catch (err) {
      log.error({ err }, 'Webhook signature verification failed');
      res.sendStatus(HTTP_STATUS.BAD_REQUEST);
      return;
    }

    log.info({ eventType: event.type, eventId: event.id }, 'Webhook received');

    try {
      switch (event.type) {
        case STRIPE_EVENTS.CHARGE_SUCCEEDED:
        case STRIPE_EVENTS.PAYMENT_INTENT_SUCCEEDED: {
          const paymentIntent = event.data.object as { id: string };
          await queryOne<Payment>(
            'UPDATE payments SET status = $1, updated_at = NOW() WHERE stripe_payment_intent_id = $2 RETURNING *',
            ['succeeded', paymentIntent.id],
          );
          log.info({ stripeId: paymentIntent.id }, 'Payment marked as succeeded');
          break;
        }
        case STRIPE_EVENTS.CHARGE_FAILED:
        case STRIPE_EVENTS.PAYMENT_INTENT_FAILED: {
          const paymentIntent = event.data.object as { id: string };
          await queryOne<Payment>(
            'UPDATE payments SET status = $1, updated_at = NOW() WHERE stripe_payment_intent_id = $2 RETURNING *',
            ['failed', paymentIntent.id],
          );
          log.warn({ stripeId: paymentIntent.id }, 'Payment marked as failed');
          break;
        }
        default:
          log.debug({ eventType: event.type }, 'Unhandled webhook event');
      }
    } catch (err) {
      log.error({ err, eventType: event.type }, 'Error processing webhook');
    }

    res.sendStatus(HTTP_STATUS.OK);
  },
);

export default router;

