#!/usr/bin/env bash
#
# Create/refresh the Kubernetes Secret charts/ecocide reads, from the same
# gitignored `.env.production` the GCP deployment used.
#
# ALTERNATIVE PATH. The default is to put every credential in `secrets.data` of a
# values file outside the repo (charts/ecocide/values.production.example.yaml),
# and let the chart render the Secret. Use this script when the Secret must be
# managed outside Helm instead (External Secrets, SealedSecrets, GitOps with a
# sealed secret), by pointing the chart at it:
#
#   secrets:
#     create: false
#     existingSecret: ecocide-secrets
#
#   ./scripts/sync-k8s-secrets.sh                 # dry run — shows which keys would be set
#   ./scripts/sync-k8s-secrets.sh --apply         # write the Secret
#
# Keys written (only those that are configured):
#   DATABASE_URL          required
#   BETTER_AUTH_SECRET    required, >= 32 chars
#   POSTGRES_PASSWORD     required while postgres.mode=bundled
#   REDIS_URL             required while redis.mode=bundled
#   GEMINI_API_KEY        required while app.gemini.mode=api
#   SMTP_USER, SMTP_PASS  optional (without them the registry cannot issue OTPs)
#   BULL_BOARD_PASS       optional (with BULL_BOARD_USER, mounts /admin/queues)
#
# DATABASE_URL derivation: if `.env.production` has DATABASE_URL it is used as
# is (an external database). Otherwise it is built from POSTGRES_PASSWORD and
# the release's bundled Postgres service.
#
set -euo pipefail

NAMESPACE="${NAMESPACE:-ecocide}"
RELEASE="${RELEASE:-ecocide}"
SECRET_NAME="${SECRET_NAME:-ecocide-secrets}"
ENV_FILE="${ENV_FILE:-.env.production}"
PG_USER="${PG_USER:-ecocide}"
PG_DB="${PG_DB:-ecocide}"
PG_PORT="${PG_PORT:-5432}"

APPLY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --namespace) NAMESPACE="${2:?--namespace needs a value}"; shift ;;
    --namespace=*) NAMESPACE="${1#*=}" ;;
    --release) RELEASE="${2:?--release needs a value}"; shift ;;
    --release=*) RELEASE="${1#*=}" ;;
    --file) ENV_FILE="${2:?--file needs a value}"; shift ;;
    --file=*) ENV_FILE="${1#*=}" ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
step() { printf '   %s\n' "$*"; }
die() { printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found — copy deploy/gcp/env.production.example first"
command -v kubectl >/dev/null 2>&1 || die "kubectl is required (mise)"

# The file is loaded as shell (same contract as deploy/gcp/sync-env.sh): values
# with spaces must be quoted. A real environment variable still wins.
set -a
# shellcheck disable=SC1090
. "./$ENV_FILE" 2>/dev/null || . "$ENV_FILE"
set +a

AUTH_SECRET="${BETTER_AUTH_SECRET:-}"
if [[ -z "$AUTH_SECRET" ]]; then
  die "BETTER_AUTH_SECRET is empty — production refuses to start without it (>= 32 chars)"
fi
if [[ ${#AUTH_SECRET} -lt 32 ]]; then
  die "BETTER_AUTH_SECRET is ${#AUTH_SECRET} chars — production needs >= 32"
fi

PG_PASSWORD="${POSTGRES_PASSWORD:-}"
DATABASE_URL="${DATABASE_URL:-}"

if [[ -z "$PG_PASSWORD" ]]; then
  # Reuse what the cluster already has: rotating the role password without
  # rotating it inside Postgres locks the app out of its own database. Check
  # both the Secret this script manages and the chart-rendered one, so switching
  # an existing install over to `existingSecret` keeps the working password.
  for candidate in "$SECRET_NAME" "$RELEASE"; do
    PG_PASSWORD="$(kubectl -n "$NAMESPACE" get secret "$candidate" \
      -o jsonpath='{.data.POSTGRES_PASSWORD}' 2>/dev/null | base64 -d || true)"
    [[ -n "$PG_PASSWORD" ]] && break
  done
fi
if [[ -z "$PG_PASSWORD" && -z "$DATABASE_URL" ]]; then
  PG_PASSWORD="$(openssl rand -hex 24)"
  step "generated a new POSTGRES_PASSWORD (kept in the Secret from now on)"
fi

if [[ -z "$DATABASE_URL" ]]; then
  DATABASE_URL="postgres://${PG_USER}:${PG_PASSWORD}@${RELEASE}-postgres:${PG_PORT}/${PG_DB}"
fi

REDIS_URL="${REDIS_URL:-redis://${RELEASE}-redis:6379}"

if [[ "${GEMINI_MODE:-}" != "api" ]]; then
  printf '\033[1;33m!! GEMINI_MODE is "%s" in %s. The chart sets GEMINI_MODE from\n' \
    "${GEMINI_MODE:-unset}" "$ENV_FILE"
  printf '   values (app.gemini.mode), so this file only contributes the key — and\n'
  printf '   "vertex" needs GCP application-default credentials the cluster does not\n'
  printf '   have. Use GEMINI_MODE=api plus GEMINI_API_KEY, or audits will 500.\033[0m\n'
fi
if [[ "${GEMINI_MODE:-}" == "api" && -z "${GEMINI_API_KEY:-}" ]]; then
  printf '\033[1;33m!! GEMINI_API_KEY is empty — the app will fall back to the offline\n'
  printf '   simulation. Set it in %s.\033[0m\n' "$ENV_FILE"
fi

SECRET_LITERALS=(
  "DATABASE_URL=$DATABASE_URL"
  "BETTER_AUTH_SECRET=$AUTH_SECRET"
)
[[ -n "$PG_PASSWORD" ]] && SECRET_LITERALS+=("POSTGRES_PASSWORD=$PG_PASSWORD")
[[ -n "$REDIS_URL" ]] && SECRET_LITERALS+=("REDIS_URL=$REDIS_URL")
[[ -n "${GEMINI_API_KEY:-}" ]] && SECRET_LITERALS+=("GEMINI_API_KEY=$GEMINI_API_KEY")
[[ -n "${SMTP_USER:-}" ]] && SECRET_LITERALS+=("SMTP_USER=$SMTP_USER")
[[ -n "${SMTP_PASS:-}" ]] && SECRET_LITERALS+=("SMTP_PASS=$SMTP_PASS")
[[ -n "${BULL_BOARD_PASS:-}" ]] && SECRET_LITERALS+=("BULL_BOARD_PASS=$BULL_BOARD_PASS")

say "Secret $SECRET_NAME in namespace $NAMESPACE"
printf '   keys:'
for entry in "${SECRET_LITERALS[@]}"; do printf ' %s' "${entry%%=*}"; done
printf '\n'
step "database host: ${DATABASE_URL##*@}"   # never print the credentials
step "redis host:    ${REDIS_URL#*://}"

if [[ "$APPLY" -eq 0 ]]; then
  say "Dry run"
  cat <<EOF
   Would run:

     kubectl -n $NAMESPACE create secret generic $SECRET_NAME \\
       --from-literal=DATABASE_URL=… (${#SECRET_LITERALS[@]} keys) \\
       --dry-run=client -o yaml | kubectl apply -f -

   Then install/upgrade with (secrets.create=false + the existingSecret above):

     helm upgrade --install $RELEASE charts/ecocide -n $NAMESPACE \\
       -f /path/to/values.production.yaml --set image.tag=<tag> \\
       -f - <<< 'secrets: {create: false, existingSecret: $SECRET_NAME}' \\
       --atomic --wait --timeout 15m

   Nothing has been changed. Re-run with --apply.
EOF
  exit 0
fi

kubectl -n "$NAMESPACE" create secret generic "$SECRET_NAME" \
  "${SECRET_LITERALS[@]/#/--from-literal=}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

say "Applied"
step "secret/$SECRET_NAME updated — roll the pods so they pick it up:"
step "  kubectl -n $NAMESPACE rollout restart deployment/$RELEASE"
