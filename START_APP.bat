@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title AI Portrait Exhibition

if not exist replicate_token.txt goto ask_token
goto start_server

:ask_token
echo.
echo Paste your Replicate API token below, then press Enter.
echo.
set "APP_KEY="
set /p "APP_KEY=Token: "
if not defined APP_KEY (
  echo.
  echo No token was entered. Try again.
  pause
  goto ask_token
)
>replicate_token.txt echo(!APP_KEY!

:start_server
start "" http://localhost:3000

where py >nul 2>nul
if not errorlevel 1 (
  py server.py
  goto end
)

where python >nul 2>nul
if not errorlevel 1 (
  python server.py
  goto end
)

echo.
echo Python is not installed on this computer.
echo Install Python from the Microsoft Store, then double-click this file again.
echo.
pause

:end
endlocal
