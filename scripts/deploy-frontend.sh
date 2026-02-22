#!/usr/bin/env bash
# Manual frontend deployment to Cloudflare Pages.
# Usage: ./scripts/deploy-frontend.sh
#
# Prerequisites:
#   - Node.js installed
#   - wrangler available (npx or global install)
#   - Authenticated via `npx wrangler login` or CLOUDFLARE_API_TOKEN env var
#
# For automated deploys, push to master — GitHub Actions handles it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "=== Building frontend ==="
cd "$FRONTEND_DIR"
npm ci
npm run build

echo ""
echo "=== Deploying to Cloudflare Pages ==="
npx wrangler pages deploy dist --project-name=agenda-souterrain

echo ""
echo "=== Done ==="
