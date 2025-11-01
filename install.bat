@echo off
echo Installing TalkSphere AI Dependencies...
echo.
echo Installing Backend Dependencies...
cd backend
call npm install
echo.
echo Backend dependencies installed!
echo.
cd ..
echo Installing Frontend Dependencies...
cd frontend
call npm install
echo.
echo Frontend dependencies installed!
echo.
cd ..
echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo To start the application, run: start.bat
echo.
pause

