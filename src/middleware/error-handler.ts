import type { Request, Response, NextFunction } from 'express';
import { AppError, RateLimitError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';
import { HTTP_STATUS } from '../config/constants.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof RateLimitError) {
    res.set('Retry-After', String(err.retryAfter));
  }

  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, statusCode: err.statusCode, message: err.message },
      'Application error',
    );

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      },
    });
    return;
  }

  // Unexpected errors
  logger.error({ err }, 'Unhandled error');

  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isProduction ? 'An unexpected error occurred' : err.message,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    },
  });
}

