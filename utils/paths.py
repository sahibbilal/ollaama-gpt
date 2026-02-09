"""Path handling for development vs .exe environments."""
import os
import sys
from pathlib import Path

def get_base_path():
    """Get the base path for data storage.
    
    Returns:
        Path: Base directory for storing data files
    """
    # Check if running as .exe (PyInstaller)
    if getattr(sys, 'frozen', False):
        # Running as compiled .exe
        base_path = Path(os.getenv('LOCALAPPDATA', '')) / 'ChatGPT-Ollama'
    else:
        # Running as script
        base_path = Path(__file__).parent.parent / 'data'
    
    # Create directory if it doesn't exist
    base_path.mkdir(parents=True, exist_ok=True)
    return base_path

def get_conversations_path():
    """Get path for conversations directory."""
    path = get_base_path() / 'conversations'
    path.mkdir(parents=True, exist_ok=True)
    return path

def get_summaries_path():
    """Get path for summaries directory."""
    path = get_base_path() / 'summaries'
    path.mkdir(parents=True, exist_ok=True)
    return path
