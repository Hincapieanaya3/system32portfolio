@echo off
title Portafolio 3D — Sebastian Hincapie (SYSTEM32)
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
cd /d "C:\Users\Usuario\.gemini\antigravity\scratch\sebastian-portfolio"
echo ========================================================
echo   Iniciando Portafolio WebGL de Sebastian Hincapie...
echo   Abre en tu navegador: http://localhost:5173
echo ========================================================
start "" "http://localhost:5173"
npm run dev
pause
