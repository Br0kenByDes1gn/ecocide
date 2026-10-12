import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database connection factory.
 *
 * The SQLite file is opened **explicitly** via `initDb()` — never at module
 * load. This keeps imports side-effect free, lets tests point at a throwaway
 * database, and (later) lets the same call sites drive a Postgres connection
 * pool once the app outgrows SQLite.
 */

function createDrizzle(sqlite: DatabaseSync) {
  return drizzle({ client: sqlite });
}

/** Resolve the SQLite file path: explicit → env → filesystem discovery. */
export function getDbPath(explicitPath?: string): string {
  if (explicitPath) return explicitPath;
  if (process.env.DB_PATH) return process.env.DB_PATH;

  // Mirrors the legacy discovery order: package data dir, server data dir, root data dir.
  const packageDataDir = path.resolve(__dirname, '../../data');
  const serverDataDir = path.resolve(process.cwd(), 'apps/server/data');
  const rootDataDir = path.resolve(process.cwd(), 'data');

  if (fs.existsSync(path.join(packageDataDir, 'dossiers.db'))) {
    return path.join(packageDataDir, 'dossiers.db');
  }
  if (fs.existsSync(path.join(serverDataDir, 'dossiers.db'))) {
    return path.join(serverDataDir, 'dossiers.db');
  }
  if (fs.existsSync(path.join(rootDataDir, 'dossiers.db'))) {
    return path.join(rootDataDir, 'dossiers.db');
  }
  if (!fs.existsSync(packageDataDir)) {
    fs.mkdirSync(packageDataDir, { recursive: true });
  }
  return path.join(packageDataDir, 'dossiers.db');
}

export interface InitDbOptions {
  /** Explicit SQLite database file path (overrides env `DB_PATH` and discovery). */
  path?: string;
}

export interface DbConnection {
  /** Drizzle query interface bound to the opened SQLite client. */
  db: ReturnType<typeof createDrizzle>;
  /** Close the underlying SQLite connection. */
  close(): void;
}

export async function initDb(options: InitDbOptions = {}): Promise<DbConnection> {
  const dbPath = getDbPath(options.path);
  const sqlite = new DatabaseSync(dbPath);

  // Configure SQLite for concurrent read/write and lock wait tolerance
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
  `);

  return {
    db: createDrizzle(sqlite),
    close: () => sqlite.close(),
  };
}