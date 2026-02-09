// ChatGPT-Ollama Desktop Frontend JavaScript

// Modal Popup Functions
function showErrorModal(title, message, details = null) {
    const modal = document.getElementById('errorModal');
    const titleEl = document.getElementById('errorModalTitle');
    const messageEl = document.getElementById('errorModalMessage');
    const detailsEl = document.getElementById('errorModalDetails');
    const okBtn = document.getElementById('errorModalOk');
    const closeBtn = document.getElementById('closeErrorModal');
    
    titleEl.textContent = title || 'Error';
    messageEl.textContent = message || 'An error occurred';
    
    if (details) {
        detailsEl.textContent = details;
        detailsEl.style.display = 'block';
    } else {
        detailsEl.style.display = 'none';
    }
    
    modal.style.display = 'flex';
    
    const closeModal = () => {
        modal.style.display = 'none';
    };
    
    okBtn.onclick = closeModal;
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

function showWarningModal(title, message) {
    const modal = document.getElementById('warningModal');
    const titleEl = document.getElementById('warningModalTitle');
    const messageEl = document.getElementById('warningModalMessage');
    const okBtn = document.getElementById('warningModalOk');
    const closeBtn = document.getElementById('closeWarningModal');
    
    titleEl.textContent = title || 'Warning';
    messageEl.textContent = message || 'A warning occurred';
    
    modal.style.display = 'flex';
    
    const closeModal = () => {
        modal.style.display = 'none';
    };
    
    okBtn.onclick = closeModal;
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

// Replace alert with modal
function showAlert(title, message, isError = false) {
    if (isError) {
        showErrorModal(title, message);
    } else {
        showWarningModal(title, message);
    }
}

// Get port from Electron main process
let API_BASE = 'http://localhost:5001'; // Default fallback

// Try to get port from Electron API
(async function getPortFromElectron() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', getPortFromElectron);
    return;
  }
  
  // Try multiple times to get port from Electron API
  const maxRetries = 5;
  let retryCount = 0;
  
  const tryGetPort = async () => {
    try {
      if (window.electronAPI && typeof window.electronAPI.getFlaskPort === 'function') {
        const port = await window.electronAPI.getFlaskPort();
        if (port && port !== 5001) {
          API_BASE = `http://localhost:${port}`;
          console.log('Using Flask port from Electron API:', port);
          return true;
        }
      }
    } catch (error) {
      console.log('Error getting port from Electron API:', error.message);
    }
    return false;
  };
  
  // Try immediately
  const gotPort = await tryGetPort();
  if (gotPort) return;
  
  // Retry with delays
  while (retryCount < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const gotPort = await tryGetPort();
    if (gotPort) return;
    retryCount++;
  }
  
  // Fallback to default port
  console.log('Using default port 5001 (Electron API not available or using default)');
})();

class ChatApp {
    constructor() {
        this.currentConversationId = null;
        this.currentModel = null;
        this.conversations = [];
        this.models = [];
        this.allModels = [];  // All available models from library
        this.popularModels = [];
        this.selectedModels = new Set();
        this.modelFilter = 'all';  // 'all', 'text', 'image', 'multimodal', 'installed'
        this.messageIndices = new Map();  // Map messageId to message index
        this.editingMessageId = null;  // Currently editing message ID
        this.isStreaming = false;  // Track if currently streaming
        this.userScrolledUp = false;  // Track if user manually scrolled up
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadTheme();
        this.waitForBackend();
    }
    
    async waitForBackend() {
        // Wait for Flask backend to be ready
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`${API_BASE}/api/health`);
                if (response.ok) {
                    console.log('Backend is ready');
                    await this.loadModels();
                    await this.loadConversations();
                    // Check dependencies status after backend is ready (with delay to ensure API is ready)
                    setTimeout(() => {
                        this.checkDependencies().catch(err => {
                            // Silently handle - endpoint might not be ready yet
                            console.log('Dependencies check will be available after backend fully initializes');
                        });
                    }, 3000); // Increased delay to ensure endpoint is ready
                    return;
                }
            } catch (error) {
                console.log(`Waiting for backend... (${attempts + 1}/${maxAttempts})`);
                // Show error popup after several failed attempts
                if (attempts === 10) {
                    showWarningModal(
                        'Backend Starting Slowly',
                        'Backend is taking longer than expected to start.\n\nPlease check if Python and Flask are properly installed.'
                    );
                }
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.error('Backend failed to start');
        // Show detailed error modal popup
        showErrorModal(
            'Backend Connection Failed',
            'Failed to connect to backend server after multiple attempts.',
            'Possible causes:\n- Python is not installed\n- Flask backend failed to start\n- Port is already in use\n- Backend service crashed\n\nPlease restart the application or check the console for details.'
        );
    }
    
    async checkDependencies() {
        try {
            const response = await fetch(`${API_BASE}/api/dependencies`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            if (!response.ok) {
                // If endpoint doesn't exist or returns error, don't show error
                if (response.status === 404) {
                    console.log('Dependencies endpoint not available yet (404) - Flask may still be starting');
                    // Retry after a delay
                    setTimeout(() => {
                        this.checkDependencies().catch(() => {
                            console.log('Dependencies check retry failed');
                        });
                    }, 3000);
                    return;
                }
                // For other errors, try to get error message
                try {
                    const errorData = await response.json();
                    console.warn('Dependencies check returned error:', errorData);
                } catch {
                    console.warn('Dependencies check returned status:', response.status);
                }
                return;
            }
            
            const data = await response.json();
            if (data && data.success !== undefined) {
                this.displayDependenciesStatus(data);
            } else {
                console.warn('Invalid dependencies response format');
            }
        } catch (error) {
            // Silently handle errors - don't show errors if API is not ready
            if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                console.log('Dependencies check timed out - API may not be ready yet');
            } else if (error.message && error.message.includes('Failed to fetch')) {
                console.log('Dependencies API not available - backend may still be starting');
            } else {
                console.log('Dependencies check skipped:', error.message);
            }
            // Don't show error to user - this is expected during startup
        }
    }
    
    displayDependenciesStatus(data) {
        const panel = document.getElementById('dependenciesPanel');
        const pythonStatusBadge = document.getElementById('pythonStatusBadge');
        const pythonVersion = document.getElementById('pythonVersion');
        const ollamaStatusBadge = document.getElementById('ollamaStatusBadge');
        const ollamaVersion = document.getElementById('ollamaVersion');
        const dependenciesBtn = document.getElementById('dependenciesBtn');
        
        // Update Python status
        if (data.python.installed) {
            pythonStatusBadge.textContent = 'Installed';
            pythonStatusBadge.className = 'status-badge installed';
            pythonVersion.textContent = `Version ${data.python.version}`;
        } else {
            pythonStatusBadge.textContent = 'Not Installed';
            pythonStatusBadge.className = 'status-badge not-installed';
            pythonVersion.textContent = `Required: ${data.python.required}`;
        }
        
        // Update Ollama status
        if (data.ollama.running) {
            ollamaStatusBadge.textContent = 'Running';
            ollamaStatusBadge.className = 'status-badge running';
            ollamaVersion.textContent = data.ollama.version || 'Service running';
        } else if (data.ollama.installed) {
            ollamaStatusBadge.textContent = 'Installed (Not Running)';
            ollamaStatusBadge.className = 'status-badge not-installed';
            ollamaVersion.textContent = data.ollama.version || 'Service not running';
        } else {
            ollamaStatusBadge.textContent = 'Not Installed';
            ollamaStatusBadge.className = 'status-badge not-installed';
            ollamaVersion.textContent = 'Not found';
        }
        
        // Update button indicator
        if (data.all_ok) {
            dependenciesBtn.style.color = 'var(--accent-color)';
            dependenciesBtn.title = 'Dependencies Status: All OK';
        } else {
            dependenciesBtn.style.color = 'var(--error-color)';
            dependenciesBtn.title = 'Dependencies Status: Issues Detected - Click to View';
        }
        
        // Show panel automatically if dependencies are not OK
        if (!data.all_ok) {
            panel.style.display = 'flex';
        }
    }
    
    setupEventListeners() {
        // Send button
        const sendBtn = document.getElementById('sendBtn');
        const messageInput = document.getElementById('messageInput');
        
        sendBtn.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        });
        
        // Track user scroll to detect if they scrolled up
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
            chatContainer.addEventListener('scroll', () => {
                // Check if user scrolled up (not at bottom)
                const isAtBottom = Math.abs(chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight) < 50;
                this.userScrolledUp = !isAtBottom && !this.isStreaming;
                
                // Show/hide scroll to bottom button
                this.updateScrollButton(!isAtBottom);
            });
        }
        
        // Scroll to bottom button click handler
        const scrollBtn = document.getElementById('scrollToBottomBtn');
        if (scrollBtn) {
            scrollBtn.addEventListener('click', () => {
                this.scrollToBottom(true, true);
            });
        }
        
        // New chat button
        document.getElementById('newChatBtn').addEventListener('click', () => this.newChat());
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // Model select
        document.getElementById('modelSelect').addEventListener('change', (e) => {
            this.currentModel = e.target.value;
        });
        
        // Install models
        document.getElementById('installModelsBtn').addEventListener('click', () => this.openInstallModal());
        document.getElementById('closeModal').addEventListener('click', () => this.closeInstallModal());
        document.getElementById('installSelectedBtn').addEventListener('click', () => this.installSelectedModels());
        document.getElementById('installManualBtn').addEventListener('click', () => this.installManualModel());
        
        // Allow Enter key in manual model input
        document.getElementById('manualModelInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.installManualModel();
            }
        });
        
        // Close modal on outside click
        document.getElementById('installModal').addEventListener('click', (e) => {
            if (e.target.id === 'installModal') {
                this.closeInstallModal();
            }
        });
        
        // Dependencies panel
        document.getElementById('dependenciesBtn').addEventListener('click', () => {
            this.showDependenciesPanel().catch(err => {
                console.log('Could not show dependencies panel:', err);
            });
        });
        document.getElementById('closeDependenciesBtn').addEventListener('click', () => this.hideDependenciesPanel());
        document.getElementById('refreshDependenciesBtn').addEventListener('click', () => {
            this.checkDependencies().catch(err => {
                console.log('Could not refresh dependencies:', err);
            });
        });
        
        // Close dependencies panel on outside click
        document.getElementById('dependenciesPanel').addEventListener('click', (e) => {
            if (e.target.id === 'dependenciesPanel') {
                this.hideDependenciesPanel();
            }
        });
    }
    
    async showDependenciesPanel() {
        const panel = document.getElementById('dependenciesPanel');
        panel.style.display = 'flex';
        
        // Show checking status
        document.getElementById('pythonStatusBadge').textContent = 'Checking...';
        document.getElementById('pythonStatusBadge').className = 'status-badge checking';
        document.getElementById('ollamaStatusBadge').textContent = 'Checking...';
        document.getElementById('ollamaStatusBadge').className = 'status-badge checking';
        
        // Refresh status when opening
        await this.checkDependencies();
    }
    
    hideDependenciesPanel() {
        const panel = document.getElementById('dependenciesPanel');
        panel.style.display = 'none';
    }
    
    loadTheme() {
        const theme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        const themeBtn = document.getElementById('themeToggle');
        themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        const themeBtn = document.getElementById('themeToggle');
        themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
    
    async loadModels(refresh = false) {
        try {
            const url = refresh ? `${API_BASE}/api/models?refresh=true` : `${API_BASE}/api/models`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                this.models = data.models || [];  // Installed models
                this.allModels = data.all_models || [];  // All available models
                this.popularModels = data.popular_models || [];
                
                this.populateModelSelect();
                this.populateInstallModal();
                
                // Set default model if available
                if (this.models.length > 0 && !this.currentModel) {
                    this.currentModel = this.models[0].name;
                    document.getElementById('modelSelect').value = this.currentModel;
                }
            }
        } catch (error) {
            console.error('Error loading models:', error);
            showErrorModal(
                'Failed to Load Models',
                'Unable to load available models from the server.',
                error.message || 'Unknown error occurred while loading models.'
            );
        }
    }
    
    populateModelSelect() {
        const select = document.getElementById('modelSelect');
        select.innerHTML = '';
        
        if (this.models.length === 0) {
            select.innerHTML = '<option value="">No models available</option>';
            return;
        }
        
        this.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            select.appendChild(option);
        });
        
        if (this.currentModel) {
            select.value = this.currentModel;
        }
    }
    
    populateInstallModal() {
        const list = document.getElementById('popularModelsList');
        list.innerHTML = '';
        
        // Add filter buttons
        const filterContainer = document.createElement('div');
        filterContainer.className = 'model-filters';
        filterContainer.innerHTML = `
            <button class="filter-btn ${this.modelFilter === 'all' ? 'active' : ''}" data-filter="all">All Models</button>
            <button class="filter-btn ${this.modelFilter === 'text' ? 'active' : ''}" data-filter="text">Text</button>
            <button class="filter-btn ${this.modelFilter === 'image' ? 'active' : ''}" data-filter="image">Image</button>
            <button class="filter-btn ${this.modelFilter === 'multimodal' ? 'active' : ''}" data-filter="multimodal">Multimodal</button>
            <button class="filter-btn ${this.modelFilter === 'installed' ? 'active' : ''}" data-filter="installed">Installed</button>
        `;
        
        // Add filter event listeners
        filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.modelFilter = e.target.dataset.filter;
                filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.populateInstallModal(); // Refresh list
            });
        });
        
        list.appendChild(filterContainer);
        
        // Filter models based on selected filter
        let modelsToShow = this.allModels;
        if (this.modelFilter === 'installed') {
            modelsToShow = this.allModels.filter(m => m.installed);
        } else if (this.modelFilter === 'image') {
            // Show both image and multimodal models for image filter (both can generate images)
            modelsToShow = this.allModels.filter(m => m.category === 'image' || m.category === 'multimodal');
        } else if (this.modelFilter !== 'all') {
            modelsToShow = this.allModels.filter(m => m.category === this.modelFilter);
        }
        
        // Sort: installed first, then by name
        modelsToShow.sort((a, b) => {
            if (a.installed !== b.installed) {
                return b.installed ? 1 : -1;
            }
            return a.name.localeCompare(b.name);
        });
        
        // Group by category
        const grouped = {};
        modelsToShow.forEach(model => {
            const category = model.category || 'other';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(model);
        });
        
        // Display grouped models
        Object.keys(grouped).sort().forEach(category => {
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'model-category-header';
            categoryHeader.textContent = category.charAt(0).toUpperCase() + category.slice(1) + ' Models';
            list.appendChild(categoryHeader);
            
            grouped[category].forEach(model => {
                const modelName = model.name;
                const isInstalled = model.installed;
                
                const item = document.createElement('div');
                item.className = 'model-item';
                const modelSize = model.size || 'Unknown';
                item.innerHTML = `
                    <input type="checkbox" class="model-item-checkbox" data-model="${modelName}" ${isInstalled ? 'disabled' : ''}>
                    <div class="model-item-info">
                        <div class="model-item-name">${modelName}</div>
                        <div class="model-item-details">
                            <span class="model-item-status">${isInstalled ? '✓ Installed' : 'Not installed'}</span>
                            ${!isInstalled ? `<span class="model-item-size">📦 ${modelSize}</span>` : ''}
                            ${isInstalled ? `<button class="model-delete-btn" data-model="${modelName}" title="Delete model">🗑️</button>` : ''}
                        </div>
                    </div>
                `;
                
                if (!isInstalled) {
                    const checkbox = item.querySelector('.model-item-checkbox');
                    checkbox.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            this.selectedModels.add(modelName);
                            console.log(`Selected model: ${modelName}`);
                        } else {
                            this.selectedModels.delete(modelName);
                            console.log(`Deselected model: ${modelName}`);
                        }
                        this.updateInstallButton();
                    });
                    
                    // Also allow clicking on the item to toggle checkbox
                    item.style.cursor = 'pointer';
                    item.addEventListener('click', (e) => {
                        if (e.target !== checkbox && e.target.type !== 'checkbox' && !e.target.classList.contains('model-delete-btn')) {
                            checkbox.checked = !checkbox.checked;
                            checkbox.dispatchEvent(new Event('change'));
                        }
                    });
                } else {
                    // Add delete button event listener for installed models
                    const deleteBtn = item.querySelector('.model-delete-btn');
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            await this.deleteModel(modelName);
                        });
                    }
                }
                
                list.appendChild(item);
            });
        });
        
        // Show message if no models
        if (modelsToShow.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-message';
            emptyMsg.textContent = 'No models found for this filter.';
            list.appendChild(emptyMsg);
        }
    }
    
    updateInstallButton() {
        const btn = document.getElementById('installSelectedBtn');
        const count = this.selectedModels.size;
        btn.disabled = count === 0;
        if (count > 0) {
            btn.textContent = `Install Selected (${count})`;
        } else {
            btn.textContent = 'Install Selected';
        }
    }
    
    async openInstallModal() {
        document.getElementById('installModal').classList.add('active');
        this.selectedModels.clear();
        this.updateInstallButton();
        
        // Refresh models list to get latest installation status
        console.log('Opening install modal, refreshing models...');
        await this.loadModels();
        this.populateInstallModal();
        await this.loadModels();
        this.populateInstallModal();
    }
    
    closeInstallModal() {
        document.getElementById('installModal').classList.remove('active');
    }
    
    async installManualModel() {
        const input = document.getElementById('manualModelInput');
        const modelName = input.value.trim();
        
        if (!modelName) {
            showWarningModal(
                'No Model Name',
                'Please enter a model name to install.'
            );
            return;
        }
        
        const btn = document.getElementById('installManualBtn');
        btn.disabled = true;
        btn.textContent = 'Installing...';
        
        try {
            await this.installModel(modelName);
            showWarningModal(
                'Installation Successful',
                `Model "${modelName}" has been successfully installed.`
            );
            input.value = '';
            
            // Refresh models list
            await this.loadModels(true);
            this.populateModelSelect();
        } catch (error) {
            console.error(`Error installing model ${modelName}:`, error);
            showErrorModal(
                'Model Installation Failed',
                `Failed to install model: ${modelName}`,
                error.message || 'Unknown error occurred during model installation.'
            );
        } finally {
            btn.disabled = false;
            btn.textContent = 'Install';
        }
    }
    
    async installSelectedModels() {
        if (this.selectedModels.size === 0) return;
        
        const modelsToInstall = Array.from(this.selectedModels);
        const btn = document.getElementById('installSelectedBtn');
        btn.disabled = true;
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < modelsToInstall.length; i++) {
            const modelName = modelsToInstall[i];
            btn.textContent = `Installing ${modelName}... (${i + 1}/${modelsToInstall.length})`;
            
            try {
                await this.installModel(modelName);
                successCount++;
                console.log(`Successfully installed: ${modelName}`);
            } catch (error) {
                failCount++;
                console.error(`Error installing ${modelName}:`, error);
                showErrorModal(
                    'Model Installation Failed',
                    `Failed to install model: ${modelName}`,
                    error.message || 'Unknown error occurred during model installation.'
                );
            }
        }
        
        btn.disabled = false;
        btn.textContent = 'Install Selected';
        
        // Show summary
        if (successCount > 0) {
            if (failCount > 0) {
                showWarningModal(
                    'Model Installation Complete',
                    `Successfully installed ${successCount} model(s).\n\n${failCount} model(s) failed to install.`
                );
            } else {
                showWarningModal(
                    'Installation Successful',
                    `Successfully installed ${successCount} model(s).`
                );
            }
        }
        
        this.closeInstallModal();
        // Force refresh models from Ollama to get newly installed models
        await this.loadModels(true); // Refresh model list with refresh=true
        this.populateModelSelect(); // Update dropdown
    }
    
    async installModel(modelName) {
        return new Promise((resolve, reject) => {
            console.log(`Starting installation of model: ${modelName}`);
            
            fetch(`${API_BASE}/api/models/install`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ model: modelName })
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`HTTP ${response.status}: ${text}`);
                    });
                }
                
                if (!response.body) {
                    throw new Error('No response body received');
                }
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let hasError = false;
                
                const readStream = () => {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            if (!hasError) {
                                console.log(`Model ${modelName} installation completed`);
                                resolve();
                            }
                            return;
                        }
                        
                        // Decode chunk and add to buffer
                        buffer += decoder.decode(value, { stream: true });
                        
                        // Process complete lines
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ''; // Keep incomplete line in buffer
                        
                        for (const line of lines) {
                            if (line.trim() && line.startsWith('data: ')) {
                                try {
                                    const jsonStr = line.slice(6).trim();
                                    if (!jsonStr) continue;
                                    
                                    const data = JSON.parse(jsonStr);
                                    
                                    if (data.error) {
                                        hasError = true;
                                        // Format error message for better readability
                                        const errorMsg = typeof data.error === 'string' 
                                            ? data.error 
                                            : JSON.stringify(data.error);
                                        reject(new Error(errorMsg));
                                        return;
                                    }
                                    
                                    if (data.status === 'success') {
                                        console.log(`Model ${modelName} installed successfully`);
                                        resolve();
                                        return;
                                    }
                                    
                                    // Log progress updates
                                    if (data.status) {
                                        console.log(`Progress: ${data.status}`);
                                    }
                                } catch (e) {
                                    // Skip invalid JSON lines
                                    console.warn('Failed to parse SSE data:', line, e);
                                }
                            }
                        }
                        
                        // Continue reading
                        readStream();
                    }).catch(err => {
                        if (!hasError) {
                            console.error(`Stream error for ${modelName}:`, err);
                            showErrorModal(
                                'Stream Error',
                                `Error occurred while streaming response from ${modelName}.`,
                                err.message || 'Unknown stream error occurred.'
                            );
                            reject(err);
                        }
                    });
                };
                
                readStream();
            })
            .catch(err => {
                console.error(`Fetch error for ${modelName}:`, err);
                showErrorModal(
                    'Request Failed',
                    `Failed to send request to ${modelName}.`,
                    err.message || 'Unknown fetch error occurred.'
                );
                reject(err);
            });
        });
    }
    
    async deleteModel(modelName) {
        // Confirm deletion
        const confirmed = confirm(`Are you sure you want to delete the model "${modelName}"?\n\nThis action cannot be undone.`);
        if (!confirmed) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/models/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ model: modelName })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showWarningModal(
                    'Model Deleted',
                    `Model "${modelName}" has been successfully deleted.`
                );
                
                // Refresh models list
                await this.loadModels(true);
                this.populateModelSelect();
                
                // If deleted model was current model, switch to first available
                if (this.currentModel === modelName) {
                    if (this.models.length > 0) {
                        this.currentModel = this.models[0].name;
                        document.getElementById('modelSelect').value = this.currentModel;
                    } else {
                        this.currentModel = null;
                    }
                }
            } else {
                throw new Error(data.error || 'Failed to delete model');
            }
        } catch (error) {
            console.error(`Error deleting model ${modelName}:`, error);
            showErrorModal(
                'Failed to Delete Model',
                `Unable to delete model "${modelName}".`,
                error.message || 'Unknown error occurred while deleting model.'
            );
        }
    }
    
    async loadConversations() {
        try {
            const response = await fetch(`${API_BASE}/api/conversations`);
            const data = await response.json();
            
            if (data.success) {
                this.conversations = data.conversations || [];
                this.renderConversations();
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            showErrorModal(
                'Failed to Load Conversations',
                'Unable to load your conversation history.',
                error.message || 'Unknown error occurred while loading conversations.'
            );
        }
    }
    
    renderConversations() {
        const list = document.getElementById('conversationsList');
        list.innerHTML = '';
        
        this.conversations.forEach(conv => {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            if (conv.id === this.currentConversationId) {
                item.classList.add('active');
            }
            
            item.innerHTML = `
                <span class="conversation-title">${this.escapeHtml(conv.title)}</span>
                <button class="conversation-delete" data-id="${conv.id}">🗑️</button>
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('conversation-delete')) {
                    this.loadConversation(conv.id);
                }
            });
            
            item.querySelector('.conversation-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteConversation(conv.id);
            });
            
            list.appendChild(item);
        });
    }
    
    async loadConversation(conversationId) {
        try {
            const response = await fetch(`${API_BASE}/api/conversations/${conversationId}`);
            const data = await response.json();
            
            if (data.success) {
                this.currentConversationId = conversationId;
                this.renderMessages(data.conversation.messages);
                this.renderConversations();
            }
        } catch (error) {
            console.error('Error loading conversation:', error);
            showErrorModal(
                'Failed to Load Conversation',
                'Unable to load the selected conversation.',
                error.message || 'Unknown error occurred while loading conversation.'
            );
            showErrorModal(
                'Failed to Load Conversation',
                'Unable to load the selected conversation.',
                error.message || 'Unknown error occurred while loading conversation.'
            );
        }
    }
    
    async deleteConversation(conversationId) {
        if (!confirm('Are you sure you want to delete this conversation?')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/conversations/${conversationId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                if (this.currentConversationId === conversationId) {
                    this.currentConversationId = null;
                    this.clearMessages();
                }
                await this.loadConversations();
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            showErrorModal(
                'Failed to Delete Conversation',
                'Unable to delete the conversation.',
                error.message || 'Unknown error occurred while deleting conversation.'
            );
        }
    }
    
    async newChat() {
        this.currentConversationId = null;
        this.clearMessages();
        this.renderConversations();
    }
    
    clearMessages() {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome to ChatGPT-Ollama</h2>
                <p>Select a model and start chatting!</p>
            </div>
        `;
    }
    
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || !this.currentModel) {
            return;
        }
        
        // Disable input
        messageInput.disabled = true;
        document.getElementById('sendBtn').disabled = true;
        
        // Add user message to UI
        this.addMessage('user', message);
        
        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // Show loading indicator
        this.showLoading();
        
        // Send to API
        try {
            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    conversation_id: this.currentConversationId,
                    model: this.currentModel
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            
            // Stream response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessageId = this.addMessage('assistant', '');
            
            // Hide loading indicator once we start receiving content
            this.hideLoading();
            
            // Mark as streaming
            this.isStreaming = true;
            this.userScrolledUp = false;  // Reset scroll state when starting new stream
            
            // Scroll to show the new message
            this.scrollToBottom(false, true);
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.error) {
                                    this.updateMessage(assistantMessageId, `Error: ${data.error}`);
                                    break;
                                }
                                if (data.content) {
                                    this.appendToMessage(assistantMessageId, data.content);
                                }
                                if (data.done) {
                                    if (data.conversation_id) {
                                        this.currentConversationId = data.conversation_id;
                                        await this.loadConversations();
                                    }
                                    break;
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }
                    }
                }
            } finally {
                // Always mark streaming as complete
                this.isStreaming = false;
                // Final scroll to ensure we're at bottom
                this.scrollToBottom(false, true);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showErrorModal(
                'Failed to Send Message',
                'Unable to send your message to the server.',
                error.message || 'Unknown error occurred while sending message.'
            );
            this.addMessage('assistant', `Error: ${error.message}`);
        } finally {
            // Hide loading indicator
            this.hideLoading();
            
            // Re-enable input
            messageInput.disabled = false;
            document.getElementById('sendBtn').disabled = false;
            messageInput.focus();
        }
    }
    
    showLoading() {
        const loadingEl = document.getElementById('messageLoading');
        if (loadingEl) {
            loadingEl.style.display = 'flex';
            // Scroll to show loading indicator
            setTimeout(() => {
                this.scrollToBottom(false, true);
            }, 100);
        }
    }
    
    hideLoading() {
        const loadingEl = document.getElementById('messageLoading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }
    
    addMessage(role, content, messageIndex = null) {
        const messagesContainer = document.getElementById('chatMessages');
        
        // Remove welcome message if present
        const welcomeMsg = messagesContainer.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
        
        const messageId = `msg-${Date.now()}-${Math.random()}`;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.id = messageId;
        
        // Store raw content for streaming updates
        messageDiv.dataset.rawContent = content || '';
        
        const avatar = role === 'user' ? '👤' : '🤖';
        
        // Calculate message index if not provided
        if (messageIndex === null) {
            messageIndex = messagesContainer.querySelectorAll('.message').length;
        }
        
        // Store message index
        this.messageIndices.set(messageId, messageIndex);
        
        // Add edit button for user messages
        const editButton = role === 'user' ? `
            <button class="message-edit-btn" data-message-id="${messageId}" data-message-index="${messageIndex}" title="Edit message">✏️</button>
        ` : '';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content-wrapper">
                <div class="message-content">${this.formatMarkdown(content || '')}</div>
                ${editButton}
            </div>
        `;
        
        // Add edit button event listener
        if (role === 'user') {
            const editBtn = messageDiv.querySelector('.message-edit-btn');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startEditMessage(messageId, content);
            });
        }
        
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom(false, true);
        
        return messageId;
    }
    
    updateMessage(messageId, content) {
        const messageDiv = document.getElementById(messageId);
        if (messageDiv) {
            const contentDiv = messageDiv.querySelector('.message-content');
            if (contentDiv) {
                // Store raw content
                messageDiv.dataset.rawContent = content || '';
                // Format and display
                contentDiv.innerHTML = this.formatMarkdown(content || '');
            }
        }
    }
    
    appendToMessage(messageId, chunk) {
        const messageDiv = document.getElementById(messageId);
        if (messageDiv) {
            const contentDiv = messageDiv.querySelector('.message-content');
            if (contentDiv) {
                // Get raw content from dataset or textContent as fallback
                let currentContent = messageDiv.dataset.rawContent || '';
                
                // Append new chunk to raw content
                currentContent += chunk;
                
                // Store updated raw content
                messageDiv.dataset.rawContent = currentContent;
                
                // Format and display (this will properly render markdown in real-time)
                contentDiv.innerHTML = this.formatMarkdown(currentContent);
                
                // Auto-scroll to show latest content during streaming
                this.scrollToBottom(true);
            }
        }
    }
    
    scrollToBottom(smooth = false, force = false) {
        const chatContainer = document.getElementById('chatContainer');
        if (!chatContainer) return;
        
        // If user scrolled up and we're not forcing, don't auto-scroll
        // But if we're streaming, always scroll to show new content
        if (!force && !this.isStreaming && this.userScrolledUp) {
            return;
        }
        
        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
            const scrollHeight = chatContainer.scrollHeight;
            
            if (smooth) {
                chatContainer.scrollTo({
                    top: scrollHeight,
                    behavior: 'smooth'
                });
            } else {
                chatContainer.scrollTop = scrollHeight;
            }
            
            // Double-check we're at bottom (sometimes scrollHeight changes after render)
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 50);
            
            // Update user scroll state - if we're at bottom, user hasn't scrolled up
            const isAtBottom = Math.abs(chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight) < 50;
            if (isAtBottom) {
                this.userScrolledUp = false;
                this.updateScrollButton(false);
            }
        });
    }
    
    updateScrollButton(show) {
        const scrollBtn = document.getElementById('scrollToBottomBtn');
        if (scrollBtn) {
            scrollBtn.style.display = show ? 'flex' : 'none';
        }
    }
    
    renderMessages(messages) {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '';
        this.messageIndices.clear();
        
        messages.forEach((msg, index) => {
            this.addMessage(msg.role, msg.content, index);
        });
        
        // Auto-scroll to bottom after loading messages
        this.scrollToBottom(false, true);
        // Hide scroll button when at bottom
        this.updateScrollButton(false);
    }
    
    startEditMessage(messageId, currentContent) {
        // Cancel any existing edit
        if (this.editingMessageId) {
            this.cancelEditMessage();
        }
        
        this.editingMessageId = messageId;
        const messageDiv = document.getElementById(messageId);
        if (!messageDiv) return;
        
        const contentWrapper = messageDiv.querySelector('.message-content-wrapper');
        const contentDiv = messageDiv.querySelector('.message-content');
        const editBtn = messageDiv.querySelector('.message-edit-btn');
        
        // Create edit textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'message-edit-input';
        textarea.value = contentDiv.textContent || currentContent;
        textarea.rows = Math.min(Math.max(textarea.value.split('\n').length, 2), 10);
        
        // Create edit buttons
        const editActions = document.createElement('div');
        editActions.className = 'message-edit-actions';
        editActions.innerHTML = `
            <button class="message-edit-save">Save & Regenerate</button>
            <button class="message-edit-cancel">Cancel</button>
        `;
        
        // Replace content with edit UI
        contentWrapper.innerHTML = '';
        contentWrapper.appendChild(textarea);
        contentWrapper.appendChild(editActions);
        
        // Focus textarea
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        
        // Event listeners
        editActions.querySelector('.message-edit-save').addEventListener('click', () => {
            const newContent = textarea.value.trim();
            if (newContent) {
                this.saveEditMessage(messageId, newContent);
            }
        });
        
        editActions.querySelector('.message-edit-cancel').addEventListener('click', () => {
            this.cancelEditMessage();
        });
        
        // Save on Enter (Ctrl+Enter or Cmd+Enter)
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const newContent = textarea.value.trim();
                if (newContent) {
                    this.saveEditMessage(messageId, newContent);
                }
            } else if (e.key === 'Escape') {
                this.cancelEditMessage();
            }
        });
    }
    
    cancelEditMessage() {
        if (!this.editingMessageId) return;
        
        // Reload conversation to restore original state
        if (this.currentConversationId) {
            this.loadConversation(this.currentConversationId);
        }
        
        this.editingMessageId = null;
    }
    
    async saveEditMessage(messageId, newContent) {
        if (!this.editingMessageId || this.editingMessageId !== messageId) return;
        
        const messageIndex = this.messageIndices.get(messageId);
        if (messageIndex === undefined) return;
        
        // Disable input
        const messageInput = document.getElementById('messageInput');
        messageInput.disabled = true;
        document.getElementById('sendBtn').disabled = true;
        
        try {
            // Truncate conversation at this message index
            if (this.currentConversationId) {
                const truncateResponse = await fetch(`${API_BASE}/api/conversations/${this.currentConversationId}/truncate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message_index: messageIndex
                    })
                });
                
                if (!truncateResponse.ok) {
                    throw new Error('Failed to truncate conversation');
                }
            }
            
            // Remove all messages after this one from UI
            const messagesContainer = document.getElementById('chatMessages');
            const allMessages = Array.from(messagesContainer.querySelectorAll('.message'));
            const currentMessageIndex = allMessages.findIndex(msg => msg.id === messageId);
            
            if (currentMessageIndex >= 0) {
                // Remove all messages after current
                for (let i = currentMessageIndex + 1; i < allMessages.length; i++) {
                    allMessages[i].remove();
                }
            }
            
            // Update the message content
            const messageDiv = document.getElementById(messageId);
            if (messageDiv) {
                const contentWrapper = messageDiv.querySelector('.message-content-wrapper');
                const avatar = '👤';
                const editButton = `
                    <button class="message-edit-btn" data-message-id="${messageId}" data-message-index="${messageIndex}" title="Edit message">✏️</button>
                `;
                contentWrapper.innerHTML = `
                    <div class="message-content">${this.formatMarkdown(newContent)}</div>
                    ${editButton}
                `;
                
                // Re-add edit button listener
                const editBtn = contentWrapper.querySelector('.message-edit-btn');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.startEditMessage(messageId, newContent);
                });
            }
            
            this.editingMessageId = null;
            
            // Send the edited message
            await this.sendEditedMessage(newContent);
            
        } catch (error) {
            console.error('Error saving edit:', error);
            showErrorModal(
                'Failed to Edit Message',
                'Unable to save your edited message.',
                error.message || 'Unknown error occurred while editing message.'
            );
            this.cancelEditMessage();
        } finally {
            // Re-enable input
            messageInput.disabled = false;
            document.getElementById('sendBtn').disabled = false;
            messageInput.focus();
        }
    }
    
    async sendEditedMessage(message) {
        if (!message || !this.currentModel) {
            return;
        }
        
        // Send to API
        try {
            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    conversation_id: this.currentConversationId,
                    model: this.currentModel
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            
            // Stream response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessageId = this.addMessage('assistant', '');
            
            // Hide loading indicator once we start receiving content
            this.hideLoading();
            
            // Mark as streaming
            this.isStreaming = true;
            this.userScrolledUp = false;  // Reset scroll state when starting new stream
            
            // Scroll to show the new message
            this.scrollToBottom(false, true);
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.content) {
                                    this.appendToMessage(assistantMessageId, data.content);
                                }
                                if (data.done) {
                                    if (data.conversation_id) {
                                        this.currentConversationId = data.conversation_id;
                                        await this.loadConversations();
                                    }
                                    break;
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }
                        }
                    }
                }
            } finally {
                // Always mark streaming as complete
                this.isStreaming = false;
                // Final scroll to ensure we're at bottom
                this.scrollToBottom(false, true);
            }
        } catch (error) {
            console.error('Error sending edited message:', error);
            // Make sure to reset streaming state on error
            this.isStreaming = false;
            this.hideLoading();
            showErrorModal(
                'Failed to Send Message',
                'Unable to send your edited message to the server.',
                error.message || 'Unknown error occurred while sending message.'
            );
            this.addMessage('assistant', `Error: ${error.message}`);
        }
    }
    
    formatMarkdown(text) {
        if (!text) return '';
        
        // Escape HTML first
        let html = this.escapeHtml(text);
        
        // Code blocks (process first to avoid interfering with other formatting)
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        
        // Inline code (but not inside code blocks)
        html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        
        // Split into lines for better processing
        const lines = html.split('\n');
        const processedLines = [];
        let inList = false;
        let listType = null; // 'ul' or 'ol'
        let listItems = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Check for ordered list (number followed by period)
            const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
            // Check for unordered list (dash, asterisk, or plus)
            const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
            
            if (orderedMatch || unorderedMatch) {
                // We're in a list
                const itemText = orderedMatch ? orderedMatch[2] : unorderedMatch[1];
                const currentListType = orderedMatch ? 'ol' : 'ul';
                
                // If list type changed or we weren't in a list, close previous list
                if (inList && listType !== currentListType) {
                    processedLines.push(`<${listType}>${listItems.join('')}</${listType}>`);
                    listItems = [];
                }
                
                // Process inline formatting in list items
                let itemHtml = this.formatInlineMarkdown(itemText);
                listItems.push(`<li>${itemHtml}</li>`);
                inList = true;
                listType = currentListType;
            } else {
                // Not a list item
                if (inList) {
                    // Close the list
                    processedLines.push(`<${listType}>${listItems.join('')}</${listType}>`);
                    listItems = [];
                    inList = false;
                    listType = null;
                }
                
                // Process headers
                if (trimmed.match(/^###\s+(.+)$/)) {
                    processedLines.push(`<h3>${trimmed.replace(/^###\s+/, '')}</h3>`);
                } else if (trimmed.match(/^##\s+(.+)$/)) {
                    processedLines.push(`<h2>${trimmed.replace(/^##\s+/, '')}</h2>`);
                } else if (trimmed.match(/^#\s+(.+)$/)) {
                    processedLines.push(`<h1>${trimmed.replace(/^#\s+/, '')}</h1>`);
                } else if (trimmed) {
                    // Regular line - process inline formatting
                    const formatted = this.formatInlineMarkdown(trimmed);
                    processedLines.push(formatted);
                } else {
                    // Empty line
                    processedLines.push('');
                }
            }
        }
        
        // Close any remaining list
        if (inList) {
            processedLines.push(`<${listType}>${listItems.join('')}</${listType}>`);
        }
        
        // Join lines and wrap consecutive non-empty lines in paragraphs
        html = processedLines.join('\n');
        
        // Wrap paragraphs (but not lists, headers, code blocks, or empty lines)
        html = html.split('\n\n').map(block => {
            const trimmed = block.trim();
            if (!trimmed) return '';
            
            // Don't wrap if it's already a block element
            if (trimmed.match(/^<(ul|ol|h[1-3]|pre|p)/)) {
                return trimmed;
            }
            
            // Wrap in paragraph
            return `<p>${trimmed}</p>`;
        }).join('\n\n');
        
        return html;
    }
    
    formatInlineMarkdown(text) {
        // Bold (must come before italic to avoid conflicts)
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic (single asterisk, not already part of bold)
        text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
        
        // Links
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        return text;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing ChatApp...');
        window.app = new ChatApp();
        console.log('ChatApp initialized successfully');
    } catch (error) {
        console.error('Error initializing ChatApp:', error);
        // Show error modal instead of replacing body
        showErrorModal(
            'Application Initialization Failed',
            'An error occurred while initializing the application.',
            `${error.message}\n\n${error.stack || 'No stack trace available'}`
        );
    }
});

// Show loading indicator if page takes too long
setTimeout(() => {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator && !window.app) {
        loadingIndicator.style.display = 'block';
    }
}, 2000);
