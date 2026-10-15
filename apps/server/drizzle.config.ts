import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration for PostgreSQL.
 *
 * `generate` diffs the Drizzle schema in `src/db/schema.ts` against the last
 * snapshot and writes SQL migrations into `./drizzle`. The server applies them
 * at boot (`runMigrations()` in src/db/migrate.ts); in production the Cloud Run
 * `ecocide-migrate` job applies them once per release.
 *
 * `push` / `studio` default to the local PGlite data directory, so they need no
 * server running. Point them at a real database by exporting DATABASE_URL and
 * switching `driver` off `pglite` (e.g. `drizzle-kit push --dialect=postgresql`).
 */
export default defineConfig({
  dialect: 'postgresql',
  driver: 'pglite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.PGLITE_DATA_DIR ?? './data/pgdata',
  },
});
