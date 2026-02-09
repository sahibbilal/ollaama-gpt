"""Ollama API client for chat and model management."""
import requests
import json
from typing import Dict, List, Optional, Generator
from config import OLLAMA_BASE_URL, OLLAMA_TIMEOUT, OLLAMA_STREAM_READ_TIMEOUT

class OllamaClient:
    """Client for interacting with Ollama API."""
    
    def __init__(self, base_url: str = None):
        """Initialize Ollama client.
        
        Args:
            base_url: Ollama base URL (defaults to config value)
        """
        self.base_url = base_url or OLLAMA_BASE_URL
        self.timeout = OLLAMA_TIMEOUT
        self.stream_read_timeout = OLLAMA_STREAM_READ_TIMEOUT
    
    def chat(self, model: str, messages: List[Dict], stream: bool = True) -> Generator[str, None, None]:
        """Send chat message to Ollama and stream response.
        
        Args:
            model: Model name to use
            messages: List of message dicts with 'role' and 'content'
            stream: Whether to stream the response
            
        Yields:
            str: Response chunks
        """
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": stream
        }
        
        try:
            # For streaming, use longer timeout and handle read timeout per chunk
            # Connection timeout: 30s, Read timeout: stream_read_timeout (for each chunk)
            if stream:
                timeout = (30, self.stream_read_timeout)
            else:
                timeout = self.timeout
            
            response = requests.post(
                url,
                json=payload,
                stream=stream,
                timeout=timeout
            )
            response.raise_for_status()
            
            if stream:
                for line in response.iter_lines(decode_unicode=True, chunk_size=8192):
                    if line:
                        try:
                            data = json.loads(line)
                            if 'message' in data and 'content' in data['message']:
                                yield data['message']['content']
                            if data.get('done', False):
                                break
                            # Check for errors in stream
                            if 'error' in data:
                                raise Exception(f"Ollama error: {data['error']}")
                        except json.JSONDecodeError:
                            continue
            else:
                data = response.json()
                if 'message' in data and 'content' in data['message']:
                    yield data['message']['content']
        except requests.exceptions.Timeout as e:
            if stream:
                raise Exception(f"Ollama request timed out. The model may be taking too long to respond. Try:\n- Using a smaller/faster model\n- Reducing the context length\n- Checking if Ollama is running properly\n\nOriginal error: {str(e)}")
            else:
                raise Exception(f"Ollama request timed out after {self.timeout} seconds. The model may be too slow for your system. Try using a smaller model.")
        except requests.exceptions.ConnectionError as e:
            raise Exception(f"Failed to connect to Ollama at {self.base_url}. Please ensure Ollama is running.\n\nTo start Ollama, run: ollama serve")
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            # Try to extract more detailed error if available
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
            raise Exception(f"Ollama API error: {error_msg}")
    
    def list_models(self) -> List[Dict]:
        """Get list of available Ollama models.
        
        Returns:
            List of model dictionaries
        """
        url = f"{self.base_url}/api/tags"
        try:
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            return data.get('models', [])
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to fetch models: {str(e)}")
    
    def pull_model(self, model: str) -> Generator[Dict, None, None]:
        """Pull/download an Ollama model.
        
        Args:
            model: Model name to pull
            
        Yields:
            Dict: Progress updates
        """
        url = f"{self.base_url}/api/pull"
        payload = {"name": model}
        
        try:
            response = requests.post(
                url,
                json=payload,
                stream=True,
                timeout=None  # No timeout for model downloads
            )
            
            # Check for HTTP errors
            if response.status_code != 200:
                error_text = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', error_text)
                except:
                    error_msg = error_text or f"HTTP {response.status_code}"
                raise Exception(f"Ollama API error: {error_msg}")
            
            response.raise_for_status()
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        # Check if Ollama returned an error in the stream
                        if 'error' in data:
                            raise Exception(data.get('error', 'Unknown error from Ollama'))
                        yield data
                    except json.JSONDecodeError:
                        continue
        except requests.exceptions.ConnectionError as e:
            raise Exception(f"Failed to connect to Ollama service at {self.base_url}. Please ensure Ollama is running.")
        except requests.exceptions.Timeout as e:
            raise Exception(f"Request to Ollama timed out. Please check your connection and try again.")
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
            raise Exception(f"Failed to pull model: {error_msg}")
    
    def delete_model(self, model: str) -> bool:
        """Delete an Ollama model.
        
        Args:
            model: Model name to delete
            
        Returns:
            bool: True if deleted successfully
        """
        url = f"{self.base_url}/api/delete"
        payload = {"name": model}
        
        try:
            response = requests.delete(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get('error', error_msg)
                except:
                    pass
            raise Exception(f"Failed to delete model: {error_msg}")
    
    def check_health(self) -> bool:
        """Check if Ollama server is accessible.
        
        Returns:
            bool: True if Ollama is accessible
        """
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False
