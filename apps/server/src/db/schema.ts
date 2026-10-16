import { boolean, doublePrecision, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Single source of truth for the database schema (PostgreSQL).
 *
 * Column names intentionally mirror the on-disk layout (snake_case). JSON blobs
 * (`items_json`, `suggestions_json`, `scripture`) are stored as TEXT and
 * serialized/parsed in the repository layer — simple and dialect-portable.
 *
 * Timestamps: the Better Auth tables use real `timestamptz` columns (the
 * library reads Dates); the application tables keep their ISO-8601 TEXT stamps,
 * which is what the lore/dossier contracts expect and keeps ordering lexical.
 *
 * The archived evidence photo is a FILE on disk (EVIDENCE_DIR); the DB stores
 * only `evidence_filename`.
 */

// ---------------------------------------------------------------------------
// Better Auth core tables
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
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

export const account = pgTable(
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
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('idx_account_user_id').on(t.userId)]
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('idx_verification_identifier').on(t.identifier)]
);

// ---------------------------------------------------------------------------
// Carbon Registry (wallet) — 1:1 with a Better Auth user
// ---------------------------------------------------------------------------

export const wallets = pgTable(
  'wallets',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Whole token units; the ledger sums to this balance. */
    credits: integer('credits').notNull().default(0),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (t) => [index('idx_wallets_user_id').on(t.user_id)]
);

export const walletLedger = pgTable(
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

export const dossiers = pgTable(
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
    /** Cached environmental injunction checklist (JSON). */
    injunction_json: text('injunction_json'),
    /** Hash of the audit items the cached checklist was built from. */
    injunction_hash: text('injunction_hash'),
    /** Evidence photo file name on disk (EVIDENCE_DIR). */
    evidence_filename: text('evidence_filename'),
    /** Owning Carbon Registry account (Better Auth user id); null while anonymous. */
    user_id: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    /**
     * When the citizen accepted the verdict. Null while the ruling is still
     * open to appeal; once set the classification is final and the injunction
     * has been (or is being) issued.
     */
    accepted_at: text('accepted_at'),
  },
  (t) => [
    index('idx_dossiers_created_at').on(t.created_at),
    index('idx_dossiers_user_id').on(t.user_id),
  ]
);

export const appeals = pgTable(
  'appeals',
  {
    id: text('id').primaryKey(),
    dossier_id: text('dossier_id').notNull(),
    appeal_text: text('appeal_text').notNull(),
    /**
     * Pledges offered with this filing (JSON array of PledgeRef). Kept as text
     * rather than a suggestion index: applying a granted appeal re-arbitrates the
     * dossier and rewrites its suggestions, so an index would point at a list that
     * no longer exists. Rows filed before this column exist read as `[]`.
     */
    pledges_json: text('pledges_json').notNull().default('[]'),
    accepted: boolean('accepted').notNull().default(false),
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

/** Accumulated environmental-injunction tasks, one row per action, per citizen. */
export const injunctionTasks = pgTable(
  'injunction_tasks',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The accepted verdict this action was issued for (its provenance). */
    dossier_id: text('dossier_id')
      .notNull()
      .references(() => dossiers.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    replaces: text('replaces').notNull(),
    why: text('why').notNull(),
    category: text('category').notNull(),
    impact: text('impact').notNull(),
    effort: text('effort').notNull(),
    created_at: text('created_at').notNull(),
    completed: boolean('completed').notNull().default(false),
    completed_at: text('completed_at'),
    points: integer('points').notNull().default(0),
  },
  (t) => [
    index('idx_injunction_tasks_user_created').on(t.user_id, t.created_at),
    // Identity: one row per action per accepted verdict. Also a double-click
    // guard, since issuance hangs off the (idempotent) claim endpoint.
    uniqueIndex('uniq_injunction_tasks_user_dossier_action').on(t.user_id, t.dossier_id, t.action),
  ]
);

export const scanApiLogs = pgTable(
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
    /** Float, NOT numeric: `pg` returns numeric as a string (see repositories). */
    cost_usd: doublePrecision('cost_usd').notNull().default(0),
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
