import { initDb, runMigrations } from './db/index.js';

/**
 * Standalone migration entrypoint for container environments — e.g. the Helm
 * chart's "migrate" init container. Applies pending drizzle-kit migrations to
 * the database selected by `DB_PATH` (see src/db/client.ts) and exits.
 *
 * Usage: node dist/migrate-cli.js
 */
const { db, close } = await initDb();
try {
  await runMigrations(db);
  console.log('[Migrate] All drizzle-kit migrations applied successfully.');
} finally {
  close();
}