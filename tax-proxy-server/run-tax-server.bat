@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing server packages. This is needed only the first time.
  npm install
)
npm start
pause
