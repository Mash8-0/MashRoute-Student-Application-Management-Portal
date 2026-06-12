#!/usr/bin/env bash
# MashRoute — one-shot deploy/update script. Run ON the VPS from the repo root:
#   cd /var/www/mashroute && bash deploy/deploy.sh
#
# Idempotent: safe to run for the first deploy or any later update.
# Assumes: Node 20+, pm2, nginx installed; backend/.env already filled in.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "▶ Deploying from $ROOT"

# Pull latest if this is a git checkout (skip silently otherwise)
if [ -d .git ]; then
  echo "▶ git pull"
  git pull --ff-only || echo "  (skipped — resolve git state manually if needed)"
fi

# ── Backend ────────────────────────────────────────────────
echo "▶ Backend: install + prisma"
cd "$ROOT/backend"
[ -f .env ] || { echo "✗ backend/.env missing — copy .env.production.example and fill it in first."; exit 1; }
npm ci
npx prisma generate
npx prisma db push            # syncs schema to Neon (non-destructive)
mkdir -p logs uploads

# ── Frontend ───────────────────────────────────────────────
echo "▶ Frontend: build"
cd "$ROOT/frontend"
npm ci
npm run build                 # → frontend/dist

# ── Restart API + reload web server ────────────────────────
echo "▶ Restart services"
cd "$ROOT"
if pm2 describe mashroute-api >/dev/null 2>&1; then
  pm2 reload mashroute-api --update-env
else
  pm2 start deploy/ecosystem.config.js
  pm2 save
fi
sudo nginx -t && sudo systemctl reload nginx || echo "  (nginx reload skipped — check config)"

echo "✓ Deploy complete. API: pm2 logs mashroute-api"
