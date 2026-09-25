import { parseArgs } from 'node:util';
import { createDb } from '../db/client';
import { seedAdmin } from '../modules/auth/seed';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
const password = process.env.ADMIN_PASSWORD;
const url = process.env.DATABASE_URL;

if (!values.email || !values.name || !password || !url) {
  console.error('Usage: ADMIN_PASSWORD=... pnpm --filter @ve/api seed:admin --email you@example.com --name "Your Name"');
  process.exit(1);
}

const { db, pool } = createDb(url);
try {
  const admin = await seedAdmin(db, { email: values.email, name: values.name, password });
  console.log(`Created admin ${admin.email}`);
} finally {
  await pool.end();
}
