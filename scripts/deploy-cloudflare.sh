#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${CLOUDFLARE_PAGES_PROJECT:-ai-content-optimizer}"
WORKER_ENV="${CLOUDFLARE_WORKER_ENV:-production}"
SKIP_INSTALL=0
DEPLOY_WORKER=1
PAGES_ARGS=()

usage() {
  cat <<'EOF'
Usage: scripts/deploy-cloudflare.sh [options] [-- <additional wrangler pages args>]

Options:
  --project <name>       Override Cloudflare Pages project name (default: ai-content-optimizer)
  --worker-env <env>     Wrangler environment to deploy for the worker (default: production)
  --skip-install         Skip running `npm install`
  --skip-worker          Skip deploying the analyze-worker (Pages deploy only)
  -h, --help             Show this help message

Environment variables:
  CLOUDFLARE_PAGES_PROJECT   Same as --project
  CLOUDFLARE_WORKER_ENV      Same as --worker-env
  SKIP_INSTALL               Set to 1 to skip npm install
  DEPLOY_WORKER              Set to 0 to skip worker deployment

All arguments after `--` are passed directly to `wrangler pages deploy`.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_NAME="$2"
      shift 2
      ;;
    --project=*)
      PROJECT_NAME="${1#*=}"
      shift
      ;;
    --worker-env)
      WORKER_ENV="$2"
      shift 2
      ;;
    --worker-env=*)
      WORKER_ENV="${1#*=}"
      shift
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --skip-worker)
      DEPLOY_WORKER=0
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      PAGES_ARGS+=("$@")
      break
      ;;
    *)
      PAGES_ARGS+=("$1")
      shift
      ;;
  esac
  if [[ $# -lt 0 ]]; then
    break
  fi
  if [[ ${1:-} == "" ]]; then
    break
  fi
done

if [[ "${SKIP_INSTALL}" == "" ]]; then
  SKIP_INSTALL=0
fi
if [[ "${DEPLOY_WORKER}" == "" ]]; then
  DEPLOY_WORKER=1
fi

log() {
  printf '[deploy] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Error: required command `%s` not found in PATH.\n' "$1" >&2
    exit 1
  fi
}

require_cmd npm
require_cmd wrangler

if [[ "${SKIP_INSTALL}" != "1" ]]; then
  log 'Installing dependencies (npm install)'
  npm install --no-fund --no-audit
else
  log 'Skipping dependency install (--skip-install)'
fi

log 'Building production bundle (npm run build)'
npm run build

if [[ ! -d dist ]]; then
  printf 'Error: build output directory `dist/` not found.\n' >&2
  exit 1
fi

log "Deploying Cloudflare Pages project: ${PROJECT_NAME}"
wrangler pages deploy dist --project-name "${PROJECT_NAME}" "${PAGES_ARGS[@]}"

if [[ "${DEPLOY_WORKER}" == "1" ]]; then
  log "Deploying analyze-worker with wrangler env: ${WORKER_ENV}"
  wrangler deploy --env "${WORKER_ENV}"
else
  log 'Skipping worker deployment (--skip-worker)'
fi

log 'Deployment complete.'
