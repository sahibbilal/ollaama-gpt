@echo off
REM ChatGPT-Ollama Desktop - Detached Startup Script
REM This script starts all services in the background
REM You can close this window and the app will keep running

title ChatGPT-Ollama Desktop - Starting...

echo.
echo ========================================
echo   ChatGPT-Ollama Desktop Launcher
echo ========================================
echo.
echo Starting application in background...
echo You can close this window - the app will keep running.
echo.
echo To stop the app later, run: STOP.bat
echo.

REM Get the directory where this script is located
cd /d "%~dp0"

REM Check for Python - try multiple commands
set PYTHON_CMD=
py --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py
    echo [OK] Found Python via 'py' launcher
) else (
    python --version >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=python
        echo [OK] Found Python via 'python' command
    ) else (
        python3 --version >nul 2>&1
        if not errorlevel 1 (
            set PYTHON_CMD=python3
            echo [OK] Found Python via 'python3' command
        )
    )
)

REM If no Python found, show error
if "%PYTHON_CMD%"=="" (
    echo.
    echo [ERROR] Python is not installed or not in PATH
    echo.
    pause
    exit /b 1
)

echo.
echo Launching application...
echo.

REM Start launcher in a new detached window (minimized)
REM This allows the window to be closed without killing child processes
start "ChatGPT-Ollama" /MIN %PYTHON_CMD% launcher.py

REM Wait a moment to see if there are immediate errors
timeout /t 3 /nobreak >nul

echo.
echo [OK] Application started!
echo.
echo The app is now running in the background.
echo You can close this window safely.
echo.
echo To stop the app, run: STOP.bat
echo.
timeout /t 5 /nobreak >nul
