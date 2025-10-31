#!/bin/bash
# Quick fix to restore talk-sphere.com domain

echo "🔧 Fixing domain configuration..."

# Check current nginx config
echo "Current server_name in nginx config:"
grep "server_name" /etc/nginx/sites-available/chatverse 2>/dev/null || echo "Config file not found"

# Update nginx config with correct domain
echo "Updating nginx configuration..."
sudo sed -i 's/server_name .*/server_name talk-sphere.com www.talk-sphere.com;/' /etc/nginx/sites-available/chatverse

# Verify the change
echo "New server_name configuration:"
grep "server_name" /etc/nginx/sites-available/chatverse

# Test nginx config
echo "Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx config is valid"
    echo "Reloading nginx..."
    sudo systemctl reload nginx
    echo "✅ Domain fixed! Your site should now work with talk-sphere.com"
else
    echo "❌ Nginx config has errors"
fi

echo ""
echo "🌐 Your site should now be accessible at:"
echo "   https://talk-sphere.com"
echo "   http://talk-sphere.com"