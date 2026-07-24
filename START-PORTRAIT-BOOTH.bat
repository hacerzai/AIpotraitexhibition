@echo off
cd /d "%~dp0"
title AI Portrait Exhibition
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed on this computer.
  echo Install Node.js once, then double-click this file again.
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)
node server.js
if errorlevel 1 (
  echo.
  echo The portrait server stopped because of an error.
  pause
)
