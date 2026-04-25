import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/request-validator.js';
import { createPaymentSchema } from '../models/payment.js';
import { processPayment, getPayment } from '../services/payment-service.js';
import { processRefund } from '../services/refund-service.js';
import { NotFoundError } from '../lib/errors.js';
import { HTTP_STATUS } from '../config/constants.js';

const router = Router();

router.post(
  '/',
  authenticate,
  validate(createPaymentSchema),
  async (req, res, next) => {
    try {
      const payment = await processPayment({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(HTTP_STATUS.CREATED).json({ data: payment });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const payment = await getPayment(req.params.id as string);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }
    res.json({ data: payment });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/refund', authenticate, async (req, res, next) => {
  try {
    const payment = await processRefund({
      paymentId: req.params.id as string,
      userId: req.user!.id,
      reason: req.body.reason,
      idempotencyKey: req.body.idempotencyKey,
    });
    res.json({ data: payment });
  } catch (error) {
    next(error);
  }
});

export default router;
