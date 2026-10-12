import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DbConnection } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Apply pending drizzle-kit migrations to the given connection.
 *
 * The migrations folder lives at `apps/server/drizzle` and is resolved relative
 * to this file so it works under both `tsx watch` (src/) and `node dist/`.
 */
export async function runMigrations(db: DbConnection['db']): Promise<void> {
  const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_DIR ?? path.resolve(__dirname, '../../drizzle');
  await migrate(db, { migrationsFolder });
}