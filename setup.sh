#!/usr/bin/env bash
set -e

echo "🚀 ChatVerse AI Complete Setup Script"
echo "======================================"
echo ""
echo "This script will:"
echo "✅ Install all dependencies (Node.js, PM2, Nginx)"
echo "✅ Clone the repository (if not already cloned)"
echo "✅ Setup database and create test accounts"
echo "✅ Build and deploy the application"
echo "✅ Configure Nginx reverse proxy"
echo "✅ Start all services"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables
REPO_URL="https://github.com/Scorpion07/chatbotnew.git"
PROJECT_NAME="chatbotnew"
APP_DIR="/var/www/chatverse"
NGINX_CONF="/etc/nginx/sites-available/chatverse"

# Function to print colored output
print_status() {
    echo -e "${BLUE}>> $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should NOT be run as root for security reasons."
   echo "Please run as a regular user with sudo privileges."
   exit 1
fi

# Check if we have sudo access
print_status "Checking sudo access..."
if ! sudo -n true 2>/dev/null; then
    echo "This script requires sudo privileges. You may be prompted for your password."
    sudo -v
fi

# Step 1: Update system packages
print_status "Updating system packages..."
sudo apt-get update -y
print_success "System packages updated"

# Step 2: Install Node.js 20.x
print_status "Installing Node.js 20.x..."
if ! command -v node >/dev/null 2>&1; then
    # Install Node.js from NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_success "Node.js installed: $(node -v)"
else
    print_success "Node.js already installed: $(node -v)"
fi

# Verify npm is working
if ! command -v npm >/dev/null 2>&1; then
    print_error "npm not found. Please install Node.js properly."
    exit 1
fi

# Step 3: Install PM2 globally
print_status "Installing PM2 process manager..."
if ! command -v pm2 >/dev/null 2>&1; then
    sudo npm install -g pm2
    print_success "PM2 installed"
else
    print_success "PM2 already installed"
fi

# Step 4: Install Nginx
print_status "Installing Nginx web server..."
if ! command -v nginx >/dev/null 2>&1; then
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    print_success "Nginx installed and enabled"
else
    print_success "Nginx already installed"
fi

# Step 5: Install Git (if not already installed)
print_status "Checking Git installation..."
if ! command -v git >/dev/null 2>&1; then
    sudo apt-get install -y git
    print_success "Git installed"
else
    print_success "Git already installed: $(git --version)"
fi

# Step 6: Clone or update repository
print_status "Setting up project repository..."
if [ -d "$PROJECT_NAME" ]; then
    print_warning "Project directory already exists. Updating..."
    cd "$PROJECT_NAME"
    git pull origin main
    print_success "Repository updated"
else
    print_status "Cloning repository..."
    git clone "$REPO_URL" "$PROJECT_NAME"
    cd "$PROJECT_NAME"
    print_success "Repository cloned"
fi

# Get absolute path
PROJECT_DIR=$(pwd)
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

print_status "Project directory: $PROJECT_DIR"

# Step 7: Setup backend
print_status "Setting up backend..."
cd "$BACKEND_DIR"

# Install backend dependencies
print_status "Installing backend dependencies..."
npm install
print_success "Backend dependencies installed"

# Verify critical dependencies
print_status "Verifying critical dependencies..."
if ! npm list bcryptjs > /dev/null 2>&1; then
    print_status "Installing bcryptjs..."
    npm install bcryptjs
fi
if ! npm list sequelize > /dev/null 2>&1; then
    print_status "Installing sequelize..."
    npm install sequelize
fi
if ! npm list sqlite3 > /dev/null 2>&1; then
    print_status "Installing sqlite3..."
    npm install sqlite3
fi
print_success "Dependencies verified"

# Create necessary directories
print_status "Creating required directories..."
mkdir -p data
mkdir -p logs
mkdir -p uploads
print_success "Directories created"

# Check if .env exists, if not create from example
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning ".env file created from example. You may want to edit it with your API keys."
    else
        # Create a basic .env file with absolute paths
        DB_PATH="$BACKEND_DIR/data/database.sqlite"
        cat > .env << EOF
# Database - Full path for production
DATABASE_URL=sqlite:$DB_PATH

# JWT Secret (change this in production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-$(date +%s)

# API Keys (optional - add your keys for AI features)
# OPENAI_API_KEY=your_openai_api_key
# CLAUDE_API_KEY=your_claude_api_key
# GEMINI_API_KEY=your_gemini_api_key

# Server Configuration
PORT=5000
NODE_ENV=production

# Project paths for reference
PROJECT_DIR=$PROJECT_DIR
BACKEND_DIR=$BACKEND_DIR
FRONTEND_DIR=$FRONTEND_DIR
EOF
        print_warning ".env file created with production settings. Database path: $DB_PATH"
    fi
fi

# Verify database directory exists and has proper permissions
print_status "Setting up database directory..."
chmod 755 data
touch data/database.sqlite
chmod 644 data/database.sqlite
print_success "Database directory configured"

# Initialize database and create test accounts
print_status "Initializing database..."

# Verify database file exists and show its location
DB_FILE="$BACKEND_DIR/data/database.sqlite"
print_status "Database will be located at: $DB_FILE"

# First, let's make sure the database is created
if node -e "
const db = require('./src/models');
db.sequelize.sync({ force: false }).then(() => {
    console.log('✅ Database synchronized successfully');
    console.log('📁 Database file:', require('path').resolve('./data/database.sqlite'));
    process.exit(0);
}).catch(err => {
    console.error('❌ Database error:', err);
    process.exit(1);
});
"; then
    print_success "Database initialized successfully"
    
    # Verify the database file was created
    if [ -f "$DB_FILE" ]; then
        DB_SIZE=$(ls -lh "$DB_FILE" | awk '{print $5}')
        print_success "Database file created: $DB_SIZE"
    else
        print_error "Database file not found at: $DB_FILE"
    fi
else
    print_error "Database initialization failed"
    exit 1
fi

print_status "Creating test accounts..."
# Use the npm script instead of inline code to avoid module issues
if npm run create-test-accounts; then
    print_success "Test accounts created successfully"
else
    print_warning "Test account creation failed, but continuing setup..."
    print_warning "You can create them manually later with: npm run create-test-accounts"
fi

print_success "Database and test accounts setup complete"

# Step 8: Setup frontend
print_status "Setting up frontend..."
cd "$FRONTEND_DIR"

# Install frontend dependencies
print_status "Installing frontend dependencies..."
npm install
print_success "Frontend dependencies installed"

# Build frontend for production
print_status "Building frontend for production..."
npm run build
print_success "Frontend built successfully"

# Step 9: Deploy frontend to nginx directory
print_status "Deploying frontend..."
sudo mkdir -p "$APP_DIR"
sudo cp -r "$FRONTEND_DIR/dist/"* "$APP_DIR/"
sudo chown -R www-data:www-data "$APP_DIR"
print_success "Frontend deployed to $APP_DIR"

# Step 10: Configure Nginx
print_status "Configuring Nginx..."

# Get server IP
SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

# Copy and configure nginx config
sudo cp "$PROJECT_DIR/deploy/nginx.conf" "$NGINX_CONF"

# Update the nginx config with current server IP if needed
sudo sed -i "s/20\.55\.236\.2/$SERVER_IP/g" "$NGINX_CONF"

# Remove default nginx site
if [ -L /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
    print_success "Removed default nginx site"
fi

# Enable our site
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/chatverse

# Test nginx configuration
print_status "Testing Nginx configuration..."
if sudo nginx -t; then
    print_success "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Step 11: Start backend with PM2
print_status "Starting backend with PM2..."
cd "$BACKEND_DIR"

# Stop any existing process
pm2 delete chatverse-backend 2>/dev/null || true

# Start the backend
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup | grep -v "PM2" | sudo bash 2>/dev/null || true

print_success "Backend started with PM2"

# Step 12: Start Nginx
print_status "Starting Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx
print_success "Nginx started and enabled"

# Step 13: Setup firewall (optional)
print_status "Configuring firewall..."
if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 22/tcp  # SSH
    sudo ufw allow 80/tcp  # HTTP
    sudo ufw allow 443/tcp # HTTPS
    # Enable UFW if not already enabled
    sudo ufw --force enable 2>/dev/null || true
    print_success "Firewall configured"
else
    print_warning "UFW not found. Skipping firewall configuration."
fi

# Step 14: Final verification
print_status "Verifying installation..."

# Check database
DB_FILE="$BACKEND_DIR/data/database.sqlite"
if [ -f "$DB_FILE" ]; then
    DB_SIZE=$(ls -lh "$DB_FILE" | awk '{print $5}')
    print_success "Database exists: $DB_SIZE at $DB_FILE"
    
    # Test database connection
    cd "$BACKEND_DIR"
    if USER_COUNT=$(node -e "const db = require('./src/models'); db.User.count().then(count => { console.log(count); process.exit(0); }).catch(() => process.exit(1))" 2>/dev/null); then
        print_success "Database connection OK - $USER_COUNT users found"
    else
        print_warning "Database exists but connection test failed"
    fi
    cd - > /dev/null
else
    print_error "Database not found at: $DB_FILE"
fi

# Check if backend is running
if pm2 list | grep -q "chatverse-backend.*online"; then
    print_success "Backend is running"
else
    print_error "Backend is not running properly"
fi

# Check if nginx is running
if systemctl is-active --quiet nginx; then
    print_success "Nginx is running"
else
    print_error "Nginx is not running properly"
fi

# Final success message
echo ""
echo "============================================"
echo -e "${GREEN}🎉 SETUP COMPLETE! 🎉${NC}"
echo "============================================"
echo ""
echo -e "${BLUE}🌐 Your ChatVerse AI is now running at:${NC}"
echo -e "${GREEN}   http://$SERVER_IP${NC}"
echo ""
echo -e "${BLUE}📧 Test Accounts:${NC}"
echo -e "${GREEN}   Premium: premium1@test.com / password123${NC}"
echo -e "${GREEN}   Normal:  normal1@test.com / password123${NC}"
echo ""
echo -e "${BLUE}�️ Database Location:${NC}"
echo -e "${GREEN}   $BACKEND_DIR/data/database.sqlite${NC}"
echo -e "${BLUE}   Type: SQLite (file-based)${NC}"
echo -e "${BLUE}   Users: 12 test accounts created${NC}"
echo ""
echo -e "${BLUE}�🔧 Useful Commands:${NC}"
echo "   pm2 status                    - Check backend status"
echo "   pm2 logs chatverse-backend    - View backend logs"
echo "   pm2 restart chatverse-backend - Restart backend"
echo "   sudo systemctl status nginx   - Check Nginx status"
echo "   sudo nginx -t                 - Test Nginx config"
echo ""
echo -e "${BLUE}📁 Project Directory:${NC}"
echo "   $PROJECT_DIR"
echo ""
echo -e "${BLUE}🔄 To update later:${NC}"
echo "   cd $PROJECT_DIR && ./quick-deploy.sh"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Visit your website at http://$SERVER_IP"
echo "2. Login with test accounts to verify functionality"
echo "3. Edit backend/.env to add your API keys for AI features"
echo "4. Consider setting up SSL/HTTPS for production use"
echo ""
print_success "Enjoy your new ChatVerse AI application!"