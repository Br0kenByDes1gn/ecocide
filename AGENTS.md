# AGENTS.md // Ecocide Technical Blueprint

Welcome to **Ecocide (placeholder working title)** — a fork of the Aipocalypse
biometric-classification flow with a completely re-skinnable story/art surface.

## 1. What this project is

A satirical web app/PWA: a camera or photo scan extracts 478 facial landmarks
locally (MediaPipe WASM), a **deterministic distance-shell classifier** places
the face into a configurable **classification taxonomy** (any number of classes,
any quotas; placeholder pack = Class I–VI, 17/17/17/17/16/16 %), and a verdict
engine ("the **Carbon Minded AI**") renders an official bureaucratic verdict —
via Gemini when `GEMINI_API_KEY` is set, via a deterministic offline simulation
when it isn't. The verdict page offers **CLAIM** (mock paywall → dossier) and
**APPEAL** (mock filing fee → archived ruling; accepted appeals re-arbitrate
against the archived photo snapshot). An **Asset Vault** (Better Auth email-OTP
accounts, token wallet, ledger) backs the mock payments.

## 2. Hard architectural rule — the lore seam

**All story, copy and art live in `packages/lore`** (dependency-free package:
data + string templates). The apps consume it; `packages/types` derives the
taxonomy from it. Do not reintroduce story into components, prompts, or the
server. The lore pack is currently a **neutral placeholder** — every string is
meant to be replaced (`TODO-LORE` markers). See `STORY.md` for the authoring
guide and the full inventory of slots.

Key conventions:
- **Internal storage names persist** (`caste`, `biocarbon_ratio`, `/api/citizen`,
  `OraclePayload`…) — they are API/DB identifiers, not display copy. Display
  vocabulary comes from the pack (`getFaction(id).name`, `IDENTITY.*`, etc.).
- The taxonomy is **data-driven**: `packages/lore/src/factions.ts` defines the
  ordered faction list with `quotaPct` shares (sum = 100) and an overflow
  bucket; percentile thresholds, populations, bands and the distance-shell
  bands in `apps/web/src/lib/face-geometry.ts` are **derived** — never hardcode
  them in both places again.
- React components must never render a raw faction id: use `getFaction(caste).name`.

## 3. Monorepo layout

```
packages/lore/     # THE STORY + ART SURFACE (identity, factions, prompts, simulate, art)
packages/types/    # contracts only; derives Caste/FactionId + census from lore
apps/server/       # Hono + SQLite (Drizzle) + Gemini + BullMQ + Better Auth + nodemailer
apps/web/          # React 19 + Vite + Tailwind v4 + PWA (intro → scan → verdict → claim/appeal → vault)
charts/            # Helm chart (placeholder branding)
scripts/           # scan-cost audit
```

Build order matters: `lore → types → server → web` (root `pnpm build` handles it).

### packages/lore (new — the heart of the fork)

- `identity.ts` — app name, version, **`entityName: 'Carbon Minded AI'`**,
  tagline, world population.
- `factions.ts` — the ordered taxonomy with quota shares, colors, census
  copy, life-stage titles, paragraph topics (icon keys), per-faction prompt
  blocks, per-faction simulated verdict copy, per-faction badge `stylePrompt`,
  and the derivation helpers (thresholds/bounds/populations/percentile→class).
- `prompts.ts` — placeholder prompt builders for verdict / appeal /
  re-arbitration (JSON contract keys like `biocarbon_ratio` must stay).
- `simulate.ts` — deterministic offline verdict/ruling copy.
- `art.ts` — shared palette + confetti tokens (JS side; `index.css` mirrors).

### apps/server

- `POST /api/oracle/scan` — multimodal scan; optional `email` queues the
  verdict email (recipient is never persisted).
- `GET /api/citizen/:id`, `POST /api/citizen/:id/avatar`, `POST /api/citizen/:id/appeal`,
  `GET /api/citizen/:id/appeals`, `POST /api/citizen/:id/appeals/:appealId/apply`.
- `GET /api/vault`, `POST /api/vault/link`, `POST /api/vault/charge`,
  `GET /api/vault/ledger`, `/api/auth/*` (Better Auth email-OTP).
- `GET /admin/queues` Bull Board (BullMQ mode + Basic auth only).
- Prompt assembly is thin: `src/gemini.ts` wraps `@ecocide/lore` builders and
  parses JSON; all world copy comes from the pack.
- DB: `node:sqlite` + Drizzle, WAL mode, explicit `initDb()`/`createRepositories()`
  factories; migrations via drizzle-kit, applied at boot (`AUTO_MIGRATE=false`
  to defer); never commit `*.db*` files.

### apps/web

- SPA flow in `src/App.tsx` (`/`, `/scan`, `/citizen/:id`, `/arbitration/:id`,
  `/claim/:id`, `/appeal/:id`, `/appeals/:id`, `/vault`, dev-only `/debug`).
- `src/lib/face-geometry.ts` — the deterministic classifier (630-combo shell;
  derives bands from the lore pack) + stability/flip-rate tests.
- `src/lib/polygon-portrait.ts` — four canvas portrait render styles
  (placeholder engine palettes; per-faction colors come from the pack).
- Copy: neutral placeholders live inline in components today (optional future
  refactor: hoist every string into `lore/ui.ts`); never reintroduce old
  Aipocalypse canon.

## 4. Commands

| Command | Action |
| --- | --- |
| `pnpm install` | Install all workspace deps |
| `pnpm build` | lore → types → server → web |
| `pnpm dev:all` | API (:3001) + web (:5173) concurrently |
| `pnpm dev:web` / `pnpm dev:server` | Single process |
| `pnpm test` | Vitest across packages (hermetic) |
| `pnpm scan-costs` | Token/cost audit from the local DB |

Dev without AI tokens: `/debug` bench (preset verdicts for every class),
`sample_face.png`, simulated verdicts (no `GEMINI_API_KEY`), OTP printed to the
server console, emails logged via jsonTransport (no SMTP), inline job dispatcher
(no Redis).

## 5. Guidelines for agents

1. **Story → lore only.** No old-canon words outside `packages/lore`
   (brand, caste names, etc.). Verification:
   `pnpm build && pnpm test`, then the grep gate (below).
2. **Rebuild after touching `lore` or `types`**: `pnpm --filter @ecocide/lore build && pnpm --filter @ecocide/types build` before server/web builds.
3. **Taxonomy changes** (class count/quotas) touch `lore/factions.ts` only;
   thresholds/populations come along automatically — keep the invariant tests
   (quotas sum to 100, monotonic thresholds, band/percentile consistency,
   stability/flip-rate) green.
4. **DB discipline**: no `*.db*` in git; schema changes go through
   `drizzle-kit generate`; never hand-write DDL.
5. **Display vs storage**: `caste`/`biocarbon_ratio` stay in code/DB/API;
   all user-facing strings are pack-driven.
6. **Markdown links** to files in responses: `[file](file:///path)`.
7. **Always run `pnpm test`** before finishing a task.

### Grep gate (old canon must not leak)

```bash
rg -i -n "aipocalypse|supreme arbiter|neon grid|mainframe|biocarbon(?!_ratio)|redundan|overlord|enforcer|bootlick|untouchable|free spirit" apps packages --pcre2 | grep -vE "CASTE|caste"
```

(Internal `caste`/`biocarbon_ratio` identifiers are exempt.)

## 6. Related docs

- [`STORY.md`](STORY.md) — lore-pack authoring handbook (every slot, taxonomy
  mechanics, prompts, art, workflow).
- [`README.md`](README.md) — user-facing overview + quick start.