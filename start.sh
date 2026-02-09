#!/bin/bash
# ChatGPT-Ollama Desktop - Linux/Mac Startup Script
# This script starts all services and waits for them to be ready

echo ""
echo "========================================"
echo "  ChatGPT-Ollama Desktop Launcher"
echo "========================================"
echo ""
echo "Starting application..."
echo "Please wait while services are starting..."
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if Python is available - try multiple commands
PYTHON_CMD=""

# Try python3 first (most common on Linux/Mac)
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    echo "[OK] Found Python via 'python3' command"
    python3 --version
# Try python as fallback
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
    echo "[OK] Found Python via 'python' command"
    python --version
fi

# If no Python found, show error
if [ -z "$PYTHON_CMD" ]; then
    echo ""
    echo "[ERROR] Python is not installed or not in PATH"
    echo ""
    echo "Troubleshooting:"
    echo "1. Install Python from https://www.python.org/downloads/"
    echo "2. Make sure Python is in your PATH"
    echo "3. Try running: python3 --version or python --version"
    echo ""
    read -p "Press Enter to exit"
    exit 1
fi

echo ""
echo "Launching application..."
echo ""

# Run the launcher script
$PYTHON_CMD launcher.py

# Check exit code
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Application failed to start"
    echo "Check the error messages above for details"
    echo ""
    read -p "Press Enter to exit"
    exit 1
fi

exit 0
