import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Single source of truth for the database schema.
 *
 * Column names intentionally mirror the on-disk layout (snake_case). JSON
 * blobs (`items_json`, `suggestions_json`, `scripture`) are stored as TEXT and
 * serialized/parsed in the repository layer — simple and dialect-portable.
 *
 * The archived evidence photo is a FILE on disk (apps/server/data/evidence);
 * the DB stores only `evidence_filename`.
 */

// ---------------------------------------------------------------------------
// Better Auth core tables
// ---------------------------------------------------------------------------

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .default(false)
    .notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('idx_session_user_id').on(t.userId)]
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('idx_account_user_id').on(t.userId)]
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('idx_verification_identifier').on(t.identifier)]
);

// ---------------------------------------------------------------------------
// Carbon Registry (wallet) — 1:1 with a Better Auth user
// ---------------------------------------------------------------------------

export const wallets = sqliteTable(
  'wallets',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    credits: integer('credits').notNull().default(0),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (t) => [index('idx_wallets_user_id').on(t.user_id)]
);

export const walletLedger = sqliteTable(
  'wallet_ledger',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    ref: text('ref'),
    balance_after: integer('balance_after').notNull(),
    created_at: text('created_at').notNull(),
  },
  (t) => [index('idx_wallet_ledger_user_created').on(t.user_id, t.created_at)]
);

// ---------------------------------------------------------------------------
// Dossiers, appeals & scan logs
// ---------------------------------------------------------------------------

export const dossiers = sqliteTable(
  'dossiers',
  {
    id: text('id').primaryKey(),
    created_at: text('created_at').notNull(),
    caste: text('caste').notNull(),
    biocarbon_ratio: integer('biocarbon_ratio').notNull(),
    honorific_title: text('honorific_title').notNull(),
    headline: text('headline').notNull(),
    paragraph_1: text('paragraph_1').notNull(),
    paragraph_2: text('paragraph_2').notNull(),
    paragraph_3: text('paragraph_3').notNull(),
    /** Audited room type, e.g. "kitchen" (null when unknown). */
    room_type: text('room_type'),
    /** Detected objects + ratings (JSON). */
    items_json: text('items_json').notNull().default('[]'),
    /** Improvement suggestions offered as appeal pledges (JSON). */
    suggestions_json: text('suggestions_json').notNull().default('[]'),
    /** Evidence photo file name on disk (apps/server/data/evidence). */
    evidence_filename: text('evidence_filename'),
    /** Owning Carbon Registry account (Better Auth user id); null while anonymous. */
    user_id: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  },
  (t) => [
    index('idx_dossiers_created_at').on(t.created_at),
    index('idx_dossiers_user_id').on(t.user_id),
  ]
);

export const appeals = sqliteTable(
  'appeals',
  {
    id: text('id').primaryKey(),
    dossier_id: text('dossier_id').notNull(),
    appeal_text: text('appeal_text').notNull(),
    accepted: integer('accepted', { mode: 'boolean' }).notNull().default(false),
    new_caste: text('new_caste'),
    new_honorific_title: text('new_honorific_title'),
    headline: text('headline'),
    reason: text('reason').notNull(),
    scripture: text('scripture'),
    caste_before: text('caste_before').notNull(),
    caste_after: text('caste_after'),
    created_at: text('created_at').notNull(),
  },
  (t) => [index('idx_appeals_dossier_created').on(t.dossier_id, t.created_at)]
);

export const scanApiLogs = sqliteTable(
  'scan_api_logs',
  {
    id: text('id').primaryKey(),
    dossier_id: text('dossier_id').notNull(),
    call_type: text('call_type').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    prompt_tokens: integer('prompt_tokens').notNull().default(0),
    candidates_tokens: integer('candidates_tokens').notNull().default(0),
    thoughts_tokens: integer('thoughts_tokens').notNull().default(0),
    total_tokens: integer('total_tokens').notNull().default(0),
    cost_usd: real('cost_usd').notNull().default(0),
    duration_ms: integer('duration_ms').notNull().default(0),
    status: text('status').notNull().default('success'),
    error_message: text('error_message'),
    created_at: text('created_at').notNull(),
  },
  (t) => [
    index('idx_scan_api_logs_dossier_id').on(t.dossier_id),
    index('idx_scan_api_logs_created_at').on(t.created_at),
  ]
);