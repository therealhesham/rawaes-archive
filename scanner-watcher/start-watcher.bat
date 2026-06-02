@echo off
title Rawaes Scanner Watcher
color 0E
cd /d "%~dp0"

echo.
echo ================================================
echo    Rawaes - Scanner Watcher
echo ================================================
echo.

python watcher.py

echo.
echo Stopped. Press any key to close...
pause >nul
