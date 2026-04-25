import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../lib/errors.js';

export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const messages = result.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      next(new ValidationError(messages));
      return;
    }

    req.body = result.data;
    next();
  };
}

