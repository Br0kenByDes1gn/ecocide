import path from 'path';
import { fileURLToPath } from 'url';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type { DbConnection } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Folder holding the drizzle-kit SQL migrations. */
export function migrationsFolder(): string {
  return process.env.DRIZZLE_MIGRATIONS_DIR ?? path.resolve(__dirname, '../../drizzle');
}

/**
 * Apply pending drizzle-kit migrations to an open connection.
 *
 * Both migrators are the same drizzle-kit output; only the driver that runs the
 * journal differs. PGlite is imported dynamically so the production image never
 * needs it (see the driver note in client.ts).
 */
export async function runMigrations(conn: DbConnection): Promise<void> {
  const config = { migrationsFolder: migrationsFolder() };

  if (conn.driver === 'pglite') {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    // The migrator declares the concrete driver type; AppDb is the shared
    // async query surface both drivers implement.
    await migrate(conn.db as unknown as PgliteDatabase, config);
    return;
  }

  await migrateNodePg(conn.db as unknown as NodePgDatabase, config);
}
