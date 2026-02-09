# Clear electron-builder winCodeSign cache to prevent symlink errors
# This script removes the cache directory that causes symlink permission errors

$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"

Write-Host "Clearing electron-builder winCodeSign cache..." -ForegroundColor Cyan

if (Test-Path $cacheDir) {
    try {
        Remove-Item -Path $cacheDir -Recurse -Force -ErrorAction Stop
        Write-Host "[OK] Cache cleared successfully" -ForegroundColor Green
    } catch {
        Write-Host "[WARNING] Could not clear cache: $_" -ForegroundColor Yellow
        Write-Host "         The build may still succeed despite symlink errors" -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] No cache to clear" -ForegroundColor Green
}
