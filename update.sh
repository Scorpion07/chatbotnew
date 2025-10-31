#!/bin/bash
set -e

echo "🚀 ChatVerse AI Auto-Update Script"
echo "=================================="

# Get current directory
REPO_DIR=$(pwd)
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
APP_DIR="/var/www/chatverse"

echo "📂 Working directory: $REPO_DIR"

# Pull latest changes
echo ""
echo "📡 Pulling latest changes from git..."
git pull origin main

# Install/update backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install

# Install/update frontend dependencies and build
echo ""
echo "📦 Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install

echo ""
echo "🔨 Building frontend..."
npm run build

# Deploy frontend
echo ""
echo "🚀 Deploying frontend..."
sudo cp -r "$FRONTEND_DIR/dist/"* "$APP_DIR/"
sudo chown -R www-data:www-data "$APP_DIR"

# Update nginx config if changed
echo ""
echo "⚙️  Updating nginx config..."
sudo cp "$REPO_DIR/deploy/nginx.conf" "/etc/nginx/sites-available/chatverse"
sudo nginx -t

# Restart services
echo ""
echo "🔄 Restarting services..."
cd "$BACKEND_DIR"

# Restart backend
echo "   Restarting backend..."
pm2 restart chatverse-backend || pm2 start ecosystem.config.cjs

# Reload nginx
echo "   Reloading nginx..."
sudo systemctl reload nginx

echo ""
echo "✅ Update complete!"
echo ""
echo "🌐 Your app is running at:"
PUBLIC_IP=$(curl -s https://api.ipify.org 2>/dev/null || curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo "   http://$PUBLIC_IP"
echo ""
echo "📊 Service status:"
echo "   Backend: $(pm2 list | grep chatverse-backend | awk '{print $10}' || echo 'Not running')"
echo "   Nginx: $(systemctl is-active nginx)"
echo ""
echo "📜 View logs:"
echo "   Backend logs: pm2 logs chatverse-backend"
echo "   Nginx logs: sudo tail -f /var/log/nginx/error.log"