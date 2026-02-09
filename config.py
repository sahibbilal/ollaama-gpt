"""Configuration management for ChatGPT-Ollama Desktop application."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Ollama Configuration
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3.2:1b')
# Increased timeout for large models and complex requests
# For streaming, this is the connection timeout; read timeout is handled per chunk
OLLAMA_TIMEOUT = int(os.getenv('OLLAMA_TIMEOUT', '300'))  # 5 minutes default
OLLAMA_STREAM_READ_TIMEOUT = int(os.getenv('OLLAMA_STREAM_READ_TIMEOUT', '120'))  # 2 minutes per chunk

# Flask Configuration
FLASK_HOST = os.getenv('FLASK_HOST', '127.0.0.1')

# Get unique 15-digit port number from shared config file
import json
from pathlib import Path

def get_unique_port():
    """Generate or retrieve a unique 15-digit port number."""
    # Try multiple locations for port config
    config_locations = [
        Path(__file__).parent / 'port_config.json',
        Path(__file__).parent.parent / 'port_config.json',
        Path.home() / '.chatgpt-ollama-port.json'
    ]
    
    for config_file in config_locations:
        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    config = json.load(f)
                    if 'port' in config:
                        port = int(config['port'])
                        # Ensure port is valid (max 65535 for TCP)
                        if 10000 <= port <= 65535:
                            return port
            except:
                continue
    
    # Generate new unique port: Use 15-digit format but ensure valid TCP port
    # Format: 1XXXXX where XXXXX ensures port is between 10000-65535
    import random
    # Generate port in valid range but format as 15 digits
    # We'll use: 100000000000000 + (port - 10000) to create 15-digit number
    base_port = 10000 + random.randint(0, 55535)  # Valid TCP port range
    
    # Store as 15-digit number: 100000000000000 + (port - 10000)
    port_15digit = 100000000000000 + (base_port - 10000)
    
    # Store actual port (not 15-digit) in config for TCP use
    for config_file in config_locations:
        try:
            config_file.parent.mkdir(parents=True, exist_ok=True)
            with open(config_file, 'w') as f:
                json.dump({'port': base_port, 'port_15digit': port_15digit}, f)
            return base_port
        except:
            continue
    
    # Fallback to default
    return 5001

FLASK_PORT = int(os.getenv('FLASK_PORT', str(get_unique_port())))
FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'

# History Configuration
# Increased to remember more context in conversations
MAX_RECENT_MESSAGES = int(os.getenv('MAX_RECENT_MESSAGES', '30'))  # Increased from 20 to 30
SUMMARY_THRESHOLD = int(os.getenv('SUMMARY_THRESHOLD', '40'))  # Lower threshold to summarize earlier
CONTEXT_WINDOW_SIZE = int(os.getenv('CONTEXT_WINDOW_SIZE', '4096'))
