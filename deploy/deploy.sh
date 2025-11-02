#!/usr/bin/env bash
set -e

echo "=== TalkSphere AI Auto-Deploy Script ==="
echo ""

# Variables - CHANGE THESE IF NEEDED
REPO_DIR=$(pwd)
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
APP_DIR="/var/www/chatverse"

# Domain and email (can be overridden via environment or first/second args)
DOMAIN=${DOMAIN:-${1:-talk-sphere.com}}
EMAIL=${EMAIL:-${2:-admin@talk-sphere.com}}

NGINX_CONF_DEST="/etc/nginx/sites-available/${DOMAIN}"

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

# Step 7: Setup Nginx (HTTP first)
echo ""
echo ">> Configuring Nginx for $DOMAIN (HTTP) ..."

NGINX_HTTP_CONF=$(cat <<NGX
upstream chatverse_backend {
  server 127.0.0.1:5000;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN} www.${DOMAIN};

  root ${APP_DIR};
  index index.html;

  # Serve ACME challenge for certbot
  location /.well-known/acme-challenge/ {
    root ${APP_DIR};
  }

  # Frontend (SPA)
  location / {
    try_files $uri $uri/ /index.html;
  }

  # API
  location /api/ {
    proxy_pass http://chatverse_backend/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20m;
  }

  # Socket.IO / WebSockets
  location /socket.io/ {
    proxy_pass http://chatverse_backend/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGX
)

echo "Writing Nginx config to $NGINX_CONF_DEST"
echo "$NGINX_HTTP_CONF" | sudo tee "$NGINX_CONF_DEST" >/dev/null

# Remove default site if exists
if [ -L /etc/nginx/sites-enabled/default ]; then
  sudo rm /etc/nginx/sites-enabled/default
fi

# Enable site
sudo ln -sf "$NGINX_CONF_DEST" "/etc/nginx/sites-enabled/${DOMAIN}"

echo "Testing Nginx config..."
sudo nginx -t

echo "Restarting Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

# Step 8: Obtain and configure HTTPS with Certbot
echo ""
echo ">> Enabling HTTPS with Let's Encrypt for $DOMAIN ..."
sudo apt-get install -y certbot python3-certbot-nginx

# Request/renew certificate and auto-configure SSL with redirect
sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
  -m "$EMAIL" --agree-tos --non-interactive --redirect || true

echo "Testing Nginx config after SSL..."
sudo nginx -t
sudo systemctl reload nginx

# Step 9: Start backend with PM2
echo ""
echo ">> Starting backend with PM2..."
cd "$BACKEND_DIR"
pm2 delete chatverse-backend 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup | grep -v "PM2" | sudo bash || true

echo ""
echo "============================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "============================================"
echo ""
echo "Frontend: https://${DOMAIN}"
echo "Backend proxied via Nginx to http://127.0.0.1:5000"
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check backend status"
echo "  pm2 logs chatverse-backend - View backend logs"
echo "  pm2 restart chatverse-backend - Restart backend"
echo "  sudo systemctl status nginx - Check Nginx status"
echo ""
echo "To update later: git pull && bash deploy/deploy.sh"
echo ""
