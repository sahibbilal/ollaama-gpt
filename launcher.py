"""Launcher script that starts Flask backend and Electron frontend."""
import sys
import os
import subprocess
import time
import webbrowser
import threading
import requests
from pathlib import Path
from check_dependencies import check_all
from install_dependencies import install_missing_dependencies

def start_flask_backend():
    """Start Flask backend server."""
    flask_script = Path(__file__).parent / 'main.py'
    python_exe = sys.executable
    
    if not flask_script.exists():
        print(f"Error: Flask script not found at {flask_script}")
        return None
    
    try:
        process = subprocess.Popen(
            [python_exe, str(flask_script)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        )
        
        # Check if process started successfully
        time.sleep(2)  # Give it more time to start
        if process.poll() is not None:
            # Process exited immediately, get error
            try:
                stdout, stderr = process.communicate(timeout=1)
            except:
                stdout, stderr = "", ""
            print(f"[ERROR] Flask backend exited immediately:")
            if stderr:
                print(f"STDERR: {stderr}")
            if stdout:
                print(f"STDOUT: {stdout}")
            return None
        
        print(f"[OK] Flask process started (PID: {process.pid})")
        return process
    except Exception as e:
        print(f"Error starting Flask backend: {e}")
        return None

def start_electron():
    """Start Electron frontend."""
    electron_dir = Path(__file__).parent / 'electron'
    package_json = electron_dir / 'package.json'
    
    if not package_json.exists():
        print("Error: Electron directory not found")
        return None
    
    try:
        # Check if node_modules exists, if not, install dependencies
        node_modules = electron_dir / 'node_modules'
        if not node_modules.exists():
            print("Installing Electron dependencies...")
            subprocess.run('npm install', cwd=electron_dir, check=True, shell=True)
        
        # On Windows, use shell=True and 'npm' as a string command
        print("Starting Electron...")
        
        # Start Electron using shell command (works better on Windows)
        if sys.platform == 'win32':
            process = subprocess.Popen(
                'npm start',
                cwd=electron_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=True
            )
        else:
            process = subprocess.Popen(
                ['npm', 'start'],
                cwd=electron_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
        
        print(f"[OK] Electron process started (PID: {process.pid})")
        return process
    except FileNotFoundError:
        print("Error: npm not found. Please install Node.js from https://nodejs.org/")
        return None
    except Exception as e:
        print(f"Error starting Electron: {e}")
        import traceback
        traceback.print_exc()
        return None

def wait_for_backend(max_wait=60):
    """Wait for Flask backend to be ready."""
    from config import FLASK_PORT
    print(f"Checking backend at http://localhost:{FLASK_PORT}/api/health...")
    for i in range(max_wait):
        try:
            response = requests.get(f'http://localhost:{FLASK_PORT}/api/health', timeout=3)
            if response.status_code == 200:
                print(f"[OK] Backend responded after {i+1} seconds")
                return True
        except requests.exceptions.ConnectionError:
            if i % 5 == 0:  # Print every 5 seconds
                print(f"Waiting for backend to start... ({i+1}/{max_wait})")
        except requests.exceptions.Timeout:
            if i % 5 == 0:
                print(f"Backend is starting but not ready yet... ({i+1}/{max_wait})")
        except Exception as e:
            if i % 5 == 0:
                print(f"Checking backend... ({i+1}/{max_wait})")
        time.sleep(1)
    print(f"[ERROR] Backend did not respond after {max_wait} seconds")
    return False

def check_port_in_use(port):
    """Check if a port is already in use."""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', port))
    sock.close()
    return result == 0

def kill_processes_on_port(port):
    """Kill processes using the specified port."""
    import platform
    if platform.system() != 'Windows':
        return
    
    try:
        import subprocess
        # Find processes using the port
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True,
            text=True
        )
        pids = set()
        for line in result.stdout.split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.split()
                if len(parts) > 4:
                    pids.add(parts[-1])
        
        # Kill the processes
        for pid in pids:
            try:
                subprocess.run(['taskkill', '/F', '/PID', pid], 
                             capture_output=True, check=False)
            except:
                pass
        if pids:
            time.sleep(2)  # Wait for processes to die
    except:
        pass

def main():
    """Main launcher function."""
    print("ChatGPT-Ollama Desktop Launcher")
    print("=" * 50)
    
    # Check if port is in use and kill existing processes
    from config import FLASK_PORT
    if check_port_in_use(FLASK_PORT):
        print(f"\nPort {FLASK_PORT} is already in use. Cleaning up...")
        kill_processes_on_port(FLASK_PORT)
        time.sleep(1)
    
    # Check dependencies
    print("\nChecking dependencies...")
    status = check_all()
    
    if not status['all_ok']:
        print("\nSome dependencies are missing:")
        if not status['python']['installed']:
            print(f"  - Python: {status['python']['version']} (required: {status['python']['required']})")
        if not status['ollama']['installed']:
            print(f"  - Ollama: {status['ollama']['version']}")
        
        print("\nAttempting to install missing dependencies...")
        if not install_missing_dependencies():
            print("\nFailed to install dependencies automatically.")
            print("Please install them manually:")
            if not status['python']['installed']:
                print("  - Python: https://www.python.org/downloads/")
            if not status['ollama']['installed']:
                print("  - Ollama: https://ollama.com/download")
            input("\nPress Enter to exit...")
            return 1
    
    print("[OK] All dependencies are installed")
    
    # Start Flask backend
    print("\nStarting Flask backend...")
    flask_process = start_flask_backend()
    if not flask_process:
        print("[ERROR] Failed to start Flask backend")
        print("Trying to start Flask directly to see error...")
        # Try to run Flask directly to see the error
        flask_script = Path(__file__).parent / 'main.py'
        python_exe = sys.executable
        try:
            result = subprocess.run([python_exe, str(flask_script)], capture_output=True, text=True, timeout=5)
            if result.returncode != 0:
                print(f"Flask error output:\n{result.stderr}")
                print(f"Flask output:\n{result.stdout}")
        except Exception as e:
            print(f"Error running Flask directly: {e}")
        return 1
    
    # Wait for backend to be ready
    print("Waiting for backend to be ready...")
    if not wait_for_backend():
        print("Backend failed to start")
        # Get error output from Flask process
        if flask_process:
            try:
                stdout, stderr = flask_process.communicate(timeout=2)
                if stderr:
                    print(f"\nFlask error output:\n{stderr}")
                if stdout:
                    print(f"\nFlask output:\n{stdout}")
            except:
                flask_process.terminate()
                flask_process.wait()
        return 1
    
    print("[OK] Backend is ready")
    
    # Start Electron
    print("\nStarting Electron frontend...")
    electron_process = start_electron()
    if not electron_process:
        print("Failed to start Electron")
        flask_process.terminate()
        return 1
    
    print("[OK] Application started")
    print("\n" + "=" * 50)
    print("Application is running. Close this window to exit.")
    print("=" * 50)
    
    try:
        # Wait for processes
        electron_process.wait()
    except KeyboardInterrupt:
        print("\n\nShutting down...")
    finally:
        # Cleanup
        if flask_process:
            flask_process.terminate()
            flask_process.wait()
        if electron_process:
            electron_process.terminate()
            electron_process.wait()
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
