@echo off
title Pepipepu Quote Server
cd /d "%~dp0"
if not exist node_modules (
  echo Installing server packages. This is needed only the first time.
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Package install failed. Please check the message above.
    pause
    exit /b 1
  )
)
start "" "http://127.0.0.1:3000/"
call npm.cmd start
echo.
echo Server stopped or failed to start. Please check the message above.
pause
