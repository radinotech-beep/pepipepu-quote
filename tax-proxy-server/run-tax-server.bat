@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing server packages. This is needed only the first time.
  npm install
)
start "" "http://127.0.0.1:3000/"
npm start
pause
