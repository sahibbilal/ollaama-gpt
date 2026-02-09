@echo off
REM ChatGPT-Ollama Desktop - Stop Script
REM This script stops all running ChatGPT-Ollama processes

title ChatGPT-Ollama Desktop - Stopping...

echo.
echo ========================================
echo   ChatGPT-Ollama Desktop - Stopper
echo ========================================
echo.
echo Stopping all ChatGPT-Ollama processes...
echo.

REM Get Flask port from config
set FLASK_PORT=
if exist "port_config.json" (
    for /f "tokens=2 delims=:," %%a in ('findstr /C:"port" port_config.json') do (
        set FLASK_PORT=%%a
        set FLASK_PORT=!FLASK_PORT:"=!
        set FLASK_PORT=!FLASK_PORT: =!
    )
)

REM Kill processes by name
echo Stopping Electron processes...
taskkill /F /IM electron.exe /T >nul 2>&1
taskkill /F /IM "ChatGPT-Ollama.exe" /T >nul 2>&1

echo Stopping Python/Flask processes...
REM Kill Python processes running launcher.py or main.py
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO LIST ^| findstr /C:"PID:"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /C:"launcher.py" >nul
    if not errorlevel 1 (
        taskkill /F /PID %%a >nul 2>&1
    )
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /C:"main.py" >nul
    if not errorlevel 1 (
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Also try with py.exe
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq py.exe" /FO LIST ^| findstr /C:"PID:"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /C:"launcher.py" >nul
    if not errorlevel 1 (
        taskkill /F /PID %%a >nul 2>&1
    )
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /C:"main.py" >nul
    if not errorlevel 1 (
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM If we have a port, try to kill processes on that port
if not "%FLASK_PORT%"=="" (
    echo Checking port %FLASK_PORT%...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%FLASK_PORT%" ^| findstr "LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo [OK] All processes stopped!
echo.
timeout /t 2 /nobreak >nul
