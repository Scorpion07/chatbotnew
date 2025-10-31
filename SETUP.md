# ChatVerse AI - Quick Setup Guide

## 🚀 One Command Installation

```bash
curl -fsSL https://raw.githubusercontent.com/Scorpion07/chatbotnew/main/install.sh | bash
```

**OR** clone and run locally:

```bash
git clone https://github.com/Scorpion07/chatbotnew.git
cd chatbotnew
chmod +x setup.sh
./setup.sh
```

## 📋 What the setup script does:

✅ **System Setup:**
- Updates system packages
- Installs Node.js 20
- Installs build essentials for native modules
- Installs PM2 process manager
- Installs Nginx web server
- Installs SQLite3 database

✅ **Application Setup:**
- Installs all dependencies (including bcrypt)
- Rebuilds native modules
- Creates database and initializes tables
- Creates test user accounts
- Builds frontend for production
- Configures Nginx proxy
- Starts backend with PM2

✅ **Security & Performance:**
- Sets up firewall rules
- Configures proper file permissions
- Enables gzip compression
- Sets up static file caching
- Adds security headers

## 🔑 Default Test Accounts

After setup, you can login with:

- **Free User:** test1@test.com / password123
- **Premium User:** premium1@test.com / password123

## 🌐 Accessing Your App

The script will show you the server IP at the end. Access via:
- `http://YOUR_SERVER_IP` - Main application
- `http://YOUR_SERVER_IP/admin` - Admin panel

## ⚙️ Configuration

1. **Add API Keys** (Required for AI features):
   ```bash
   nano backend/.env
   ```
   Add your actual API keys and restart:
   ```bash
   pm2 restart all
   ```

2. **Custom Domain** (Optional):
   Update `server_name` in `/etc/nginx/sites-available/chatverse`

## 🛠️ Management Commands

```bash
# View application logs
pm2 logs

# Restart backend
pm2 restart all

# Check PM2 status
pm2 status

# Reload Nginx
sudo systemctl reload nginx

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
```

## 🔧 Troubleshooting

**Backend won't start:**
```bash
cd backend
npm install
npm rebuild
pm2 restart all
```

**Frontend not loading:**
```bash
sudo systemctl status nginx
sudo nginx -t
```

**Database issues:**
```bash
cd backend
rm -f data/database.sqlite
node scripts/create-test-accounts.js
```

## 📁 File Structure

```
/var/www/chatverse/          # Frontend files
/path/to/chatbotnew/backend/ # Backend application
/etc/nginx/sites-available/  # Nginx configuration
```

## 🎯 Requirements

- **OS:** Ubuntu 18.04+ / Debian 9+
- **RAM:** 1GB minimum (2GB recommended)
- **Storage:** 2GB free space
- **Network:** Open ports 80, 443, 22

---

**Need help?** Check the logs with `pm2 logs` and `sudo tail -f /var/log/nginx/error.log`
