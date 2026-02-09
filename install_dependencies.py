"""Auto-installer for Ollama and Python dependencies."""
import os
import sys
import subprocess
import urllib.request
import tempfile
import platform
from pathlib import Path
from check_dependencies import check_all

# Download URLs
PYTHON_DOWNLOAD_URL = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
OLLAMA_DOWNLOAD_URL = "https://ollama.com/download/windows"

def download_file(url: str, destination: Path) -> bool:
    """Download a file from URL.
    
    Args:
        url: URL to download from
        destination: Path to save file
        
    Returns:
        bool: True if successful
    """
    try:
        print(f"Downloading from {url}...")
        urllib.request.urlretrieve(url, destination)
        print(f"Downloaded to {destination}")
        return True
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return False

def install_python(installer_path: Path) -> bool:
    """Install Python using the installer.
    
    Args:
        installer_path: Path to Python installer
        
    Returns:
        bool: True if successful
    """
    try:
        print("Installing Python...")
        # Silent install with add to PATH
        cmd = [
            str(installer_path),
            '/quiet',
            'InstallAllUsers=1',
            'PrependPath=1',
            'Include_test=0'
        ]
        result = subprocess.run(cmd, timeout=300)
        return result.returncode == 0
    except Exception as e:
        print(f"Error installing Python: {e}")
        return False

def install_ollama(installer_path: Path) -> bool:
    """Install Ollama using the installer.
    
    Args:
        installer_path: Path to Ollama installer
        
    Returns:
        bool: True if successful
    """
    try:
        print("Installing Ollama...")
        # Silent install
        cmd = [str(installer_path), '/S']
        result = subprocess.run(cmd, timeout=300)
        return result.returncode == 0
    except Exception as e:
        print(f"Error installing Ollama: {e}")
        return False

def install_missing_dependencies():
    """Check and install missing dependencies.
    
    Returns:
        bool: True if all dependencies are now installed
    """
    if platform.system() != 'Windows':
        print("Auto-installation is only supported on Windows")
        return False
    
    status = check_all()
    
    temp_dir = Path(tempfile.gettempdir()) / 'chatgpt-ollama-install'
    temp_dir.mkdir(exist_ok=True)
    
    # Install Python if missing
    if not status['python']['installed']:
        print("Python is not installed. Installing...")
        installer_path = temp_dir / 'python-installer.exe'
        
        if not download_file(PYTHON_DOWNLOAD_URL, installer_path):
            print("Failed to download Python installer")
            return False
        
        if not install_python(installer_path):
            print("Failed to install Python")
            return False
        
        # Wait a bit and verify
        import time
        time.sleep(5)
        status = check_all()
        if not status['python']['installed']:
            print("Python installation verification failed")
            return False
    
    # Install Ollama if missing
    if not status['ollama']['installed']:
        print("Ollama is not installed. Installing...")
        # Note: Ollama download URL may need to be updated
        # For now, prompt user to download manually
        print("Please download Ollama from https://ollama.com/download/windows")
        print("Or run the installer manually.")
        return False
    
    # Cleanup
    try:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
    except:
        pass
    
    return True

if __name__ == '__main__':
    success = install_missing_dependencies()
    if success:
        print("All dependencies installed successfully!")
        sys.exit(0)
    else:
        print("Some dependencies failed to install")
        sys.exit(1)
