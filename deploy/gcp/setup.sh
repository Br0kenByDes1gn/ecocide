#!/usr/bin/env bash
#
# One-time Google Cloud setup for ECOCIDE (Cloud Run + Cloud SQL + GCS).
#
# Creates everything the tag-triggered workflow in .github/workflows/deploy-gcp.yml
# expects to already exist. Idempotent-ish: re-running reports "already exists"
# for resources that are present rather than failing the whole script.
#
#   ./deploy/gcp/setup.sh                 # uses the defaults below
#   PROJECT=my-proj REGION=europe-west1 ./deploy/gcp/setup.sh
#
# Everything here is billable except the IAM plumbing: Cloud SQL is the one
# always-on cost (~$9-12/mo at the smallest tier).
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
EVIDENCE_BUCKET="${EVIDENCE_BUCKET:-${PROJECT}-evidence}"
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

say "Cloud SQL (PostgreSQL) — the always-on cost"
if exists gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT"; then
  echo "instance $SQL_INSTANCE already exists"
else
  # Verify the tier is available in your region before running; shared-core
  # tiers are the cheapest option and are fine for a single-replica demo.
  gcloud sql instances create "$SQL_INSTANCE" --project "$PROJECT" \
    --database-version=POSTGRES_17 \
    --region "$REGION" \
    --tier=db-f1-micro \
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

cat <<EOF

\033[1mNext: first deploy\033[0m
  1. Add the Brevo SMTP key:  printf '%s' '<smtp-key>' | gcloud secrets versions add ecocide-smtp-pass --project $PROJECT --data-file=-
  2. Build + push the image:  gcloud builds submit --project $PROJECT --tag ${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPO}/ecocide:v0.1.0 .
  3. Create the migrate job:  see deploy/gcp/README.md (step "Migrate job")
  4. Deploy the service:      see deploy/gcp/README.md (step "Deploy")
  5. Map the domain + point BETTER_AUTH_URL/APP_BASE_URL at it (deploy/gcp/README.md)
EOF
