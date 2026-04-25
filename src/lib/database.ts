import pg from 'pg';
import { config } from '../config/index.js';
import { createLogger } from './logger.js';

const log = createLogger({ module: 'database' });

const pool: pg.Pool | null = config.database.url
  ? new pg.Pool({ connectionString: config.database.url })
  : null;

if (!pool) {
  log.warn('DATABASE_URL not configured — database queries will fail');
}

export async function query<T extends pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  if (!pool) {
    throw new Error('Database not configured');
  }
  return pool.query<T>(sql, params);
}

export async function queryOne<T extends pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result.rows[0] ?? null;
}

export async function disconnect(): Promise<void> {
  if (pool) {
    await pool.end();
    log.info('Database pool disconnected');
  }
}

export { pool };
