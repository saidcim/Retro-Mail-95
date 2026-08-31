@echo off
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  python server.py
  exit /b %errorlevel%
)

where py >nul 2>nul
if %errorlevel%==0 (
  py server.py
  exit /b %errorlevel%
)

set CODEX_PY=C:\Users\hp\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
if exist "%CODEX_PY%" (
  "%CODEX_PY%" server.py
  exit /b %errorlevel%
)

echo Python bulunamadi. Python 3 kurup tekrar deneyin.
pause
