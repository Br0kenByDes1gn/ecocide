# ECOSIDE — placeholder working title

> **Status: provisional.** This is a fork of the Aipocalypse biometric-classification
> flow, rebuilt so the **entire story and artwork live in one package**
> (`packages/lore`), shipped with a **neutral placeholder pack** (ECOCIDE /
> Carbon Minded AI / Class I–VI). The mechanics (face scan → deterministic
> classification → verdict → claim/appeal/vault) are fully functional today;
> the world is yours to write. Start with [`STORY.md`](STORY.md).

The app: you point a webcam (or upload a photo) at yourself; MediaPipe extracts
478 facial landmarks locally in WASM; a deterministic "distance shell" maps the
face into the classification taxonomy (any number of classes, any quotas — the
placeholder pack ships six); the server then renders a verdict — via Gemini when
`GEMINI_API_KEY` is set, or a deterministic offline simulation when it isn't.
You can CLAIM your designation (mock payment) or APPEAL it (another mock
payment, accepted appeals get re-arbitrated against your archived photo).

## Stack

- pnpm workspace monorepo: `packages/lore` (story+art), `packages/types`
  (contracts + derived taxonomy), `apps/server` (Hono + SQLite/Drizzle +
  Gemini + BullMQ + Better Auth), `apps/web` (React 19 + Vite + Tailwind v4 +
  PWA).
- Deterministic classification is client-side and free: no AI tokens needed
  for the core loop.

## Quick start

```bash
pnpm install
pnpm build          # builds lore → types → server → web
pnpm dev:all        # API on :3001, web on :5173
pnpm test           # vitest (hermetic — no Redis/SMTP/API key needed)
```

Environment: copy `.env.example` to `.env`. Everything is optional — without
`GEMINI_API_KEY` the server uses the offline simulation verdict, without
`SMTP_HOST` emails are logged, without `REDIS_URL` jobs run inline.

## Zero-token workflow

1. `pnpm dev:all` and open <http://localhost:5173/debug> — the debug bench
   generates presets for every classification and needs no webcam.
2. `pnpm dev:web` + upload a photo, or use the bundled `sample_face.png`.
3. Scan → arbitration uses the deterministic simulated verdict.
4. Claim/appeal: the email-OTP code prints to the server console; appeal
   rulings and emails are simulated/logged locally.

## Repository layout

```
packages/
  lore/        # ← THE STORY + ARTWORK SURFACE (rewrite this, see STORY.md)
  types/       # contracts; derives the taxonomy (Caste/FactionId) from lore
apps/
  server/      # Hono API, DB (Drizzle/SQLite), Gemini verdict engine,
               # BullMQ jobs, nodemailer, Better Auth vault
  web/         # React PWA: intro → scan → verdict → claim/appeal → vault
charts/        # Helm chart (placeholder branding)
```

## Deploy

Dockerfile + `charts/ecocide` are carried over from the fork; image and Helm
values are already re-named to `ecocide` but branding is placeholder.

See [`AGENTS.md`](AGENTS.md) for the developer/agent brief and
[`STORY.md`](STORY.md) for the lore-pack authoring guide.