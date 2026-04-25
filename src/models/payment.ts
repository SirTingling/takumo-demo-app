import { z } from 'zod';
import { CURRENCIES } from '../config/constants.js';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  customerId: string;
  stripePaymentIntentId: string | null;
  idempotencyKey: string;
  status: PaymentStatus;
  description: string | null;
  metadata: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}

export const createPaymentSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.enum(CURRENCIES),
  description: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
  metadata: z.record(z.string()).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

