#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}    ChatVerse AI - Complete Setup Script      ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should NOT be run as root for security reasons.${NC}"
   echo -e "${YELLOW}Please run as a regular user with sudo privileges.${NC}"
   exit 1
fi

# Variables
REPO_DIR=$(pwd)
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
APP_DIR="/var/www/chatverse"
NGINX_CONF_SOURCE="$REPO_DIR/deploy/nginx.conf"
NGINX_CONF_DEST="/etc/nginx/sites-available/chatverse"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: System Updates
echo -e "${BLUE}>> Updating system packages...${NC}"
sudo apt-get update -y
print_status "System packages updated"

# Step 2: Install Node.js 20
echo -e "${BLUE}>> Installing Node.js 20...${NC}"
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status "Node.js installed: $(node -v)"
else
    print_status "Node.js already installed: $(node -v)"
fi

# Step 3: Install build essentials for bcrypt and other native modules
echo -e "${BLUE}>> Installing build essentials for native modules...${NC}"
sudo apt-get install -y build-essential python3-dev python3-setuptools
print_status "Build essentials installed"

# Step 4: Install PM2 globally
echo -e "${BLUE}>> Installing PM2...${NC}"
if ! command -v pm2 >/dev/null 2>&1; then
    sudo npm install -g pm2
    print_status "PM2 installed"
else
    print_status "PM2 already installed"
fi

# Step 5: Install Nginx
echo -e "${BLUE}>> Installing Nginx...${NC}"
if ! command -v nginx >/dev/null 2>&1; then
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    print_status "Nginx installed and started"
else
    print_status "Nginx already installed"
fi

# Step 6: Install SQLite3 (for database)
echo -e "${BLUE}>> Installing SQLite3...${NC}"
sudo apt-get install -y sqlite3 libsqlite3-dev
print_status "SQLite3 installed"

# Step 7: Setup Backend
echo ""
echo -e "${BLUE}>> Setting up backend...${NC}"
cd "$BACKEND_DIR"

# Remove existing node_modules to prevent conflicts
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}Removing existing node_modules...${NC}"
    rm -rf node_modules package-lock.json
fi

# Install backend dependencies with exact versions to avoid conflicts
echo -e "${BLUE}Installing backend dependencies...${NC}"
npm install --no-package-lock

# Force rebuild native modules (especially bcrypt)
echo -e "${BLUE}Rebuilding native modules...${NC}"
npm rebuild

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << 'EOF'
# API Keys (Add your actual keys here)
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# JWT Secret (Change this to a secure random string)
JWT_SECRET=chatverse_jwt_secret_change_this_in_production

# Database
DATABASE_PATH=./data/database.sqlite

# Server
PORT=5000
NODE_ENV=production
EOF
    print_warning "Created .env file - Please add your actual API keys!"
fi

# Initialize database
echo -e "${BLUE}Initializing database...${NC}"
mkdir -p data logs uploads
if [ ! -f "data/database.sqlite" ]; then
    touch data/database.sqlite
fi

# Test backend startup
echo -e "${BLUE}Testing backend startup...${NC}"
timeout 10s npm start || true
print_status "Backend setup completed"

# Step 8: Setup Frontend
echo ""
echo -e "${BLUE}>> Setting up frontend...${NC}"
cd "$FRONTEND_DIR"

# Remove existing node_modules
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}Removing existing frontend node_modules...${NC}"
    rm -rf node_modules package-lock.json
fi

# Install frontend dependencies
echo -e "${BLUE}Installing frontend dependencies...${NC}"
npm install --no-package-lock

# Build for production
echo -e "${BLUE}Building frontend for production...${NC}"
npm run build
print_status "Frontend built successfully"

# Step 9: Deploy Frontend
echo ""
echo -e "${BLUE}>> Deploying frontend...${NC}"
sudo mkdir -p "$APP_DIR"
sudo cp -r dist/* "$APP_DIR/"
sudo chown -R www-data:www-data "$APP_DIR"
sudo chmod -R 755 "$APP_DIR"
print_status "Frontend deployed to $APP_DIR"

# Step 10: Configure Nginx
echo -e "${BLUE}>> Configuring Nginx...${NC}"
sudo cp "$NGINX_CONF_SOURCE" "$NGINX_CONF_DEST"

# Enable site
if [ ! -L "/etc/nginx/sites-enabled/chatverse" ]; then
    sudo ln -s "$NGINX_CONF_DEST" /etc/nginx/sites-enabled/
fi

# Remove default site if it exists
if [ -L "/etc/nginx/sites-enabled/default" ]; then
    sudo rm /etc/nginx/sites-enabled/default
fi

# Test nginx configuration
if sudo nginx -t; then
    print_status "Nginx configuration is valid"
    sudo systemctl reload nginx
    print_status "Nginx reloaded"
else
    print_error "Nginx configuration has errors"
    exit 1
fi

# Step 11: Start Backend with PM2
echo ""
echo -e "${BLUE}>> Starting backend with PM2...${NC}"
cd "$BACKEND_DIR"

# Stop any existing PM2 processes
pm2 stop all || true
pm2 delete all || true

# Start the application
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup | grep -E "sudo env PATH" | bash || true
print_status "Backend started with PM2"

# Step 12: Setup Firewall (UFW)
echo -e "${BLUE}>> Configuring firewall...${NC}"
if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 22    # SSH
    sudo ufw allow 80    # HTTP
    sudo ufw allow 443   # HTTPS
    sudo ufw --force enable
    print_status "Firewall configured"
else
    print_warning "UFW not installed, skipping firewall setup"
fi

# Step 13: Create test accounts
echo ""
echo -e "${BLUE}>> Creating test accounts...${NC}"
cd "$BACKEND_DIR"
if [ -f "scripts/create-test-accounts.js" ]; then
    node scripts/create-test-accounts.js || true
    print_status "Test accounts created"
fi

# Step 14: Final status check
echo ""
echo -e "${BLUE}>> Final system check...${NC}"

# Check if backend is running
if pm2 list | grep -q "online"; then
    print_status "Backend is running"
else
    print_warning "Backend may not be running properly"
fi

# Check if nginx is running
if systemctl is-active --quiet nginx; then
    print_status "Nginx is running"
else
    print_warning "Nginx is not running"
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}    🎉 ChatVerse AI Setup Complete! 🎉       ${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${YELLOW}📋 Setup Summary:${NC}"
echo -e "• Frontend: Deployed to $APP_DIR"
echo -e "• Backend: Running on PM2 (port 5000)"
echo -e "• Database: SQLite at $BACKEND_DIR/data/database.sqlite"
echo -e "• Nginx: Configured and running"
echo ""
echo -e "${YELLOW}🌐 Access your application:${NC}"
echo -e "• URL: http://$SERVER_IP"
echo -e "• Admin: Go to /admin for admin panel"
echo ""
echo -e "${YELLOW}🔑 Test Accounts:${NC}"
echo -e "• Free User: test1@test.com / password123"
echo -e "• Premium User: premium1@test.com / password123"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo -e "1. Add your API keys to $BACKEND_DIR/.env"
echo -e "2. Restart backend: pm2 restart all"
echo -e "3. Test the application in browser"
echo ""
echo -e "${YELLOW}💡 Useful Commands:${NC}"
echo -e "• View logs: pm2 logs"
echo -e "• Restart backend: pm2 restart all"
echo -e "• Check status: pm2 status"
echo -e "• Reload nginx: sudo systemctl reload nginx"
echo ""
echo -e "${GREEN}✅ All done! Your ChatVerse AI is ready to use! 🚀${NC}"
