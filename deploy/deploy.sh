#!/usr/bin/env bash
set -euo pipefail

# Variables
APP_DIR=/var/www/chatverse
REPO_DIR=/var/www/chatverse-repo
BACKEND_DIR=$REPO_DIR/backend
FRONTEND_DIR=$REPO_DIR/frontend

# Ensure dependencies
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm i -g pm2
fi

# Pull latest code (assumes repo already cloned)
cd "$REPO_DIR"
.git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo: $REPO_DIR"; exit 1; }

git fetch --all --prune
GIT_BRANCH=${1:-main}
git checkout "$GIT_BRANCH"
git pull --ff-only origin "$GIT_BRANCH"

# Install dependencies
cd "$BACKEND_DIR" && npm ci
cd "$FRONTEND_DIR" && npm ci

# Build frontend
cd "$FRONTEND_DIR" && npm run build

# Deploy frontend build
sudo mkdir -p "$APP_DIR"
sudo rsync -a --delete "$FRONTEND_DIR/dist/" "$APP_DIR/"

# PM2 restart backend
cd "$BACKEND_DIR"
pm2 startOrRestart ecosystem.config.js --env production
pm2 save

# Nginx reload (assumes config already placed/enabled)
sudo nginx -t && sudo systemctl reload nginx

echo "Deployment complete."
