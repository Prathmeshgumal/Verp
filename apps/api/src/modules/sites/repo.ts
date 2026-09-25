import { asc, eq } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client';
import { sites, type SiteRow } from '../../db/schema';

export async function listSites(db: DbOrTx): Promise<SiteRow[]> {
  return db.select().from(sites).orderBy(asc(sites.name));
}

export async function findSiteById(db: DbOrTx, id: string): Promise<SiteRow | undefined> {
  const [row] = await db.select().from(sites).where(eq(sites.id, id));
  return row;
}

export async function insertSite(db: DbOrTx, values: typeof sites.$inferInsert): Promise<SiteRow> {
  const [row] = await db.insert(sites).values(values).returning();
  return row!;
}

export async function updateSiteRow(
  db: DbOrTx,
  id: string,
  values: Partial<typeof sites.$inferInsert>,
): Promise<SiteRow | undefined> {
  const [row] = await db.update(sites).set(values).where(eq(sites.id, id)).returning();
  return row;
}
