import { desc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type {
  ApiCallLog,
  ApiCallType,
  AuditItem,
  Caste,
  CensusReport,
  CitizenAppeal,
  CitizenRecord,
  OraclePayload,
  Prophecy,
  ScanCostSummary,
  Suggestion,
  UserProfile,
  VaultDossierSummary,
  VaultStats,
  Wallet,
  WalletLedgerEntry,
  WalletLedgerReason,
} from '@ecocide/types';
import { CASTE_ORDER } from '@ecocide/types';
import { hardFailCount, topOffender } from '@ecocide/compliance';
import { evidenceUrlFor } from '../evidence.js';
import type { DbConnection } from './client.js';
import { appeals, dossiers, scanApiLogs, walletLedger, wallets } from './schema.js';

/**
 * Repository layer: the whole database surface of the app.
 *
 * Functions are `async` even though the node:sqlite driver is synchronous —
 * awaiting the sync query methods is a no-op today, and the signatures are then
 * stable when the app later switches to an async Postgres driver.
 */

export interface SaveDossierOptions {
  /** Optional explicit dossier id (defaults to a fresh nanoid). */
  id?: string;
  /** Evidence photo file name on disk (e.g. `<id>.jpg`). */
  evidenceFileName?: string;
  /** Audited room type. */
  roomType?: string | null;
}

export interface AppealUpdateFields {
  caste: string;
  honorificTitle: string;
  headline: string;
  paragraph_1: string;
  paragraph_2: string;
  paragraph_3: string;
}

export interface SaveAppealEntry {
  dossierId: string;
  appealText: string;
  accepted: boolean;
  newCaste?: Caste;
  newHonorificTitle?: string;
  headline?: string;
  reason: string;
  scripture?: [string, string, string];
  casteBefore: Caste;
  casteAfter?: Caste;
}

type DossierRow = typeof dossiers.$inferSelect;
type ScanLogRow = typeof scanApiLogs.$inferSelect;

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapRowToRecord(row: DossierRow): CitizenRecord {
  const userProfile: UserProfile = {
    caste: row.caste as Caste,
    biocarbon_ratio: row.biocarbon_ratio,
    honorific_title: row.honorific_title,
  };

  const items: AuditItem[] = parseJson<AuditItem[]>(row.items_json, []);
  const hardFails = hardFailCount(items);
  const top = topOffender(items);
  const audit = {
    roomType: row.room_type ?? null,
    items,
    ratio: row.biocarbon_ratio,
    hardFails,
    topOffenderLabel: top?.label ?? null,
  };
  const suggestions: Suggestion[] = parseJson<Suggestion[]>(row.suggestions_json, []);
  const prophecy: Prophecy = {
    headline: row.headline,
    paragraph_1: row.paragraph_1,
    paragraph_2: row.paragraph_2,
    paragraph_3: row.paragraph_3,
  };

  return {
    id: row.id,
    createdAt: row.created_at,
    profile: userProfile,
    user_profile: userProfile,
    prophecy,
    audit,
    suggestions,
    evidenceUrl: row.evidence_filename ? evidenceUrlFor(row.evidence_filename) : undefined,
    ownerId: row.user_id || undefined,
  };
}

function mapScanLogRow(row: ScanLogRow): ApiCallLog {
  return {
    id: row.id,
    dossierId: row.dossier_id,
    callType: row.call_type as ApiCallType,
    provider: row.provider,
    model: row.model,
    promptTokens: row.prompt_tokens,
    candidatesTokens: row.candidates_tokens,
    thoughtsTokens: row.thoughts_tokens,
    totalTokens: row.total_tokens,
    costUsd: row.cost_usd,
    durationMs: row.duration_ms,
    status: row.status as ApiCallLog['status'],
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

type WalletRow = typeof wallets.$inferSelect;
type WalletLedgerRow = typeof walletLedger.$inferSelect;

function mapWalletRow(row: WalletRow): Wallet {
  return {
    id: row.id,
    userId: row.user_id,
    credits: row.credits,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLedgerRow(row: WalletLedgerRow): WalletLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    delta: row.delta,
    reason: row.reason as WalletLedgerReason,
    ref: row.ref || undefined,
    balanceAfter: row.balance_after,
    createdAt: row.created_at,
  };
}

export function createRepositories(db: DbConnection['db']) {
  return {
    /** Persists a fresh audit verdict and returns the dossier id. */
    async saveDossier(
      payload: OraclePayload,
      options: SaveDossierOptions = {}
    ): Promise<string> {
      const id = options.id || nanoid(10);
      const createdAt = new Date().toISOString();

      await db.insert(dossiers).values({
        id,
        created_at: createdAt,
        caste: payload.user_profile.caste,
        biocarbon_ratio: payload.user_profile.biocarbon_ratio,
        honorific_title: payload.user_profile.honorific_title,
        headline: payload.prophecy.headline,
        paragraph_1: payload.prophecy.paragraph_1,
        paragraph_2: payload.prophecy.paragraph_2,
        paragraph_3: payload.prophecy.paragraph_3,
        room_type: options.roomType ?? payload.audit.roomType ?? null,
        items_json: JSON.stringify(payload.audit.items ?? []),
        suggestions_json: JSON.stringify(payload.suggestions ?? []),
        evidence_filename: options.evidenceFileName ?? null,
      }).run();

      return id;
    },

    /** Rewrites the classification columns of a dossier after a granted appeal. */
    async updateDossierAppeal(id: string, fields: AppealUpdateFields): Promise<void> {
      await db
        .update(dossiers)
        .set({
          caste: fields.caste,
          honorific_title: fields.honorificTitle,
          headline: fields.headline,
          paragraph_1: fields.paragraph_1,
          paragraph_2: fields.paragraph_2,
          paragraph_3: fields.paragraph_3,
        })
        .where(eq(dossiers.id, id))
        .run();
    },

    /** Persists an appeal filing + its ruling, linked to the original dossier. */
    async saveAppeal(entry: SaveAppealEntry): Promise<string> {
      const id = nanoid(12);
      const createdAt = new Date().toISOString();

      await db.insert(appeals).values({
        id,
        dossier_id: entry.dossierId,
        appeal_text: entry.appealText,
        accepted: entry.accepted,
        new_caste: entry.newCaste || null,
        new_honorific_title: entry.newHonorificTitle || null,
        headline: entry.headline || null,
        reason: entry.reason,
        scripture: entry.scripture ? JSON.stringify(entry.scripture) : null,
        caste_before: entry.casteBefore,
        caste_after: entry.casteAfter || null,
        created_at: createdAt,
      }).run();

      return id;
    },

    /** Lists every appeal for a dossier, newest first. */
    async getAppealsByDossier(dossierId: string): Promise<CitizenAppeal[]> {
      const rows = db
        .select()
        .from(appeals)
        .where(eq(appeals.dossier_id, dossierId))
        .orderBy(desc(appeals.created_at))
        .all();

      return rows.map((row) => {
        let scripture: [string, string, string] | undefined;
        if (row.scripture) {
          try {
            scripture = JSON.parse(row.scripture);
          } catch {
            scripture = undefined;
          }
        }
        return {
          id: row.id,
          dossierId: row.dossier_id,
          appealText: row.appeal_text,
          accepted: row.accepted,
          newCaste: row.new_caste as Caste | undefined,
          newHonorificTitle: row.new_honorific_title || undefined,
          headline: row.headline || undefined,
          reason: row.reason,
          scripture,
          casteBefore: row.caste_before as Caste,
          casteAfter: row.caste_after as Caste | undefined,
          createdAt: row.created_at,
        };
      });
    },

    async getDossier(id: string): Promise<CitizenRecord | null> {
      const row = db.select().from(dossiers).where(eq(dossiers.id, id)).get();
      if (!row) return null;
      return mapRowToRecord(row);
    },

    async getRecentDossiers(limit: number = 10): Promise<CitizenRecord[]> {
      const rows = db
        .select()
        .from(dossiers)
        .orderBy(desc(dossiers.created_at))
        .limit(limit)
        .all();
      return rows.map(mapRowToRecord);
    },

    /** Live census: audited-household counts per tier (art §7). */
    async getCensusReport(): Promise<CensusReport> {
      const rows = db
        .select({ caste: dossiers.caste, count: sql<number>`count(*)` })
        .from(dossiers)
        .groupBy(dossiers.caste)
        .all();
      const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
      const byCaste = new Map<string, number>(rows.map((r) => [r.caste as string, Number(r.count)]));
      const entries = CASTE_ORDER.map((caste) => {
        const count = byCaste.get(caste) ?? 0;
        return {
          caste,
          count,
          sharePct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        };
      });
      return { total, sufficient: total >= 50, entries };
    },

    async logApiCall(entry: Omit<ApiCallLog, 'id' | 'createdAt'>): Promise<string> {
      const id = nanoid(10);
      const createdAt = new Date().toISOString();

      await db.insert(scanApiLogs).values({
        id,
        dossier_id: entry.dossierId,
        call_type: entry.callType,
        provider: entry.provider,
        model: entry.model,
        prompt_tokens: entry.promptTokens || 0,
        candidates_tokens: entry.candidatesTokens || 0,
        thoughts_tokens: entry.thoughtsTokens || 0,
        total_tokens: entry.totalTokens || 0,
        cost_usd: entry.costUsd || 0,
        duration_ms: entry.durationMs || 0,
        status: entry.status || 'success',
        error_message: entry.errorMessage || null,
        created_at: createdAt,
      }).run();

      return id;
    },

    async getScanApiLogs(dossierId: string): Promise<ApiCallLog[]> {
      const rows = db
        .select()
        .from(scanApiLogs)
        .where(eq(scanApiLogs.dossier_id, dossierId))
        .orderBy(scanApiLogs.created_at)
        .all();
      return rows.map(mapScanLogRow);
    },

    async getRecentScansWithCosts(limit: number = 10): Promise<ScanCostSummary[]> {
      const recent = db
        .select()
        .from(dossiers)
        .orderBy(desc(dossiers.created_at))
        .limit(limit)
        .all();

      return recent.map((dossier) => {
        const rawLogs = db
          .select()
          .from(scanApiLogs)
          .where(eq(scanApiLogs.dossier_id, dossier.id))
          .orderBy(scanApiLogs.created_at)
          .all();
        const apiCalls = rawLogs.map(mapScanLogRow);

        const totalCostUsd = Number(apiCalls.reduce((sum, c) => sum + (c.costUsd || 0), 0).toFixed(6));
        const totalTokens = apiCalls.reduce((sum, c) => sum + (c.totalTokens || 0), 0);
        const totalDurationMs = apiCalls.reduce((sum, c) => sum + (c.durationMs || 0), 0);

        return {
          dossierId: dossier.id,
          createdAt: dossier.created_at,
          caste: dossier.caste,
          biocarbonRatio: dossier.biocarbon_ratio,
          honorificTitle: dossier.honorific_title,
          headline: dossier.headline,
          totalCostUsd,
          totalTokens,
          totalDurationMs,
          apiCalls,
        };
      });
    },

    // ------------------------------------------------------------------
    // Asset Vault (wallet)
    // ------------------------------------------------------------------

    /** Returns the wallet for a user, or null when the vault has no wallet yet. */
    async getWalletByUser(userId: string): Promise<Wallet | null> {
      const row = db.select().from(wallets).where(eq(wallets.user_id, userId)).get();
      return row ? mapWalletRow(row) : null;
    },

    /**
     * Idempotently provisions a wallet for a user. When one is created and
     * `initialCredits > 0`, a matching `seed` ledger entry is written so the
     * balance is always reconstructable from the ledger.
     */
    async createWalletForUser(userId: string, initialCredits = 0): Promise<Wallet> {
      const existing = db.select().from(wallets).where(eq(wallets.user_id, userId)).get();
      if (existing) return mapWalletRow(existing);

      const id = nanoid(10);
      const now = new Date().toISOString();

      db.insert(wallets)
        .values({
          id,
          user_id: userId,
          credits: initialCredits,
          created_at: now,
          updated_at: now,
        })
        .run();

      if (initialCredits !== 0) {
        db.insert(walletLedger)
          .values({
            id: nanoid(12),
            user_id: userId,
            delta: initialCredits,
            reason: 'seed',
            ref: null,
            balance_after: initialCredits,
            created_at: now,
          })
          .run();
      }

      return {
        id,
        userId,
        credits: initialCredits,
        createdAt: now,
        updatedAt: now,
      };
    },

    /**
     * Moves the wallet balance by `delta` and records an auditable ledger row.
     * Creates the wallet first if it does not exist. Returns the updated wallet
     * plus the ledger entry that was written.
     */
    async applyWalletDelta(entry: {
      userId: string;
      delta: number;
      reason: WalletLedgerReason;
      ref?: string;
    }): Promise<{ wallet: Wallet; entry: WalletLedgerEntry }> {
      let wallet = db.select().from(wallets).where(eq(wallets.user_id, entry.userId)).get();
      if (!wallet) {
        await this.createWalletForUser(entry.userId, 0);
        wallet = db.select().from(wallets).where(eq(wallets.user_id, entry.userId)).get()!;
      }

      const now = new Date().toISOString();
      const balanceAfter = wallet.credits + entry.delta;

      db.update(wallets)
        .set({ credits: balanceAfter, updated_at: now })
        .where(eq(wallets.id, wallet.id))
        .run();

      const ledgerEntry: WalletLedgerEntry = {
        id: nanoid(12),
        userId: entry.userId,
        delta: entry.delta,
        reason: entry.reason,
        ref: entry.ref || undefined,
        balanceAfter,
        createdAt: now,
      };

      db.insert(walletLedger)
        .values({
          id: ledgerEntry.id,
          user_id: entry.userId,
          delta: entry.delta,
          reason: entry.reason,
          ref: entry.ref || null,
          balance_after: balanceAfter,
          created_at: now,
        })
        .run();

      return {
        wallet: { ...mapWalletRow(wallet), credits: balanceAfter, updatedAt: now },
        entry: ledgerEntry,
      };
    },

    /** Finds a specific ledger entry (used to make charge-backs idempotent). */
    async getWalletLedgerByRef(
      userId: string,
      ref: string,
      reason: WalletLedgerReason
    ): Promise<WalletLedgerEntry | null> {
      const row = db
        .select()
        .from(walletLedger)
        .where(eq(walletLedger.user_id, userId))
        .all()
        .find((r) => r.ref === ref && r.reason === reason);
      return row ? mapLedgerRow(row) : null;
    },

    /** Recent ledger entries for a wallet, newest first. */
    async getWalletLedger(userId: string, limit = 25): Promise<WalletLedgerEntry[]> {
      const rows = db
        .select()
        .from(walletLedger)
        .where(eq(walletLedger.user_id, userId))
        .orderBy(desc(walletLedger.created_at))
        .limit(limit)
        .all();
      return rows.map(mapLedgerRow);
    },

    /** A page of ledger entries plus the full transaction count. */
    async getWalletLedgerPage(
      userId: string,
      options: { limit: number; offset: number }
    ): Promise<{ entries: WalletLedgerEntry[]; total: number }> {
      const total =
        db
          .select({ count: sql<number>`count(*)` })
          .from(walletLedger)
          .where(eq(walletLedger.user_id, userId))
          .get()?.count ?? 0;

      const rows = db
        .select()
        .from(walletLedger)
        .where(eq(walletLedger.user_id, userId))
        .orderBy(desc(walletLedger.created_at))
        .limit(options.limit)
        .offset(options.offset)
        .all();

      return { entries: rows.map(mapLedgerRow), total: Number(total) };
    },

    /** Aggregate credits/spend/count over the whole ledger (not just a page). */
    async getWalletStats(userId: string): Promise<VaultStats> {
      const row = db
        .select({
          totalCredited: sql<number>`coalesce(sum(case when ${walletLedger.delta} > 0 then ${walletLedger.delta} else 0 end), 0)`,
          totalSpent: sql<number>`coalesce(sum(case when ${walletLedger.delta} < 0 then -${walletLedger.delta} else 0 end), 0)`,
          transactionCount: sql<number>`count(*)`,
        })
        .from(walletLedger)
        .where(eq(walletLedger.user_id, userId))
        .get();

      return {
        totalCredited: Number(row?.totalCredited ?? 0),
        totalSpent: Number(row?.totalSpent ?? 0),
        transactionCount: Number(row?.transactionCount ?? 0),
      };
    },

    /** Attaches an (anonymous) dossier to a vault account. */
    async linkDossierToUser(dossierId: string, userId: string): Promise<void> {
      await db.update(dossiers).set({ user_id: userId }).where(eq(dossiers.id, dossierId)).run();
    },

    /** Lightweight summaries of a vault's dossiers, newest first. */
    async getVaultDossierSummaries(userId: string): Promise<VaultDossierSummary[]> {
      const rows = db
        .select({
          id: dossiers.id,
          caste: dossiers.caste,
          honorific_title: dossiers.honorific_title,
          biocarbon_ratio: dossiers.biocarbon_ratio,
          created_at: dossiers.created_at,
          evidence_filename: dossiers.evidence_filename,
        })
        .from(dossiers)
        .where(eq(dossiers.user_id, userId))
        .orderBy(desc(dossiers.created_at))
        .all();

      return rows.map((row) => ({
        id: row.id,
        caste: row.caste as Caste,
        honorificTitle: row.honorific_title,
        biocarbonRatio: row.biocarbon_ratio,
        createdAt: row.created_at,
        evidenceUrl: row.evidence_filename ? evidenceUrlFor(row.evidence_filename) : undefined,
      }));
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;