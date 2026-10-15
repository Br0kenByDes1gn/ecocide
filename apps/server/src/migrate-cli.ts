import { initDb, runMigrations } from './db/index.js';

/**
 * Standalone migration entrypoint — the release step of the deployment.
 *
 * Applies pending drizzle-kit migrations to the database selected by
 * `DATABASE_URL` (see src/db/client.ts) and exits:
 *
 *   • Cloud Run: `gcloud run jobs execute ecocide-migrate` re-pointed at the
 *     image for the tag being released, so DDL runs exactly once per release
 *     instead of racing every cold start (`AUTO_MIGRATE=false`).
 *   • Local: `node dist/migrate-cli.js` migrates the PGlite data directory.
 *
 * Usage: node dist/migrate-cli.js
 */
const conn = await initDb();
try {
  await runMigrations(conn);
  console.log(`[Migrate] All drizzle-kit migrations applied (driver: ${conn.driver}).`);
} finally {
  await conn.close();
}
