import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { createLogger } from './logger.js';

const log = createLogger({ module: 'redis' });

export const redis: Redis | null = config.redis.url
  ? new Redis(config.redis.url, { lazyConnect: true, maxRetriesPerRequest: 3 })
  : null;

if (redis) {
  redis.on('connect', () => log.info('Redis connected'));
  redis.on('error', (err: Error) => log.error({ err }, 'Redis error'));
} else {
  log.warn('REDIS_URL not configured — Redis features disabled');
}
