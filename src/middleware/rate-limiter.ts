import type { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis.js';
import { RateLimitError } from '../lib/errors.js';
import { RATE_LIMIT } from '../config/constants.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory fallback when Redis is unavailable
const memoryStore = new Map<string, RateLimitEntry>();

export function rateLimiter(
  options?: { windowMs?: number; maxRequests?: number },
) {
  const windowMs = options?.windowMs ?? RATE_LIMIT.WINDOW_MS;
  const maxRequests = options?.maxRequests ?? RATE_LIMIT.MAX_REQUESTS;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `rl:${req.ip}`;

    try {
      if (redis) {
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.pexpire(key, windowMs);
        }
        const ttl = await redis.pttl(key);

        res.set('X-RateLimit-Limit', String(maxRequests));
        res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - current)));
        res.set('X-RateLimit-Reset', String(Math.ceil((Date.now() + ttl) / 1000)));

        if (current > maxRequests) {
          const retryAfter = Math.ceil(ttl / 1000);
          next(new RateLimitError('Too many requests', retryAfter));
          return;
        }
      } else {
        // In-memory fallback
        const now = Date.now();
        const entry = memoryStore.get(key);

        if (!entry || now >= entry.resetAt) {
          memoryStore.set(key, { count: 1, resetAt: now + windowMs });
        } else {
          entry.count++;
          if (entry.count > maxRequests) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            next(new RateLimitError('Too many requests', retryAfter));
            return;
          }
        }
      }
      next();
    } catch {
      // If rate limiting fails, allow the request through
      next();
    }
  };
}
