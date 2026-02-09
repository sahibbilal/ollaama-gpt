; NSIS script for dependency installation

; Check if Python is installed
Function CheckPython
    ClearErrors
    ExecWait 'python --version' $0
    IfErrors 0 PythonFound
    ExecWait 'py --version' $0
    IfErrors 0 PythonFound
    
    ; Python not found
    StrCpy $R0 "0"
    Goto PythonCheckEnd
    
    PythonFound:
    StrCpy $R0 "1"
    
    PythonCheckEnd:
    ; Store result in $R0: "1" = installed, "0" = not installed
FunctionEnd

; Check if Ollama is installed
Function CheckOllama
    ClearErrors
    ExecWait 'ollama --version' $0
    IfErrors OllamaNotFound OllamaFound
    
    OllamaNotFound:
    StrCpy $R1 "0"
    Goto OllamaCheckEnd
    
    OllamaFound:
    StrCpy $R1 "1"
    
    OllamaCheckEnd:
FunctionEnd

; Download Python installer using PowerShell
Function DownloadPython
    DetailPrint "Downloading Python installer..."
    ; Use PowerShell to download (no plugin required)
    ; Create a temporary PowerShell script to avoid quote escaping issues
    FileOpen $0 "$TEMP\download-python.ps1" w
    FileWrite $0 'Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile "$env:TEMP\python-installer.exe"'
    FileClose $0
    ExecWait 'powershell.exe -ExecutionPolicy Bypass -File "$TEMP\download-python.ps1"' $0
    StrCmp $0 "0" 0 PythonDownloadError
    
    ; Check if file was downloaded
    IfFileExists "$TEMP\python-installer.exe" PythonDownloadSuccess PythonDownloadError
    
    PythonDownloadSuccess:
    StrCpy $R2 "$TEMP\python-installer.exe"
    Goto PythonDownloadEnd
    
    PythonDownloadError:
    MessageBox MB_OK "Failed to download Python installer.$\n$\nPlease install Python manually from:$\nhttps://www.python.org/downloads/"
    StrCpy $R2 ""
    
    PythonDownloadEnd:
FunctionEnd

; Install Python
Function InstallPython
    DetailPrint "Installing Python..."
    ExecWait '"$R2" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0' $0
    StrCmp $0 "0" PythonInstallSuccess PythonInstallError
    
    PythonInstallSuccess:
    DetailPrint "Python installed successfully"
    Goto PythonInstallEnd
    
    PythonInstallError:
    MessageBox MB_OK "Failed to install Python. Please install manually."
    
    PythonInstallEnd:
FunctionEnd

; Download Ollama installer using PowerShell
Function DownloadOllama
    DetailPrint "Opening Ollama download page..."
    ; Ollama download URL might be dynamic, so we'll open browser
    ; User can download and we'll prompt them to run it
    ExecShell "open" "https://ollama.com/download/windows"
    
    MessageBox MB_YESNO "Ollama download page opened in your browser.$\n$\nAfter downloading the installer, would you like to select and run it now?" IDYES OllamaManualDownload IDNO OllamaSkipDownload
    
    OllamaManualDownload:
    ; Ask user to select the downloaded file
    FileOpenDialog $R3 "Select Ollama Installer" "$DESKTOP" "Executable Files (*.exe)|*.exe|All Files (*.*)|*.*"
    StrCmp $R3 "" OllamaDownloadError OllamaDownloadEnd
    
    OllamaSkipDownload:
    StrCpy $R3 ""
    Goto OllamaDownloadEnd
    
    OllamaDownloadError:
    StrCpy $R3 ""
    
    OllamaDownloadEnd:
FunctionEnd

; Install Ollama
Function InstallOllama
    DetailPrint "Installing Ollama..."
    ExecWait '"$R3" /S' $0
    StrCmp $0 "0" OllamaInstallSuccess OllamaInstallError
    
    OllamaInstallSuccess:
    DetailPrint "Ollama installed successfully"
    Goto OllamaInstallEnd
    
    OllamaInstallError:
    MessageBox MB_OK "Failed to install Ollama. Please install manually."
    
    OllamaInstallEnd:
FunctionEnd

; Main dependency check and install function
Function InstallDependencies
    DetailPrint "Checking dependencies..."
    
    ; Check Python
    Call CheckPython
    StrCmp $R0 "1" PythonOK InstallPythonAuto
    
    InstallPythonAuto:
    DetailPrint "Python is not installed. Downloading and installing Python..."
    Call DownloadPython
    StrCmp $R2 "" PythonDownloadFailed
    Call InstallPython
    ; Wait a bit for installation to complete
    Sleep 3000
    ; Verify installation
    Call CheckPython
    StrCmp $R0 "1" PythonOK PythonInstallFailed
    
    PythonOK:
    DetailPrint "Python is installed and verified"
    Goto OllamaCheck
    
    PythonDownloadFailed:
    DetailPrint "Failed to download Python installer"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to download Python installer.$\n$\nPlease install Python 3.8+ manually from:$\nhttps://www.python.org/downloads/$\n$\nThe installation will continue after Python is installed."
    Abort
    
    PythonInstallFailed:
    DetailPrint "Python installation failed or verification failed"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Python installation failed or Python is not properly configured.$\n$\nPlease ensure Python 3.8+ is installed and added to PATH.$\n$\nDownload from: https://www.python.org/downloads/"
    Abort
    
    OllamaCheck:
    ; Check Ollama
    Call CheckOllama
    StrCmp $R1 "1" OllamaOK InstallOllamaAuto
    
    InstallOllamaAuto:
    DetailPrint "Ollama is not installed. Downloading Ollama..."
    ; Try to download Ollama installer directly
    DetailPrint "Downloading Ollama installer..."
    FileOpen $0 "$TEMP\download-ollama.ps1" w
    FileWrite $0 'try {'
    FileWrite $0 '  $url = "https://ollama.com/download/windows"'
    FileWrite $0 '  $response = Invoke-WebRequest -Uri $url -UseBasicParsing'
    FileWrite $0 '  $downloadLink = ($response.Links | Where-Object { $_.href -like "*OllamaSetup*.exe" } | Select-Object -First 1).href'
    FileWrite $0 '  if (-not $downloadLink) {'
    FileWrite $0 '    $downloadLink = "https://ollama.com/download/OllamaSetup.exe"'
    FileWrite $0 '  }'
    FileWrite $0 '  Invoke-WebRequest -Uri $downloadLink -OutFile "$env:TEMP\ollama-installer.exe"'
    FileWrite $0 '  Write-Host "Downloaded to $env:TEMP\ollama-installer.exe"'
    FileWrite $0 '} catch {'
    FileWrite $0 '  Write-Host "Error: $_"'
    FileWrite $0 '  exit 1'
    FileWrite $0 '}'
    FileClose $0
    
    ExecWait 'powershell.exe -ExecutionPolicy Bypass -File "$TEMP\download-ollama.ps1"' $0
    StrCmp $0 "0" OllamaDownloadSuccess OllamaDownloadFailed
    
    OllamaDownloadSuccess:
    IfFileExists "$TEMP\ollama-installer.exe" OllamaInstall OllamaDownloadFailed
    
    OllamaInstall:
    DetailPrint "Installing Ollama..."
    ExecWait '"$TEMP\ollama-installer.exe" /S' $0
    StrCmp $0 "0" OllamaInstallSuccess OllamaInstallFailed
    
    OllamaInstallSuccess:
    DetailPrint "Ollama installed successfully"
    ; Wait a bit for installation to complete
    Sleep 2000
    ; Verify installation
    Call CheckOllama
    StrCmp $R1 "1" OllamaOK OllamaVerifyFailed
    
    OllamaOK:
    DetailPrint "Ollama is installed and verified"
    Goto DependenciesOK
    
    OllamaDownloadFailed:
    DetailPrint "Failed to download Ollama installer"
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "Failed to download Ollama installer automatically.$\n$\nWould you like to open the Ollama download page in your browser?" IDYES OllamaOpenBrowser IDNO OllamaSkip
    OllamaOpenBrowser:
    ExecShell "open" "https://ollama.com/download/windows"
    MessageBox MB_OK "Please download and install Ollama, then run this installer again."
    Abort
    OllamaSkip:
    MessageBox MB_OK "Ollama installation is required. Please install Ollama from https://ollama.com/download"
    Abort
    
    OllamaInstallFailed:
    DetailPrint "Ollama installation failed"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Ollama installation failed.$\n$\nPlease install Ollama manually from:$\nhttps://ollama.com/download"
    Abort
    
    OllamaVerifyFailed:
    DetailPrint "Ollama installation verification failed"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Ollama was installed but could not be verified.$\n$\nPlease ensure Ollama is properly installed and added to PATH."
    Abort
    
    DependenciesOK:
    DetailPrint "All dependencies are installed and verified"
FunctionEnd
