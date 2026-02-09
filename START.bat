@echo off
REM ChatGPT-Ollama Desktop - Easy Startup Script
REM This script starts all services and waits for them to be ready
REM 
REM TIP: To run in background (close window but keep app running):
REM      Use START_DETACHED.bat or START_SILENT.vbs instead

title ChatGPT-Ollama Desktop - Starting...

echo.
echo ========================================
echo   ChatGPT-Ollama Desktop Launcher
echo ========================================
echo.
echo Starting application...
echo Please wait while services are starting...
echo.

REM Get the directory where this script is located
cd /d "%~dp0"

REM Check for Python - try multiple commands (Windows often uses 'py' launcher)
set PYTHON_CMD=
py --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py
    echo [OK] Found Python via 'py' launcher
    py --version
) else (
    python --version >nul 2>&1
    if not errorlevel 1 (
        set PYTHON_CMD=python
        echo [OK] Found Python via 'python' command
        python --version
    ) else (
        python3 --version >nul 2>&1
        if not errorlevel 1 (
            set PYTHON_CMD=python3
            echo [OK] Found Python via 'python3' command
            python3 --version
        )
    )
)

REM If no Python found, show error
if "%PYTHON_CMD%"=="" (
    echo.
    echo [ERROR] Python is not installed or not in PATH
    echo.
    echo Troubleshooting:
    echo 1. Make sure Python is installed from https://www.python.org/downloads/
    echo 2. During installation, check "Add Python to PATH"
    echo 3. Try running: py --version
    echo 4. If 'py' works, Python is installed but 'python' command may not be in PATH
    echo.
    echo Trying 'py' launcher directly...
    py --version 2>&1
    if errorlevel 1 (
        pause
        exit /b 1
    ) else (
        echo [OK] 'py' launcher works! Using it...
        set PYTHON_CMD=py
    )
)

echo.

REM Run the launcher script
%PYTHON_CMD% launcher.py

REM If launcher exits, pause so user can see any error messages
if errorlevel 1 (
    echo.
    echo [ERROR] Application failed to start
    echo Check the error messages above for details
    echo.
    pause
)

exit /b %errorlevel%
