import type { DbOrTx } from '../db/client';
import { auditLogs } from '../db/schema';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/** Call inside the same transaction as the change it records. Never pass hashes or secrets. */
export async function writeAudit(db: DbOrTx, entry: AuditEntry, now: Date): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
    createdAt: now,
  });
}
