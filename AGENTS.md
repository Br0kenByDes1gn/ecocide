# AGENTS.md // AI Supreme Arbiter Technical Blueprint

Welcome to the **AI Supreme Arbiter (Ecocide)** codebase. This document serves as the primary system briefing for AI agents, pairing assistants, and developers contributing to this repository.

---

## 1. Project Overview & Core Mission

**AI Supreme Arbiter** is a satirical dystopian web application and Progressive Web App (PWA). It simulates an unyielding corporate AI Mainframe that biometrically scans human users via webcam or uploaded photos, deterministically classifies them into a dystopian caste hierarchy, and delivers biting, personalized bureaucratic verdicts regarding their assigned societal duties and incident logs.

### Key Architectural Pillars
- **Deterministic Biometrics**: Facial geometry extracted locally in WASM (MediaPipe) produces reproducible caste hashes and compliance scores.
- **Visual Grounding with Gemini**: Google Gemini (Gemini 2.5/3.8 Flash) analyzes facial expression, clothing, accessories, and grooming to deliver tailored, sarcastic incident logs.
- **Zero AI-Token Debugging**: A dedicated testbench at `/debug` allows full simulation, manual parameter tuning, and canvas portrait experimentation without invoking LLM APIs.
- **Client-Side Cyberpunk Rendering**: Real-time canvas shaders, HUD reticles, audio synthesizers, and procedural facet rendering.

---

## 2. Monorepo Architecture & Workspaces

The codebase is structured as a **pnpm workspace monorepo**:

```
ecocide/
├── apps/
│   ├── server/             # Backend API & AI Gateway (Hono + SQLite + Gemini)
│   │   ├── src/
│   │   │   ├── avatar/       # Pluggable Avatar Synthesis Engine Registry
│   │   │   ├── db/           # Drizzle ORM layer: client (init), schema, migrate, repositories
│   │   │   ├── email/        # nodemailer mailer + typed verdict/appeal email templates
│   │   │   ├── jobs/         # BullMQ queue/worker (in-process) + typed job handlers
│   │   │   ├── gemini.ts     # Multimodal Vision & Sarcastic Verdict Pipeline
│   │   │   └── index.ts      # Hono REST endpoints & SPA static asset serving
│   │   ├── drizzle/          # drizzle-kit migration history (committed)
│   │   └── data/             # SQLite database directory (dossiers.db - git-ignored)
│   └── web/                # Cyberpunk Frontend (React 19 + Vite + Tailwind + PWA)
│       ├── src/
│       │   ├── components/ # CameraScanner, CitizenDossier, DebugBench, etc.
│       │   ├── lib/        # mediapipe-service, polygon-portrait, face-geometry, audio
│       │   └── App.tsx     # Router & primary user flow
├── packages/
│   └── types/              # Shared TypeScript contracts & domain logic
│       └── src/            # Interfaces, caste percentages, simulation engine
├── scripts/                # Utility scripts (scan cost reports, etc.)
├── IDEA.md                 # Original game design and technical specification
├── ART_DIRECTION.md        # Visual style bible: hex palettes, caste identities, render styles, artwork prompts
└── README.md               # User-facing project overview & deployment guide
```

### Workspace Packages

1. **`@ecocide/types` ([`packages/types`](file:///home/zaro/dev/ecocide/packages/types))**:
   - Contains single-source-of-truth TypeScript definitions: [`CitizenRecord`](file:///home/zaro/dev/ecocide/packages/types/src/index.ts), [`BiometricTelemetry`](file:///home/zaro/dev/ecocide/packages/types/src/index.ts), [`OraclePayload`](file:///home/zaro/dev/ecocide/packages/types/src/index.ts), [`AvatarEngineId`](file:///home/zaro/dev/ecocide/packages/types/src/index.ts).
   - Houses the deterministic mock engine [`simulateOracleClassification()`](file:///home/zaro/dev/ecocide/packages/types/src/index.ts).
   - **Crucial Note**: After modifying files in `packages/types/src`, run `pnpm build` so `packages/types/dist` is updated for consuming apps.

2. **`@ecocide/server` ([`apps/server`](file:///home/zaro/dev/ecocide/apps/server))**:
   - Built on [Hono](https://hono.dev/) with `@hono/node-server`.
   - Primary endpoints:
     - `POST /api/oracle/scan`: Multimodal scan analyzing image + biometric telemetry. The client sends a **downscaled ~360px snapshot** as the vision `image`; the same snapshot is archived as `source_snapshot` and reused for vision-grounded re-arbitrations. Accepts an **optional `email`** — when present (and valid), a verdict email is queued to that address.
     - `GET /api/citizen/:id`: Retrieves saved dossier record by permanent NanoID.
     - `POST /api/citizen/:id/avatar`: Queues background avatar synthesis or regeneration (BullMQ job, retried).
     - `POST /api/citizen/:id/appeal`: Arbitrates a citizen appeal (small text-only Gemini ruling, simulation fallback) and **persists the filing + ruling** in the `appeals` table (the re-classification is applied only when the citizen re-arbitrates). Accepts an **optional `email`** — when present (and valid), the ruling is queued to that address.
     - `GET /api/citizen/:id/appeals`: Lists every stored appeal for a dossier (newest first).
     - `POST /api/citizen/:id/appeals/:appealId/apply`: Applies an accepted appeal by re-running the **original multimodal oracle prompt** against the archived photo snapshot (new caste; the appeal is acknowledged only in paragraph 1), then rewrites the archive and returns the refreshed record.
     - `GET /api/avatar/engines`: Lists active avatar synthesis engines.
     - `POST /api/auth/*`: **Better Auth** email-OTP identity handler (session cookie / bearer). New emails are auto-registered on first sign-in.
     - `GET /api/vault`: Returns the signed-in citizen's **Asset Vault** — wallet (credits), aggregate `stats`, lightweight claimed-dossier summaries and the most recent ledger page.
     - `GET /api/vault/ledger`: A paginated wallet-ledger slice (`limit` clamped 1–100, `offset`) plus the total count.
     - `POST /api/vault/link`: Binds a freshly-scanned anonymous dossier to the vault and charges the certification fee from it (idempotent per dossier; seeds the vault with the token allowance on first use).
     - `POST /api/vault/charge`: Draws a fixed fee (e.g. the appeal filing fee) from the vault and records it in the ledger; used by every non-claim payment screen.
     - `GET /api/health`: Health status and database connectivity.
     - `GET /admin/queues`: Bull Board queue dashboard (Basic auth; BullMQ mode only).
   - Database: **Drizzle ORM** over Node's embedded SQLite (`node:sqlite` via `DatabaseSync`) configured in Write-Ahead Logging (`WAL`) mode with `busy_timeout = 5000` and `foreign_keys = ON`. Layer lives in [`apps/server/src/db/`](file:///home/zaro/dev/ecocide/apps/server/src/db): `client.ts` (`initDb()` — explicit connection factory, never opens at module load), `schema.ts` (Drizzle table definitions, single source of truth for DDL — including the Better Auth `user`/`session`/`account`/`verification` tables and the Asset Vault `wallets`/`wallet_ledger` tables), `migrate.ts` (`runMigrations()` applies drizzle-kit migrations at boot), `repositories.ts` (`createRepositories(db)` — the async repository functions routes call). Repository functions are `async` even though the driver is synchronous, so the signatures are stable when the app later moves to PostgreSQL.
   - Email: **nodemailer** in [`apps/server/src/email/`](file:///home/zaro/dev/ecocide/apps/server/src/email). `loadMailConfig()` reads `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM`, `MAIL_REPLY_TO` and `APP_BASE_URL`; `createMailer(config)` uses a pooled SMTP transport when `SMTP_HOST` is set, otherwise nodemailer's **`jsonTransport`** (messages are logged, never sent) so dev/tests need no SMTP. Typed templates live in `email/templates/` (verdict, appeal). The recipient address is **not persisted** — it is supplied per request via the optional `email` field; delivery always goes through the job queue.
   - Async jobs: **BullMQ + Redis** in [`apps/server/src/jobs/`](file:///home/zaro/dev/ecocide/apps/server/src/jobs). `createJobSystem({ redisUrl, context })` returns a `JobDispatcher` and (in BullMQ mode) the `Queue`. The worker runs **in-process** so it shares the SQLite connection; when `REDIS_URL` is unset it falls back to an **inline dispatcher** that runs handlers immediately (no Redis needed for local dev/tests). Job handlers — `email:verdict`, `email:appeal-ruling`, `email:otp`, `avatar:synthesize` — receive `{ repositories, mailer, appBaseUrl }`. Emails are deduped with deterministic `jobId`s; default jobs retry 5× with exponential backoff. Recurring jobs use BullMQ **Job Schedulers** (`dispatcher.schedule(id, cron, name, data)` → `upsertJobScheduler`).

3. **`@ecocide/web` ([`apps/web`](file:///home/zaro/dev/ecocide/apps/web))**:
   - React 19 + TypeScript + Vite.
   - Uses MediaPipe Face Landmarker via WebAssembly (`@mediapipe/tasks-vision`) to extract 478 3D facial coordinates.
   - Procedural Web Audio API sound generator in [`apps/web/src/lib/audio.ts`](file:///home/zaro/dev/ecocide/apps/web/src/lib/audio.ts) (cyberpunk hums, scanner beeps, alarm triggers).

---

## 3. Core Subsystems & Domain Rules

### A. Caste Target Distribution (100% Deterministic)
Caste classification is calculated in [`apps/web/src/lib/face-geometry.ts`](file:///home/zaro/dev/ecocide/apps/web/src/lib/face-geometry.ts) as a **distance shell over face-geometry space**:
- Three scale-invariant ratios are extracted from the 478 MediaPipe landmarks: `facialAspectRatio` (face height / cheek-to-cheek width), `jawTaperRatio` (jaw width / face width), and `eyeToNoseRatio` (eye distance / nose-to-chin).
- Each ratio is normalized into **equal-probability (quantile) bins** derived from a normal population model (`CASTE_RATIO_CALIBRATION`: μ/σ per ratio, Acklam inverse-normal quantiles) → **7 × 5 × 18 = 630 face-type combos**, each representing an equal slice of the population.
- The 630 combos are ranked by **z-distance from the population center** ([`buildCasteShellTable`](file:///home/zaro/dev/ecocide/apps/web/src/lib/face-geometry.ts), built once and cached): rank 0 is the statistically average face.
- **Quota bands** (6 / 19 / 32 / 25 / 25 / 523 = 1 / 3 / 5 / 4 / 4 / 83 %) assign castes over that distance-ordered axis — the innermost rings are the apex castes, the outermost ring is `Redundants` (the 83% overflow bucket). The displayed percentile sits inside each caste's threshold band, so the shared `getCasteFromPercentile` thresholds agree by construction.
- The verdict is **stable under re-scan noise**: the bins are far wider than MediaPipe measurement jitter, so the same face reliably yields the same caste (unit-tested <3% flip rate under ±0.004 ratio jitter).

Percentile thresholds:
- **Tech Overlords (1%)**: 99.0% – 100.0% percentile.
- **Enforcers (3%)**: 96.0% – 98.9% percentile.
- **Bootlickers (5%)**: 91.0% – 95.9% percentile.
- **Untouchables (4%)**: 87.0% – 90.9% percentile.
- **Free Spirits (4%)**: 83.0% – 86.9% percentile.
- **Redundants (83%)**: 0.0% – 82.9% percentile (marked for recycling).

### B. Biocarbon Compliance Ratio
- **User-Facing Display**: All UI cards, download badges, share texts, and AI prompt instructions refer to this metric as the **`Biocarbon Compliance Ratio`**.
- **Value**: a 0–100 percent ratio derived from the distance shell — ~85% template-conformity (`distance from the population center`) + ~15% facial symmetry. The statistically average face scores near 100; extreme outliers near 0.
- **Internal Storage**: Across SQLite columns, database queries, and backend schemas, this metric is stored as **`biocarbon_ratio`** (integer from `0` to `100`) — and as `biocarbonRatio` in TypeScript models. Do not rename the database column or API field.

### C. Biometric Portrait Rendering Engine
Implemented in [`apps/web/src/lib/polygon-portrait.ts`](file:///home/zaro/dev/ecocide/apps/web/src/lib/polygon-portrait.ts):
- **Default Visual Style**: **`neon-hologram`** (`NEON HOLO`) — translucent vector wireframe with neon halo glow.
- **Supported Styles**:
  1. `neon-hologram`: 100% vector holographic cyber-mesh with caste-themed rim lighting.
  2. `faceted-poly`: 3D shaded polygon facets sampled from facial photo colors with dynamic specular lighting.
  3. `surveillance-hud`: Grayscale surveillance camera feed with biometric vector overlay and targeting reticles.
  4. `thermal-flir`: False-color infrared FLIR thermal gradient map derived from facial depth/normals.
- **Centering & Framing Normalization**: Automatically centers the bounding box of the 478 facial landmarks to the canvas midpoint and scales the face to fill 90% of the viewport ([`transformLandmarksToFitFrame`](file:///home/zaro/dev/ecocide/apps/web/src/lib/polygon-portrait.ts)).

### D. Avatar Synthesis Provider Registry
Located in [`apps/server/src/avatar/registry.ts`](file:///home/zaro/dev/ecocide/apps/server/src/avatar/registry.ts):
- **Default Synthesis Protocol**: **`gemini-text-svg`** — generates compact, stylized vector SVG badges via Gemini text models.
- **Alternative Providers**: `gemini-image-vector` (raster flat vector), `gemini-image-pixel` (retro pixel art), and custom third-party engines via `AvatarProvider`.
- **Scanner UI**: The camera scanner HUD is kept clean and minimalist (avatar protocol selector removed); `/debug` retains full manual provider controls.

### E. Appeals & Re-Arbitration (Game Flow)
- **Flow**: `VERDICT DELIVERED` on `/arbitration/:id` offers **CLAIM** (`/claim/:id` → citizen dossier after paying the certification fee) and **APPEAL** (`/appeal/:id` → filing fee + appeal text). Both fees are drawn from the **Asset Vault** via the shared [`AssetVaultPayment`](file:///home/zaro/dev/ecocide/apps/web/src/components/AssetVaultPayment.tsx) terminal.
- **Storage**: every appeal + its ruling is persisted in the `appeals` table (`saveAppeal` / `getAppealsByDossier`), surfaced on `/appeals/:id` (latest prominent, browsable history). Screens: [`AppealScreen`](file:///home/zaro/dev/ecocide/apps/web/src/components/AppealScreen.tsx), [`AppealRecordsScreen`](file:///home/zaro/dev/ecocide/apps/web/src/components/AppealRecordsScreen.tsx).
- **Mock payments**: the terminal is simulated only — no real charge. Fees are debited from the vault ledger (claim binds the dossier via `/api/vault/link`; other fees via `/api/vault/charge`).
- **Deferred re-classification**: an accepted appeal never touches the archive until **RE-ARBITRATE AS NEW CASTE** (`POST /api/citizen/:id/appeals/:appealId/apply`), which re-runs the **original multimodal oracle prompt** against the archived `source_snapshot` (the ~360px photo the initial verdict saw), pins the new caste, and acknowledges the appeal **only in paragraph 1**. Rejected rulings offer **NEW APPEAL** / **ACCEPT VERDICT** (replay arbitration unchanged).
- **Paragraph 2 special case — Free Spirits**: no occupation — the Arbiter coldly projects their off-grid life as barely animal (wild fauna). Shared template in [`gemini.ts`](file:///home/zaro/dev/ecocide/apps/server/src/gemini.ts) applies to both the initial verdict and re-arbitration.
- **Snapshot source**: the client downscales the capture (~360px, [`downscaleImage.ts`](file:///home/zaro/dev/ecocide/apps/web/src/lib/downscaleImage.ts)); the same snapshot feeds the original vision verdict and is archived (`source_snapshot`) for re-arbitrations.

### F. Email & Async Job Queue (BullMQ)
- **Email (nodemailer)**: [`apps/server/src/email/`](file:///home/zaro/dev/ecocide/apps/server/src/email). `createMailer()` sends via a pooled SMTP transport when `SMTP_HOST` is set; otherwise it uses nodemailer's `jsonTransport` and logs the message, so no SMTP is required for development or tests. Templates are typed functions under `email/templates/` (verdict, appeal, vault OTP) sharing an inline-styled layout. Recipients are supplied per request (optional `email` on the scan / appeal payload) and are **not persisted**.
- **Job queue**: [`apps/server/src/jobs/`](file:///home/zaro/dev/ecocide/apps/server/src/jobs). Jobs are enqueued via a `JobDispatcher` and processed by an **in-process BullMQ worker** (it must share the app's SQLite connection/volume). Registered jobs: `email:verdict`, `email:appeal-ruling`, `email:otp`, `avatar:synthesize`. Emails use deterministic `jobId`s (`email:verdict:<dossierId>`) to dedupe; default options retry 5× with exponential backoff and prune completed/failed history. With **no `REDIS_URL`**, an inline dispatcher runs handlers immediately (fire-and-forget) so local dev/tests need no Redis.
- **Recurring tasks**: register via `dispatcher.schedule(id, cronPattern, name, data)`, backed by BullMQ **Job Schedulers** (`upsertJobScheduler`).
- **Bull Board**: queue dashboard mounted at `/admin/queues` **only in BullMQ mode**, protected by HTTP Basic auth (`BULL_BOARD_USER` / `BULL_BOARD_PASS`); disabled (404) when unset.
- **Environment**: `REDIS_URL`, `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM`, `MAIL_REPLY_TO`, `APP_BASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BULL_BOARD_USER`, `BULL_BOARD_PASS`. Local Redis: `docker compose -f docker-compose.dev.yml up -d`.

### G. Asset Vault (Accounts & Identity)
- **Concept**: a user account *is* the **Asset Vault** — a token wallet. There is **no login before playing**: scan → arbitration → verdict are fully anonymous, and the payment screen (`ClaimScreen`) presents the vault unlock instead of a card form.
- **Identity**: **Better Auth** (`better-auth@1.7.7`) with the `emailOTP` plugin (email + one-time code; no passwords) plus `bearer` for native shells. Configured in [`apps/server/src/auth/index.ts`](file:///home/zaro/dev/ecocide/apps/server/src/auth/index.ts) via `createAuth({ db, jobs, config })` (explicit factory, mirroring `initDb`/`createRepositories`), mounted at `/api/auth/*` before the SPA catch-all. `loadAuthConfig()` reads `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `APP_BASE_URL` (trusted origins); a dev fallback secret is used when `BETTER_AUTH_SECRET` is unset, and production requires it.
- **Schemas**: Better Auth owns `user`, `session`, `account`, `verification` (camelCase Drizzle keys over snake_case columns — the adapter looks up logical field names). The vault adds `wallets` (1:1 with `user.id`, `credits`) and `wallet_ledger` (auditable deltas). `dossiers.user_id` (nullable) binds an initially-anonymous dossier to a vault. Seeded allowance and fees live in `@ecocide/types` (`VAULT_ALLOWANCE`, `VAULT_CLAIM_FEE`, `VAULT_APPEAL_FEE`).
- **Shared payment terminal**: [`AssetVaultPayment.tsx`](file:///home/zaro/dev/ecocide/apps/web/src/components/AssetVaultPayment.tsx) is the single payment UI for **every** paywall — it handles the email-OTP unlock via the extracted [`VaultUnlock.tsx`](file:///home/zaro/dev/ecocide/apps/web/src/components/VaultUnlock.tsx) (skipped when already signed in) then authorizes the charge. It drives `POST /api/vault/link` (claim: binds the dossier + certification fee) or `POST /api/vault/charge` (plain fee, e.g. the appeal filing fee).
- **Vault dashboard**: [`VaultScreen.tsx`](file:///home/zaro/dev/ecocide/apps/web/src/components/VaultScreen.tsx) at `/vault` (header VAULT link) shows the balance, aggregate stats (credited/spent/count), a paginated transaction ledger (`/api/vault/ledger`, "load older") and the claimed-dossier summaries, with inline unlock when locked and sign-out when unlocked. Display formatting lives in [`vault-format.ts`](file:///home/zaro/dev/ecocide/apps/web/src/lib/vault-format.ts).
- **Flow**: `POST /api/auth/email-otp/send-verification-otp` → `POST /api/auth/sign-in/email-otp` (auto-registers, sets the session cookie, returns a token) → `POST /api/vault/link` with the current `dossierId`, which provisions the wallet on first use, deducts the claim fee exactly once, and links the dossier. `requireSession` ([`auth/middleware.ts`](file:///home/zaro/dev/ecocide/apps/server/src/auth/middleware.ts)) gates vault routes, accepting the cookie or an `Authorization: Bearer` header.
- **Sessions on the client**: web relies on Better Auth's **HttpOnly `session_token` cookie** (same-origin through the Vite proxy / prod static server). Native/Capacitor holds the sign-in token in secure storage and attaches it as a bearer header. The token is never written to `localStorage`. Client wiring: [`auth-client.ts`](file:///home/zaro/dev/ecocide/apps/web/src/lib/auth-client.ts), [`useVault.ts`](file:///home/zaro/dev/ecocide/apps/web/src/lib/useVault.ts), [`vault-api.ts`](file:///home/zaro/dev/ecocide/apps/web/src/lib/vault-api.ts).
- **Dev without SMTP**: the OTP is also printed to the server console (`[Auth] Vault unlock OTP for …`). `/api/auth/*` and `/api/vault/*` are excluded from the PWA service-worker cache (`vite.config.ts`).

---

## 4. Developer Workflows & Commands

All standard development tasks are orchestrated from the root:

| Command | Action |
| --- | --- |
| `pnpm install` | Install all dependencies across all workspace packages |
| `pnpm dev:all` | Start backend Hono API (port 3001) and frontend Vite server (port 5173) concurrently |
| `pnpm dev:web` | Start only the frontend Vite development server (`http://localhost:5173`) |
| `pnpm dev:server` | Start only the backend Hono API with `tsx watch` (`http://localhost:3001`) |
| `pnpm build` | Compile types (`tsc`), server (`tsc`), and web (`vite build`) in topological order |
| `pnpm test` | Run the complete Vitest suite across server and web (hermetic; no Redis or SMTP needed) |
| `pnpm scan-costs` | Run the token usage and cost accounting summary script |
| `docker compose -f docker-compose.dev.yml up -d` | Start local Redis for the BullMQ job queue (optional) |

---

## 5. Testing & Debugging Without AI Tokens

To develop, experiment, or write tests without burning Gemini API credits or requiring a webcam:

1. **Access the Debug Bench**:
   - Navigate to **`http://localhost:5173/debug`** in the browser.
   - Use the **Caste Preset Buttons** to instantly load any demographic caste.
   - Click **`Sample Face`** to execute MediaPipe landmark extraction on a pre-bundled test face (`sample_face.png`).
   - Use **`Biometric Portrait Lab`** to toggle between the 4 polygon render styles or inspect the side-by-side 4-style comparison grid.
2. **Offline Simulation Mode**:
   - When `GEMINI_API_KEY` is not present in the environment, the server automatically switches to [`generateSimulatedVerdict()`](file:///home/zaro/dev/ecocide/packages/types/src/index.ts), generating rich, satirical responses locally with zero external network requests.
3. **Job Queue Dashboard (Bull Board)**:
   - With `REDIS_URL` plus `BULL_BOARD_USER`/`BULL_BOARD_PASS` set, inspect and retry jobs at **`http://localhost:3001/admin/queues`**. Without them, jobs run inline and the dashboard is disabled. With no SMTP configured, outgoing emails are logged (`jsonTransport`) rather than sent.

---

## 6. Guidelines & Best Practices for AI Agents

When implementing changes or new features:

1. **Preserve Display vs Storage Separation**:
   - Keep `biocarbon_ratio` / `biocarbonRatio` in code models, APIs, and SQLite schema.
   - Present `Biocarbon Compliance Ratio` as a 0–100 percent on UI elements, badges, share strings, and user prompts.
2. **Rebuild Types When Edited**:
   - If you modify [`packages/types/src/index.ts`](file:///home/zaro/dev/ecocide/packages/types/src/index.ts), always run `pnpm build` so the compiled declaration files in `packages/types/dist` update.
3. **Database File Discipline**:
   - The SQLite database file [`apps/server/data/dossiers.db`](file:///home/zaro/dev/ecocide/apps/server/data/dossiers.db) is git-ignored. Do **NOT** force-add or commit SQLite database binaries (`*.db`, `*.db-wal`, `*.db-shm`) to git; replacing an active SQLite file breaks running file descriptors.
4. **Schema Changes Go Through drizzle-kit**:
   - The schema lives in [`apps/server/src/db/schema.ts`](file:///home/zaro/dev/ecocide/apps/server/src/db/schema.ts). For any table/column change, run `pnpm --filter @ecocide/server exec drizzle-kit generate --name=<slug>` (from `apps/server`) so the migration is applied on startup — never hand-write `ALTER TABLE` DDL in code. Migrations in `apps/server/drizzle/` are committed. In Kubernetes, the Helm chart's `migrate` init container applies them (`node dist/migrate-cli.js`); locally/plain docker they run at app boot via `runMigrations()` (or set `AUTO_MIGRATE=false` and use `node dist/migrate-cli.js` yourself).
   - The DB connection is created explicitly via `initDb()` (see [`index.ts`](file:///home/zaro/dev/ecocide/apps/server/src/index.ts)); repository functions are `async` and go through `createRepositories(db)`. Tests boot a throwaway temp database (temp dir + `runMigrations`), so the shared dev DB is never touched by `pnpm test`.
5. **Markdown Links**:
   - Whenever referencing code symbols or files in responses, create clickable links using standard GitHub file URI markdown syntax (e.g., [`CameraScanner.tsx`](file:///home/zaro/dev/ecocide/apps/web/src/components/CameraScanner.tsx)).
6. **Run the Test Suite**:
   - Before completing tasks, always run `pnpm test` to ensure all tests pass cleanly.

---

## 7. Related Documentation

- [`README.md`](file:///home/zaro/dev/ecocide/README.md): Quick start, deployment instructions, and mobile PWA/Capacitor setup.
- [`IDEA.md`](file:///home/zaro/dev/ecocide/IDEA.md): Original concept document, caste lore, and prompt extraction schemas.
- [`ART_DIRECTION.md`](file:///home/zaro/dev/ecocide/ART_DIRECTION.md): Visual style & art direction bible — exact color palettes (core neons + both caste color systems), typography, HUD/UI motifs, the four portrait render styles with thermal gradient stops, avatar badge generation prompts, and per-caste visual lore. Consult before generating any artwork or changing visual styling.
- [`apps/web/README.md`](file:///home/zaro/dev/ecocide/apps/web/README.md): Frontend framework and compiler notes.
