import pino from 'pino';
import { config } from '../config/index.js';

const transport = config.isProduction
  ? undefined
  : {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    };

export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  transport,
  redact: {
    paths: [
      'password',
      'creditCard',
      'ssn',
      'authorization',
      'req.headers.authorization',
      'token',
      'secret',
    ],
    censor: '[REDACTED]',
  },
  serializers: pino.stdSerializers,
});

export function createLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
