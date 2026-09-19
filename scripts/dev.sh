#!/usr/bin/env bash
# Start the whiteboard, or do nothing if it is already up.
#
# WHY: this is the one command handed to a human, so assume it gets pressed
# twice. `vite --strictPort` exits 1 on a busy port, which would read as a
# broken handoff rather than "it's already running" — so check first.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=5199
URL="http://127.0.0.1:${PORT}"

if curl -fsS -o /dev/null --max-time 2 "$URL"; then
  echo "Already running — open ${URL}"
  exit 0
fi

if [ ! -d "$REPO/node_modules" ]; then
  echo "Installing dependencies..."
  pnpm --dir "$REPO" install
fi

echo "Starting on ${URL} — Ctrl-C to stop."
exec pnpm --dir "$REPO" dev
