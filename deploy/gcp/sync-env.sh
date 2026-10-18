#!/usr/bin/env bash
#
# Push production configuration from a local (gitignored) `.env.production` into
# Secret Manager and onto the Cloud Run service.
#
#   ./deploy/gcp/sync-env.sh                 # dry run: print exactly what would change
#   ./deploy/gcp/sync-env.sh --apply         # write secrets + update the service revision
#   ./deploy/gcp/sync-env.sh --apply --secrets-only
#   ./deploy/gcp/sync-env.sh --print-flags   # the --set-env-vars/--set-secrets strings, for the first deploy
#
# Nothing is written without --apply: a tool that mutates production secrets
# should not do it because you pressed Enter.
#
# Where each key goes is HARDCODED below (SECRET_MAP / SERVICE_ENV_KEYS). A key
# that is in neither is a hard error, so a typo like `SMTP_PAS` cannot silently
# become a plain-text env var on a public service.
#
# The file is loaded as shell (`set -a; . file; set +a`), the same as `.env` for
# local dev, so shell quoting applies: single-quote values containing spaces,
# `#` or `<...>` — e.g. MAIL_FROM='ECOCIDE <no-reply@ecocide.quest>'.
set -euo pipefail

if [ "${BASH_VERSION%%.*}" -lt 4 ]; then
  echo "bash 4+ is required (associative arrays)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PROJECT="${PROJECT:-ecocide-511407}"
REGION="${REGION:-asia-southeast1}"
SERVICE="${SERVICE:-ecocide}"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env.production}"

# ---------------------------------------------------------------------------
# The split. Secrets are pushed to Secret Manager and referenced by the service;
# everything else is plain env. Both lists are exhaustive by design.
# ---------------------------------------------------------------------------

# KEY -> Secret Manager secret id (the ids setup.sh creates).
declare -A SECRET_MAP=(
  [BETTER_AUTH_SECRET]=ecocide-auth-secret
  [SMTP_PASS]=ecocide-smtp-pass
  [DATABASE_URL]=ecocide-db-url
  # The queue URL carries the Memorystore AUTH string, so it is a secret.
  [REDIS_URL]=ecocide-redis-url
  [BULL_BOARD_PASS]=ecocide-bull-pass
)

# Space-delimited allow-list of plain env vars (delimiters make the case match).
SERVICE_ENV_KEYS=" NODE_ENV AUTO_MIGRATE EVIDENCE_DIR BETTER_AUTH_URL APP_BASE_URL
  GEMINI_MODE GEMINI_PROJECT GEMINI_LOCATION GEMINI_MODEL
  SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER MAIL_FROM MAIL_REPLY_TO
  BULL_BOARD_USER "

# Credentials that must NOT be set in Vertex mode: the runtime service account's
# ADC is used, and an API key here would silently switch billing/engine or ship a
# long-lived credential.
FORBIDDEN_KEYS=" GEMINI_API_KEY GCP_SA_KEY GOOGLE_APPLICATION_CREDENTIALS "

REQUIRED_KEYS=" BETTER_AUTH_SECRET BETTER_AUTH_URL APP_BASE_URL "
RECOMMENDED_KEYS=" SMTP_HOST SMTP_USER SMTP_PASS MAIL_FROM "

# Delimited membership lists need single-space padding: these definitions wrap
# across lines for readability, and a newline where the match expects a space
# would make a valid key look unrecognised.
list_of() { printf ' %s ' $1; } # shellcheck disable=SC2086 # intentional word-splitting
SERVICE_ENV_KEYS="$(list_of "$SERVICE_ENV_KEYS")"
FORBIDDEN_KEYS="$(list_of "$FORBIDDEN_KEYS")"
REQUIRED_KEYS="$(list_of "$REQUIRED_KEYS")"
RECOMMENDED_KEYS="$(list_of "$RECOMMENDED_KEYS")"

MODE="dry-run"
SECRETS_ONLY=0
FAILED=0

usage() {
  sed -n '3,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) MODE="apply" ;;
    --dry-run) MODE="dry-run" ;;
    --print-flags) MODE="print-flags" ;;
    --secrets-only) SECRETS_ONLY=1 ;;
    --file) shift; ENV_FILE="${1:?--file needs a path}" ;;
    --file=*) ENV_FILE="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1 (try --help)" >&2; exit 1 ;;
  esac
  shift
done

die() { echo "error: $*" >&2; exit 1; }
note() { printf '%s\n' "$*"; }
warn() { printf '\033[33mwarn:\033[0m %s\n' "$*" >&2; }

command -v gcloud >/dev/null 2>&1 || die "gcloud is not on PATH."
[ -f "$ENV_FILE" ] || die "no such file: ${ENV_FILE}
Create one (the template is deploy/gcp/env.production.example) — it must stay out of git."

# ---------------------------------------------------------------------------
# Load
# ---------------------------------------------------------------------------

perms="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
if [ -n "$perms" ] && [ "${perms: -2}" != "00" ]; then
  warn "${ENV_FILE} is mode ${perms} (readable by group/other)."
  if [ "$MODE" = "apply" ]; then
    chmod 600 "$ENV_FILE"
    warn "fixed: now mode 600"
  else
    warn "would fix to 600 on --apply"
  fi
fi

# Key names only — values are never passed through a log or a pipe that prints.
mapfile -t KEYS < <(
  grep -oE '^[[:space:]]*(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*' "$ENV_FILE" |
    sed -E 's/^[[:space:]]*(export[[:space:]]+)?//' | sort -u
)
[ "${#KEYS[@]}" -gt 0 ] || die "no KEY=value lines found in ${ENV_FILE}"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------

unknown=()    # neither secret nor allowed env → refuse (fail closed)
forbidden=()  # credential vars that must not be set in Vertex/ADC mode

in_list() { # $1 = key, $2 = space-delimited list
  case "$2" in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

for key in "${KEYS[@]}"; do
  if in_list "$key" "$FORBIDDEN_KEYS"; then
    forbidden+=("$key")
  elif [ -n "${SECRET_MAP[$key]+set}" ]; then
    : # goes to Secret Manager
  elif in_list "$key" "$SERVICE_ENV_KEYS"; then
    : # goes to plain service env
  else
    unknown+=("$key")
  fi
done

if [ "${#forbidden[@]}" -gt 0 ]; then
  die "these keys must not be set for a Vertex/ADC deployment: ${forbidden[*]}
  The runtime service account supplies credentials; remove them from ${ENV_FILE}."
fi

if [ "${#unknown[@]}" -gt 0 ]; then
  die "unrecognised key(s): ${unknown[*]}
  Nothing is pushed for them. Either add them to SERVICE_ENV_KEYS (plain env),
  to SECRET_MAP (Secret Manager), or remove them from ${ENV_FILE}."
fi

for key in $REQUIRED_KEYS; do
  if [ -z "${!key:-}" ]; then
    FAILED=1
    warn "$key is not set (required in production)"
  fi
done

for key in $RECOMMENDED_KEYS; do
  if [ -z "${!key:-}" ]; then
    warn "$key is not set — the Carbon Registry cannot issue OTPs without SMTP"
  fi
done

if [ -n "${BETTER_AUTH_SECRET:-}" ]; then
  if [ "${#BETTER_AUTH_SECRET}" -lt 32 ]; then
    FAILED=1
    warn "BETTER_AUTH_SECRET is shorter than 32 characters"
  fi
  case "$BETTER_AUTH_SECRET" in
    ecocide-dev-secret*) FAILED=1; warn "BETTER_AUTH_SECRET is the development secret" ;;
  esac
fi

# Production invariants — cheaper to catch here than in a broken deployment.
if [ -n "${NODE_ENV:-}" ] && [ "$NODE_ENV" != "production" ]; then
  FAILED=1
  warn "NODE_ENV is '${NODE_ENV}': production suppresses the OTP console log and"
  warn "  makes Better Auth require BETTER_AUTH_SECRET. Leave it unset or 'production'."
fi
if [ "${AUTO_MIGRATE:-false}" = "true" ]; then
  FAILED=1
  warn "AUTO_MIGRATE=true: the Cloud Run migrate job owns DDL. Use false so schema"
  warn "  changes run once per release instead of on every cold start."
fi

if [ -n "${DATABASE_URL:-}" ]; then
  case "$DATABASE_URL" in
    *"?host=/cloudsql/${PROJECT}:${REGION}:"*) : ;;
    *) warn "DATABASE_URL does not look like the Cloud SQL socket form
  (…?host=/cloudsql/${PROJECT}:${REGION}:…). 'setup.sh' already created that
  secret; drop DATABASE_URL from ${ENV_FILE} unless you are pointing elsewhere." ;;
  esac
fi

if [ "$MODE" = "apply" ] && [ "$FAILED" = "1" ]; then
  die "refusing to apply with the problems above."
fi

# ---------------------------------------------------------------------------
# Build the flag payloads
#
# Secret *references* (ecocide-auth-secret:latest) can never contain a comma, so
# they use the plain form. Plain env values might (MAIL_FROM with a comma), so
# those use gcloud's alternative-delimiter form and reject '|' in a value.
# ---------------------------------------------------------------------------

secret_refs=()
secret_keys=()
for key in $(printf '%s\n' "${!SECRET_MAP[@]}" | sort); do
  if [ -n "${!key:-}" ]; then
    secret_refs+=("${key}=${SECRET_MAP[$key]}:latest")
    secret_keys+=("$key")
  fi
done

env_pairs=()
env_keys=()
if [ "$SECRETS_ONLY" != "1" ]; then
  for key in $(printf '%s\n' $SERVICE_ENV_KEYS | sort -u); do
    value="${!key-}"
    [ -n "$value" ] || continue # an empty value means "leave it as the image default"
    case "$value" in
      *"|"*) die "$key contains a '|', which this script uses as the flag delimiter. Set it directly:
  gcloud run services update ${SERVICE} --region=${REGION} --update-env-vars=${key}=…" ;;
    esac
    env_pairs+=("${key}=${value}")
    env_keys+=("$key")
  done
fi

secrets_flag=""
[ "${#secret_refs[@]}" -gt 0 ] && secrets_flag="$(IFS=,; echo "${secret_refs[*]}")"
env_flag=""
[ "${#env_pairs[@]}" -gt 0 ] && env_flag="^|^$(IFS='|'; echo "${env_pairs[*]}")"

print_flags() {
  note "--set-secrets=${secrets_flag}"
  note "--set-env-vars='${env_flag}'"
}

# ---------------------------------------------------------------------------
# Act
# ---------------------------------------------------------------------------

note "file:    ${ENV_FILE}"
note "project: ${PROJECT}   service: ${SERVICE}   region: ${REGION}"
note "mode:    ${MODE}$([ "$SECRETS_ONLY" = "1" ] && echo ' (secrets only)')"
note ""

if [ "$MODE" = "print-flags" ]; then
  note "Paste these into the first deploy (deploy/gcp/README.md step 4):"
  print_flags
  exit 0
fi

changed_secrets=0
changed_env=0

for key in "${secret_keys[@]}"; do
  sid="${SECRET_MAP[$key]}"
  value="${!key}"

  current="$(gcloud secrets versions access latest --secret="$sid" --project="$PROJECT" 2>/dev/null || true)"
  if [ -n "$current" ] && [ "$current" = "$value" ]; then
    note "  ${key} → secret ${sid} (unchanged)"
    continue
  fi

  if [ "$MODE" = "dry-run" ]; then
    note "  ${key} → secret ${sid} (would add a version)"
    changed_secrets=$((changed_secrets + 1))
    continue
  fi

  if ! gcloud secrets describe "$sid" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud secrets create "$sid" --project="$PROJECT" --replication-policy=automatic >/dev/null
    note "  ${key} → created secret ${sid}"
  fi

  version="$(printf '%s' "$value" | gcloud secrets versions add "$sid" --project="$PROJECT" \
    --data-file=- --format='value(name)' | awk -F/ '{print $NF}')"
  note "  ${key} → secret ${sid} (version ${version})"
  changed_secrets=$((changed_secrets + 1))
done

for key in "${env_keys[@]}"; do
  note "  ${key} → service env (value not shown)"
  changed_env=$((changed_env + 1))
done

if [ "$changed_env" -gt 0 ] && [ "$MODE" = "dry-run" ]; then
  note "  (would update the service revision with ${#env_keys[@]} env var(s))"
fi

note ""
note "summary: ${changed_secrets} secret change(s), ${changed_env} env var(s)"

if [ "$MODE" = "dry-run" ]; then
  note ""
  note "Dry run — nothing written. Re-run with --apply."
  exit 0
fi

if [ "$SECRETS_ONLY" = "1" ]; then
  note "Secrets pushed. A new revision picks them up on the next deploy."
  exit 0
fi

if ! gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  note ""
  note "Service '${SERVICE}' does not exist yet, so there is no revision to update."
  note "The secrets are pushed; use these flags in the first deploy:"
  print_flags
  exit 0
fi

if [ "$changed_env" -eq 0 ] && [ "$changed_secrets" -eq 0 ]; then
  note "Nothing changed — no new revision created."
  exit 0
fi

args=(run services update "$SERVICE" --region="$REGION" --project="$PROJECT")
if [ -n "$secrets_flag" ]; then
  args+=(--update-secrets="$secrets_flag")
fi
if [ -n "$env_flag" ]; then
  args+=(--update-env-vars="$env_flag")
fi

note ""
note "Creating a new revision…"
gcloud "${args[@]}"

note ""
note "Done. Verify:"
note "  gcloud run services describe ${SERVICE} --region=${REGION} --format=export | sed -n '/env:/,\$p'"
note "  curl -s https://<your-domain>/api/health   # expect database=PostgreSQL Active, mail=smtp"
