#!/usr/bin/env bash
#
# Move a live ECOCIDE deployment's data from Google Cloud into a Kubernetes
# release of charts/ecocide.
#
# Copies two things, because the app stores them separately:
#
#   1. the PostgreSQL database (dossiers, appeals, injunction tasks, the token
#      ledger, Better Auth accounts) — exported server-side by Cloud SQL and
#      restored into the release's Postgres pod;
#   2. the evidence photos — the GCS bucket, streamed into the evidence volume
#      at EVIDENCE_DIR. The database keeps only `evidence_filename`, so a
#      missing file is a broken dossier and a missing row is an orphan file.
#
# Read-only until `--apply` is passed.
#
#   ./scripts/copy-from-gcp.sh                      # dry run: check + print the plan
#   ./scripts/copy-from-gcp.sh --apply              # do it
#   ./scripts/copy-from-gcp.sh --apply --skip-db    # photos only
#
# Requirements: gcloud (mise), kubectl (mise), jq — and a Cloud SQL instance that
# has the same major version as the release's Postgres (17), which the script
# checks before touching anything.
#
# Notes worth reading before running this:
#   • The restore DROPs the target schema. Without --force the script refuses to
#     touch a database that already has dossiers in it.
#   • The dump carries `__drizzle_migrations`, so the schema and the migration
#     journal stay consistent and the next release's migrate step is a no-op.
#   • Keeping the same BETTER_AUTH_SECRET in the k8s Secret keeps copied
#     sessions valid; changing it just signs everyone out (accounts survive).
#
set -euo pipefail

PROJECT="${PROJECT:-ecocide-511407}"
SQL_INSTANCE="${SQL_INSTANCE:-ecocide-pg}"
SQL_DB="${SQL_DB:-ecocide}"
EVIDENCE_BUCKET="${EVIDENCE_BUCKET:-${PROJECT}-evidence}"
NAMESPACE="${NAMESPACE:-default}"
RELEASE="${RELEASE:-ecocide}"
EVIDENCE_DIR_IN_POD="${EVIDENCE_DIR_IN_POD:-/data/evidence}"
DUMP_PREFIX="${DUMP_PREFIX:-_migration}"

APPLY=0
FORCE=0
SKIP_DB=0
SKIP_EVIDENCE=0
KEEP_DUMP=0

usage() {
  sed -n '2,35p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

Options:
  --apply            actually copy (default is a dry run)
  --force            restore into a database that already has dossiers
  --skip-db          skip the database
  --skip-evidence    skip the evidence photos
  --keep-dump        keep the Cloud SQL export in gs://$EVIDENCE_BUCKET/_migration/
  --namespace <ns>   release namespace (default: $NAMESPACE or "default")
  --release <name>   release name (default: "ecocide")
  -h, --help         this text

Environment: PROJECT, SQL_INSTANCE, SQL_DB, EVIDENCE_BUCKET, NAMESPACE, RELEASE
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --force) FORCE=1 ;;
    --skip-db) SKIP_DB=1 ;;
    --skip-evidence) SKIP_EVIDENCE=1 ;;
    --keep-dump) KEEP_DUMP=1 ;;
    --namespace) NAMESPACE="${2:?--namespace needs a value}"; shift ;;
    --namespace=*) NAMESPACE="${1#*=}" ;;
    --release) RELEASE="${2:?--release needs a value}"; shift ;;
    --release=*) RELEASE="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
step() { printf '   %s\n' "$*"; }
die() { printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }
k() { kubectl -n "$NAMESPACE" "$@"; }

TMPDIR_COPY=""
cleanup() {
  [[ -n "$TMPDIR_COPY" && -d "$TMPDIR_COPY" ]] && rm -rf "$TMPDIR_COPY"
  return 0
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Preflight — everything here is read-only.
# ---------------------------------------------------------------------------
say "Preflight"

for tool in gcloud kubectl jq; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is required (mise: \`mise install\`)"
done

gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 |
  grep -q . || die "no active gcloud account — run \`gcloud auth login\`"
step "gcloud: $(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)"

CONTEXT="$(kubectl config current-context)"
step "kubectl context: $CONTEXT (namespace: $NAMESPACE)"

k get deployment "$RELEASE" >/dev/null 2>&1 ||
  die "deployment/$RELEASE not found in namespace $NAMESPACE — install the chart first:
     helm upgrade --install $RELEASE charts/ecocide -n $NAMESPACE -f /path/to/values.production.yaml"

APP_POD="$(k get pod -l "app.kubernetes.io/instance=$RELEASE,app.kubernetes.io/component=app" \
  --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}')"
[[ -n "$APP_POD" ]] || die "no running app pod for release $RELEASE in $NAMESPACE"
step "app pod: $APP_POD"

PG_POD=""
PG_USER=""
if [[ "$SKIP_DB" -eq 0 ]]; then
  PG_POD="$(k get pod -l "app.kubernetes.io/instance=$RELEASE,app.kubernetes.io/component=postgres" \
    --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"

  if [[ -z "$PG_POD" ]]; then
    die "no in-cluster Postgres for release $RELEASE.
     This script restores into the chart's bundled database. With
     postgres.mode=external, restore the dump yourself:
       gcloud sql instances export sql $SQL_INSTANCE gs://$EVIDENCE_BUCKET/$DUMP_PREFIX/ecocide.sql.gz --database=$SQL_DB
       gcloud storage cat gs://$EVIDENCE_BUCKET/$DUMP_PREFIX/ecocide.sql.gz | gunzip | psql \"\$DATABASE_URL\""
  fi
  PG_USER="$(k exec "$PG_POD" -- printenv POSTGRES_USER)"
  PG_DB="$(k exec "$PG_POD" -- printenv POSTGRES_DB)"
  step "postgres pod: $PG_POD (user: $PG_USER, database: $PG_DB)"

  # The dump is a plain SQL file from the source server; a cross-major restore
  # is not something psql will do for you.
  SRC_VERSION="$(gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT" \
    --format='value(databaseVersion)' 2>/dev/null || true)"
  DST_VERSION="$(k exec "$PG_POD" -- sh -c 'psql --version' | awk '{print $3}' | cut -d. -f1)"
  if [[ -z "$SRC_VERSION" ]]; then
    # No usable gcloud credentials (expired session, offline): a dry run can
    # still be useful, an actual copy cannot.
    [[ "$APPLY" -eq 0 ]] ||
      die "could not describe $SQL_INSTANCE (expired gcloud credentials?) — run \`gcloud auth login\`"
    step "target: PostgreSQL $DST_VERSION — source version unverified (gcloud unavailable)"
  else
    step "source: $SQL_INSTANCE ($SRC_VERSION)  →  target: PostgreSQL $DST_VERSION"
    [[ "$SRC_VERSION" == POSTGRES_17 && "$DST_VERSION" == 17 ]] ||
      die "major version mismatch ($SRC_VERSION vs $DST_VERSION): restore into a matching server"
  fi

  TARGET_COUNT="$(k exec "$PG_POD" -- psql -U "$PG_USER" -d "$PG_DB" -tAc \
    "select count(*) from dossiers" 2>/dev/null || echo 0)"
  TARGET_COUNT="${TARGET_COUNT//[[:space:]]/}"
  step "target already holds ${TARGET_COUNT:-0} dossiers"
  if [[ "${TARGET_COUNT:-0}" != "0" && "$FORCE" -eq 0 ]]; then
    if [[ "$APPLY" -eq 0 ]]; then
      step "!! would refuse to restore into a non-empty database without --force"
    else
      die "the target database is not empty (${TARGET_COUNT} dossiers).
     The restore drops the public schema. Re-run with --force if that is what
     you want, or point the release at an empty database."
    fi
  fi
fi

if [[ "$SKIP_EVIDENCE" -eq 0 ]]; then
  if gcloud storage buckets describe "gs://$EVIDENCE_BUCKET" --project "$PROJECT" >/dev/null 2>&1; then
    step "evidence bucket: gs://$EVIDENCE_BUCKET"
  elif [[ "$APPLY" -eq 0 ]]; then
    step "evidence bucket: gs://$EVIDENCE_BUCKET — unverified (gcloud unavailable)"
  else
    die "bucket gs://$EVIDENCE_BUCKET not found (set EVIDENCE_BUCKET)"
  fi
fi

if [[ "$APPLY" -eq 0 ]]; then
  say "Dry run"
  cat <<EOF
   Would run, in this order:

   1. gcloud sql instances export sql $SQL_INSTANCE \\
        gs://$EVIDENCE_BUCKET/$DUMP_PREFIX/ecocide-<timestamp>.sql.gz --database=$SQL_DB
   2. gcloud storage cat …/ecocide-<timestamp>.sql.gz | gunzip \\
        | kubectl -n $NAMESPACE exec -i $PG_POD -- \\
            psql -U $PG_USER -d $PG_DB -v ON_ERROR_STOP=1
      (after: DROP SCHEMA public CASCADE; CREATE SCHEMA public;)
   3. gcloud storage cp --recursive gs://$EVIDENCE_BUCKET/* → a temp dir
   4. tar | kubectl -n $NAMESPACE exec -i $APP_POD -- tar -xf - -C $EVIDENCE_DIR_IN_POD
   5. verify: every dossiers.evidence_filename has a file on the volume

   Nothing has been changed. Re-run with --apply.
EOF
  exit 0
fi

# ---------------------------------------------------------------------------
# 1. Export the database from Cloud SQL (server-side; no local pg_dump).
# ---------------------------------------------------------------------------
DUMP_OBJECT=""
if [[ "$SKIP_DB" -eq 0 ]]; then
  say "Exporting Cloud SQL database"
  DUMP_OBJECT="$DUMP_PREFIX/ecocide-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  step "→ gs://$EVIDENCE_BUCKET/$DUMP_OBJECT"
  gcloud sql instances export sql "$SQL_INSTANCE" "gs://$EVIDENCE_BUCKET/$DUMP_OBJECT" \
    --database="$SQL_DB" --project "$PROJECT" --quiet
  step "export complete"

  # -------------------------------------------------------------------------
  # 2. Restore into the release's Postgres.
  # -------------------------------------------------------------------------
  say "Restoring into $PG_POD"
  step "dropping the public schema (the dump recreates every object, including"
  step "__drizzle_migrations, so the schema and the journal stay in step)"
  # Both schemas: drizzle-orm keeps its migration journal in `drizzle`, the dump
  # recreates it, and restoring over the existing one fails with
  # `schema "drizzle" already exists`.
  k exec "$PG_POD" -- psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -q -c '
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;'

  step "streaming the dump through psql"
  gcloud storage cat "gs://$EVIDENCE_BUCKET/$DUMP_OBJECT" \
    | gunzip -c \
    | k exec -i "$PG_POD" -- psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -q
  step "restore complete"
fi

# ---------------------------------------------------------------------------
# 3 + 4. Evidence photos → the evidence volume.
# ---------------------------------------------------------------------------
if [[ "$SKIP_EVIDENCE" -eq 0 ]]; then
  say "Copying evidence photos"
  TMPDIR_COPY="$(mktemp -d)"
  step "downloading gs://$EVIDENCE_BUCKET into $TMPDIR_COPY"
  # --recursive on a bucket root pulls the dump prefix too; drop it before the
  # tar so an interrupted run cannot leave dumps inside the evidence volume.
  gcloud storage cp --recursive "gs://$EVIDENCE_BUCKET/*" "$TMPDIR_COPY/" --project "$PROJECT"
  rm -rf "${TMPDIR_COPY:?}/$DUMP_PREFIX"

  FILES=$(find "$TMPDIR_COPY" -type f | wc -l | tr -d ' ')
  step "$FILES file(s) to stream into $APP_POD:$EVIDENCE_DIR_IN_POD"
  k exec "$APP_POD" -- mkdir -p "$EVIDENCE_DIR_IN_POD"
  # tar over stdin: one transfer, no per-file kubectl cp round trips.
  tar -C "$TMPDIR_COPY" -cf - . \
    | k exec -i "$APP_POD" -- tar -xf - -C "$EVIDENCE_DIR_IN_POD"
  step "evidence copied"
fi

# ---------------------------------------------------------------------------
# 5. Verify. The database is the authority on which photos must exist, so this
#    needs no second connection to the source.
# ---------------------------------------------------------------------------
if [[ "$SKIP_DB" -eq 0 ]]; then
  say "Verifying"
  k exec "$PG_POD" -- psql -U "$PG_USER" -d "$PG_DB" -tAc \
    "select evidence_filename from dossiers where evidence_filename is not null" \
    | sed '/^$/d' | sort > /tmp/ecocide-need.txt
  k exec "$APP_POD" -- ls -1 "$EVIDENCE_DIR_IN_POD" | sort > /tmp/ecocide-have.txt

  DOSS=0; APPEALS=0; TASKS=0; USERS=0
  read -r DOSS APPEALS TASKS USERS < <(k exec "$PG_POD" -- psql -U "$PG_USER" -d "$PG_DB" -tA -F' ' -c \
    "select (select count(*) from dossiers), (select count(*) from appeals), (select count(*) from injunction_tasks), (select count(*) from \"user\")")

  MISSING=$(comm -23 /tmp/ecocide-need.txt /tmp/ecocide-have.txt | wc -l | tr -d ' ')
  ORPHANS=$(comm -13 /tmp/ecocide-need.txt /tmp/ecocide-have.txt | wc -l | tr -d ' ')

  step "dossiers: $DOSS   appeals: $APPEALS   injunction tasks: $TASKS   accounts: $USERS"
  step "evidence files: $(wc -l < /tmp/ecocide-have.txt | tr -d ' ')"
  step "missing (row without a file): $MISSING"
  step "orphans (file without a row): $ORPHANS"

  if [[ "$MISSING" != "0" ]]; then
    printf '\n\033[1;31m!! %s dossier(s) have no evidence file\033[0m\n' "$MISSING"
    comm -23 /tmp/ecocide-need.txt /tmp/ecocide-have.txt | head -10 | sed 's/^/     /'
    printf '   Their /api/evidence/<name> will 404. Re-run with --skip-db to copy\n'
    printf '   the bucket again, or accept broken photos for these dossiers.\n'
    EXIT_CODE=1
  fi

  # A random sample through the API, so this also proves route → file → mime.
  step "spot-checking 3 evidence URLs over the service"
  PORT=18099
  k port-forward "svc/$RELEASE" "$PORT:3000" >/dev/null 2>&1 &
  PF_PID=$!
  sleep 2
  SAMPLE=$(head -3 /tmp/ecocide-need.txt)
  for name in $SAMPLE; do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/evidence/$name" || echo 000)
    step "  $name → HTTP $CODE"
    [[ "$CODE" == "200" ]] || EXIT_CODE=1
  done
  kill "$PF_PID" >/dev/null 2>&1 || true
  wait "$PF_PID" 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Cleanup + closing notes.
# ---------------------------------------------------------------------------
if [[ "$KEEP_DUMP" -eq 0 && -n "$DUMP_OBJECT" ]]; then
  gcloud storage rm "gs://$EVIDENCE_BUCKET/$DUMP_OBJECT" --project "$PROJECT" --quiet >/dev/null 2>&1 ||
    step "could not remove gs://$EVIDENCE_BUCKET/$DUMP_OBJECT (harmless; remove it by hand)"
fi

say "Done"
cat <<EOF
   Next:
     kubectl -n $NAMESPACE rollout restart deployment/$RELEASE   # clear any cached state
     curl -s http://localhost:8080/api/health | jq
     # then one real audit through the UI

   Sessions survive only if the k8s Secret carries the SAME BETTER_AUTH_SECRET
   as the old deployment; otherwise every citizen signs in again (accounts and
   wallets are untouched).

   Keep the old Cloud Run service for a few days: rolling back is a DNS change,
   and rolling the app back does not roll the schema back.
EOF

exit "${EXIT_CODE:-0}"
