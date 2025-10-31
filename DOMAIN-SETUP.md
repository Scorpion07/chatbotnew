# Domain Setup for talk-sphere.com

## 🌐 DNS Configuration

Before running the setup, configure your DNS records:

### Required DNS Records:

```
Type    Name                Value               TTL
A       talk-sphere.com     YOUR_SERVER_IP      300
A       www                 YOUR_SERVER_IP      300
CNAME   www                 talk-sphere.com     300
```

### Optional but Recommended:

```
Type    Name                Value               TTL
TXT     @                   "v=spf1 -all"       300
TXT     _dmarc              "v=DMARC1; p=none"  300
```

## 🚀 Installation Steps

1. **Point DNS to your server** (wait for propagation)

2. **Run the setup script:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/Scorpion07/chatbotnew/main/install.sh | bash
   ```

3. **Setup SSL (after DNS propagation):**
   ```bash
   chmod +x ssl-setup.sh
   ./ssl-setup.sh
   ```

## 🔍 Verification

Check if your domain is working:
```bash
# Test HTTP redirect
curl -I http://talk-sphere.com

# Test HTTPS (after SSL setup)
curl -I https://talk-sphere.com

# Check SSL certificate
openssl s_client -connect talk-sphere.com:443 -servername talk-sphere.com
```

## 🔧 Troubleshooting

**DNS not propagating:**
```bash
# Check DNS propagation
nslookup talk-sphere.com
dig talk-sphere.com

# Wait 5-15 minutes for propagation
```

**SSL issues:**
```bash
# Check nginx config
sudo nginx -t

# Check certbot logs
sudo journalctl -u certbot

# Manual SSL renewal
sudo certbot renew --dry-run
```

**Application not loading:**
```bash
# Check PM2 status
pm2 status

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart all
sudo systemctl restart nginx
```

## 📱 Features Available

Once setup is complete, your TalkSphere will have:

- ✅ **Multiple AI Models**: GPT-4, Claude, Gemini
- ✅ **SSL Certificate**: Automatic HTTPS
- ✅ **Mobile Responsive**: Works on all devices
- ✅ **User Authentication**: Secure login system
- ✅ **Admin Panel**: User management
- ✅ **Premium Features**: Subscription model

## 🎯 Post-Setup Tasks

1. **Add API Keys** in `backend/.env`
2. **Test all AI models** work correctly
3. **Customize branding** if needed
4. **Setup monitoring** with PM2
5. **Configure backups** for database

Your TalkSphere is now live at **https://talk-sphere.com**! 🎉