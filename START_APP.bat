@echo off
cd /d "%~dp0"
title AI Portrait Exhibition
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:3000
  py server.py
  goto end
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:3000
  python server.py
  goto end
)
echo.
echo Python is not installed on this computer.
echo Install Python from the Microsoft Store, then double-click this file again.
echo.
pause
:end
