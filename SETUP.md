# 🚀 ChatVerse AI - One-Command Setup

Complete deployment script that handles everything from dependencies to running website.

## 📋 What This Does

The `setup.sh` script automatically:

✅ **System Setup**
- Updates system packages
- Installs Node.js 20.x
- Installs PM2 process manager
- Installs Nginx web server
- Installs Git (if needed)

✅ **Project Setup**
- Clones the repository (if not already done)
- Installs all dependencies (frontend + backend)
- Creates required directories and files

✅ **Database Setup**
- Initializes SQLite database
- Creates 12 test accounts (10 premium + 2 normal)
- Sets up all tables and relationships

✅ **Production Deployment**
- Builds frontend for production
- Configures Nginx reverse proxy
- Starts backend with PM2
- Sets up auto-restart on boot

✅ **Security & Configuration**
- Configures firewall rules
- Sets proper file permissions
- Creates production-ready .env file

## 🎯 One-Command Deployment

### Fresh Server Setup:
```bash
# On a fresh Ubuntu/Debian server:
wget https://raw.githubusercontent.com/Scorpion07/chatbotnew/main/setup.sh
chmod +x setup.sh
./setup.sh
```

### Or if you have the repository:
```bash
git clone https://github.com/Scorpion07/chatbotnew.git
cd chatbotnew
chmod +x setup.sh
./setup.sh
```

## 📧 Test Accounts Created

**Premium Accounts (10):**
- `premium1@test.com` / `password123`
- `premium2@test.com` / `password123`
- ... up to `premium10@test.com`

**Normal Accounts (2):**
- `normal1@test.com` / `password123`
- `normal2@test.com` / `password123`

## 🌐 After Setup

Your website will be available at:
- `http://YOUR_SERVER_IP`

## 🔧 Post-Setup Commands

```bash
# Check services status
pm2 status
sudo systemctl status nginx

# View logs
pm2 logs chatverse-backend
sudo tail -f /var/log/nginx/access.log

# Restart services
pm2 restart chatverse-backend
sudo systemctl restart nginx

# Update application
./quick-deploy.sh
```

## ⚙️ Configuration

Edit `backend/.env` to add your API keys:
```env
OPENAI_API_KEY=your_openai_api_key
CLAUDE_API_KEY=your_claude_api_key
GEMINI_API_KEY=your_gemini_api_key
```

## 🔒 Security Notes

- Script runs as regular user (not root)
- Firewall configured for HTTP/HTTPS/SSH only
- Database uses SQLite (file-based, secure)
- All services run with proper permissions

## 🆘 Troubleshooting

If something goes wrong:

1. **Check logs:**
   ```bash
   pm2 logs chatverse-backend
   sudo nginx -t
   ```

2. **Restart services:**
   ```bash
   pm2 restart chatverse-backend
   sudo systemctl restart nginx
   ```

3. **Re-run setup:**
   ```bash
   ./setup.sh
   ```

The setup script is idempotent - you can run it multiple times safely.

## 📁 Directory Structure After Setup

```
/var/www/chatverse/     # Frontend files (served by Nginx)
~/chatbotnew/           # Project source code
~/chatbotnew/backend/   # Backend API server
~/chatbotnew/frontend/  # Frontend source
```

## 🎉 Features Included

- ✅ Mobile-responsive design
- ✅ User authentication system
- ✅ Premium/normal user tiers
- ✅ Test accounts for development
- ✅ Database with user management
- ✅ Nginx reverse proxy
- ✅ PM2 process management
- ✅ Auto-restart on server reboot
- ✅ Production-optimized build
- ✅ Security headers and CORS
- ✅ Gzip compression
- ✅ Static asset caching

Ready to go live! 🚀