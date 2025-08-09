@echo off
echo Starting the Disaster Management application...
echo.

echo Starting Python Flask server (Speech-to-Text) on port 5000...
start cmd /k "python server.py"

echo Waiting 10 seconds for Python server to initialize...
timeout /t 10 /nobreak

echo Starting Node.js backend server on port 5001...
start cmd /k "set PORT=5001 && npm run server"

echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak

echo Starting React frontend on port 3000...
start cmd /k "npm start"

echo.
echo All services are starting...
echo 1. Python Flask server (port 5000)
echo 2. Node.js backend server (port 5001)
echo 3. React frontend (port 3000)
echo.
echo IMPORTANT: Wait until all services are fully started before continuing
echo.
pause
echo.
echo The application should now be running.
echo - Speech-to-Text API: http://localhost:5000
echo - Backend API: http://localhost:5001
echo - Frontend UI: http://localhost:3000
echo.
echo To stop the application, close all command windows.
pause 