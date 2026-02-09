' ChatGPT-Ollama Desktop - Silent Startup Script
' This script starts the app without showing a console window
' Double-click this file to start the app silently

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
strScriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Change to script directory
objShell.CurrentDirectory = strScriptPath

' Check for Python
strPythonCmd = ""
On Error Resume Next

' Try py launcher first
Set objExec = objShell.Exec("py --version")
If objExec.Status = 0 Then
    strPythonCmd = "py"
Else
    ' Try python
    Set objExec = objShell.Exec("python --version")
    If objExec.Status = 0 Then
        strPythonCmd = "python"
    Else
        ' Try python3
        Set objExec = objShell.Exec("python3 --version")
        If objExec.Status = 0 Then
            strPythonCmd = "python3"
        End If
    End If
End If
On Error Goto 0

If strPythonCmd = "" Then
    ' Show error message
    objShell.Popup "Python is not installed or not in PATH." & vbCrLf & vbCrLf & _
                   "Please install Python from https://www.python.org/downloads/", _
                   10, "ChatGPT-Ollama - Error", 48
    WScript.Quit 1
End If

' Start launcher in a hidden window
strCommand = strPythonCmd & " launcher.py"
objShell.Run strCommand, 0, False

' Show brief notification
objShell.Popup "ChatGPT-Ollama is starting..." & vbCrLf & vbCrLf & _
               "The app will open shortly." & vbCrLf & _
               "To stop it, run STOP.bat", _
               3, "ChatGPT-Ollama", 64
