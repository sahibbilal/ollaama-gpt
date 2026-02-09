; ChatGPT-Ollama Desktop NSIS Installer Script

!define APP_NAME "ChatGPT-Ollama"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "ChatGPT-Ollama"
!define APP_EXE "ChatGPT-Ollama.exe"
!define APP_DIR "$PROGRAMFILES\${APP_NAME}"

; Include dependency installation script
!include "install_deps.nsh"

; Modern UI
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "nsDialogs.nsh"

; Installer settings
Name "${APP_NAME}"
OutFile "..\dist\${APP_NAME}-Setup-${APP_VERSION}.exe"
InstallDir "${APP_DIR}"
RequestExecutionLevel admin

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON ""
!define MUI_UNICON ""

; Pages - Show dependency status BEFORE directory selection
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ShowDependencyStatusAfterWelcome
!insertmacro MUI_PAGE_WELCOME
!undef MUI_PAGE_CUSTOMFUNCTION_LEAVE
Page custom ShowCustomStepPage LeaveCustomStepPage "Configuration"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

; Installer sections
Section "Dependencies" SecDeps
    SectionIn RO
    Call InstallDependencies
SectionEnd

Section "Application" SecApp
    SectionIn RO
    
    SetOutPath "$INSTDIR"
    
    ; Copy application files
    File /r "..\electron\dist\*.*"
    File /r "..\main.py"
    File /r "..\launcher.py"
    File /r "..\check_dependencies.py"
    File /r "..\install_dependencies.py"
    File /r "..\config.py"
    File /r "..\requirements.txt"
    File /r "..\utils\*.*"
    
    ; Create desktop shortcut
    CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
    
    ; Create start menu shortcut
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
    
    ; Write registry
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
        "DisplayName" "${APP_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
        "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
        "Publisher" "${APP_PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
        "DisplayVersion" "${APP_VERSION}"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; Uninstaller
Section "Uninstall"
    ; Remove files
    Delete "$INSTDIR\*.*"
    RMDir /r "$INSTDIR"
    
    ; Remove shortcuts
    Delete "$DESKTOP\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"
    RMDir "$SMPROGRAMS\${APP_NAME}"
    
    ; Remove registry
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
SectionEnd

; Example Custom Step Page - Configuration Options
Function ShowCustomStepPage
    ; Set page header
    !insertmacro MUI_HEADER_TEXT "Configuration" "Configure installation options"
    
    ; Create nsDialogs page
    nsDialogs::Create 1018
    Pop $0
    
    ${If} $0 == error
        ; Fallback: Show MessageBox if nsDialogs fails
        MessageBox MB_OK|MB_ICONINFORMATION "Configuration Page$\n$\nThis is a custom configuration step.$\nClick OK to continue."
        Abort
    ${EndIf}
    
    ; Create main label
    ${NSD_CreateLabel} 0 10u 100% 30u "Choose installation options:$\r$\n$\r$\nSelect the options you want:"
    Pop $1
    
    ; Create checkbox for desktop shortcut (example)
    ${NSD_CreateCheckbox} 0 50u 100% 12u "Create desktop shortcut"
    Pop $2
    ${NSD_Check} $2  ; Check by default
    
    ; Create checkbox for start menu (example)
    ${NSD_CreateCheckbox} 0 70u 100% 12u "Add to Start Menu"
    Pop $3
    ${NSD_Check} $3  ; Check by default
    
    ; Create label with info
    ${NSD_CreateLabel} 0 90u 100% 50u "These options can be changed later.$\r$\n$\r$\nClick Next to continue to directory selection."
    Pop $4
    
    ; Show the page
    nsDialogs::Show
FunctionEnd

Function LeaveCustomStepPage
    ; Save checkbox states (example - you can use these in your sections)
    ${NSD_GetState} $2 $R2  ; Desktop shortcut checkbox state
    ${NSD_GetState} $3 $R3  ; Start menu checkbox state
    
    ; Store in variables for later use in sections
    ; $R2 = 1 if desktop shortcut checked, 0 if not
    ; $R3 = 1 if start menu checked, 0 if not
    
    ; You can add validation here
    ; ${If} $R2 == 0
    ;     MessageBox MB_OK "Warning: Desktop shortcut will not be created."
    ; ${EndIf}
FunctionEnd

; Alternative simple version using MessageBox (for testing)
Function ShowSimpleConfigStep
    MessageBox MB_OK|MB_ICONINFORMATION "Configuration Step$\n$\nThis is a simple configuration step.$\nClick OK to continue."
FunctionEnd

; Custom page function to show dependency status AFTER Welcome page
Function ShowDependencyStatusAfterWelcome
    ; Check Python
    Call CheckPython
    StrCpy $0 $R0
    
    ; Check Ollama
    Call CheckOllama
    StrCpy $1 $R1
    
    ; Create detailed status message
    StrCpy $2 "DEPENDENCY STATUS CHECK$\n$\n"
    StrCpy $2 "$2Checking required dependencies...$\n$\n"
    
    ; Python status
    StrCmp $0 "1" PythonInstalled PythonNotInstalled
    PythonInstalled:
        StrCpy $2 "$2[OK] Python: INSTALLED$\n"
        Goto OllamaCheck
    PythonNotInstalled:
        StrCpy $2 "$2[X] Python: NOT INSTALLED$\n  Will be installed automatically$\n"
    
    OllamaCheck:
    StrCmp $1 "1" OllamaInstalled OllamaNotInstalled
    OllamaInstalled:
        StrCpy $2 "$2[OK] Ollama: INSTALLED$\n"
        Goto ShowStatus
    OllamaNotInstalled:
        StrCpy $2 "$2[X] Ollama: NOT INSTALLED$\n  Will be installed automatically$\n"
    
    ShowStatus:
    StrCpy $2 "$2$\n"
    StrCmp $0 "1" CheckOllamaStatus FinalMessage
    CheckOllamaStatus:
        StrCmp $1 "1" AllInstalled SomeMissing
    AllInstalled:
        StrCpy $2 "$2All dependencies are already installed.$\nYou can proceed with installation.$\n"
        Goto FinalMessage
    SomeMissing:
        StrCpy $2 "$2Some dependencies will be installed$\nautomatically during installation.$\nThis may take a few minutes.$\n"
    
    FinalMessage:
    StrCpy $2 "$2$\nClick OK to continue to directory selection."
    
    ; Show message box - this will appear before directory page
    ; Using MB_SYSTEMMODAL to ensure it's visible and blocking
    MessageBox MB_OK|MB_ICONINFORMATION|MB_SYSTEMMODAL "$2"
FunctionEnd

; Section descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecDeps} "Check and install required dependencies (Python and Ollama)."
    !insertmacro MUI_DESCRIPTION_TEXT ${SecApp} "Install ${APP_NAME} application files."
!insertmacro MUI_FUNCTION_DESCRIPTION_END
