import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration for the SQLite (node:sqlite) dialect.
 *
 * `generate` diffs the Drizzle schema in `src/db/schema.ts` against the last
 * snapshot and writes SQL migrations into `./drizzle`. The server applies them
 * at boot via `runMigrations()` (src/db/migrate.ts).
 *
 * When the app later moves to PostgreSQL, swap this to the postgres dialect and
 * point `dbCredentials.url` at the connection string.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DB_PATH ?? './data/dossiers.db',
  },
});