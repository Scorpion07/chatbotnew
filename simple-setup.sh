#!/bin/bash
# Simple setup script - just the essentials

set -e

echo "🚀 ChatVerse AI - Simple Setup"
echo "==============================="

# Install system dependencies
echo "📦 Installing system dependencies..."
sudo apt-get update -y
sudo apt-get install -y curl git

# Install Node.js 20.x
echo "📦 Installing Node.js..."
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2
echo "📦 Installing PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
    sudo npm install -g pm2
fi

# Install Nginx
echo "📦 Installing Nginx..."
if ! command -v nginx >/dev/null 2>&1; then
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
fi

echo "✅ Dependencies installed"

# Setup project
if [ ! -d "chatbotnew" ]; then
    echo "📥 Cloning repository..."
    git clone https://github.com/Scorpion07/chatbotnew.git
    cd chatbotnew
else
    echo "📥 Updating repository..."
    cd chatbotnew
    git pull origin main
fi

# Backend setup
echo "🔧 Setting up backend..."
cd backend
npm install --production
mkdir -p data logs uploads

# Create basic .env
if [ ! -f ".env" ]; then
    cat > .env << EOF
PORT=5000
NODE_ENV=production
JWT_SECRET=your-jwt-secret-change-this
DATABASE_URL=sqlite:./data/database.sqlite
EOF
fi

# Start backend temporarily to create database
echo "🗄️ Initializing database..."
timeout 10s npm start || true

# Try to create test accounts
echo "👥 Creating test accounts..."
npm run create-test-accounts || echo "⚠️ Manual account creation may be needed"

cd ..

# Frontend setup
echo "🎨 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Deploy
echo "🚀 Deploying..."
sudo mkdir -p /var/www/chatverse
sudo cp -r frontend/dist/* /var/www/chatverse/
sudo chown -R www-data:www-data /var/www/chatverse

# Configure Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/chatverse
sudo ln -sf /etc/nginx/sites-available/chatverse /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Start backend with PM2
cd backend
pm2 delete chatverse-backend 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "✅ Setup complete!"
echo "🌐 Visit: http://$(curl -s ifconfig.me)"
echo "📧 Test login: premium1@test.com / password123"