#!/usr/bin/env bash
set -e

echo "=== TalkSphere AI Auto-Deploy Script ==="
echo ""

# Variables - CHANGE THESE IF NEEDED
REPO_DIR=$(pwd)
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
APP_DIR="/var/www/chatverse"
NGINX_CONF_SOURCE="$REPO_DIR/deploy/nginx.conf"
NGINX_CONF_DEST="/etc/nginx/sites-available/chatverse"

# Step 1: Install Node.js if missing
echo ">> Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "Node.js already installed: $(node -v)"
fi

# Step 2: Install PM2 if missing
echo ">> Checking PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing PM2..."
  sudo npm i -g pm2
else
  echo "PM2 already installed"
fi

# Step 3: Install Nginx if missing
echo ">> Checking Nginx..."
if ! command -v nginx >/dev/null 2>&1; then
  echo "Installing Nginx..."
  sudo apt-get update
  sudo apt-get install -y nginx
else
  echo "Nginx already installed"
fi

# Step 4: Backend setup
echo ""
echo ">> Setting up backend..."
cd "$BACKEND_DIR"

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo "IMPORTANT: Edit backend/.env and add your API keys!"
  read -p "Press Enter after you've set your .env values..."
fi

echo "Installing backend dependencies..."
npm install

# Create data directory for SQLite
mkdir -p data

# Step 5: Frontend setup
echo ""
echo ">> Setting up frontend..."
cd "$FRONTEND_DIR"
echo "Installing frontend dependencies..."
npm install

echo "Building frontend..."
npm run build

# Step 6: Deploy frontend
echo ""
echo ">> Deploying frontend to $APP_DIR..."
sudo mkdir -p "$APP_DIR"
sudo cp -r "$FRONTEND_DIR/dist/"* "$APP_DIR/"
sudo chown -R www-data:www-data "$APP_DIR"

# Step 7: Setup Nginx
echo ""
echo ">> Configuring Nginx..."
sudo cp "$NGINX_CONF_SOURCE" "$NGINX_CONF_DEST"

# Remove default site if exists
if [ -L /etc/nginx/sites-enabled/default ]; then
  sudo rm /etc/nginx/sites-enabled/default
fi

# Enable ChatVerse site
sudo ln -sf "$NGINX_CONF_DEST" /etc/nginx/sites-enabled/chatverse

echo "Testing Nginx config..."
sudo nginx -t

echo "Restarting Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

# Step 8: Start backend with PM2
echo ""
echo ">> Starting backend with PM2..."
cd "$BACKEND_DIR"
pm2 delete chatverse-backend 2>/dev/null || true
# Use the correct ecosystem file extension from repo (CommonJS)
if [ -f ecosystem.config.cjs ]; then
  pm2 start ecosystem.config.cjs
else
  pm2 start ecosystem.config.js
fi
pm2 save
pm2 startup | grep -v "PM2" | sudo bash || true

echo ""
echo "============================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "============================================"
echo ""
echo "Frontend: http://$(hostname -I | awk '{print $1}')"
echo "Backend running on port 5000 (proxied via Nginx)"
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check backend status"
echo "  pm2 logs chatverse-backend - View backend logs"
echo "  pm2 restart chatverse-backend - Restart backend"
echo "  sudo systemctl status nginx - Check Nginx status"
echo ""
echo "To update later: git pull && bash deploy/deploy.sh"
echo ""
