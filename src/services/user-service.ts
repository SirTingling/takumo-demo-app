import { trace } from '@opentelemetry/api';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { queryOne } from '../lib/database.js';
import { createLogger } from '../lib/logger.js';
import {
  AuthenticationError,
  ConflictError,
  ValidationError,
} from '../lib/errors.js';
import { logAudit } from './audit-service.js';
import { config } from '../config/index.js';
import { ACCOUNT_LOCKOUT } from '../config/constants.js';
import { createUserSchema, loginSchema } from '../models/user.js';
import type { User } from '../models/user.js';

const log = createLogger({ service: 'user' });
const tracer = trace.getTracer('user-service');

const SALT_ROUNDS = 12;

export async function registerUser(input: unknown): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
  return tracer.startActiveSpan('registerUser', async (span) => {
    try {
      const parsed = createUserSchema.safeParse(input);
      if (!parsed.success) {
        const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(msg);
      }
      const data = parsed.data;

      span.setAttribute('user.email', data.email);

      // Check for existing user with parameterized query
      const existing = await queryOne<User>(
        'SELECT id FROM users WHERE email = $1',
        [data.email],
      );
      if (existing) {
        throw new ConflictError('Email already registered');
      }

      // Hash password with bcrypt (NOT MD5)
      const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

      const user = await queryOne<User>(
        `INSERT INTO users (email, name, password_hash, role, failed_login_attempts, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING *`,
        [data.email, data.name, passwordHash, 'user', 0],
      );

      if (!user) {
        throw new Error('Failed to create user');
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiry, subject: user.id } as jwt.SignOptions,
      );

      await logAudit({
        userId: user.id,
        action: 'user.registered',
        resource: 'user',
        resourceId: user.id,
      });

      log.info({ event: 'user.registered', userId: user.id }, 'User registered');

      const { passwordHash: _, ...safeUser } = user;
      return { user: safeUser, token };
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export async function loginUser(input: unknown): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
  return tracer.startActiveSpan('loginUser', async (span) => {
    try {
      const parsed = loginSchema.safeParse(input);
      if (!parsed.success) {
        const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(msg);
      }
      const data = parsed.data;

      span.setAttribute('user.email', data.email);

      const user = await queryOne<User>(
        'SELECT * FROM users WHERE email = $1',
        [data.email],
      );
      if (!user) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Account lockout check
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        throw new AuthenticationError('Account is temporarily locked');
      }

      const validPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!validPassword) {
        // Increment failed attempts
        const newAttempts = user.failedLoginAttempts + 1;
        const lockedUntil = newAttempts >= ACCOUNT_LOCKOUT.MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS)
          : null;

        await queryOne(
          'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
          [newAttempts, lockedUntil, user.id],
        );

        log.warn({ userId: user.id, attempts: newAttempts }, 'Failed login attempt');
        throw new AuthenticationError('Invalid credentials');
      }

      // Reset failed attempts on successful login
      await queryOne(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [user.id],
      );

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwt.secret,
        { expiresIn: config.jwt.expiry, subject: user.id } as jwt.SignOptions,
      );

      await logAudit({
        userId: user.id,
        action: 'user.login',
        resource: 'user',
        resourceId: user.id,
      });

      log.info({ event: 'user.login', userId: user.id }, 'User logged in');

      const { passwordHash: _, ...safeUser } = user;
      return { user: safeUser, token };
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export async function getUser(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
  const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) return null;
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

