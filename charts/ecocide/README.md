# ECOCIDE — Helm chart

One container (Hono API + the built SPA), PostgreSQL, Redis for the BullMQ queue,
and a volume for the archived evidence photos. No operators required: the
database and the queue are plain StatefulSet/Deployment resources, so the chart
installs on a fresh minikube and on any cluster with a default StorageClass.

```
Internet ──► Ingress (ingress-nginx + cert-manager)
               └─► Service :3000 ─► Deployment (1 replica)
                                      ├─ initContainer: wait-for-postgres
                                      ├─ initContainer: migrate (drizzle-kit)
                                      ├─ app (API + SPA + BullMQ worker)
                                      └─ PVC /data/evidence
                                    StatefulSet postgres:17  ── PVC /var/lib/postgresql/data
                                    Deployment valkey:8      ── PVC (AOF)
```

## Install

### Development (minikube, offline Gemini, no tokens)

```bash
minikube start            # any running cluster works
helm install ecocide charts/ecocide
kubectl port-forward svc/ecocide 8080:3000
open http://localhost:8080
```

With no values the chart runs the deterministic simulation (`GEMINI_MODE=off`),
bundles both dependencies, and keeps everything on `ClusterIP`. Expected health:

```bash
curl -s localhost:8080/api/health | jq
# database: PostgreSQL Active · jobs: bullmq · queue: connected · engine: offline simulation
```

### Tilt (the fast loop)

```bash
tilt up                                  # builds the image into minikube, helm upgrade --install
ECOCIDE_GEMINI_MODE=api GEMINI_API_KEY=… tilt up
ECOCIDE_VALUES=~/.config/ecocide/values.yaml tilt up   # drive the loop from your real values file
tilt down                                # helm uninstall; PVCs are kept
```

Tilt drives a real Helm release (not `kubectl apply` of a rendered chart), so the
loop and production go through the same path.

### Production

`charts/ecocide/values.production.example.yaml` is the template; the real file
lives **outside the repo** (any file matching `charts/ecocide/values.*.yaml` is
gitignored — the example is the only exception).

```bash
mkdir -p ~/.config/ecocide
cp charts/ecocide/values.production.example.yaml ~/.config/ecocide/values.production.yaml
chmod 600 ~/.config/ecocide/values.production.yaml     # it holds credentials
$EDITOR ~/.config/ecocide/values.production.yaml       # every secret goes in secrets.data

kubectl create namespace ecocide
helm upgrade --install ecocide charts/ecocide -n ecocide \
  -f ~/.config/ecocide/values.production.yaml --atomic --wait --timeout 15m
```

Prerequisites on the target cluster: an ingress controller (nginx) and, for
`ingress.tls.enabled`, cert-manager plus a `ClusterIssuer`. Set
`ingress.className` / `ingress.tls.clusterIssuer` in your values file if yours
differ, and point DNS at the ingress address before enabling TLS.

## Image

`.github/workflows/build-image.yml` builds the repo `Dockerfile` on every push to
`main` and publishes it to GitHub Container Registry:

| Tag | When |
| --- | --- |
| `sha-<7>` | every build — immutable, the one to pin in production |
| `main` | default branch builds |
| `latest` | default branch builds |
| `X.Y.Z`, `X.Y` | from a `vX.Y.Z` git tag (the `v` is stripped) |

Pin it in your values file (or override per release):

```yaml
image:
  repository: ghcr.io/br0kenbydes1gn/ecocide
  tag: sha-1a2b3c4        # or X.Y.Z / latest
```

**A private package needs a pull secret** — GHCR packages default to private, and
the chart supports the standard knob:

```bash
kubectl -n ecocide create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=<github-user> \
  --docker-password=<PAT with read:packages>
```

```yaml
imagePullSecrets:
  - name: ghcr-pull
```

Or make the package public (Package settings → Change visibility) and skip both.

Until the package exists, build locally and hand the image to the cluster:
`tilt up` (image into minikube's daemon) or `docker build -t ghcr.io/…:dev .`
plus a `docker push`.

## Secrets

Every credential lives in `secrets.data` in that values file — the chart renders
one Secret from it. Nothing else is needed: no `kubectl create secret`, no
`--set`.

```yaml
secrets:
  create: true
  generateMissing: false      # a missing/misspelled key fails `helm template`
  keepOnUninstall: false      # the values file is the source of truth
  data:
    POSTGRES_PASSWORD: "…"    # openssl rand -hex 24 — see the warning below
    BETTER_AUTH_SECRET: "…"   # openssl rand -hex 32
    GEMINI_API_KEY: "…"
    SMTP_USER: "…"
    SMTP_PASS: "…"
    BULL_BOARD_PASS: "…"
    DATABASE_URL: ""          # empty → derived from postgres.* + POSTGRES_PASSWORD
    REDIS_URL: ""             # empty → derived from redis.*
  extra: {}                   # any further Secret key, verbatim (e.g. REDIS_CA_CERT)
```

Three guards fail the render rather than leaving a broken pod:

| Guard | Why |
| --- | --- |
| `create: false` and no `existingSecret` | Nowhere to read credentials from |
| `generateMissing: false` and a required key empty | Names the key, so a typo can't silently mint a random value that breaks the next reinstall |
| `POSTGRES_PASSWORD` empty while a bundled `DATABASE_URL` is set | The database is initialised with `POSTGRES_PASSWORD`; a URL carrying a different password cannot connect |

A fourth guard rejects the example file's `REPLACE_ME` placeholders, so
`values.production.example.yaml` cannot be deployed as-is — it fails with the
command to generate each value instead of running with a published password.

**`POSTGRES_PASSWORD` is a one-way door.** `initdb` bakes it into the data
volume. Changing it in the values file of a running database locks the app out
until the role is rotated to match:

```bash
kubectl -n ecocide exec -i ecocide-postgres-0 -- psql -U ecocide -d postgres \
  -c "ALTER ROLE ecocide WITH PASSWORD '…'"
```

Keep a copy of `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` outside the cluster
and outside git (a password manager): they are the only way back into an
existing volume and into existing sessions. `helm get values` in the cluster also
holds them, base64-encoded in the release Secret — no worse than any k8s Secret,
but know it.

`secrets.existingSecret: <name>` remains supported for Secrets managed outside
Helm (External Secrets, SealedSecrets, SOPS, `scripts/sync-k8s-secrets.sh`); it
wins over `create`, and then the chart renders nothing secret.

## Evidence storage

Photos are never database blobs: the DB stores only `evidence_filename`, and the
API streams the bytes at `/api/evidence/<name>`. The storage backend is never
exposed to browsers — no bucket policy, no CORS, no hostname in the URL — and
responses are `Cache-Control: immutable` because names are written once.

`evidence.store` chooses where the bytes live:

| `evidence.store` | Where | Consequences |
| --- | --- | --- |
| `fs` (default) | the evidence PVC at `/data/evidence` | `replicaCount: 1` (a ReadWriteOnce volume mounts on one node); back the PVC up |
| `s3` | any S3-compatible bucket | no PVC; raise `replicaCount` and `maxSurge` freely; back the bucket up yourself |

```yaml
evidence:
  store: s3
  s3:
    endpoint: https://minio.example:9000   # empty → AWS
    region: us-east-1
    bucket: ecocide-evidence
    prefix: evidence
    forcePathStyle: true                    # true for MinIO / most self-hosted gateways
```

AWS S3, MinIO, Cloudflare R2, Backblaze B2, Wasabi and Ceph RGW all work, and so
does GCS through its S3 XML interop (HMAC keys, `endpoint:
https://storage.googleapis.com`). The app only ever calls `PutObject` and
`GetObject` — no listing, no ACLs, no bucket policy.

Credentials go in the same Secret as everything else,
`secrets.data.S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`. Leave both empty when
the nodes have an instance profile or role and the AWS SDK's default provider
chain should be used instead.

`/api/health` reports the active store, e.g. `"storage": "s3:ecocide-evidence/evidence"`,
so a chart that says `s3` and a pod still writing to a volume is visible.

**The bucket must already exist.** The chart does not create it (and cannot: it
holds no AWS credentials of its own), so:

```bash
mc mb myminio/ecocide-evidence            # MinIO
aws s3 mb s3://ecocide-evidence           # AWS
```

Switching a running release from `fs` to `s3` does **not** move existing photos.
Copy them first — `scripts/copy-from-gcp.sh` detects the target from the release
(`--evidence-target` overrides), or move the volume by hand:

```bash
kubectl exec ecocide-<pod> -- tar -cf - -C /data/evidence . \
  | tar -xf - -C /tmp/evidence
mc mirror --overwrite /tmp/evidence myminio/ecocide-evidence/evidence
```

## Values that matter

| Key | Default | Notes |
| --- | --- | --- |
| `image.repository` / `image.tag` | `ghcr.io/br0kenbydes1gn/ecocide` / chart appVersion | CI overrides the tag |
| `replicaCount` | `1` | The evidence volume is RWO and the worker is in-process: a second replica adds no HA and needs RWX or object storage |
| `app.publicUrl` | `http://localhost:8080` | Feeds Better Auth `trustedOrigins` **and** email permalinks. Must be the exact browser origin or the Carbon Registry fails with a CORS/401 |
| `app.gemini.mode` | `off` | `off` = simulation, `api` = AI Studio key. `vertex` does not exist here (no GCP ADC) |
| `secrets.data` | dev password, everything else empty | Every credential; see [Secrets](#secrets) |
| `secrets.generateMissing` | `true` | Set `false` in a hand-maintained values file so missing keys fail loudly |
| `secrets.existingSecret` | `""` | Alternative: a Secret you manage outside Helm (wins over `create`) |
| `postgres.mode` | `bundled` | `external` → set `external.*` and either `DATABASE_URL` or `POSTGRES_PASSWORD` |
| `postgres.backup.enabled` | `false` | CronJob `pg_dump` onto `<release>-backup` (keep 7 days). **The only safety net** for the bundled database |
| `redis.mode` | `bundled` | Valkey with `noeviction` + AOF. `external` → set `redis.external.url` |
| `migrations.mode` | `init` | `init` (initContainer, works on a fresh install), `hook` (pre-upgrade Job, external DB only), `off` |
| `persistence.evidence.size` | `5Gi` | Photos are files (never DB blobs) and are kept on `helm uninstall`; PVCs cannot shrink, so a later reduction is rejected. Only used when `evidence.store=fs` |
| `evidence.store` | `fs` | `fs` = the volume above (one replica); `s3` = bucket (no PVC, any replica count) |
| `evidence.s3.endpoint` / `region` / `bucket` / `prefix` | `""` / `us-east-1` / `""` / `""` | S3-compatible target; the bucket must exist. See [Evidence storage](#evidence-storage) |
| `evidence.s3.forcePathStyle` | `false` | `true` for MinIO and most self-hosted gateways |
| `ingress.*` | disabled | proxy body 20m, 300s read timeout, `limit-rps: 5` (no Cloud Run concurrency cap anymore) |

## Migrations

With `migrations.mode: init`, every new pod runs `node dist/migrate-cli.js` after
`wait-for-postgres` and before the app starts. The migrations ship inside the
image, so the release that migrates is the release that serves. With a
single replica this is exactly once per rollout.

Keep migrations additive: `helm rollback` restores the image, never the schema.

## Data from the Google Cloud deployment

```bash
./scripts/copy-from-gcp.sh --namespace ecocide            # dry run
./scripts/copy-from-gcp.sh --namespace ecocide --apply
```

It exports the Cloud SQL database server-side (no local `pg_dump`), restores it
into the release's Postgres, streams the evidence bucket into the volume, and
then verifies that every `dossiers.evidence_filename` has a file — the database
is the authority on which photos must exist. Requires matching major versions
(17).

Keep `BETTER_AUTH_SECRET` identical to keep copied sessions valid; changing it
only signs citizens out.

## Backup and restore (bundled database)

```bash
# an immediate dump
kubectl create job --from=cronjob/ecocide-postgres-backup backup-now
kubectl logs job/backup-now

# restore one
kubectl exec -i ecocide-postgres-0 -- \
  psql -U ecocide -d ecocide -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
kubectl exec -i ecocide-postgres-0 -- pg_restore -U ecocide -d ecocide --no-owner < dump
```

The dump format is `pg_dump -Fc`, which is what `pg_restore` expects. Note the
dump prefix `_migration/` used by `copy-from-gcp.sh` — that script removes its
own temporary dump, and never leaves it inside the evidence volume.

## Upgrades, rollback, uninstall

```bash
helm upgrade ecocide charts/ecocide -n ecocide \
  -f ~/.config/ecocide/values.production.yaml --set image.tag=v0.1.1 --atomic --wait
helm rollback ecocide -n ecocide            # previous release
helm uninstall ecocide -n ecocide           # keeps the PVCs
```

A reinstall is safe: `keepOnUninstall: false` deletes the Secret with the
release, and the values file rebuilds the same one — same `POSTGRES_PASSWORD`, so
the kept data volume opens, and the same `BETTER_AUTH_SECRET`, so sessions
survive. (If the values carry *generated* values instead —
`generateMissing: true` and empty keys — keep `keepOnUninstall: true` or the next
install mints new credentials against the old volume.)

`helm uninstall` leaves the evidence/PVC data (annotated
`helm.sh/resource-policy: keep`); only the Secret goes with the release, unless
you set `secrets.keepOnUninstall`.

## Troubleshooting

**`password authentication failed for user "ecocide"`.**
The volume was initialised with a password other than the one now in
`secrets.data.POSTGRES_PASSWORD` (a rotated values file, or an install that used
generated values before you switched to a hand-maintained file). Rotate the role
to match, or start from a fresh volume:

```bash
kubectl exec -i ecocide-postgres-0 -- psql -U ecocide -d postgres \
  -c "ALTER ROLE ecocide WITH PASSWORD '…'"   # the value from secrets.data
```

The chart refuses to render the two variants that cause this silently
(`POSTGRES_PASSWORD` empty while a bundled `DATABASE_URL` is set), so reaching
this error means the values file itself changed.

**Pods stuck in `Init:Error` on `migrate`.**
The init container logged the real reason; `kubectl logs <pod> -c migrate`.
Usually the database is unreachable or `DATABASE_URL` does not match the release.

**Health says `jobs: inline`.**
`REDIS_URL` is missing from the Secret. With `redis.mode=bundled` the chart
derives it, so this means an `existingSecret` was used without the key — add
`redis://<release>-redis:6379`, or let the chart own the Secret again.

**`queue: disconnected` with `jobs: bullmq`.**
The mode comes from the environment, the connection from the client: check the
`REDIS_URL` host/port and that the Redis pod is Ready. In-cluster URLs are plain
`redis://`, so `REDIS_CA_CERT` is not involved (the app only attaches TLS for
`rediss://`).

**413 on a photo upload.** The ingress annotation `proxy-body-size: 20m` did not
apply — check `ingress.className` matches the controller that is actually
installed.

**`The specified bucket does not exist` on a scan.** The bucket was never
created, or `evidence.s3.prefix` is fine but the bucket name is wrong. The chart
does not create buckets. For MinIO, `forcePathStyle: true` is also required,
otherwise the SDK addresses `bucket.host` and the request never reaches the
gateway.

**Old photos 404 after switching to `s3`.** They are still on the volume; nothing
moved them. Copy them (see [Evidence storage](#evidence-storage)) — the copy
script's verification pass reports exactly which files are missing.

**Health says `storage: fs:…` while `evidence.store` is `s3`.** The pod predates
the ConfigMap change, or `S3_BUCKET` is empty (the chart fails the render for
that). Roll the deployment.

**Rollout stuck at `0 of 1 updated replicas are available`.** With `maxSurge: 0`
the old pod must terminate first; if it hangs, the grace period (45s) plus the
`preStop` sleep is the longest it should take. A second replica on an RWO volume
cannot roll at all.
