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
apps/server/          # Hono + PostgreSQL (Drizzle; PGlite locally) + Gemini
                      # + BullMQ + Better Auth + nodemailer + evidence file store
apps/web/             # React 19 + Vite + Tailwind v4 + PWA
                      # (intro → scan → verdict → claim/appeal → vault)
deploy/gcp/           # Cloud Run + Cloud SQL deploy: setup.sh (one-time IAM/SQL/
                      # bucket/secrets), sync-env.sh (.env.production → Secret
                      # Manager + service), env.production.example, runbook
                      # (release workflow: .github/workflows/deploy-gcp.yml)
apps/server/scripts/  # scan-cost audit
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
  and the payment terminal copy. Also `INFORMANT_COPY` (the tip screen + its
  email), `ADJUDICATORS_COPY` (the credits page and its team roster) and
  `GRID_COPY` (the Planetary Grid's readouts + its 30 log message templates,
  filled by `apps/web/src/lib/status-log.ts`). World strings only; mechanical
  chrome stays inline in components.

### apps/server

- `POST /api/oracle/scan` — the two-pass pipeline (inventory → math →
  verdict), writes the evidence file, persists the dossier, logs both model
  calls (`oracle_inventory`, `oracle_classify`). Offline when no Gemini creds.
- `GET /api/citizen/:id`, `GET /api/citizen/:id/appeals`,
  `POST /api/citizen/:id/appeal`, `POST /api/citizen/:id/appeals/:appealId/apply`.
  **Acceptance is terminal** (`dossiers.accepted_at`): once a verdict is accepted
  — the `ACCEPT VERDICT` claim — the classification is frozen and both appeal
  endpoints refuse with 409. These permalink endpoints are public, so the rule is
  enforced server-side, not just by hiding the buttons.
- **A verdict can be tipped against another household.**
  `POST /api/citizen/:id/inform` (session required, `src/informant.ts`) attributes
  a fresh verdict to an accused address (`dossiers.subject_email`, plus
  `informant_user_id` for the audit trail) and pays the informant
  `INFORMANT_REWARD_UNITS` (one credit) — once per verdict, guarded by its
  `informant_reward` ledger entry with `ref = dossierId`. The accused is emailed
  the "anonymous tip" notice (`email:informant-tip`). While a verdict is
  attributed, only a session signed in with that address may claim or appeal it:
  `src/access.ts` (`dossierAccessError`) is consulted by `/api/vault/link`, the
  priced `/api/vault/charge`, the appeal filing and the re-arbitration apply. The
  raw address is **never** serialized — `GET /api/citizen/:id` reports only
  `attributed: true`.
- **Pledges** are persisted when an appeal is *filed* (`appeals.pledges_json`, a
  `PledgeRef[]`), and the **server composes** the `PLEDGES OFFERED: …` block into
  the stored appeal text — the tribunal reads the prose, the record keeps the list,
  and one composer keeps them equal. Phrase and impact are stored, not a suggestion
  index: applying a granted appeal re-arbitrates the dossier and replaces its
  suggestions, so an index would point at a list that no longer exists.
  `GET /api/citizen/:id` returns `acceptedPledges`, derived from **granted** appeals
  only (de-duplicated by phrase) — a rejected filing offered pledges it never had
  accepted. Rows filed before that column exist read as `[]`.
- The **environmental injunction** (`src/injunction.ts`) is issued at acceptance,
  from the frozen verdict (including any granted appeal), exactly once per
  accepted verdict: the dossier's items are hashed, a cached checklist is reused
  when unchanged, otherwise a text-only Gemini checklist is generated (or the
  deterministic simulation offline) and one `injunction_tasks` row per action is
  inserted — **in one transaction**, so a checklist lands whole or not at all —
  unique on (user, dossier, action). Completed rows are the citizen's banked
  points; they are never re-issued.
- **Filing is a durable bit, and issuance is retried.** `issueInjunction` runs as
  the `injunction:issue` queue job (enqueued by `/link`, `jobs/enqueue.ts`), and
  again from the dossier page's **first read**
  (`GET /api/vault/injunction-tasks?dossierId=…&ensure=1`) whenever an accepted
  verdict has no `dossiers.injunction_issued_at`. That flag is written **last** —
  the single "filed" bit, and the date the stamp prints. Three outcomes:
  `filed` (rows committed), `empty` (the model parsed a checklist with no actions:
  a real filing — "no corrective orders" — flagged and never retried) and
  **thrown** (model error, unparseable JSON, or items that all failed sanitizing:
  nothing cached or flagged, so the queue's 5 attempts and the next page load both
  retry). The job's `jobId` is removed on completion *and* on final failure, or a
  retained failed job would swallow every later enqueue. Model calls are logged to
  `scan_api_logs` as `oracle_injunction` and carry a 25s abort so a hung call cannot
  hold a request or a worker slot. The public record exposes only
  `injunctionFiledAt` + `injunctionOrders` (a count) — never the actions.
- **Dispatch mode matters.** With `REDIS_URL` (production: Memorystore) the job
  runs on the durable BullMQ queue and `enqueue` awaits only `queue.add`. Without
  it — dev, tests, and the PGlite smoke path — the dispatcher runs the handler
  **inline in the calling process**, and `enqueueInjunction` therefore does *not*
  wait: awaiting would put a model call inside `/link` and inside the dossier read.
  `issueInjunction` is single-flight per verdict, so the acceptance job and the
  page's retry share one execution in either mode. `/api/health` reports
  `jobs: 'bullmq' | 'inline'` (from the environment) **and** `queue:
  'connected' | 'disconnected' | 'inline'` (from the Redis client's events), and
  the release workflow fails on either an inline dispatcher or a disconnected
  queue — the pair exists because `jobs` alone would call a wrong port healthy.
  Production Memorystore runs `SERVER_AUTHENTICATION`, so `rediss://` also needs
  `REDIS_CA_CERT` (`serverCaCerts[0].cert`, the instance's own CA): without it the
  handshake fails "unable to verify the first certificate" and the queue retries
  forever. See `jobs/connection.ts`.
- `GET /api/census` — live audited-household counts per tier (display gate:
  only once ≥50 audits exist, art §7). `GET /api/evidence/:name`.
- **Money is carbon credits.** One credit is one tonne of CO₂e; the ledger counts
  *credit units* (1/100 of a credit = 10 kg) so it can stay integer, and every
  user-facing figure is credits with two decimals. A new account is minted one
  year's average citizen footprint (≈6.6 t, rounded to 7.00) as its allowance.
- **The Bureau prices fees; the client never does.** Each tier carries a `tariff`
  (`claimUnits` / `appealUnits`) and the audit modulates it — a harm-weighted load
  over the items, normalised so the tier's own exhibit room scores exactly 1.0,
  clamped to 0.6–1.8 and capped at half the allowance. The calibration lives in
  `packages/types/src/economy.ts` and is asserted by `economy.test.ts`: the
  disaster zone affords **20 audits + 1 appeal** out of the allowance, and every
  better tier more. `/link` prices the claim, and `/api/vault/charge` derives the
  appeal fee from the dossier it is given — an amount sent for `claim_fee` /
  `appeal_fee` is ignored. Scans cost nothing: an audit can run with no account to
  charge, and the money moves at the two acts that need one — then back again when
  a completed order is confirmed (below).
- `GET /api/vault`, `POST /api/vault/link`, `POST /api/vault/charge`,
  `GET /api/vault/ledger`, `GET /api/vault/injunction-tasks`,
  `POST /api/vault/injunction-confirm`, `/api/auth/*` (Better Auth email-OTP).
  These are the Carbon Registry endpoints — the storage path keeps its `vault`
  name. `/link` is the acceptance.
- **Completing an order pays, slowly.** `/injunction-confirm` banks standing points
  (impact × effort) **and credits the wallet** with `injunctionRewardUnits`, one `injunction_reward` ledger
  entry per batch with the per-task amounts recorded on the task rows
  (`reward_units`, written at confirmation like `points`, so retuning the schedule
  cannot rewrite what a past confirmation paid). The payout is 0.05–0.50 credits,
  `Math.log2`-spread over the same impact × effort product so the extremes land on
  the ends of the range, then jittered ±10% by a hash of the **action text** — a
  chore is worth the same on every dossier, for every household, and an unreadable
  rating is priced at the floor rather than overpaid. `injunctionTaskPoints` and
  `injunctionRewardUnits` live in `types/economy.ts` and are shared with the
  worksheet, which has to quote a figure before any stored points exist.
- **The index is measured, not earned.** Standing is the pooled verdicts
  (`registryStanding`) plus a bounded contribution from honored orders:
  `injunctionStanding` → `bonus = INJUNCTION_INDEX_CAP × T/(T + halfPoints)` (cap
  +10, half of it at 600 points ≈ thirty orders), so paperwork can nudge the index
  but never carry a household up a tier, and 216 honored orders read +8.8 rather
  than the +4,320 the raw point sum used to add. Both numbers are exposed together
  — `VaultState.standing.index` (verdicts) and `VaultState.injunction`
  (points, ordersHonored, bonus, effectiveIndex, effectiveCaste) — because the
  bonus used to be pooled client-side on one screen only, which made `/registry`
  and `/injunction` disagree about the same account. The lift is derived on read:
  the stored per-audit SI is never rewritten.
- `GET /admin/queues` Bull Board (BullMQ mode + `BULL_BOARD_USER`/`BULL_BOARD_PASS`
  only; production runs Memorystore via `REDIS_URL`, so the dashboard is mounted
  there once both are set).
- Prompt assembly is thin in `src/gemini.ts` (wraps lore builders, parses
  JSON, sanitizes model output); world copy comes from the pack.
- DB: PostgreSQL + Drizzle via `pg` (`DATABASE_URL`) or **PGlite** in-process
  when unset — one schema, one repository implementation, both drivers extending
  Drizzle's `PgAsyncDatabase` (see `db/client.ts`). Explicit
  `initDb()`/`createRepositories()` factories; migrations via drizzle-kit, applied
  at boot (`AUTO_MIGRATE=false` to defer to the Cloud Run migrate job); never
  commit `*.db*`, `data/pgdata*` or `data/evidence/` files.
- Local DB caveats: PGlite is single-process (advisory `pgdata.lock`, readable
  error instead of corruption) and a directory initialized twice is unopenable —
  delete `apps/server/data/pgdata` to reset.

### apps/web

- SPA flow in `src/App.tsx` (`/`, `/scan`, `/citizen/:id`, `/arbitration/:id`,
  `/claim/:id`, `/appeal/:id`, `/inform/:id`, `/appeals/:id`,
  `/adjudicators` with `/about` redirecting, `/grid`, `/injunction` (optionally
  `?dossier=<id>`), `/registry` with `/vault` redirecting, dev-only `/debug`).
- `src/lib/analytics.ts` — GA4 (`G-CES4JGST5C`), injected by `main.tsx` from the
  same two tags as the standard gtag snippet. Three deliberate choices: it is a
  **no-op outside a production build** (local clicking never reaches the
  property); `config` runs with `send_page_view: false` and `App.tsx` sends one
  `page_view` per screen from an effect keyed on
  `viewState`/`permalinkId`/`dossierFilter` (a router-less SPA would otherwise
  report one view per document load, i.e. the whole journey as one hit); and
  `analyticsPath` collapses permalink ids to `/citizen/:id` before anything is
  sent, so household ids never leave the app and reports group by route. No
  consent banner — GA4 anonymises IPs by default; add consent mode if that
  changes.
- `src/components/ArbitrationDossier.tsx` — the verdict page. Beside
  `ACCEPT VERDICT` and `APPEAL`, when a permalink exists, it offers
  `SUBMIT AS EVIDENCE FOR SOMEONE ELSE` (`/inform/:id`), hidden once the verdict
  is attributed or accepted. An attributed verdict shows a response-pending
  notice; the address itself is never rendered (the server only reports
  `attributed`).
- `src/components/InformantScreen.tsx` — `/inform/:id`: the citizen unlocks their
  own registry (the bounty lands in a wallet), enters the accused household's
  address, and files the tip; a success view pays the credit. Copy is
  `INFORMANT_COPY` from the pack; the call is
  `lib/vault-api.ts#submitInformantEvidence`.
- `src/components/HomePage.tsx` — the landing screen (terminal + paper
  dossier panel); the global app header hides on the scan screen. Its footer
  carries the only link to the credits page.
- `src/components/AboutScreen.tsx` — `/adjudicators` (the credits page, `/about`
  redirects): a Bureau personnel file on the paper layer — the Broken By Design
  mark, the `Made with ❤️ by Broken By Design` line and the studio stamp (all
  linking to the studio site) and the two-person roster with self-hosted GitHub
  avatars (`public/team/`) and profile links. Copy and the roster come from
  `ADJUDICATORS_COPY`; the logo is `public/broken-by-design-logo.svg`.
- `src/components/GridScreen.tsx` — `/grid`, the Planetary Grid: the rotating
  earth wireframe (the scanner's `AssetWireframe` with `models={['earth_wireframe']}`
  + `motion="spin"`, at a larger size), a readout strip and an activity log that
  prepends the 30 `GRID_COPY.log` templates every ~3s (newest on top, paused
  while the tab is hidden, last 60 kept). Its operator strip links to the credits
  page. Copy in `GRID_COPY`; formatting in `src/lib/status-log.ts`.
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
  `RegistryPayment`, `RegistrySwitchAccount`) — `/registry`: the pooled carbon
  standing hero, the assessment archive and the demoted carbon account. The
  payment terminal quotes the fee in carbon credits with its kg CO₂e equivalent
  and sends only the filing (`lib/vault-api.ts`; `RegistryPayment` takes
  `amountUnits` for display while the server charges its own price), and
  API/storage names keep their `vault` spellings. Anywhere a session is *shown*
  rather than entered — the payment terminal and the informant screen —
  `RegistrySwitchAccount` exposes the signed-in address and a
  **Not you? Use a different address** escape hatch, because a wrong address is
  refused by the attributed-verdict gates and must be switchable in place.
  `/registry` and `/injunction` decide what to render through
  `lib/registry-phase.ts`, gated on `useVault().sessionReady` — **never on
  better-auth's `isPending`**. That flag is `data === null` sampled at each
  fetch, so for a logged-out visitor it returns to `true` on every background
  refetch (better-auth refetches the session when a tab becomes visible), and
  reading it as a mount gate tore the unlock form out of the tree on a tab
  switch — losing the email and the one-time code the citizen had just typed.
  `sessionReady` latches on the first answer and never goes back. A registry
  fetch that fails is a `failed` phase with a retry, not a spinner.
- `src/components/InjunctionStamp.tsx` (+ `lib/useInjunction.ts`,
  `lib/injunction-worksheet.ts`) — the mark placed in the dossier's reserved space
  under IMPACT FINDINGS once an accepted verdict's orders exist. Issuance runs
  *after* the acceptance response, so the space shows a pulsing line
  (`INJUNCTION_STAMP.pending`, from the pack) while `useInjunction` waits: it
  reads once, then polls on a bounded schedule (≤6 requests, 30s deadline),
  makes no requests while the tab is hidden, and reads once on return. The first
  read carries `ensure=1` (the page-load retry, see the server bullet above); the
  polls do not. The poll asks for one verdict (`?dossierId=`, served by
  `getInjunctionTasksByDossier`), so its cost is the matching rows rather than the
  whole worksheet. `resolveInjunctionState` is the pure mapping from an answer to
  what renders: `issued` (the actions), `empty` (filed with **no corrective
  orders** — the green stamp), `waiting` (the pulsing line), `unavailable` (the
  deadline passed with nothing on file: the lore's "orders not on file" line plus
  a retry that restarts the wait) and, when the endpoint answers 401/403 (a locked
  registry, or someone else's verdict), the public `injunctionFiledAt` /
  `injunctionOrders` decide between an **inert** stamp and the green one — never
  blank paper. Clicking the orders mark opens `/injunction?dossier=<id>`; the
  worksheet splits the visible list from the pooled bonus so filtering never moves
  the standing.
- `src/components/DossierStamp.tsx` — the shared stamp idiom (hard border, tilt,
  inset shadow, mono caps) used by **both** marks on the dossier, so they cannot
  drift. `src/components/DispositionStamp.tsx` (+ `DispositionModal.tsx`) is the
  other mark, on the left of the reserved space: the Bureau's disposition for the
  household, from the tier's own `disposition` (label, icon keys, detail) in the
  pack. No date — it is a statement of intent, not a filing. It is drawn with the
  tier's hex as the border/wash and the tier's matte `stampInk` as the lettering,
  and opens the detail in a modal (Escape / backdrop dismiss, mirroring
  `CensusModal`). Glyphs are line icons whose keys the pack stores and
  `src/lib/lore-icons.ts` resolves (`topics.icon` uses the same map) — no colour
  emoji anywhere on the paper layer. Both marks wrap rather than collide on a
  narrow screen; only the injunction mark plays a landing sound.
- `src/components/DossierSheet.tsx` + `src/components/PaperDossierPanel.tsx` — the
  dossier's two-column sheet and its paper half, rendered by **both** the page and
  the PNG export. `src/lib/dossier-export.ts` rasterises that sheet off-screen
  (fixed 1280px, 2×, `modern-screenshot` through an SVG `foreignObject`, with
  canvases swapped for images and motion frozen) so DOWNLOAD CASE CARD produces the
  page as it looks. **Never hand-paint a second design for the export** — the
  previous canvas painter described an older page within a day and had to go. The
  typewriter face is self-hosted (`apps/web/public/fonts/`) so the export is
  deterministic and the PWA keeps its face offline.
- `src/components/PaperDossierPanel.tsx` — the paper half of a dossier. Its
  remediation block always lists the pledges, split into `PLEDGED` (from
  `acceptedPledges`, in pledge green with the grant date) and `UNPLEDGED` (the
  verdict's suggestions minus any already granted, matched by phrase so nothing is
  listed twice). The split comes from `lib/pledges.ts`; the copy from
  `REMEDIATION_COPY`. Once acceptance has closed the file the footer stops inviting
  an appeal, and the audit card's tile counts the group its label names
  (`Pledges available` = still unpledged, `Pledges on file` = granted).
- `src/components/PaperDossierHeader.tsx` — the paper header shared by the
  arbitration and citizen dossiers (and the PNG export). Everything collapses under
  `sm:` — the recycling mark, the bureau title, the case/citizen ids and the
  barcode — and **the title block is `min-h`, never a fixed height**: a fixed box
  let three wrapped lines spill out of the header and over the case-ID row beneath.
  The ids `break-all` instead of clipping, because a citizen id is a full email
  address. The arbitration page's classification stamp scales down and wraps for the
  same reason: a `shrink-0` block in a non-wrapping row can only be cut off.
- Copy: all world strings live in the lore pack; inline UI strings are
  generic chrome, not story.
- **PWA installability** is generated, not hand-written: `pwaAssets` in
  `vite.config.ts` (`@vite-pwa/assets-generator`, preset tuned to a
  `#080b08` background) rasterises `public/favicon.svg` into the manifest's
  `pwa-64/192/512.png` + `maskable-icon-512x512.png`, the `apple-touch-icon`
  and `favicon.ico`, and injects the head links. Never hand-write
  `manifest.icons`: the old `{ src: 'favicon.svg', sizes: '192x192 512x512' }`
  pointed at a 64px drawing, which Chrome rejects (no icon ≥144px) and with it
  the install promotion. The `icons` entry is overridden by the plugin;
  `screenshots` (real PNGs in `public/screenshots/`, exact declared sizes) feed
  Android's richer install dialog.

## 4. Commands

| Command | Action |
| --- | --- |
| `pnpm install` | Install all workspace deps |
| `pnpm build` | compliance → lore → types → server → web |
| `pnpm dev:all` | API (:3001) + web (:5173) concurrently |
| `pnpm dev:web` / `pnpm dev:server` | Single process |
| `pnpm test` | Vitest across packages (hermetic) |
| `pnpm screenshots` | Drive the built app (offline simulation, own server + throwaway PGlite) and capture every production-reachable screen → `screenshots/<mobile|desktop>/` (`--viewport`, `--out`, `--photo`, `--only`, `--full-page`, `--headed`, `--keep`, `--base-url`) |
| `pnpm scan-costs` | Token/cost audit from the local DB |
| `pnpm --filter @ecocide/server db:reset-allowance` | One-off repair: re-base every wallet onto the current allowance, writing a reconciling ledger entry |
| `pnpm wireframes` | Convert `models-src/*.obj` → `apps/web/src/lib/asset-wireframes.ts` (face meshes **and** `l` line elements, e.g. the earth graticule) |
| `pnpm --filter @ecocide/server db:generate` | drizzle-kit generate (schema → `apps/server/drizzle`) |

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
4. **DB discipline**: no `*.db*`, `data/pgdata*` or `data/evidence/` in git;
   schema changes go through `drizzle-kit generate` (`pnpm --filter
   @ecocide/server db:generate`); never hand-write DDL. Money/credits are
   `integer` units and aggregates (`count(*)`, `sum(...)`) must be wrapped in
   `Number(...)` — `pg` returns bigint as a string.
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
- [`deploy/gcp/README.md`](deploy/gcp/README.md) — Cloud Run + Cloud SQL
  deployment runbook (setup, releases, rollback).
- `art_directions.md` — visual style bible (§-numbered; the source of truth
  for colors, tiers, stamps, lenses, motion, copy rules).
- `compliance_formula.md` — the base item-level formula implemented verbatim
  by `packages/compliance`.
- `readme/sustainability_scoring_framework.md` — the extended framework
  (Step-5 overrides, size-weighted roll-up, title drivers, modifiers).