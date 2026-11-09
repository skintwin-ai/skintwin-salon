#!/usr/bin/env bash
set -euo pipefail
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1090
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 16 >/dev/null
nvm use 16
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/node_modules/.bin:$PATH"
PORT="${GATSBY_PORT:-9000}"
HOST="${GATSBY_HOST:-0.0.0.0}"
exec gatsby develop -p "$PORT" -H "$HOST" "$@"
