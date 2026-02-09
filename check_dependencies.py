"""Check for required dependencies (Python and Ollama)."""
import sys
import subprocess
import shutil

def check_python():
    """Check if Python is installed and version is 3.8+.
    
    Returns:
        tuple: (bool, str) - (is_installed, version_string)
    """
    try:
        version = sys.version_info
        if version.major == 3 and version.minor >= 8:
            version_str = f"{version.major}.{version.minor}.{version.micro}"
            return True, version_str
        else:
            version_str = f"{version.major}.{version.minor}.{version.micro}"
            return False, version_str
    except Exception as e:
        return False, f"Error: {e}"

def check_ollama():
    """Check if Ollama is installed.
    
    Returns:
        tuple: (bool, str) - (is_installed, version_string)
    """
    ollama_path = shutil.which('ollama')
    if ollama_path:
        try:
            result = subprocess.run(
                ['ollama', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                return True, result.stdout.strip()
        except Exception as e:
            return False, f"Error: {e}"
    
    return False, "Not found in PATH"

def check_all():
    """Check all dependencies.
    
    Returns:
        dict: Status of all dependencies
    """
    python_ok, python_version = check_python()
    ollama_ok, ollama_version = check_ollama()
    
    return {
        'python': {
            'installed': python_ok,
            'version': python_version,
            'required': '3.8+'
        },
        'ollama': {
            'installed': ollama_ok,
            'version': ollama_version
        },
        'all_ok': python_ok and ollama_ok
    }

if __name__ == '__main__':
    status = check_all()
    print("Dependency Check Results:")
    print(f"Python: {'✓' if status['python']['installed'] else '✗'} {status['python']['version']}")
    print(f"Ollama: {'✓' if status['ollama']['installed'] else '✗'} {status['ollama']['version']}")
    sys.exit(0 if status['all_ok'] else 1)
