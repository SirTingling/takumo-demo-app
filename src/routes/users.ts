import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/request-validator.js';
import { createUserSchema, loginSchema } from '../models/user.js';
import { registerUser, loginUser, getUser } from '../services/user-service.js';
import { NotFoundError } from '../lib/errors.js';
import { HTTP_STATUS } from '../config/constants.js';

const router = Router();

router.post(
  '/register',
  validate(createUserSchema),
  async (req, res, next) => {
    try {
      const result = await registerUser(req.body);
      res.status(HTTP_STATUS.CREATED).json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/login',
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const result = await loginUser(req.body);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await getUser(req.user!.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

export default router;
