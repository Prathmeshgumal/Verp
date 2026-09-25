import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';

/** Applies SQL migrations from ./drizzle (relative to the api package, or MIGRATIONS_DIR). */
export async function runMigrations(url: string): Promise<void> {
  const { db, pool } = createDb(url);
  try {
    const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle');
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}
