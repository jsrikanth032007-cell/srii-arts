# SRII ARTS - Launch Script for PowerShell
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       SRII ARTS - AI NLE Studio Director" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

Start-Sleep -Seconds 2

Write-Host "Starting React Frontend on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; npm run dev"

Start-Sleep -Seconds 1
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "SRII ARTS is running! Check your browser window." -ForegroundColor Yellow
