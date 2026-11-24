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
  taxonomy), `apps/server` (Hono + PostgreSQL/Drizzle + Gemini + BullMQ + Better
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

### Database: Postgres everywhere, PGlite locally

The server speaks **PostgreSQL** — `pg` when `DATABASE_URL` is set, and
[PGlite](https://pglite.dev) (a full PostgreSQL compiled to WASM, in-process)
when it is not. Local dev and `pnpm test` therefore need no database server and
no Docker, while running the same schema, the same SQL and the same drizzle-kit
migrations as production.

`apps/server/data/pgdata/` holds the local database and persists across
restarts. Two caveats that come with an embedded engine:

- It is **single-process**: the server takes an advisory lock
  (`data/pgdata.lock`), so a second dev server — or `pnpm scan-costs` while the
  server is running — reports a clear error instead of corrupting the directory.
- If a directory *is* damaged (e.g. two processes initialized it at once),
  delete it and start fresh: `rm -rf apps/server/data/pgdata`.

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

## Performance

`pnpm bench` measures the audit pipeline and the API by driving a real server
process over HTTP, and `pnpm bench:report` renders the results into
[`docs/performance/PERFORMANCE.md`](docs/performance/PERFORMANCE.md) with charts.

```bash
pnpm build          # the bench spawns apps/server/dist
pnpm bench:matrix   # PGlite + Postgres, offline (free — no tokens)
pnpm bench --db=postgres --mode=live --live-n=5 --live-confirm=yes   # real tokens
pnpm bench:report   # regenerates the report + charts from docs/performance/data/
```

## Screenshots

[`screenshots/`](screenshots/README.md) is a browsable gallery of every screen a
production visitor can reach — landing, scanner, verdict, claim, appeal,
registry, injunction, informant, credits and the grid — at phone and desktop
sizes. It is generated, not hand-captured:

```bash
pnpm build                  # the script spawns apps/server/dist + apps/web/dist
pnpm screenshots            # both viewports → screenshots/{mobile,desktop}/ + README
pnpm screenshots --viewport mobile
pnpm screenshots --only verdict,grid   # write only these frames
```

It boots its own server against a throwaway PGlite directory and forces the
offline simulation (`GEMINI_MODE=off`), so a full run costs nothing and never
touches your dev database. The evidence photo is
[`scripts/fixtures/demo-scan.jpg`](scripts/fixtures/demo-scan.jpg) (metadata
stripped; override with `--photo`), and the one-time registry code is read from
the server's own log. Requires `pnpm exec playwright install chromium` once.

Each run provisions a **throwaway** database (a fresh PGlite directory, or a
disposable `postgres:17-alpine` container) and a throwaway evidence directory, so
`apps/server/data` is never touched. Offline runs force `GEMINI_MODE=off` and cost
nothing; live runs are gated behind `--live-confirm=yes`. Per-pass latency comes
from the `scan_api_logs` rows the server writes (including the `scan_total` row
that records each audit's true wall clock), and the report is a pure function of
the JSON in `docs/performance/data/`.

## Repository layout

```
packages/
  compliance/  # the compliance formula: weights, Harm Score, SI, statuses,
               # household roll-up, item dedupe/sanitize
  lore/        # THE STORY + ARTWORK SURFACE (world copy, tiers, prompts,
               # offline simulation — see STORY.md)
  types/       # contracts; derives the taxonomy (tiers) from lore
apps/
  server/      # Hono API, DB (Drizzle/PostgreSQL, PGlite locally),
               # Gemini two-pass engine, evidence file store, BullMQ jobs,
               # nodemailer, Better Auth registry
  web/         # React PWA: intro → audit → verdict → claim/appeal → registry
charts/ecocide/  # the deployment: one Helm chart (app + Postgres + Redis + evidence
                 # volume + ingress), installable on any cluster
Tiltfile       # dev loop on minikube: build the image, `helm upgrade --install`
deploy/gcp/    # LEGACY Cloud Run + Cloud SQL setup, kept as the migration source
```

## Deploy

The app ships as **one container** that serves the API and the built SPA on the
same origin (the session cookie is same-origin and the web app calls `/api/*`
relative paths), so it is one Deployment plus its data:

```bash
kubectl create namespace ecocide
cp charts/ecocide/values.production.example.yaml ~/.config/ecocide/values.production.yaml
$EDITOR ~/.config/ecocide/values.production.yaml   # chmod 600 — it holds the credentials
helm upgrade --install ecocide charts/ecocide -n ecocide \
  -f ~/.config/ecocide/values.production.yaml --set image.tag=v0.1.0 \
  --atomic --wait --timeout 15m
```

Every credential (database password, auth secret, Gemini key, SMTP) lives in
`secrets.data` in that file, which is gitignored and kept outside the repo — the
chart renders the Secret from it. See
[`charts/ecocide/README.md`](charts/ecocide/README.md) for values, secrets,
backups, upgrade/rollback and troubleshooting.

The chart bundles PostgreSQL and Redis (no operators) and runs drizzle-kit
migrations in an init container before the new pod serves traffic. Audit photos
stay files on a volume, never database blobs. See
[`charts/ecocide/README.md`](charts/ecocide/README.md) for values, backups,
upgrade/rollback and troubleshooting.

Images are built and published to GitHub Container Registry by
[`.github/workflows/build-image.yml`](.github/workflows/build-image.yml): every
push to `main` publishes `sha-<7>`, `main` and `latest`; a `v*` tag also publishes
`X.Y.Z` and `X.Y`. Pin `image.tag` in your values file — a private package also
needs an `imagePullSecrets` entry.

For the local loop: `tilt up` builds the image into minikube and drives a real
`helm upgrade --install` (`GEMINI_MODE=off`, so audits are the deterministic
simulation until you pass `ECOCIDE_GEMINI_MODE=api GEMINI_API_KEY=…`).

Moving an existing deployment's data in:

```bash
./scripts/copy-from-gcp.sh --namespace ecocide            # dry run
./scripts/copy-from-gcp.sh --namespace ecocide --apply
```

That exports the Cloud SQL database, restores it into the release, streams the
evidence bucket onto the volume and verifies every dossier's photo is present.
The previous **Cloud Run + Cloud SQL** deployment is still described in
[`deploy/gcp/README.md`](deploy/gcp/README.md) — it is the source those scripts
read from, not the target.

See [`AGENTS.md`](AGENTS.md) for the developer/agent brief,
[`STORY.md`](STORY.md) for the lore-pack authoring guide,
[`art_directions.md`](art_directions.md) for the visual bible,
[`compliance_formula.md`](compliance_formula.md) for the score formula, and
[`docs/performance/PERFORMANCE.md`](docs/performance/PERFORMANCE.md) for the
measured performance report.