# ChatGPT-Ollama Desktop

A ChatGPT-like desktop application for Windows that uses Ollama for local AI conversations. Features automatic dependency installation, conversation history, model selection, and a native desktop experience.

## Features

- 🤖 **Multiple Ollama Models**: Select from available Ollama models
- 💬 **ChatGPT-like Interface**: Modern, clean chat interface with dark/light themes
- 📚 **Conversation History**: Automatic saving and management of all conversations
- 🧠 **Intelligent Context**: Uses recent messages + summarized older conversations
- 🔄 **Streaming Responses**: Real-time streaming responses
- 💾 **Local Storage**: All data stored locally in AppData
- 🚀 **Auto-Install Dependencies**: Automatically installs Python and Ollama if missing
- 🎨 **Rich Formatting**: Real-time markdown rendering with proper list and paragraph distinction
- 📝 **Dynamic Titles**: Conversation titles automatically update from first user message
- 📥 **Model Installation**: Install popular Ollama models directly from the application
- ✏️ **Message Editing**: Edit and resend previous messages
- 🔄 **Auto-scroll**: Smart auto-scrolling during message generation with scroll-to-bottom button
- ⏱️ **Extended Timeouts**: Configured for long-running model responses (300s timeout)

## Requirements

### For Development
- **Python 3.8+**: Required for running the application
- **Node.js 18+**: Required for Electron
- **Ollama**: Must be installed and running
- **NSIS** (optional): For creating installer

### For End Users
- **Windows 10/11**: Required
- **Python 3.8+**: Auto-installed if missing
- **Ollama**: Auto-installed if missing

## Installation

### Development Setup

1. **Clone the repository**

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Electron dependencies:**
   ```bash
   cd electron
   npm install
   ```

4. **Run the application:**
   
   **Easy way (recommended):**
   - **Windows**: Double-click `START.bat`
   - **Linux/Mac**: Run `./start.sh` (make executable first: `chmod +x start.sh`)
   
   **Manual way:**
   ```bash
   python launcher.py
   ```
   
   The startup scripts will:
   - Check dependencies (Python, Ollama)
   - Start Flask backend
   - Wait for backend to be ready
   - Start Electron frontend
   - Keep everything running until you close the window
   
   **Note**: Closing the terminal window will stop the app. Keep the terminal open while using the application.

### Building Windows Installer

**Important**: Building requires either:
- **Developer Mode enabled** in Windows Settings (recommended), OR
- Running PowerShell/CMD **as Administrator**

1. **Install NSIS** (optional, for installer):
   - Download from: https://nsis.sourceforge.io/

2. **Build the application:**
   ```bash
   py build/build.py
   ```
   
   **Note**: If you get symlink permission errors, enable Developer Mode in Windows Settings or run PowerShell/CMD as Administrator.
   
3. **Output:**
   - Electron app: `electron/dist/`
   - Installer: `dist/ChatGPT-Ollama-Setup-1.0.0.exe`

## Usage

1. **Launch the application** from desktop shortcut or Start Menu
2. **Select a model** from the dropdown in the header
3. **Start chatting!** Type a message and press Enter
4. **View history**: Click on conversations in the sidebar
5. **New chat**: Click "+ New Chat" to start a new conversation
6. **Delete chat**: Hover over conversation and click delete icon

## Project Structure

```
chatgpt-ollama-desktop/
├── main.py                    # Flask backend server
├── launcher.py                # Entry point (starts Flask + Electron)
├── START.bat                  # Windows batch startup script (double-click to run)
├── start.sh                   # Linux/Mac startup script
├── check_dependencies.py     # Dependency checker
├── install_dependencies.py   # Auto-installer
├── config.py                  # Configuration
├── requirements.txt           # Python dependencies
│
├── electron/                  # Electron frontend
│   ├── main.js               # Electron main process
│   ├── preload.js            # Preload script
│   ├── package.json          # Node.js dependencies
│   └── renderer/             # Frontend UI
│       ├── index.html
│       ├── css/style.css
│       └── js/app.js
│
├── utils/                     # Backend utilities
│   ├── ollama_client.py
│   ├── history_manager.py
│   ├── context_builder.py
│   └── paths.py
│
├── installer/                 # Windows installer
│   ├── installer.nsi
│   ├── install_deps.nsh
│   └── license.txt
│
└── build/                     # Build scripts
    └── build.py
```

## Configuration

Create a `.env` file in the project root:

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
OLLAMA_TIMEOUT=300
OLLAMA_STREAM_READ_TIMEOUT=120

# Flask Configuration
FLASK_HOST=127.0.0.1
FLASK_PORT=5000
FLASK_DEBUG=False

# History Configuration
MAX_RECENT_MESSAGES=30
SUMMARY_THRESHOLD=40
CONTEXT_WINDOW_SIZE=4096
```

## Data Storage

- **Location**: `%LOCALAPPDATA%\ChatGPT-Ollama\`
- **Conversations**: `conversations/*.json`
- **Summaries**: `summaries/*.json`

## License

This project is provided as-is for educational and personal use.
