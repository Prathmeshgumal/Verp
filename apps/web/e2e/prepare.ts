// Fresh database for every run: drop, create, migrate, seed one admin.
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { E2E } from './env';

const admin = new pg.Client({ connectionString: E2E.adminDbUrl });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${E2E.dbName} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${E2E.dbName}`);
await admin.end();

const env = { ...process.env, DATABASE_URL: E2E.databaseUrl, ADMIN_PASSWORD: E2E.adminPassword };
const api = (...args: string[]) => execFileSync('pnpm', ['--filter', '@ve/api', 'exec', 'tsx', ...args], { env, stdio: 'inherit' });
api('src/scripts/migrate.ts');
api('src/scripts/seed-admin.ts', '--email', E2E.adminEmail, '--name', 'E2E Admin');
