import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type { EmptyRelations } from 'drizzle-orm';
import type { PgAsyncDatabase } from 'drizzle-orm/pg-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database connection factory (PostgreSQL).
 *
 * The driver is selected by `DATABASE_URL`:
 *
 *  • set      → `pg` (node-postgres) against that DSN. Production: Cloud SQL
 *               over the unix socket, e.g.
 *               `postgres://user:pass@localhost/db?host=/cloudsql/<conn>`
 *  • unset    → PGlite, a full PostgreSQL compiled to WASM, running in-process.
 *               Local dev and tests need no server, no Docker, no network. The
 *               database is a directory on disk (PGLITE_DATA_DIR) so it persists
 *               across restarts like the SQLite file used to.
 *
 * Both drivers extend Drizzle's `PgAsyncDatabase`, so the query surface typed as
 * {@link AppDb} is identical and `repositories.ts` has exactly one
 * implementation — no dialect branching. PGlite is a devDependency and is
 * imported dynamically, so the production image never ships its WASM payload.
 *
 * The connection is opened **explicitly** via `initDb()` — never at module load.
 * This keeps imports side-effect free and lets tests point at a throwaway
 * directory.
 */

/** The query surface shared by the node-postgres and PGlite drivers. */
export type AppDb = PgAsyncDatabase<any, EmptyRelations>;

export type DbDriver = 'postgres' | 'pglite';

/** Resolve the local PGlite data directory: explicit → env → `apps/server/data/pgdata`. */
export function resolvePgliteDataDir(explicitPath?: string): string {
  if (explicitPath) return explicitPath;
  if (process.env.PGLITE_DATA_DIR) return process.env.PGLITE_DATA_DIR;
  return path.resolve(__dirname, '../../data/pgdata');
}

export interface InitDbOptions {
  /** PGlite data directory. Ignored when `DATABASE_URL` is set. */
  path?: string;
  /** Open a throwaway in-memory database (tests). Ignored when `DATABASE_URL` is set. */
  memory?: boolean;
}

export interface DbConnection {
  /** Drizzle query interface — identical for both drivers. */
  db: AppDb;
  /** Which engine was opened (surfaced in `/api/health` and boot logs). */
  driver: DbDriver;
  /** Close the pool / shut the in-process engine down. */
  close(): Promise<void>;
}

/**
 * Advise against two processes sharing one PGlite directory.
 *
 * PGlite does not enforce single-writer: if two instances initialize the same
 * directory concurrently they interleave two clusters (pg_control from one, WAL
 * from the other) and the directory becomes permanently unopenable. That is easy
 * to trigger locally — a second `pnpm dev:server`, or `pnpm scan-costs` before
 * the dev server has settled — so we take an advisory pid lock next to the data
 * directory and refuse to start with a readable message instead of corrupting it.
 *
 * A lock left behind by a dead process is taken over silently.
 */
function acquireLocalLock(dataDir: string): string {
  const lockPath = `${dataDir}.lock`;

  if (fs.existsSync(lockPath)) {
    const holder = Number(fs.readFileSync(lockPath, 'utf8').trim());
    if (holder && holder !== process.pid && isProcessAlive(holder)) {
      throw new Error(
        `The local PGlite database at ${dataDir} is already open by pid ${holder} ` +
          `(another dev server or \`pnpm scan-costs\`).\n` +
          `Stop that process first, or set DATABASE_URL to use a real PostgreSQL instead.`
      );
    }
  }

  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  fs.writeFileSync(lockPath, String(process.pid));
  return lockPath;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the in-process engine. PGlite is a devDependency, so it is deliberately
 * absent from the production image — say so plainly rather than surfacing a bare
 * module-resolution error.
 */
async function loadPglite(): Promise<{
  PGlite: typeof import('@electric-sql/pglite').PGlite;
  drizzle: typeof import('drizzle-orm/pglite').drizzle;
}> {
  try {
    const [{ PGlite }, { drizzle }] = await Promise.all([
      import('@electric-sql/pglite'),
      import('drizzle-orm/pglite'),
    ]);
    return { PGlite, drizzle };
  } catch (err) {
    throw new Error(
      'DATABASE_URL is not set and the in-process PGlite engine is not installed ' +
        '(it is a devDependency, so the production image does not contain it).\n' +
        'Set DATABASE_URL to a PostgreSQL connection string.',
      { cause: err }
    );
  }
}

export async function initDb(options: InitDbOptions = {}): Promise<DbConnection> {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.DB_POOL_MAX) || 10,
    });
    // Fail fast on bad credentials / an unreachable instance at boot, rather
    // than on the first household scan.
    await pool.query('select 1');
    return {
      db: drizzleNodePg({ client: pool }),
      driver: 'postgres',
      close: () => pool.end(),
    };
  }

  const { PGlite, drizzle: drizzlePglite } = await loadPglite();

  // In-memory instances (tests) have no directory to collide on.
  const dataDir = options.memory ? null : resolvePgliteDataDir(options.path);
  const lockPath = dataDir ? acquireLocalLock(dataDir) : null;

  try {
    const client = dataDir ? new PGlite(dataDir) : new PGlite();
    await client.waitReady;
    return {
      db: drizzlePglite({ client }),
      driver: 'pglite',
      async close() {
        await client.close();
        if (lockPath) fs.rmSync(lockPath, { force: true });
      },
    };
  } catch (err) {
    if (lockPath) fs.rmSync(lockPath, { force: true });
    // PGlite aborts the WASM module on an unopenable cluster; without this the
    // failure surfaces as an unreadable multi-megabyte minified source dump.
    throw new Error(
      `Could not open the local PGlite database at ${dataDir}: ${err instanceof Error ? err.message : String(err)}\n` +
        `The directory is most likely the result of two processes initializing it at once, or a partial copy.\n` +
        `Delete it to start a fresh one: rm -rf ${dataDir}`
    );
  }
}
