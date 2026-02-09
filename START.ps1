# ChatGPT-Ollama Desktop - PowerShell Startup Script
# This script starts all services and waits for them to be ready

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ChatGPT-Ollama Desktop Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting application..." -ForegroundColor Yellow
Write-Host "Please wait while services are starting..." -ForegroundColor Yellow
Write-Host ""

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check for Python - try multiple commands (Windows often uses 'py' launcher)
$pythonCmd = $null

# Try 'py' launcher first (common on Windows)
try {
    $version = py --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $pythonCmd = "py"
        Write-Host "[OK] Found Python via 'py' launcher: $version" -ForegroundColor Green
    }
} catch {}

# Try 'python' if 'py' didn't work
if (-not $pythonCmd) {
    try {
        $version = python --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonCmd = "python"
            Write-Host "[OK] Found Python via 'python' command: $version" -ForegroundColor Green
        }
    } catch {}
}

# Try 'python3' as last resort
if (-not $pythonCmd) {
    try {
        $version = python3 --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonCmd = "python3"
            Write-Host "[OK] Found Python via 'python3' command: $version" -ForegroundColor Green
        }
    } catch {}
}

# If no Python found, show error
if (-not $pythonCmd) {
    Write-Host "[ERROR] Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure Python is installed from https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "2. During installation, check 'Add Python to PATH'" -ForegroundColor Yellow
    Write-Host "3. Try running: py --version" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Run the launcher script
Write-Host ""
Write-Host "Launching application..." -ForegroundColor Green
Write-Host ""

& $pythonCmd launcher.py

# Check exit code
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Application failed to start" -ForegroundColor Red
    Write-Host "Check the error messages above for details" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
}

exit $LASTEXITCODE
