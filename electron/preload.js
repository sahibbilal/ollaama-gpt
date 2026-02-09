const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the API without exposing the entire Node.js API
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any Electron-specific APIs here if needed
  platform: process.platform,
  getFlaskPort: () => {
    // Get port from main process via IPC
    return ipcRenderer.invoke('get-flask-port');
  }
});
