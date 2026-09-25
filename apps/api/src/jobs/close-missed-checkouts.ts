import { Cron } from 'croner';
import { and, eq, lt } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db/client';
import { attendanceDays } from '../db/schema';
import { writeAudit } from '../lib/audit';
import type { Clock } from '../lib/clock';
import { workDateOf } from '../lib/workdate';
import { getSettings } from '../modules/settings/repo';

/** Marks every CHECKED_IN day from a previous work date as MISSED_CHECKOUT. Idempotent. */
export async function closeMissedCheckouts(deps: { db: Db; clock: Clock }): Promise<number> {
  const now = deps.clock();
  const { timezone } = await getSettings(deps.db);
  const today = workDateOf(now, timezone);
  return deps.db.transaction(async (tx) => {
    const closed = await tx
      .update(attendanceDays)
      .set({ status: 'MISSED_CHECKOUT', needsReview: true, updatedAt: now })
      .where(and(eq(attendanceDays.status, 'CHECKED_IN'), lt(attendanceDays.workDate, today)))
      .returning({ id: attendanceDays.id, workDate: attendanceDays.workDate });
    for (const row of closed) {
      await writeAudit(
        tx,
        {
          actorId: null,
          action: 'attendance.auto_missed_checkout',
          entityType: 'attendance_day',
          entityId: row.id,
          after: { status: 'MISSED_CHECKOUT', workDate: row.workDate },
        },
        now,
      );
    }
    return closed.length;
  });
}

/** Runs now (to catch up after downtime) and then every 15 minutes. Returns a stop function. */
export function startMissedCheckoutJob(deps: { db: Db; clock: Clock; log: FastifyBaseLogger }): () => void {
  const run = async () => {
    try {
      const closed = await closeMissedCheckouts(deps);
      if (closed > 0) deps.log.info({ closed }, 'closed missed checkouts');
    } catch (err) {
      deps.log.error({ err }, 'missed checkout job failed');
    }
  };
  void run();
  const job = new Cron('*/15 * * * *', { protect: true }, run);
  return () => job.stop();
}
