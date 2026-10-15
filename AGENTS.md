# AGENTS.md // Ecocide Technical Blueprint

Welcome to **ECOCIDE** — a satirical dystopian environmental-bureaucracy web
app/PWA. A photo of your **household** is audited: objects are detected,
rated, and sentenced by an unyielding machine authority, the **AI Supreme
Arbiter of Consumption**.

## 1. What this project is

A photo of a room (upload or camera) goes through a **two-pass AI pipeline**:

1. **Pass 1 — Inventory** (server, Gemini vision, structured JSON): the model
   detects household objects, groups identical ones with counts, emits
   normalized bounding boxes, and rates each item **1–5** on the applicable
   compliance dimensions (material, recyclability, decomposition, embodied
   carbon, lifespan, toxicity, pollution shedding, operating energy).
2. **Compliance math** (`packages/compliance`, 100% deterministic): per-item
   Harm Score → Sustainability Index → status; Step-5 override rules
   (single-use plastic, hazardous → Special Handling, landfill traps); the
   size-weighted roll-up → **Household Sustainability Index** → tier (via the
   lore taxonomy bands `90/75/60/40/20/0`). The model never touches the math.
3. **Pass 2 — Classification** (server, text-only Gemini): given the tier +
   items summary, the model writes the funny bureaucratic verdict paragraphs
   and 3–5 **suggestions** bound to detected items. Those suggestions power
   the appeal tribunal's **pledge picker**.

The dossier then offers CLAIM (mock paywall → dossier) and APPEAL (mock
filing fee → archived ruling; accepted appeals re-arbitrate against the
**stored item list**, no vision re-call). A **Carbon Registry** (Better Auth
email-OTP accounts) holds the citizen's pooled carbon standing, the archive of
claimed assessments and the token wallet/ledger that backs the mock payments.

**Without AI tokens everything still runs**: the server degrades to a seeded
offline simulation (archetype catalog → deterministic room → deterministic
verdict), so `pnpm test`, the dev bench and local development cost nothing.

## 2. Hard architectural rules

1. **Story → lore only.** All story, copy and art live in `packages/lore`
   (dependency-free: data + string templates). Components, prompts and the
   server read from the pack; do not reintroduce story into them.
2. **Math → compliance only.** The compliance formula (weights, H, SI, ratio,
   statuses) lives in `packages/compliance` (dependency-free). Never
   re-implement it in components, prompts, or the server; only import it.
3. **Internal storage names persist** (`caste`, `biocarbon_ratio`,
   `/api/citizen`, `OraclePayload`…) — they are API/DB identifiers, not
   display copy. The taxonomy is data-driven: `packages/lore/src/factions.ts`
   defines the six tiers with `minScore` bands; thresholds, colors, stamps and
   titles are derived — never duplicate them.
4. **Evidence photos are files, not DB blobs.** The archived audit photo lives
   at `apps/server/data/evidence/<dossierId>.<ext>` (env `EVIDENCE_DIR`); the
   database stores only `evidence_filename` and serves it via
   `GET /api/evidence/<name>` (extension whitelist). No base64 images in the
   DB or emails.
5. **React components must never render a raw tier id**: use
   `getFaction(caste).name`. Display vocab comes from the pack.
6. **Markdown links** to files in responses: `[file](file:///path)`.
7. **Always run `pnpm test`** before finishing a task.

## 3. Monorepo layout

**Build order:** `compliance → lore → types → server → web` (root
`pnpm build` handles it).

```
packages/compliance/  # Pure formula math: dimensions+weights, H, SI, status,
                      # household ratio roll-up, dedupe/sanitize, aggregates
packages/lore/        # THE STORY + ART SURFACE: identity, six tiers (factions),
                      # prompt builders + JSON schemas, offline simulation,
                      # archetype catalog, exhibit rooms, art tokens
packages/types/       # Contracts only; derives the taxonomy from lore +
                      # formula from compliance; simulateScanFromItems etc.
apps/server/          # Hono + SQLite (Drizzle) + Gemini + BullMQ + Better Auth
                      # + nodemailer + evidence file store
apps/web/             # React 19 + Vite + Tailwind v4 + PWA
                      # (intro → scan → verdict → claim/appeal → vault)
charts/               # Helm chart (placeholder branding)
scripts/              # scan-cost audit, wireframe model conversion
```

### packages/compliance

- `dimensions.ts` — 8 dimension keys `m r d c l t p e`, weights summing to 100.
- `math.ts` — `harmScore` (weighted mean over applicable dims; denominator
  rebalances, e.g. 95 without operating energy), `siFromHarm` (100(5−H)/4),
  `baseItemStatus` + `itemStatus` (≥60 / ≥40 / <40, extended by Step-5
  overrides), `evaluateOverrides` (single-use plastic / hazardous / landfill
  trap), `householdRatio` (quantity × size-factor weighted mean, integer),
  `hardFailCount` (override hits), `topOffender`, `dominantDimension`,
  `dominantMaterialFamily`, `dedupeItems`, `clampRating`, `sanitizeCount`.
- `registry.ts` — the cross-assessment roll-up: `pooledIndex` (item-weighted
  mean across every archived assessment), `objectCount`, `registryStanding`
  (index + record texture + the newest-audit `delta`). The tier bands stay in
  lore; the registry never re-derives them.

### packages/lore

- `identity.ts` — app name, `entityName: 'AI Supreme Arbiter of
  Consumption'`, taglines, backronym, `auditProtocol: 'PROTOCOL-9'`.
- `factions.ts` — the six tiers (art §7) with `minScore` bands (90/75/60/40/
  20/0), colors, stamp text + ink, verdict lines, lore, prompt blocks,
  badge art prompts, and the deterministic title driver table
  (`HOUSEHOLD_TITLES` + `householdTitle`); `getFactionFromScore`.
- `prompts.ts` — `buildInventoryPrompt` + `INVENTORY_JSON_SCHEMA` (Pass 1:
  objects, material family, size, ratings, boxes, optional room hint) and
  `buildVerdictPrompt` + `VERDICT_JSON_SCHEMA` (Pass 2; JSON contract keeps
  `caste`/`biocarbon_ratio` keys), plus appeal/re-arbitration builders.
- `simulate.ts` — deterministic offline content: `ITEM_ARCHETYPES` catalog,
  `generateSimulatedInventory(seed)`, `SIMULATED_ROOMS` + `buildSimulatedRoom`
  (one curated exhibit room per tier), verdict copy, suggestions, appeal
  rulings, re-arbitration copy.
- `surfaces.ts` — `REGISTRY_COPY` (+ `standingTrendLabel`): the Carbon
  Registry page, its standing hero, the assessment archive, the token account
  and the payment terminal copy. World strings only; mechanical chrome stays
  inline in components.

### apps/server

- `POST /api/oracle/scan` — the two-pass pipeline (inventory → math →
  verdict), writes the evidence file, persists the dossier, logs both model
  calls (`oracle_inventory`, `oracle_classify`). Offline when no Gemini creds.
- `GET /api/citizen/:id`, `GET /api/citizen/:id/appeals`,
  `POST /api/citizen/:id/appeal`, `POST /api/citizen/:id/appeals/:appealId/apply`.
- `GET /api/census` — live audited-household counts per tier (display gate:
  only once ≥50 audits exist, art §7). `GET /api/evidence/:name`.
- `GET /api/vault`, `POST /api/vault/link`, `POST /api/vault/charge`,
  `GET /api/vault/ledger`, `/api/auth/*` (Better Auth email-OTP). These are the
  Carbon Registry endpoints — the storage path keeps its `vault` name.
- `GET /admin/queues` Bull Board (BullMQ mode + Basic auth only).
- Prompt assembly is thin in `src/gemini.ts` (wraps lore builders, parses
  JSON, sanitizes model output); world copy comes from the pack.
- DB: `node:sqlite` + Drizzle, WAL mode, explicit `initDb()`/`createRepositories()`
  factories; migrations via drizzle-kit, applied at boot (`AUTO_MIGRATE=false`
  to defer); never commit `*.db*` or `data/evidence/` files.

### apps/web

- SPA flow in `src/App.tsx` (`/`, `/scan`, `/citizen/:id`, `/arbitration/:id`,
  `/claim/:id`, `/appeal/:id`, `/appeals/:id`, `/registry` with `/vault`
  redirecting, dev-only `/debug`).
- `src/components/HomePage.tsx` — the landing screen (terminal + paper
  dossier panel); the global app header hides on the scan screen.
- `src/components/ObjectScanner.tsx` (+ `ScannerHeader`, `UploadPanel`,
  `EvidenceDropZone`, `AssetWireframe`, `AnalysisPanel`) — capture a room
  (camera/upload/drag-drop) with the audit-area category chips, then the
  in-flight analysis cinematic; no client-side detection; "SCAN OBJECTS, NOT
  PEOPLE".
- `src/lib/audit-lenses.ts` — the four audit lenses (art §9): neon-outline,
  evidence-photo, inspection-hud, carbon-heat — canvas renders over the
  evidence photo + item boxes.
- `src/components/HouseholdAuditCard.tsx` — the dossier card: lens view, tier
  stamp, title, index + waste gauge, 2×2 stats, per-item cards (with Step-5
  override flags), barcode.
- `src/components/CarbonRegistryScreen.tsx` (+ `RegistryUnlock`,
  `RegistryPayment`) — `/registry`: the pooled carbon standing hero, the
  assessment archive and the demoted token account. Payment terminals charge
  via `lib/vault-api.ts` (API/storage names keep their `vault` spellings).
- Copy: all world strings live in the lore pack; inline UI strings are
  generic chrome, not story.

## 4. Commands

| Command | Action |
| --- | --- |
| `pnpm install` | Install all workspace deps |
| `pnpm build` | compliance → lore → types → server → web |
| `pnpm dev:all` | API (:3001) + web (:5173) concurrently |
| `pnpm dev:web` / `pnpm dev:server` | Single process |
| `pnpm test` | Vitest across packages (hermetic) |
| `pnpm scan-costs` | Token/cost audit from the local DB |
| `pnpm wireframes` | Convert `models-src/*.obj` → `apps/web/src/lib/asset-wireframes.ts` |

Dev without AI tokens: `/debug` bench (six exhibit rooms, one per tier),
simulated audits (no `GEMINI_API_KEY`), OTP printed to the server console,
emails logged via jsonTransport (no SMTP), inline job dispatcher (no Redis).

## 5. Guidelines for agents

1. **Story → lore only; math → compliance only.** Verification:
   `pnpm build && pnpm test`, then the grep gate (below).
2. **Rebuild after touching deps**: `pnpm --filter @ecocide/compliance build
   && pnpm --filter @ecocide/lore build && pnpm --filter @ecocide/types build`
   before server/web builds.
3. **Taxonomy changes** (tier count/bands) touch `lore/factions.ts` only;
   colors, stamps and titles follow. Keep the invariant tests green
   (band monotonicity, boundary mapping, exhibit rooms landing in-band,
   simulate determinism).
4. **DB discipline**: no `*.db*` or `data/evidence/` in git; schema changes
   go through `drizzle-kit generate`; never hand-write DDL.
5. **Display vs storage**: `caste`/`biocarbon_ratio` stay in code/DB/API;
   all user-facing strings are pack-driven.
6. **Markdown links** to files in responses: `[file](file:///path)`.
7. **Always run `pnpm test`** before finishing a task.

### Grep gate (placeholder canon must not leak)

```bash
rg -i -n "carbon minded|aipocalypse|neon grid|mainframe|biocarbon(?!_ratio)|redundan|overlord|enforcer|bootlick|untouchable|free spirit|\bclass (i|ii|iii|iv|v|vi)\b|class-[ivx]+" apps packages scripts --pcre2 | grep -vE "caste|biocarbonRatio|classify|classification"
```

(Internal `caste`/`biocarbon_ratio`/`biocarbonRatio` identifiers are exempt.)

## 6. Related docs

- [`STORY.md`](STORY.md) — lore-pack authoring handbook (every slot, tier
  mechanics, prompts, art, workflow).
- [`README.md`](README.md) — user-facing overview + quick start.
- `art_directions.md` — visual style bible (§-numbered; the source of truth
  for colors, tiers, stamps, lenses, motion, copy rules).
- `compliance_formula.md` — the base item-level formula implemented verbatim
  by `packages/compliance`.
- `readme/sustainability_scoring_framework.md` — the extended framework
  (Step-5 overrides, size-weighted roll-up, title drivers, modifiers).