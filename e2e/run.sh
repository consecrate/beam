#!/usr/bin/env bash
# Runs the end-to-end smoke test against a fresh in-memory backend.
# Expects the Next.js dev server in e2e mode on :3000 (npm run e2e:next).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${E2E_BACKEND_PORT:-3299}"
if curl -s -o /dev/null -m 1 -XPOST "localhost:$PORT" -d '{}'; then
  echo "Port $PORT is already in use (a leftover e2e backend?). Stop it first." >&2
  exit 1
fi
# A single node process (not npx), so the trap below really stops it.
node --import tsx e2e/backend.ts > /tmp/beam-e2e-backend.log 2>&1 &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -s -o /dev/null -XPOST "localhost:$PORT" -d '{}' && break; sleep 0.5; done
mkdir -p "${SHOTS:-e2e/shots}"
node e2e/smoke.mjs
