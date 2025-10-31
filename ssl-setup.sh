#!/bin/bash

# SSL Setup Script for talk-sphere.com
# Run this after DNS is pointing to your server

set -e

echo "🔒 Setting up SSL for talk-sphere.com"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should NOT be run as root for security reasons."
   echo "Please run as a regular user with sudo privileges."
   exit 1
fi

# Install Certbot
echo ">> Installing Certbot..."
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
echo ">> Obtaining SSL certificate for talk-sphere.com..."
sudo certbot --nginx -d talk-sphere.com -d www.talk-sphere.com --non-interactive --agree-tos --email admin@talk-sphere.com

# Update nginx config to enable SSL lines
echo ">> Updating nginx configuration..."
sudo sed -i 's/# ssl_certificate/ssl_certificate/g' /etc/nginx/sites-available/chatverse
sudo sed -i 's/# ssl_certificate_key/ssl_certificate_key/g' /etc/nginx/sites-available/chatverse
sudo sed -i 's/# ssl_protocols/ssl_protocols/g' /etc/nginx/sites-available/chatverse
sudo sed -i 's/# ssl_ciphers/ssl_ciphers/g' /etc/nginx/sites-available/chatverse
sudo sed -i 's/# ssl_prefer_server_ciphers/ssl_prefer_server_ciphers/g' /etc/nginx/sites-available/chatverse

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