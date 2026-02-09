# Pre-build script to handle symlink issues
# This script creates dummy files to prevent symlink errors

$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"

Write-Host "Pre-build: Checking for winCodeSign cache issues..." -ForegroundColor Cyan

# Clear any problematic cache entries
if (Test-Path $cacheDir) {
    Get-ChildItem -Path $cacheDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $darwinDir = Join-Path $_.FullName "darwin\10.12\lib"
        if (Test-Path $darwinDir) {
            $libcrypto = Join-Path $darwinDir "libcrypto.dylib"
            $libssl = Join-Path $darwinDir "libssl.dylib"
            
            # Create empty files if symlinks fail (these aren't needed for Windows builds)
            if (-not (Test-Path $libcrypto)) {
                New-Item -ItemType File -Path $libcrypto -Force | Out-Null
            }
            if (-not (Test-Path $libssl)) {
                New-Item -ItemType File -Path $libssl -Force | Out-Null
            }
        }
    }
}

Write-Host "Pre-build: Ready" -ForegroundColor Green
