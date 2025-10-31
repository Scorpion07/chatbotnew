@echo off
echo Building ChatVerse AI for production...

echo.
echo Building frontend...
cd frontend
call npm install
call npm run build
cd ..

echo.
echo Frontend built successfully!
echo Build files are in frontend/dist/

echo.
echo Next steps for deployment:
echo 1. Copy frontend/dist/* to /var/www/chatverse/ on your server
echo 2. Copy deploy/nginx.conf to /etc/nginx/sites-available/chatverse
echo 3. Enable the site: sudo ln -s /etc/nginx/sites-available/chatverse /etc/nginx/sites-enabled/
echo 4. Test nginx config: sudo nginx -t
echo 5. Reload nginx: sudo systemctl reload nginx
echo 6. Start the backend with PM2: pm2 start backend/ecosystem.config.js
echo.
echo Done!