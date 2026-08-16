#!/usr/bin/env bash
# Local development helper for MashRoute.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT/backend"
npm run dev > /tmp/mashroute-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 3

cd "$ROOT/frontend"
npm run dev > /tmp/mashroute-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo "$BACKEND_PID $FRONTEND_PID" > /tmp/mashroute-pids.txt
echo "Both servers starting..."
sleep 4
echo "=== Backend ==="
cat /tmp/mashroute-backend.log
echo "=== Frontend ==="
cat /tmp/mashroute-frontend.log
