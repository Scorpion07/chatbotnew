# ChatVerse AI - Azure Deployment Guide

## Quick Deploy (One Command)

SSH into your Azure VM (20.55.236.2) and run:

```bash
cd ~
git clone <YOUR_REPO_URL> chatverse
cd chatverse
bash deploy/deploy.sh
```

That's it! The script will:
- ✅ Install Node.js, PM2, and Nginx
- ✅ Build frontend and backend
- ✅ Configure Nginx reverse proxy
- ✅ Start backend with PM2
- ✅ Serve everything on port 80

## First Time Setup

1. **Clone repo on Azure VM:**
```bash
ssh azureuser@20.55.236.2
cd ~
git clone <YOUR_REPO_URL> chatverse
cd chatverse
```

2. **Run deploy script:**
```bash
bash deploy/deploy.sh
```

3. **Configure environment (when prompted):**
Edit `backend/.env` and add your API keys:
```bash
nano backend/.env
```

Set at minimum:
- `JWT_SECRET=your_random_secret_here`
- `OPENAI_API_KEY=sk-proj-...`

Save and exit (Ctrl+X, Y, Enter)

4. **Access your app:**
- Open browser: `http://20.55.236.2`
- Your app is live!

## Updates

To deploy changes after git push:

```bash
ssh azureuser@20.55.236.2
cd ~/chatverse
git pull
bash deploy/deploy.sh
```

## Useful Commands

```bash
# Check backend status
pm2 status

# View backend logs
pm2 logs chatverse-backend

# Restart backend
pm2 restart chatverse-backend

# Check Nginx status
sudo systemctl status nginx

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

**Backend not starting?**
```bash
pm2 logs chatverse-backend
```

**Nginx issues?**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

**Permission issues?**
```bash
sudo chown -R $USER:$USER ~/chatverse
```

## Architecture

```
Internet (Port 80)
       ↓
    Nginx
    ├─→ Frontend: Static files from /var/www/chatverse
    └─→ /api/* requests → Backend (Node.js on localhost:5000)
             ↓
          SQLite DB (backend/data/database.sqlite)
```

## Optional: HTTPS Setup

If you have a domain pointed to 20.55.236.2:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Then update `deploy/nginx.conf` to use your domain in `server_name`.

## Security Notes

1. **Never commit backend/.env** - It's in .gitignore
2. **Change JWT_SECRET** before deploying
3. **Open ports in Azure NSG:**
   - Port 80 (HTTP)
   - Port 443 (HTTPS if using SSL)
   - Port 22 (SSH for management)

## Need Help?

Common issues and fixes:
- Port 80 blocked? Check Azure NSG rules
- Database errors? Ensure `backend/data/` directory exists and is writable
- API calls failing? Check `pm2 logs` for backend errors
