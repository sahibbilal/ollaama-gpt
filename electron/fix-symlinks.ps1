# Workaround script to handle symlink errors in electron-builder cache
# This script manually extracts the winCodeSign archive without symlinks

$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
$archivePattern = "$cacheDir\*.7z"

Write-Host "Checking for winCodeSign archives..."

Get-ChildItem -Path $cacheDir -Filter "*.7z" -ErrorAction SilentlyContinue | ForEach-Object {
    $archive = $_.FullName
    $extractDir = $archive -replace '\.7z$', ''
    
    Write-Host "Extracting: $archive"
    Write-Host "To: $extractDir"
    
    # Extract with 7zip, ignoring symlink errors
    $sevenZip = Join-Path $PSScriptRoot "node_modules\7zip-bin\win\x64\7za.exe"
    
    if (Test-Path $sevenZip) {
        # Extract ignoring errors
        & $sevenZip x -bd "-o$extractDir" $archive 2>&1 | Out-Null
        
        # If darwin directory exists, manually create the symlinks as regular files
        $darwinDir = Join-Path $extractDir "darwin\10.12\lib"
        if (Test-Path $darwinDir) {
            $libcrypto = Join-Path $darwinDir "libcrypto.dylib"
            $libssl = Join-Path $darwinDir "libssl.dylib"
            
            # Create empty files if they don't exist (they're not needed for Windows builds)
            if (-not (Test-Path $libcrypto)) {
                New-Item -ItemType File -Path $libcrypto -Force | Out-Null
            }
            if (-not (Test-Path $libssl)) {
                New-Item -ItemType File -Path $libssl -Force | Out-Null
            }
        }
        
        Write-Host "Extraction completed (symlinks ignored)"
    }
}

Write-Host "Done!"
