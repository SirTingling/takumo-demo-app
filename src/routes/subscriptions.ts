import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/request-validator.js';
import { createSubscriptionSchema } from '../models/subscription.js';
import {
  createSubscription,
  getSubscription,
  cancelSubscription,
} from '../services/subscription-service.js';
import { NotFoundError } from '../lib/errors.js';
import { HTTP_STATUS } from '../config/constants.js';

const router = Router();

router.post(
  '/',
  authenticate,
  validate(createSubscriptionSchema),
  async (req, res, next) => {
    try {
      const subscription = await createSubscription({
        ...req.body,
        userId: req.user!.id,
        stripeCustomerId: req.body.stripeCustomerId,
      });
      res.status(HTTP_STATUS.CREATED).json({ data: subscription });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const subscription = await getSubscription(req.params.id as string);
    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }
    res.json({ data: subscription });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const subscription = await cancelSubscription(req.params.id as string, req.user!.id);
    res.json({ data: subscription });
  } catch (error) {
    next(error);
  }
});

export default router;

