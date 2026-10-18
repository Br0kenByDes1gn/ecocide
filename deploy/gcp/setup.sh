#!/usr/bin/env bash
#
# One-time Google Cloud setup for ECOCIDE (Cloud Run + Cloud SQL + GCS + Memorystore).
#
# Creates everything the tag-triggered workflow in .github/workflows/deploy-gcp.yml
# expects to already exist. Idempotent-ish: re-running reports "already exists"
# for resources that are present rather than failing the whole script.
#
#   ./deploy/gcp/setup.sh                 # uses the defaults below
#   PROJECT=my-proj REGION=europe-west1 ./deploy/gcp/setup.sh
#
# Two things here are billable and always-on: Cloud SQL (~$9-12/mo at the smallest
# tier) and the job queue's Memorystore Basic instance (1 GiB, no free tier, low
# tens of dollars a month). The queue is not optional in production: without
# REDIS_URL the job dispatcher runs inline, which puts a model call inside the
# acceptance request and loses the queue's retries. See deploy/gcp/README.md
# ("Job queue"). Everything else is IAM plumbing or scales to zero.
set -euo pipefail

PROJECT="${PROJECT:-ecocide-511407}"
REGION="${REGION:-asia-southeast1}"

# Which GitHub repository may deploy. Defaults to this checkout's `origin`
# remote, so the value is never guessed: the WIF attribute condition and the IAM
# principalSet both have to match GitHub's OIDC `repository` claim exactly.
# Override with GITHUB_REPO=owner/repo (or when running outside a checkout).
detect_github_repo() {
  git config --get remote.origin.url 2>/dev/null |
    sed -E 's#^(git@[^:]+:|https?://[^/]+/|ssh://git@[^/]+/)##; s#\.git$##'
}
GITHUB_REPO="${GITHUB_REPO:-$(detect_github_repo)}"
if ! printf '%s' "$GITHUB_REPO" | grep -qE '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'; then
  echo "Could not determine GITHUB_REPO (owner/repo) from the git remote." >&2
  echo "Re-run with it set explicitly:  GITHUB_REPO=owner/repo $0" >&2
  exit 1
fi

AR_REPO="${AR_REPO:-ecocide}"
SQL_INSTANCE="${SQL_INSTANCE:-ecocide-pg}"
SQL_DB="${SQL_DB:-ecocide}"
SQL_USER="${SQL_USER:-ecocide}"
# Shared-core machine type on the Enterprise edition (see the create command).
SQL_TIER="${SQL_TIER:-db-f1-micro}"
EVIDENCE_BUCKET="${EVIDENCE_BUCKET:-${PROJECT}-evidence}"
# BullMQ queue: Memorystore Redis, reachable from Cloud Run over Direct VPC egress
# on the default network (no Serverless VPC connector to pay for).
REDIS_INSTANCE="${REDIS_INSTANCE:-ecocide-queue}"
REDIS_RANGE="${REDIS_RANGE:-ecocide-redis-range}"
VPC_NETWORK="${VPC_NETWORK:-default}"
RUN_SA="ecocide-run@${PROJECT}.iam.gserviceaccount.com"
DEPLOY_SA="ecocide-deploy@${PROJECT}.iam.gserviceaccount.com"
SERVICE="ecocide"
MIGRATE_JOB="ecocide-migrate"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

say "APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  iamcredentials.googleapis.com \
  monitoring.googleapis.com \
  redis.googleapis.com \
  servicenetworking.googleapis.com \
  compute.googleapis.com \
  --project "$PROJECT"

say "Artifact Registry ($REGION)"
exists gcloud artifacts repositories describe "$AR_REPO" --location "$REGION" --project "$PROJECT" ||
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker --location "$REGION" --project "$PROJECT" \
    --description "ECOCIDE container images"

say "Runtime service account (what the app runs as)"
exists gcloud iam service-accounts describe "$RUN_SA" --project "$PROJECT" ||
  gcloud iam service-accounts create ecocide-run --project "$PROJECT" \
    --display-name "ECOCIDE runtime (Cloud Run)"
for role in roles/aiplatform.user roles/cloudsql.client \
            roles/secretmanager.secretAccessor roles/logging.logWriter \
            roles/monitoring.metricWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT" --quiet \
    --member "serviceAccount:${RUN_SA}" --role "$role" >/dev/null
done

say "Deployer service account (what GitHub Actions impersonates)"
exists gcloud iam service-accounts describe "$DEPLOY_SA" --project "$PROJECT" ||
  gcloud iam service-accounts create ecocide-deploy --project "$PROJECT" \
    --display-name "GitHub Actions deployer"
for role in roles/run.developer roles/artifactregistry.writer \
            roles/cloudsql.client roles/cloudsql.viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --quiet \
    --member "serviceAccount:${DEPLOY_SA}" --role "$role" >/dev/null
done
# Required to create revisions that run AS the runtime service account.
gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" --quiet \
  --member "serviceAccount:${DEPLOY_SA}" --role roles/iam.serviceAccountUser >/dev/null

say "Workload Identity Federation for ${GITHUB_REPO}"
exists gcloud iam workload-identity-pools describe github --location global --project "$PROJECT" ||
  gcloud iam workload-identity-pools create github --location global --project "$PROJECT" \
    --display-name "GitHub Actions"

exists gcloud iam workload-identity-pools providers describe github-actions \
  --location global --workload-identity-pool github --project "$PROJECT" ||
  gcloud iam workload-identity-pools providers create-oidc github-actions \
    --location global --workload-identity-pool github --project "$PROJECT" \
    --display-name "GitHub Actions (tag pushes)" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository=='${GITHUB_REPO}'"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --quiet \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${GITHUB_REPO}" \
  --role roles/iam.workloadIdentityUser >/dev/null

echo "Bound '${GITHUB_REPO}' (from $(git config --get remote.origin.url 2>/dev/null || echo 'GITHUB_REPO')) to the deployer."
echo "This must match GitHub's OIDC 'repository' claim exactly, case included —"
echo "if a tag push fails to authenticate, see the Troubleshooting section of deploy/gcp/README.md."

say "Cloud SQL (PostgreSQL) — an always-on cost"
if exists gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT"; then
  echo "instance $SQL_INSTANCE already exists"
else
  # `--edition=enterprise` is not optional: shared-core machine types exist only
  # on the Enterprise edition, while new instances default to Enterprise Plus,
  # which requires db-perf-optimized-N-* (roughly an order of magnitude more).
  #
  # Shared-core caveats, accepted for a single-replica demo:
  #   • db-f1-micro / db-g1-small are NOT covered by the Cloud SQL SLA
  #   • ~0.6 GB RAM and a low connection cap (the app pool is 10, cf. DB_POOL_MAX)
  # Bump it with SQL_TIER=db-g1-small (or db-custom-1-3840) if either bites.
  gcloud sql instances create "$SQL_INSTANCE" --project "$PROJECT" \
    --edition=enterprise \
    --database-version=POSTGRES_17 \
    --region "$REGION" \
    --tier="${SQL_TIER}" \
    --storage-size=10GB \
    --storage-type=HDD \
    --backup --enable-point-in-time-recovery \
    --deletion-protection
fi

exists gcloud sql databases describe "$SQL_DB" --instance "$SQL_INSTANCE" --project "$PROJECT" ||
  gcloud sql databases create "$SQL_DB" --instance "$SQL_INSTANCE" --project "$PROJECT"

if gcloud sql users list --instance "$SQL_INSTANCE" --project "$PROJECT" \
     --format='value(name)' | grep -qx "$SQL_USER"; then
  echo "user $SQL_USER already exists (password unchanged)"
  DB_PASSWORD=""
else
  DB_PASSWORD="$(openssl rand -hex 24)"
  gcloud sql users create "$SQL_USER" --instance "$SQL_INSTANCE" --project "$PROJECT" \
    --password "$DB_PASSWORD"
fi

say "Evidence bucket"
exists gcloud storage buckets describe "gs://${EVIDENCE_BUCKET}" --project "$PROJECT" ||
  gcloud storage buckets create "gs://${EVIDENCE_BUCKET}" --project "$PROJECT" \
    --location "$REGION" --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding "gs://${EVIDENCE_BUCKET}" --quiet \
  --member "serviceAccount:${RUN_SA}" --role roles/storage.objectAdmin >/dev/null

say "Job queue (Memorystore Redis)"
# Memorystore lives on a private IP, so it needs private services access: one
# reserved range, peered to the VPC that Cloud Run egresses through.
exists gcloud compute addresses describe "$REDIS_RANGE" --global --project "$PROJECT" ||
  gcloud compute addresses create "$REDIS_RANGE" \
    --global --purpose=VPC_PEERING --prefix-length=24 \
    --network="$VPC_NETWORK" --project "$PROJECT"

if gcloud services vpc-peerings list --network="$VPC_NETWORK" --project "$PROJECT" \
     --format='value(service)' 2>/dev/null | grep -q servicenetworking.googleapis.com; then
  echo "private services access already connected"
else
  gcloud services vpc-peerings connect \
    --service=servicenetworking.googleapis.com \
    --ranges="$REDIS_RANGE" --network="$VPC_NETWORK" --project "$PROJECT"
fi

# Basic 1 GiB, Redis 7, AUTH + server-side TLS: the URL becomes `rediss://:AUTH@IP`.
# Flag names are the Memorystore *instance* API's, not the Redis Cluster one:
# `--enable-auth` (not `--auth-enabled`) and lowercase `server-authentication`.
exists gcloud redis instances describe "$REDIS_INSTANCE" --region "$REGION" --project "$PROJECT" ||
  gcloud redis instances create "$REDIS_INSTANCE" \
    --size=1 --tier=basic --redis-version=redis_7_0 \
    --region "$REGION" --network "$VPC_NETWORK" \
    --enable-auth --transit-encryption-mode=server-authentication \
    --display-name "ECOCIDE job queue (BullMQ)" --project "$PROJECT"

say "Secrets"
# DATABASE_URL uses the Cloud SQL unix socket mounted by --add-cloudsql-instances.
if [ -n "$DB_PASSWORD" ]; then
  DATABASE_URL="postgres://${SQL_USER}:${DB_PASSWORD}@localhost/${SQL_DB}?host=/cloudsql/${PROJECT}:${REGION}:${SQL_INSTANCE}"
  printf '%s' "$DATABASE_URL" | gcloud secrets create ecocide-db-url --project "$PROJECT" \
    --replication-policy=automatic --data-file=- 2>/dev/null ||
    printf '%s' "$DATABASE_URL" | gcloud secrets versions add ecocide-db-url --project "$PROJECT" --data-file=-
else
  echo "cloud-sql user already existed — leaving ecocide-db-url untouched."
fi

if exists gcloud secrets describe ecocide-auth-secret --project "$PROJECT"; then
  echo "ecocide-auth-secret already exists"
else
  printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create ecocide-auth-secret \
    --project "$PROJECT" --replication-policy=automatic --data-file=-
fi

# Brevo SMTP key — create the secret, then add the version from your dashboard:
#   printf '%s' 'xkeysib-...' | gcloud secrets versions add ecocide-smtp-pass \
#     --project $PROJECT --data-file=-
if exists gcloud secrets describe ecocide-smtp-pass --project "$PROJECT"; then
  echo "ecocide-smtp-pass already exists"
else
  printf '%s' 'REPLACE_ME' | gcloud secrets create ecocide-smtp-pass \
    --project "$PROJECT" --replication-policy=automatic --data-file=-
  echo "!! ecocide-smtp-pass created with a placeholder — add the real Brevo SMTP key."
fi

# BullMQ needs the instance's private IP, PORT and AUTH string. The URL lives in
# Secret Manager because it carries the credential; copy it into .env.production
# only if you want sync-env.sh to own it (it is idempotent if the value is
# unchanged).
#
# The port is read from the instance, never assumed: Memorystore does not always
# use 6379 (this project's instance listens on 6378), and a URL that disagrees
# with it connects forever — ioredis retries in the background while health
# reports `queue: "disconnected"`.
#
# The secret is derived on every run and compared to the stored version, so a
# re-run repairs a wrong URL instead of skipping it because the secret exists.
read -r REDIS_HOST REDIS_PORT REDIS_ENCRYPTION < <(
  gcloud redis instances describe "$REDIS_INSTANCE" --region "$REGION" \
    --project "$PROJECT" --format='value(host,port,transitEncryptionMode)'
)
REDIS_AUTH="$(gcloud redis instances get-auth-string "$REDIS_INSTANCE" --region "$REGION" \
  --project "$PROJECT" --format='value(authString)')"

# Take the scheme from the instance rather than assuming: AUTH + TLS is what the
# create above asks for, but an instance created by hand may differ.
REDIS_SCHEME=redis
[ "$REDIS_ENCRYPTION" = "SERVER_AUTHENTICATION" ] && REDIS_SCHEME=rediss

# A silent empty value would build `redis://:@IP:PORT` and only fail when the app
# tries to connect, so refuse here with something actionable.
if [ -z "$REDIS_HOST" ] || [ -z "$REDIS_PORT" ] || [ -z "$REDIS_AUTH" ]; then
  echo "Could not read the Memorystore host / port / AUTH string for ${REDIS_INSTANCE}." >&2
  echo "  host='${REDIS_HOST}' port='${REDIS_PORT}' auth=${REDIS_AUTH:+set}" >&2
  echo "  AUTH must be enabled:  gcloud redis instances update ${REDIS_INSTANCE} \\" >&2
  echo "    --region=${REGION} --project=${PROJECT} --enable-auth" >&2
  exit 1
fi

REDIS_URL="${REDIS_SCHEME}://:${REDIS_AUTH}@${REDIS_HOST}:${REDIS_PORT}"

if exists gcloud secrets describe ecocide-redis-url --project "$PROJECT"; then
  REDIS_URL_CURRENT="$(gcloud secrets versions access latest --secret=ecocide-redis-url \
    --project "$PROJECT" 2>/dev/null || true)"
  if [ "$REDIS_URL_CURRENT" = "$REDIS_URL" ]; then
    echo "ecocide-redis-url is current (${REDIS_SCHEME}://…@${REDIS_HOST}:${REDIS_PORT})"
  else
    printf '%s' "$REDIS_URL" | gcloud secrets versions add ecocide-redis-url \
      --project "$PROJECT" --data-file=- >/dev/null
    echo "ecocide-redis-url updated (${REDIS_SCHEME}://…@${REDIS_HOST}:${REDIS_PORT})"
  fi
else
  printf '%s' "$REDIS_URL" | gcloud secrets create ecocide-redis-url \
    --project "$PROJECT" --replication-policy=automatic --data-file=-
  echo "ecocide-redis-url created (${REDIS_SCHEME}://…@${REDIS_HOST}:${REDIS_PORT})"
fi

# The instance's own CA. With `SERVER_AUTHENTICATION` Memorystore signs its server
# certificate with this CA, which no public trust store knows, so `rediss://`
# alone fails the chain check ("unable to verify the first certificate") while the
# queue retries forever. The app trusts it via `REDIS_CA_CERT`.
if [ "$REDIS_ENCRYPTION" = "SERVER_AUTHENTICATION" ]; then
  REDIS_CA="$(gcloud redis instances describe "$REDIS_INSTANCE" --region "$REGION" \
    --project "$PROJECT" --format='value(serverCaCerts[0].cert)')"
  if [ -z "$REDIS_CA" ]; then
    echo "Could not read the Memorystore server CA for ${REDIS_INSTANCE}." >&2
    echo "  It exists only while in-transit encryption is enabled." >&2
    exit 1
  fi

  if exists gcloud secrets describe ecocide-redis-ca --project "$PROJECT"; then
    REDIS_CA_CURRENT="$(gcloud secrets versions access latest --secret=ecocide-redis-ca \
      --project "$PROJECT" 2>/dev/null || true)"
    if [ "$REDIS_CA_CURRENT" = "$REDIS_CA" ]; then
      echo "ecocide-redis-ca is current"
    else
      printf '%s' "$REDIS_CA" | gcloud secrets versions add ecocide-redis-ca \
        --project "$PROJECT" --data-file=- >/dev/null
      echo "ecocide-redis-ca updated (the instance CA changed — a new version)"
    fi
  else
    printf '%s' "$REDIS_CA" | gcloud secrets create ecocide-redis-ca \
      --project "$PROJECT" --replication-policy=automatic --data-file=-
    echo "ecocide-redis-ca created"
  fi
else
  echo "In-transit encryption is off — no CA secret needed."
fi

# Password for the Bull Board dashboard (/admin/queues). Generated once and
# printed here — put it in .env.production together with BULL_BOARD_USER.
if exists gcloud secrets describe ecocide-bull-pass --project "$PROJECT"; then
  echo "ecocide-bull-pass already exists"
else
  BULL_BOARD_PASSWORD="$(openssl rand -hex 24)"
  printf '%s' "$BULL_BOARD_PASSWORD" | gcloud secrets create ecocide-bull-pass \
    --project "$PROJECT" --replication-policy=automatic --data-file=-
  echo "!! Bull Board password (save it, it is not shown again): ${BULL_BOARD_PASSWORD}"
fi

cat <<EOF

\033[1mNext: first deploy\033[0m
  1. Add the Brevo SMTP key:  printf '%s' '<smtp-key>' | gcloud secrets versions add ecocide-smtp-pass --project $PROJECT --data-file=-
  2. Build + push the image:  gcloud builds submit --project $PROJECT --tag ${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPO}/ecocide:v0.1.0 .
  3. Create the migrate job:  see deploy/gcp/README.md (step "Migrate job")
  4. Deploy the service:      see deploy/gcp/README.md (step "Deploy") — it needs
     the Direct VPC egress flags and REDIS_URL, or /api/health will report
     "jobs": "inline" and the release smoke test will refuse the deploy
  5. Dashboard (optional):    put BULL_BOARD_USER + the printed BULL_BOARD_PASS in
     .env.production, then ./deploy/gcp/sync-env.sh --apply
  6. Map the domain + point BETTER_AUTH_URL/APP_BASE_URL at it (deploy/gcp/README.md)
EOF
