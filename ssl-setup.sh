#!/bin/bash

# SSL Setup Script for talk-sphere.com
# Run this after DNS is pointing to your server and the site is working on HTTP

set -e

echo "🔒 Setting up SSL for talk-sphere.com"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should NOT be run as root for security reasons."
   echo "Please run as a regular user with sudo privileges."
   exit 1
fi

# Check if site is accessible via HTTP first
echo ">> Checking if site is accessible via HTTP..."
if curl -s -o /dev/null -w "%{http_code}" http://talk-sphere.com | grep -q "200\|30[0-9]"; then
    echo "✅ Site is accessible via HTTP"
else
    echo "❌ Site is not accessible via HTTP. Please check:"
    echo "   1. DNS is pointing to this server"
    echo "   2. Site is running (pm2 status)"
    echo "   3. Nginx is running (sudo systemctl status nginx)"
    exit 1
fi

# Install Certbot
echo ">> Installing Certbot..."
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
echo ">> Obtaining SSL certificate for talk-sphere.com..."
sudo certbot --nginx -d talk-sphere.com -d www.talk-sphere.com --non-interactive --agree-tos --email admin@talk-sphere.com

# Test nginx config
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded with SSL"
else
    echo "❌ Nginx configuration has errors"
    exit 1
fi

# Setup auto-renewal
echo ">> Setting up SSL auto-renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

echo ""
echo "🎉 SSL setup complete!"
echo ""
echo "Your site is now accessible at:"
echo "• https://talk-sphere.com"
echo "• https://www.talk-sphere.com"
echo ""
echo "SSL certificates will auto-renew via systemd timer."