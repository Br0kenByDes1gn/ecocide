# Deploying ECOCIDE to Google Cloud (no Kubernetes)

Production shape:

```
Internet ──► Cloud Run service "ecocide" (:3000, HTTPS, managed cert)
               ├── serves the built SPA from /app/web/dist
               ├── talks to Cloud SQL (PostgreSQL) over the Cloud SQL unix socket
               ├── reads/writes audit photos on a mounted GCS bucket (/app/evidence)
               └── calls Vertex AI with the runtime service account's ADC
Cloud Run job "ecocide-migrate" applies drizzle-kit migrations, once per release
Artifact Registry holds the images; GitHub Actions deploys on tag push (WIF, no keys)
```

Everything is one container (API + SPA) because the web app calls `/api/*`
same-origin and auth is a `session_token` cookie.

## 0. Local development needs none of this

`pnpm dev` / `pnpm test` run on **PGlite** — a full PostgreSQL compiled to WASM that
runs in-process (`apps/server/data/pgdata`). No Docker, no server, no network. Setting
`DATABASE_URL` switches the same code to `pg`; that is the only difference between
local and production.

Two things to know about the local database:

- **It is single-process.** PGlite does not lock its directory, so the server takes an
  advisory pid lock (`data/pgdata.lock`). Starting a second dev server — or running
  `pnpm scan-costs` while the server is up — fails with a clear message instead of
  quietly interleaving two clusters.
- **A directory that was initialized twice cannot be opened.** The error says so;
  `rm -rf apps/server/data/pgdata` starts a fresh one.

## 1. One-time project setup

```bash
./deploy/gcp/setup.sh                 # PROJECT=... REGION=... GITHUB_REPO=owner/repo
```

Creates: the APIs, the Artifact Registry repo, the runtime and deployer service
accounts (+ their roles), the GitHub Workload Identity pool/provider bound to your
repository, the Cloud SQL instance/database/user, the evidence bucket, and the
`ecocide-db-url` / `ecocide-auth-secret` / `ecocide-smtp-pass` secrets.

Then add the real Brevo SMTP key (see `deploy/gcp/setup.sh` for the one-liner).

### Or: keep the whole config in a gitignored file

Typing fourteen env vars into a `gcloud` flag is error-prone and leaves no record of
what was set. `deploy/gcp/sync-env.sh` instead reads a local, **gitignored**
`.env.production` and pushes it where each key belongs:

```bash
cp deploy/gcp/env.production.example .env.production
$EDITOR .env.production          # secrets included; single-quote values with spaces
./deploy/gcp/sync-env.sh         # dry run — prints exactly what would change
./deploy/gcp/sync-env.sh --apply # write secret versions + update the service revision
```

| Key | Destination |
| --- | --- |
| `BETTER_AUTH_SECRET`, `SMTP_PASS`, `DATABASE_URL` | Secret Manager (new version; skipped when unchanged) |
| `NODE_ENV`, `AUTO_MIGRATE`, `EVIDENCE_DIR`, `BETTER_AUTH_URL`, `APP_BASE_URL`, `GEMINI_*`, `SMTP_*`, `MAIL_FROM`, `MAIL_REPLY_TO` | plain service env |
| anything else | **hard error** — a typo'd secret can't silently become a plain-text env var |

It never writes without `--apply`, never prints a value, refuses `GEMINI_API_KEY` /
`GCP_SA_KEY` (Vertex uses the runtime SA's ADC), and validates the invariants that
bite in production (`NODE_ENV`, `AUTO_MIGRATE=false`, secret length, the Cloud SQL
socket form). `--print-flags` emits the `--set-env-vars` / `--set-secrets` strings for
the first deploy, `--secrets-only` touches only Secret Manager, and `--file` points at
a different file.

Two mechanics worth knowing: `--update-env-vars` (merge) is used rather than
`--set-env-vars` (replace), so an existing revision can't lose its other vars; and
because a comma inside a value would corrupt a comma-separated flag, the script uses
gcloud's alternative delimiter (`^|^`) and rejects `|` in a value — `MAIL_FROM='ECOCIDE,
Bureau <no-reply@ecocide.quest>'` works, and the same string without that trick fails
with `Bad syntax for dict arg`.

> **Region note:** keep `REGION` consistent everywhere — Cloud Run and Cloud SQL must
> match so the unix socket works. `GEMINI_LOCATION` is unrelated: leave it `global`,
> since regional Vertex endpoints do not serve the 3.x models.

> **The repository string must match GitHub's claim exactly.** `GITHUB_REPO`
> defaults to this checkout's `origin` remote (`git remote -v`) and is used twice:
> in the WIF provider's attribute condition and in the IAM principalSet — both
> compare against GitHub's OIDC `repository` claim as a case-sensitive string. The
> default is normally right; if a tag push fails to authenticate, see
> *Troubleshooting* below.

## 2. Build and push an image

```bash
gcloud builds submit \
  --tag asia-southeast1-docker.pkg.dev/ecocide-511407/ecocide/ecocide:v0.1.0 .
```

This is also the first real test of the image: it runs the full workspace build, so a
pnpm/lockfile mismatch surfaces here rather than on a tag push.

## 3. Migrate job (DDL, once per release)

```bash
gcloud run jobs create ecocide-migrate \
  --region=asia-southeast1 \
  --service-account=ecocide-run@ecocide-511407.iam.gserviceaccount.com \
  --image=asia-southeast1-docker.pkg.dev/ecocide-511407/ecocide/ecocide:v0.1.0 \
  --set-cloudsql-instances=ecocide-511407:asia-southeast1:ecocide-pg \
  --set-secrets=DATABASE_URL=ecocide-db-url:latest \
  --command=node --args=dist/migrate-cli.js \
  --max-retries=1 --task-timeout=10m
```

`--service-account` is not optional. `setup.sh` puts every runtime permission on
`ecocide-run@` (Vertex, Cloud SQL, Secret Manager, the evidence bucket); omit the flag and
Cloud Run silently falls back to the **Compute Engine default service account**, which has
none of them — the job dies at create time with
`Permission denied on secret: … for Revision service account …-compute@developer.gserviceaccount.com`.

The app runs with `AUTO_MIGRATE=false`: DDL belongs to this job, not to cold starts.
(`gcloud run jobs` uses `--set-cloudsql-instances`; services use `--add-cloudsql-instances`.)

Then apply it:

```bash
gcloud run jobs execute ecocide-migrate --region=asia-southeast1 --wait
```

## 4. Deploy the service

```bash
gcloud run deploy ecocide \
  --region=asia-southeast1 \
  --service-account=ecocide-run@ecocide-511407.iam.gserviceaccount.com \
  --image=asia-southeast1-docker.pkg.dev/ecocide-511407/ecocide/ecocide:v0.1.0 \
  --allow-unauthenticated \
  --port=3000 \
  --cpu=1 --memory=1Gi --concurrency=8 \
  --min-instances=0 --max-instances=3 \
  --timeout=300 \
  --no-cpu-throttling \
  --execution-environment=gen2 \
  --add-cloudsql-instances=ecocide-511407:asia-southeast1:ecocide-pg \
  --add-volume=name=evidence,type=cloud-storage,bucket=ecocide-511407-evidence \
  --add-volume-mount=volume=evidence,mount-path=/app/evidence \
  --set-secrets=BETTER_AUTH_SECRET=ecocide-auth-secret:latest,DATABASE_URL=ecocide-db-url:latest,SMTP_PASS=ecocide-smtp-pass:latest \
  --set-env-vars='^|^NODE_ENV=production|AUTO_MIGRATE=false|EVIDENCE_DIR=/app/evidence|BETTER_AUTH_URL=https://ecocide.quest|APP_BASE_URL=https://ecocide.quest|GEMINI_MODE=vertex|GEMINI_PROJECT=ecocide-511407|GEMINI_LOCATION=global|GEMINI_MODEL=gemini-3.8-flash|SMTP_HOST=smtp-relay.brevo.com|SMTP_PORT=587|SMTP_SECURE=false|SMTP_USER=your-brevo-login@example.com|MAIL_FROM=ECOCIDE <no-reply@ecocide.quest>'
```

`--service-account=ecocide-run@…` for the same reason as the job — and here the failure is
quieter: without it the revision cannot inject secrets, has no `cloudsql.client` (the app
cannot reach the database) and no `aiplatform.user` (Vertex falls back to *offline
simulation*, which the release smoke test then refuses to deploy).

`--set-env-vars` uses gcloud's `^|^` alternative delimiter, because a comma in a value
(`MAIL_FROM`) would otherwise corrupt the flag; `./deploy/gcp/sync-env.sh --print-flags`
emits both long flags correctly formatted.

Flags that are not cosmetic:

| Flag | Why |
| --- | --- |
| `--service-account` | Everything the app is allowed to do lives on this identity. |
| `--no-cpu-throttling` | The OTP/verdict emails are sent after the HTTP response (fire-and-forget jobs). With throttled CPU the container is frozen at that point and **emails silently never send**. |
| `--concurrency=8`, `--max-instances=3` | One scan is two Gemini calls taking 15-30s. The default concurrency of 80 on a 1 GiB instance is an OOM and a bill. |
| `--add-volume` (GCS) | Audit photos are files (AGENTS.md rule 4) and are written once, never modified — safe on FUSE, and no code change. Swap to the GCS SDK inside `evidence.ts` if FUSE memory ever bites. |
| `AUTO_MIGRATE=false` | The migrate job owns DDL. |
| `--execution-environment=gen2` | Required for volume mounts. |

`SMTP_USER` must be your Brevo login address; `SMTP_PASS` is a **Brevo SMTP key** (SMTP & API → SMTP), not the API key. Verify `ecocide.quest` in Brevo and publish SPF/DKIM/DMARC — and merge `include:spf.brevo.com` into the single existing SPF record if you already have one.

## 5. Domain

```bash
# 1. ownership of the base domain, once per project (covers subdomains)
gcloud domains list-user-verified
gcloud domains verify ecocide.quest

# 2. the mapping — the GA `gcloud run domain-mappings create` is the old Cloud
#    Run for Anthos command; managed Cloud Run needs the beta variant
gcloud components install beta
gcloud beta run domain-mappings create \
  --service=ecocide --domain=ecocide.quest --region=asia-southeast1

# 3. the DNS records (also printed by step 2; empty until the mapping is Ready)
gcloud beta run domain-mappings describe --domain=ecocide.quest --region=asia-southeast1
```

Add every record under `status.resourceRecords` — for an apex domain that is **A and AAAA**
(add both, or IPv6-only clients fail); a subdomain gets a CNAME instead. Use `@` for the
apex and `www` for `www`.

Two DNS facts that break the *certificate*, not the app:

- **Cloudflare:** turn **off** "Always use HTTPS" (SSL/TLS → Edge Certificates). It
  intercepts the validation requests, so the mapping or its renewal fails.
- **CAA records:** authorize **both** `pki.goog` and `letsencrypt.org`.

Provisioning usually takes ~15 minutes but can take up to 24 hours. A mapping created
before its service exists stays `Ready: False, reason: RouteMissing` and retries every
minute — that is not an error to fix, and it emits no `resourceRecords` until the service
appears.

**Preview status:** Cloud Run domain mapping is a preview feature and Google's docs do not
recommend it for production services (latency). The production-grade alternative is a
global external Application Load Balancer in front of a serverless NEG (~$18-25/mo), which
also allows custom certificates, TLS 1.2-only and CDN/Armor. Also note you cannot use
wildcards, cannot upload your own certificate, cannot disable TLS 1.0/1.1, and can only map
to `/`.

Then re-deploy with `BETTER_AUTH_URL`/`APP_BASE_URL` set to the final origin. Those two
feed Better Auth's `trustedOrigins`, so a mismatch breaks the registry with a confusing
CORS error. Serve **one** canonical origin — mapping `www` too would break cookies there
instead of redirecting.

## 6. Releasing

Tag and push: `git tag v0.1.0 && git push --tags`. `.github/workflows/deploy-gcp.yml` then
verifies (`pnpm build && pnpm test`), builds and pushes the image, runs the migrate job on
the new tag, deploys a revision with **no traffic**, smoke-tests `/api/health` on the
tagged candidate URL, and only then shifts traffic. A failed smoke test leaves the previous
revision serving.

**Rollback:** Actions → *Deploy to Cloud Run* → *Run workflow* with the previous `image_tag`
(no rebuild, no migrations), or instantly:

```bash
gcloud run services update-traffic ecocide --region=asia-southeast1 \
  --to-revisions=<previous-revision>=100
```

Rolling the app back does not roll the schema back — keep migrations additive so the
previous revision keeps working against the new schema.

## Troubleshooting

### The auth step fails with an attribute-condition / invalid_grant error

The WIF provider only accepts tokens whose `repository` claim matches `GITHUB_REPO`
**exactly, including case**. If your owner name is mixed-case (`Br0kenByDes1gn`), verify
what GitHub actually sends instead of guessing — this workflow needs no GCP access:

```yaml
# .github/workflows/whoami.yml  (throwaway)
name: Who am I
on: { workflow_dispatch: }
permissions: { id-token: write, contents: read }
jobs:
  claims:
    runs-on: ubuntu-latest
    steps:
      - run: |
          TOKEN=$(curl -sS -H "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
            "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=ecocide" | jq -r .value)
          echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '{repository, repository_id, repository_owner, ref}'
```

Then repair the provider and the binding with whatever it printed:

```bash
gcloud iam workload-identity-pools providers update-oidc github-actions \
  --location=global --workload-identity-pool=github --project=ecocide-511407 \
  --attribute-condition="assertion.repository=='<exact claim value>'"

gcloud iam service-accounts remove-iam-policy-binding ecocide-deploy@ecocide-511407.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/757714368400/locations/global/workloadIdentityPools/github/attribute.repository/<old value>"
gcloud iam service-accounts add-iam-policy-binding ecocide-deploy@ecocide-511407.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/757714368400/locations/global/workloadIdentityPools/github/attribute.repository/<exact claim value>"
```

Re-running `deploy/gcp/setup.sh` with `GITHUB_REPO=<exact value>` also fixes both, it just
leaves the old principalSet member behind.

### The candidate smoke test fails

Its output is the whole point of the no-traffic step: the previous revision is still
serving, so nothing is broken for users. The assertions are deliberate —
`database == "PostgreSQL Active"` catches a wrong/unreachable DSN, `engine` starting
with `Vertex AI` catches a silent fallback to the offline simulation (the runtime
service account is missing `roles/aiplatform.user`), and `mail` catches a bad Brevo
key. `mail` is `checking` while the SMTP handshake runs in the background, so the test
waits for it to settle: `error` **fails the deploy**, `disabled` only warns (that's a
deliberate choice, not a misconfiguration).

`GET /api/health` therefore reports the active driver, the AI engine and the mail
status — check it by hand when anything smells off.

## Operating notes

- `GET /api/health` reports the active driver, the Gemini engine and the mail status
  (`smtp` / `disabled` / `error`). In CI all three are asserted: `PostgreSQL Active`,
  `Vertex AI …` — if the engine says *offline simulation*, the runtime service account
  is missing `roles/aiplatform.user` — and a mailer that isn't in a failing state.
- Config lives on the service, not in the repo: releases only swap the image, so a
  secret rotation reaches production on the next revision. See the `sync-env.sh`
  section above; `.env.production` is the gitignored source of truth.
- Cloud SQL is the only always-on cost (~$9-12/mo on `db-f1-micro`); Cloud Run scales
  to zero. **Set a billing budget alert** — every household scan is two paid Gemini calls
  on a public endpoint.
- The instance is created on the **Enterprise** edition, which is what makes a shared-core
  tier possible: new instances default to Enterprise Plus, where the cheapest tier is
  `db-perf-optimized-N-2` (roughly 10× the price). `db-f1-micro`/`db-g1-small` are not
  covered by the Cloud SQL SLA and have a low connection cap — bump with
  `SQL_TIER=db-g1-small ./deploy/gcp/setup.sh` if needed.
- Backups: Cloud SQL automated backups + PITR are enabled by `setup.sh`. The evidence
  bucket needs no backup (write-once objects); enable versioning if you want protection
  against accidental deletes.
- `pnpm scan-costs` reads whichever database it is pointed at (`DATABASE_URL` in prod, the
  local PGlite directory otherwise).
- The Helm chart was removed: this app ships as a single container, and the chart's
  `persistence`/`DB_PATH` wiring described the SQLite era.
