@echo off
echo Starting TalkSphere AI...
echo.
echo Starting Backend Server...
start cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak > nul
echo.
echo Starting Frontend...
start cmd /k "cd frontend && npm run dev"
echo.
echo TalkSphere AI is starting!
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit this window...
pause > nul

