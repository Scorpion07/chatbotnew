@echo off
REM Stop all Node.js, Vite, and related processes
for /f "tokens=2 delims= " %%a in ('tasklist ^| findstr /i "node.exe vite.exe npm.exe"') do (
    taskkill /F /PID %%a
)
echo All chatbot app processes stopped.
pause