import { query } from '../lib/database.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger({ service: 'audit' });

export interface AuditEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, resource, resource_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [entry.userId, entry.action, entry.resource, entry.resourceId, JSON.stringify(entry.metadata ?? {})],
    );
  } catch (err) {
    // Fire-and-forget: audit failures should never break business logic
    log.error({ err, entry }, 'Failed to write audit log');
  }
}

