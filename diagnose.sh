#!/bin/bash
# Comprehensive troubleshooting for talk-sphere.com

echo "🔍 ChatVerse AI Domain Troubleshooting"
echo "======================================"
echo ""

# Check if we're root
if [[ $EUID -eq 0 ]]; then
   echo "⚠️  Running as root. Consider running as regular user with sudo."
fi

echo "1. 🌐 Domain & DNS Check"
echo "------------------------"
echo "Domain: talk-sphere.com"
echo ""

# Check if domain resolves
echo "DNS Resolution:"
if nslookup talk-sphere.com > /dev/null 2>&1; then
    echo "✅ Domain resolves to:"
    nslookup talk-sphere.com | grep "Address:" | tail -n +2
else
    echo "❌ Domain does not resolve"
    echo "💡 Fix: Update your domain's A record to point to this server's IP"
fi

echo ""
echo "2. 🖥️  Server Info"
echo "------------------"
echo "Server IP addresses:"
ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print "  " $2}'

echo ""
echo "Public IP:"
PUBLIC_IP=$(curl -s https://api.ipify.org 2>/dev/null || curl -s ifconfig.me 2>/dev/null || echo "Could not determine")
echo "  $PUBLIC_IP"

echo ""
echo "3. 🔧 Nginx Status"
echo "------------------"
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
    echo "Version: $(nginx -v 2>&1)"
else
    echo "❌ Nginx is not running"
    echo "💡 Fix: sudo systemctl start nginx"
fi

echo ""
echo "4. 📋 Nginx Configuration"
echo "-------------------------"
NGINX_CONF="/etc/nginx/sites-available/chatverse"
if [ -f "$NGINX_CONF" ]; then
    echo "✅ Config file exists: $NGINX_CONF"
    echo "Server name configuration:"
    grep "server_name" "$NGINX_CONF" || echo "❌ No server_name found"
    
    echo ""
    echo "Listen configuration:"
    grep "listen" "$NGINX_CONF" || echo "❌ No listen directive found"
else
    echo "❌ Nginx config file not found: $NGINX_CONF"
    echo "💡 Fix: Copy deploy/nginx.conf to $NGINX_CONF"
fi

echo ""
echo "5. 🔗 Site Enabled"
echo "------------------"
if [ -L "/etc/nginx/sites-enabled/chatverse" ]; then
    echo "✅ Site is enabled"
else
    echo "❌ Site is not enabled"
    echo "💡 Fix: sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/"
fi

echo ""
echo "6. ⚙️  Nginx Config Test"
echo "------------------------"
if sudo nginx -t > /dev/null 2>&1; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors:"
    sudo nginx -t
fi

echo ""
echo "7. 🚪 Port Check"
echo "----------------"
echo "Ports listening:"
if command -v netstat > /dev/null 2>&1; then
    netstat -tlnp | grep ":80\|:443\|:5000" | while read line; do
        echo "  $line"
    done
else
    ss -tlnp | grep ":80\|:443\|:5000" | while read line; do
        echo "  $line"
    done
fi

echo ""
echo "8. 🔥 Firewall Status"
echo "--------------------"
if command -v ufw > /dev/null 2>&1; then
    echo "UFW Status:"
    sudo ufw status | head -10
else
    echo "UFW not installed"
fi

echo ""
echo "9. 🗂️  Backend Status"
echo "--------------------"
if command -v pm2 > /dev/null 2>&1; then
    echo "PM2 Status:"
    pm2 status 2>/dev/null || echo "No PM2 processes running"
else
    echo "PM2 not installed"
fi

echo ""
echo "10. 🧪 Connection Tests"
echo "----------------------"
echo "Testing local connections:"

# Test localhost
if curl -s -o /dev/null -w "%{http_code}" http://localhost > /dev/null 2>&1; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost)
    echo "✅ localhost:80 responds with HTTP $STATUS"
else
    echo "❌ localhost:80 not responding"
fi

# Test backend
if curl -s -o /dev/null http://localhost:5000 > /dev/null 2>&1; then
    echo "✅ Backend (localhost:5000) is responding"
else
    echo "❌ Backend (localhost:5000) not responding"
    echo "💡 Fix: Start backend with 'pm2 start ecosystem.config.cjs' in backend directory"
fi

echo ""
echo "11. 📂 File Permissions"
echo "----------------------"
if [ -d "/var/www/chatverse" ]; then
    echo "✅ Web directory exists: /var/www/chatverse"
    echo "Permissions:"
    ls -la /var/www/chatverse | head -5
else
    echo "❌ Web directory not found: /var/www/chatverse"
    echo "💡 Fix: sudo mkdir -p /var/www/chatverse && deploy frontend files"
fi

echo ""
echo "12. 📝 Nginx Logs"
echo "-----------------"
echo "Recent Nginx errors (last 10 lines):"
if [ -f "/var/log/nginx/error.log" ]; then
    sudo tail -10 /var/log/nginx/error.log 2>/dev/null || echo "No recent errors"
else
    echo "Error log not found"
fi

echo ""
echo "13. 🔧 Quick Fixes"
echo "------------------"
echo "Run these commands to fix common issues:"
echo ""
echo "# Fix domain in nginx config:"
echo "sudo sed -i 's/server_name .*/server_name talk-sphere.com www.talk-sphere.com;/' /etc/nginx/sites-available/chatverse"
echo ""
echo "# Enable site:"
echo "sudo ln -sf /etc/nginx/sites-available/chatverse /etc/nginx/sites-enabled/"
echo ""
echo "# Restart services:"
echo "sudo systemctl restart nginx"
echo "pm2 restart all"
echo ""
echo "# Check if domain points to this server:"
echo "nslookup talk-sphere.com"
echo "echo 'Should show: $PUBLIC_IP'"

echo ""
echo "🎯 Summary"
echo "=========="
echo "If domain still doesn't work after running fixes:"
echo "1. Ensure DNS A record for talk-sphere.com points to: $PUBLIC_IP"
echo "2. Wait 5-10 minutes for DNS propagation"
echo "3. Try accessing http://$PUBLIC_IP directly first"
echo "4. Check domain registrar settings"
echo ""
echo "Need help? Share this diagnostic output!"