# ECOCIDE — Carbon Excess Eliminator

> A satirical dystopian environmental-bureaucracy app: point a camera at your
> **household**, and the **AI Supreme Arbiter of Consumption** detects the
> objects, weighs them against the planet, and files an official verdict.
> Your only defence is a credible pledge.

The app: you photograph a room (webcam or upload). The server runs a
**two-pass pipeline** — a vision model inventories the objects (counts,
bounding boxes, per-dimension 1–5 ratings), deterministic math
(`packages/compliance`) rolls those up into a **Household Sustainability
Index** and a tier (Carbon Neutral Legend → Environmental Disaster Zone), and
a second model prompt writes the deadpan bureaucratic verdict plus concrete
improvement **suggestions**. You can CLAIM your designation (mock paywall) or
APPEAL it (mock filing fee; accepted appeals re-arbitrate against the stored
item list). The archived photo lives on disk; the database stores only its
file name.

Without AI tokens everything still runs: the server degrades to a seeded
offline simulation, so tests, the dev bench and local development cost
nothing.

## Stack

- pnpm workspace monorepo: `packages/compliance` (formula math),
  `packages/lore` (story+art), `packages/types` (contracts + derived
  taxonomy), `apps/server` (Hono + SQLite/Drizzle + Gemini + BullMQ + Better
  Auth), `apps/web` (React 19 + Vite + Tailwind v4 + PWA).
- Deterministic compliance math — the tier, the stamps, the titles: no AI
  tokens needed for the core loop.

## Quick start

```bash
pnpm install
pnpm build          # builds compliance → lore → types → server → web
pnpm dev:all        # API on :3001, web on :5173
pnpm test           # vitest (hermetic — no Redis/SMTP/API key needed)
```

Environment: copy `.env.example` to `.env`. Everything is optional — without
Gemini credentials the server uses the offline simulated audit, without
`SMTP_HOST` emails are logged, without `REDIS_URL` jobs run inline.

### Gemini billing: Vertex AI vs API key

The audit engine runs through `@google/genai` on either:

- **Gemini Developer API** — set `GEMINI_API_KEY`. Usage is billed by AI Studio.
- **Vertex AI (recommended for production)** — bills to your GCP project's
  Cloud billing account instead. Set `GEMINI_MODE=vertex` (auto-detected when
  unset), `GEMINI_PROJECT=<project id>`, and provide credentials via
  `GCP_SA_KEY` (inline service-account JSON) or
  `GOOGLE_APPLICATION_CREDENTIALS` (ADC file path). The endpoint defaults to
  `global`. Override with `GEMINI_LOCATION` if your region serves the model.
  The model defaults to `gemini-3.8-flash`; override with `GEMINI_MODEL`.

Each scan = two model calls (inventory + classification), both logged to the
cost audit (`pnpm scan-costs`).

## Zero-token workflow

1. `pnpm dev:all` and open <http://localhost:5173/debug> — the bench ships
   six **exhibit rooms**, one per tier, generated entirely offline.
2. Upload a room photo (or use the camera) and scan — the server runs the
   simulated audit when no AI credentials are configured.
3. Claim/appeal: the email-OTP code prints to the server console; appeal
   rulings and emails are simulated/logged locally.
4. Archived evidence photos land in `apps/server/data/evidence/`
   (override with `EVIDENCE_DIR`).

## Repository layout

```
packages/
  compliance/  # the compliance formula: weights, Harm Score, SI, statuses,
               # household roll-up, item dedupe/sanitize
  lore/        # THE STORY + ARTWORK SURFACE (world copy, tiers, prompts,
               # offline simulation — see STORY.md)
  types/       # contracts; derives the taxonomy (tiers) from lore
apps/
  server/      # Hono API, DB (Drizzle/SQLite), Gemini two-pass engine,
               # evidence file store, BullMQ jobs, nodemailer, Better Auth registry
  web/         # React PWA: intro → audit → verdict → claim/appeal → registry
charts/        # Helm chart (placeholder branding — mount a volume at
               # EVIDENCE_DIR in production)
```

## Deploy

Dockerfile + `charts/ecocide` are carried over from the fork; image and Helm
values are re-named to `ecocide`. Mount a persistent volume at the evidence
directory (`EVIDENCE_DIR`) and run migrations via the chart's migrate init
container (`AUTO_MIGRATE=false` for app pods).

See [`AGENTS.md`](AGENTS.md) for the developer/agent brief,
[`STORY.md`](STORY.md) for the lore-pack authoring guide,
[`art_directions.md`](art_directions.md) for the visual bible, and
[`compliance_formula.md`](compliance_formula.md) for the score formula.