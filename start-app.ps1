# Start Python Flask server (Speech-to-Text)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python server.py"

# Start Node.js backend server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run server"

# Start React frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start"

Write-Host "All services are starting..."
Write-Host "1. Python Flask server (port 5000)"
Write-Host "2. Node.js backend server"
Write-Host "3. React frontend (port 3000)"
Write-Host "Please wait for all services to initialize..."

Write-Host "Starting the Disaster Management application..." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Wait until all services are fully started before continuing" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to continue"
Write-Host ""
Write-Host "The application should now be running." -ForegroundColor Green
Write-Host "- Backend API: http://localhost:5000" -ForegroundColor White
Write-Host "- Frontend UI: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "To stop the application, close all PowerShell windows." -ForegroundColor Yellow
Read-Host "Press Enter to exit" 