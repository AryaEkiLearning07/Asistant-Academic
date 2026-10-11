@echo off
title EPIONA Literature Assistant - Dual-Pane Workspace
color 0A
echo ======================================================================
echo          EPIONA - Academic Literature Research Assistant
echo ======================================================================
echo.
echo [1/2] Menyalakan Backend FastAPI (Port 8005)...
start "EPIONA Backend API (Port 8005)" cmd /k "cd /d E:\epiona-assistant\backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload"

echo [2/2] Menyalakan Frontend Next.js (Port 3005)...
start "EPIONA Frontend (Port 3005)" cmd /k "cd /d E:\epiona-assistant\frontend && npm run dev"

echo.
echo ======================================================================
echo Selesai! Buka browser Anda di:
echo - Frontend Workspace: http://localhost:3005
echo - API Documentation : http://127.0.0.1:8005/docs
echo ======================================================================
echo.
pause
