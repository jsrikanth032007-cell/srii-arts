@echo off
title SRII ARTS Studio
echo ========================================================
echo        SRII ARTS - AI NLE Studio Director
echo ========================================================
echo.
echo Starting FastAPI Backend (Port 8000)...
start "SRII ARTS Backend" cmd /k "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak > nul

echo Starting Vite Frontend (Port 5173)...
start "SRII ARTS Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Launching browser at http://localhost:5173...
start http://localhost:5173

echo.
echo SRII ARTS Studio is running!
pause
