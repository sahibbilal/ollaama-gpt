const { app, BrowserWindow, dialog, Notification, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let flaskProcess;
let ollamaProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'build', 'icon.ico'),
    title: 'ChatGPT-Ollama'
  });

  // Don't open DevTools automatically - user can press F12 if needed
  // Only open in development mode if explicitly enabled
  if (process.env.OPEN_DEVTOOLS === 'true') {
    mainWindow.webContents.openDevTools();
  }

  // Load the HTML immediately - the renderer will wait for backend
  const htmlPath = path.join(__dirname, 'renderer', 'index.html');
  console.log('Loading HTML from:', htmlPath);
  
  // Verify renderer files exist
  const cssPath = path.join(__dirname, 'renderer', 'css', 'style.css');
  const jsPath = path.join(__dirname, 'renderer', 'js', 'app.js');
  const fs = require('fs');
  
  if (!fs.existsSync(cssPath)) {
    console.warn('Warning: CSS file not found at:', cssPath);
  }
  if (!fs.existsSync(jsPath)) {
    console.error('ERROR: JavaScript file not found at:', jsPath);
  }
  
  mainWindow.loadFile(htmlPath);

  // Handle resource loading failures (404 errors) - only show errors for critical files
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (errorCode === -105 || errorCode === -106) { // ERR_NAME_NOT_RESOLVED or ERR_FILE_NOT_FOUND
      // Only show error for main frame (HTML) or critical JS files
      if (isMainFrame || validatedURL.includes('app.js')) {
        console.error(`Resource not found (404): ${validatedURL}`);
        dialog.showErrorBox(
          'File Not Found',
          `The application file could not be found:\n\n${validatedURL}\n\nPlease reinstall the application.`
        );
      } else {
        // For other resources (CSS, images, etc.), just log - fallback styles will handle it
        console.warn(`Resource not found (404): ${validatedURL} - using fallback`);
      }
    }
  });

  // Log console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer ${level}]:`, message);
  });

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading');
    // Ensure window is visible
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Get port from config file
function getFlaskPort() {
  const fs = require('fs');
  const path = require('path');
  
  // Try multiple locations for port config
  const configLocations = [
    path.join(__dirname, '..', 'port_config.json'),
    path.join(__dirname, '..', '..', 'port_config.json'),
    path.join(require('os').homedir(), '.chatgpt-ollama-port.json')
  ];
  
  for (const configPath of configLocations) {
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.port && config.port >= 10000 && config.port <= 65535) {
          return config.port;
        }
      } catch (err) {
        console.error('Error reading port config:', err);
      }
    }
  }
  
  // Fallback to default
  return 5001;
}

const FLASK_PORT = getFlaskPort();
console.log('Using Flask port:', FLASK_PORT);

// Expose port to renderer process
ipcMain.handle('get-flask-port', () => {
  return FLASK_PORT;
});

function checkBackendHealth(callback) {
  const options = {
    hostname: 'localhost',
    port: FLASK_PORT,
    path: '/api/health',
    method: 'GET',
    timeout: 1000
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      callback(true);
    } else {
      callback(false);
    }
  });

  req.on('error', () => {
    callback(false);
  });

  req.on('timeout', () => {
    req.destroy();
    callback(false);
  });

  req.end();
}

// Check if backend is already running (e.g., started by launcher.py)
function isBackendRunning(callback) {
  checkBackendHealth((isReady) => {
    callback(isReady);
  });
}

// Check if Ollama service is running
function checkOllamaRunning(callback) {
  const options = {
    hostname: 'localhost',
    port: 11434,
    path: '/api/tags',
    method: 'GET',
    timeout: 2000
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      callback(true);
    } else {
      callback(false);
    }
  });

  req.on('error', () => {
    callback(false);
  });

  req.on('timeout', () => {
    req.destroy();
    callback(false);
  });

  req.end();
}

// Start Ollama service
function startOllama() {
  console.log('Starting Ollama service...');
  
  // Try to find Ollama executable
  let ollamaExe = 'ollama';
  if (process.platform === 'win32') {
    // On Windows, Ollama is usually installed in Program Files
    const possiblePaths = [
      'C:\\Program Files\\Ollama\\ollama.exe',
      'C:\\Program Files (x86)\\Ollama\\ollama.exe',
      process.env.LOCALAPPDATA + '\\Programs\\Ollama\\ollama.exe'
    ];
    
    const fs = require('fs');
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        ollamaExe = possiblePath;
        break;
      }
    }
  }
  
  console.log('Using Ollama executable:', ollamaExe);
  
  // Start Ollama as a background service
  ollamaProcess = spawn(ollamaExe, ['serve'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    detached: false
  });

  ollamaProcess.stdout.on('data', (data) => {
    console.log(`Ollama: ${data.toString().trim()}`);
  });

  ollamaProcess.stderr.on('data', (data) => {
    console.error(`Ollama Error: ${data.toString().trim()}`);
  });

  ollamaProcess.on('error', (error) => {
    console.error('Failed to start Ollama:', error);
    showNotification('Ollama Failed to Start', `Could not start Ollama service: ${error.message}. Please ensure Ollama is installed.`);
  });

  ollamaProcess.on('exit', (code) => {
    console.log(`Ollama service exited with code ${code}`);
    if (code !== 0 && code !== null) {
      console.error('Ollama service crashed!');
      showNotification('Ollama Service Stopped', 'Ollama service has stopped unexpectedly. Please restart it manually.');
    }
  });
}

// Show system notification
function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, 'build', 'icon.ico')
    }).show();
  } else {
    // Fallback: show in window
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.executeJavaScript(`
        alert('${title}\\n\\n${body}');
      `).catch(err => {
        console.error('Error showing notification:', err);
      });
    }
  }
}

// Show status message in the window
function showStatusMessage(message, isError = false) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.once('did-finish-load', () => {
      const color = isError ? '#ef4444' : '#10a37f';
      const bgColor = isError ? '#fee' : '#efe';
      const safeMsg = message
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n');
      
      mainWindow.webContents.executeJavaScript(`
        (function() {
          const statusDiv = document.getElementById('backend-status') || document.createElement('div');
          statusDiv.id = 'backend-status';
          statusDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 15px 20px; background: ${bgColor}; border: 2px solid ${color}; border-radius: 5px; z-index: 10000; font-family: Arial; max-width: 400px;';
          statusDiv.innerHTML = '<strong style="color: ${color};">${safeMsg}</strong>';
          if (!document.getElementById('backend-status')) {
            document.body.appendChild(statusDiv);
          }
          setTimeout(function() {
            if (statusDiv.parentNode) {
              statusDiv.style.opacity = '0';
              statusDiv.style.transition = 'opacity 0.5s';
              setTimeout(function() { statusDiv.remove(); }, 500);
            }
          }, 5000);
        })();
      `).catch(err => {
        console.error('Error showing status:', err);
      });
    });
  }
}

function findPythonExecutable() {
  // Try multiple Python executables in order of preference
  const candidates = process.platform === 'win32' 
    ? ['py', 'python', 'python3', 'python.exe']
    : ['python3', 'python'];
  
  // For now, return the first candidate and let spawn handle errors
  // In a more robust solution, we'd check each one exists first
  return candidates[0];
}

function startFlaskBackend() {
  // Determine Python executable - try multiple options
  const pythonExe = findPythonExecutable();
  
  // Path to main.py (adjust based on where the app is installed)
  let appPath;
  let appCwd;
  
  if (app.isPackaged) {
    // In packaged app, Python files are in extraResources/app
    appPath = path.join(process.resourcesPath, 'app', 'main.py');
    appCwd = path.join(process.resourcesPath, 'app');
    
    // Fallback: check if files are in the app directory
    if (!require('fs').existsSync(appPath)) {
      // Try alternative location (some electron-builder versions use different paths)
      const altPath = path.join(process.resourcesPath, '..', 'app', 'main.py');
      if (require('fs').existsSync(altPath)) {
        appPath = altPath;
        appCwd = path.join(process.resourcesPath, '..', 'app');
      } else {
        // Last resort: check if files are alongside the exe
        const exeDir = path.dirname(process.execPath);
        const exePath = path.join(exeDir, 'resources', 'app', 'main.py');
        if (require('fs').existsSync(exePath)) {
          appPath = exePath;
          appCwd = path.join(exeDir, 'resources', 'app');
        }
      }
    }
  } else {
    // In development, use parent directory
    appPath = path.join(__dirname, '..', 'main.py');
    appCwd = path.join(__dirname, '..');
  }
  
  console.log('Starting Flask backend...');
  console.log('Python:', pythonExe);
  console.log('Script:', appPath);
  console.log('CWD:', appCwd);
  console.log('File exists:', require('fs').existsSync(appPath));
  
  // Check if main.py exists
  if (!require('fs').existsSync(appPath)) {
    console.error('ERROR: main.py not found at:', appPath);
    console.error('Please ensure Python backend files are included in the build.');
    return;
  }
  
  // Set port environment variable for Flask
  const env = { ...process.env };
  env.FLASK_PORT = FLASK_PORT.toString();
  
  // Set PYTHONPATH to include the app directory
  env.PYTHONPATH = appCwd + (process.platform === 'win32' ? ';' : ':') + (env.PYTHONPATH || '');
  
  // Start Flask server
  console.log(`Attempting to start Flask with: ${pythonExe} ${appPath} on port ${FLASK_PORT}`);
  console.log(`Working directory: ${appCwd}`);
  console.log(`PYTHONPATH: ${env.PYTHONPATH}`);
  
  flaskProcess = spawn(pythonExe, [appPath], {
    cwd: appCwd,
    env: {
      ...env,
      PYTHONUNBUFFERED: '1' // Ensure Python output is not buffered
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });

  let flaskOutput = '';
  let flaskErrors = '';

  // Log Flask output
  flaskProcess.stdout.on('data', (data) => {
    const output = data.toString();
    flaskOutput += output;
    console.log(`Flask: ${output.trim()}`);
  });

  flaskProcess.stderr.on('data', (data) => {
    const output = data.toString();
    flaskErrors += output;
    const errorMsg = output.trim();
    console.error(`Flask Error: ${errorMsg}`);
    
    // Show popup for critical errors (both system dialog and in-app modal)
    if (errorMsg.includes('Error') || errorMsg.includes('Exception') || errorMsg.includes('Traceback') || errorMsg.includes('ModuleNotFoundError')) {
      // Show system error dialog
      dialog.showErrorBox(
        'Backend Error',
        `Flask backend encountered an error:\n\n${errorMsg.substring(0, 500)}`
      );
      
      // Also show modal popup in the renderer
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.once('did-finish-load', () => {
          const safeError = errorMsg
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/`/g, '\\`')
            .replace(/\n/g, '\\n')
            .substring(0, 1000);
          
          mainWindow.webContents.executeJavaScript(`
            if (typeof showErrorModal === 'function') {
              showErrorModal(
                'Backend Error',
                'Flask backend encountered an error while starting.',
                \`${safeError}\`
              );
            }
          `).catch(err => console.error('Error showing modal:', err));
        });
      }
    }
  });

  flaskProcess.on('error', (error) => {
    console.error('Failed to start Flask backend:', error);
    
    // Show error popup instead of just console
    dialog.showErrorBox(
      'Failed to Start Backend',
      `Failed to start Flask backend server.\n\nError: ${error.message}\n\nPython: ${pythonExe}\nScript: ${appPath}\n\nPlease ensure Python is installed and the application files are present.`
    );
    
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.once('did-finish-load', () => {
        const errorMsg = (error.message || String(error))
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n');
        
        mainWindow.webContents.executeJavaScript(`
          document.body.innerHTML = '<div style="padding: 50px; text-align: center; font-family: Arial; max-width: 600px; margin: 0 auto;">' +
            '<h1 style="color: #ef4444;">Failed to Start Backend</h1>' +
            '<p><strong>Error:</strong> ${errorMsg}</p>' +
            '<p><strong>Python executable:</strong> ${pythonExe}</p>' +
            '<p><strong>Script path:</strong> ${appPath}</p>' +
            '<hr style="margin: 20px 0;">' +
            '<h2>Possible Solutions:</h2>' +
            '<ul style="text-align: left; display: inline-block;">' +
            '<li>Ensure Python is installed and added to PATH</li>' +
            '<li>Try running the application as Administrator</li>' +
            '<li>Check that Python dependencies are installed: <code>pip install -r requirements.txt</code></li>' +
            '<li>Verify that main.py exists at the expected location</li>' +
            '</ul>' +
            '<p style="margin-top: 20px;">Check the console (F12) for more details.</p>' +
            '</div>';
        `).catch(err => {
          console.error('Error showing error message:', err);
        });
      });
    }
  });

  flaskProcess.on('exit', (code, signal) => {
    console.log(`Flask backend exited with code ${code}, signal ${signal}`);
    if (code !== 0 && code !== null) {
      console.error('Flask backend crashed!');
      console.error('Output:', flaskOutput);
      console.error('Errors:', flaskErrors);
      
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.once('did-finish-load', () => {
          const errorDisplay = flaskErrors || flaskOutput || 'No error output available';
          const safeError = errorDisplay
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .substring(0, 500); // Limit length
          
          mainWindow.webContents.executeJavaScript(`
            document.body.innerHTML = '<div style="padding: 50px; text-align: center; font-family: Arial; max-width: 600px; margin: 0 auto;">' +
              '<h1 style="color: #ef4444;">Backend Crashed</h1>' +
              '<p>The Flask backend started but exited with code ${code}.</p>' +
              '<pre style="background: #f0f0f0; padding: 15px; text-align: left; overflow-x: auto; max-height: 300px;">${safeError}</pre>' +
              '<p>Check the console (F12) for full error details.</p>' +
              '</div>';
          `).catch(err => {
            console.error('Error showing crash message:', err);
          });
        });
      }
    }
  });
}

app.whenReady().then(() => {
  // Request notification permission
  if (Notification.isSupported()) {
    app.requestSingleInstanceLock();
  }
  
  // Check if Ollama is running, if not start it
  checkOllamaRunning((isRunning) => {
    if (isRunning) {
      console.log('Ollama is already running');
    } else {
      console.log('Ollama is not running, starting it...');
      showNotification('Starting Ollama', 'Ollama service is starting. Please wait...');
      startOllama();
      
      // Wait a bit and check again (give it time to start)
      setTimeout(() => {
        checkOllamaRunning((isRunningNow) => {
          if (isRunningNow) {
            showNotification('Ollama Started', 'Ollama service is now running.');
            console.log('Ollama started successfully');
          } else {
            // Try one more time after a longer delay
            setTimeout(() => {
              checkOllamaRunning((isRunningFinal) => {
                if (isRunningFinal) {
                  showNotification('Ollama Started', 'Ollama service is now running.');
                } else {
                  showNotification('Ollama Failed to Start', 'Ollama service could not be started. Please ensure Ollama is installed and try again.');
                  // Show error in window
                  if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.once('did-finish-load', () => {
                      mainWindow.webContents.executeJavaScript(`
                        document.body.innerHTML = '<div style="padding: 50px; text-align: center; font-family: Arial; max-width: 600px; margin: 0 auto;">' +
                          '<h1 style="color: #ef4444;">Ollama Not Running</h1>' +
                          '<p>Ollama service could not be started automatically.</p>' +
                          '<p>Please ensure:</p>' +
                          '<ul style="text-align: left; display: inline-block;">' +
                          '<li>Ollama is installed on your system</li>' +
                          '<li>Ollama is added to your PATH</li>' +
                          '<li>Try starting Ollama manually: <code>ollama serve</code></li>' +
                          '</ul>' +
                          '<p>After starting Ollama, please restart this application.</p>' +
                          '</div>';
                      `).catch(err => console.error('Error showing message:', err));
                    });
                  }
                }
              });
            }, 5000);
          }
        });
      }, 3000);
    }
  });
  
  // Periodically check Ollama health (every 30 seconds)
  setInterval(() => {
    checkOllamaRunning((isRunning) => {
      if (!isRunning && !ollamaProcess) {
        console.log('Ollama stopped running, attempting to restart...');
        showNotification('Ollama Stopped', 'Ollama service stopped. Attempting to restart...');
        startOllama();
      }
    });
  }, 30000);
  
  // Create window immediately - renderer will wait for backend
  createWindow();
  
  // Check if backend is already running (started by launcher.py)
  // Wait a bit first to allow launcher.py time to start Flask
  setTimeout(() => {
    isBackendRunning((isRunning) => {
      if (isRunning) {
        console.log('Backend is already running (started by launcher)');
        showStatusMessage('Backend connected successfully');
        // Don't start Flask again - launcher.py is managing it
      } else {
        console.log('Backend not running, starting Flask...');
        showStatusMessage('Starting Flask backend...');
        // Only start Flask if not already running
        startFlaskBackend();
        
        // Check again after a delay to see if Flask started successfully
        setTimeout(() => {
          isBackendRunning((isRunningNow) => {
            if (isRunningNow) {
              showStatusMessage('Backend started successfully');
            } else {
              showStatusMessage('Backend failed to start. Check console for details.', true);
            }
          });
        }, 3000);
      }
    });
  }, 1000); // Wait 1 second for launcher.py to start Flask

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Kill Flask process
  if (flaskProcess) {
    flaskProcess.kill();
  }
  
  // Note: We don't kill Ollama process as it might be used by other applications
  // Ollama runs as a system service and should be managed separately
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Ensure Flask process is killed
  if (flaskProcess) {
    flaskProcess.kill();
  }
  // Note: Ollama process is left running as it's a system service
});
