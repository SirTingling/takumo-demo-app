import Stripe from 'stripe';
import { config } from '../config/index.js';
import { createLogger } from './logger.js';

const log = createLogger({ module: 'stripe' });

export const stripe: Stripe | null = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, { apiVersion: '2025-02-24.acacia' })
  : null;

if (!stripe) {
  log.warn('STRIPE_SECRET_KEY not configured — Stripe features disabled');
}
