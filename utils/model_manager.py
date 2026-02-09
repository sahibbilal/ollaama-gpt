"""Model selection and management."""
from typing import List, Dict
from utils.ollama_client import OllamaClient

class ModelManager:
    """Manage Ollama models."""
    
    # Popular models list (for quick access)
    POPULAR_MODELS = [
        'llama3.2:1b',
        'llama3.2:3b',
        'llama3.1:8b',
        'llama3:8b',
        'mistral:7b',
        'codellama:7b',
        'phi3:mini',
        'gemma:2b',
        'qwen2:0.5b',
        'tinyllama:1.1b'
    ]
    
    # Image generation models (verified and installable)
    IMAGE_MODELS = [
        'llava',
        'bakllava',
        'moondream'
    ]
    
    def __init__(self):
        """Initialize model manager."""
        self.client = OllamaClient()
        self._cached_models = None
    
    def get_available_models(self, refresh: bool = False) -> List[Dict]:
        """Get list of available models.
        
        Args:
            refresh: Force refresh from Ollama API
            
        Returns:
            List of model dictionaries
        """
        if self._cached_models and not refresh:
            return self._cached_models
        
        try:
            models = self.client.list_models()
            self._cached_models = models
            return models
        except Exception as e:
            print(f"Error fetching models: {e}")
            return []
    
    def get_popular_models(self) -> List[str]:
        """Get list of popular models.
        
        Returns:
            List of popular model names
        """
        return self.POPULAR_MODELS
    
    def get_all_available_models_from_ollama(self) -> List[str]:
        """Get all available models from Ollama library (not just installed).
        
        This would require querying Ollama's model library API if available.
        For now, returns a comprehensive list of known models.
        
        Returns:
            List of all known model names
        """
        # Comprehensive list of Ollama models including image generation
        all_models = set()
        
        # Text models (expanded list of popular Ollama models)
        text_models = [
            # Llama models
            'llama3.2:1b', 'llama3.2:3b', 'llama3.1:8b', 'llama3.1:70b', 
            'llama3:8b', 'llama3:70b', 'llama2', 'llama2:7b', 'llama2:13b', 'llama2:70b',
            # Mistral models
            'mistral:7b', 'mistral:8x7b', 'mistral-nemo:12b', 'mixtral:8x7b', 'mixtral:8x22b',
            # CodeLlama models
            'codellama:7b', 'codellama:13b', 'codellama:34b',
            # Phi models
            'phi3:mini', 'phi3:medium', 'phi3:14b',
            # Gemma models
            'gemma:2b', 'gemma:7b',
            # Qwen models
            'qwen2:0.5b', 'qwen2:1.5b', 'qwen2:7b', 'qwen2:72b', 'qwen:7b', 'qwen:14b',
            # Tiny models
            'tinyllama:1.1b',
            # Chat models
            'neural-chat:7b', 'starling-lm:7b',
            # Orca models
            'orca-mini:3b', 'orca-mini:7b',
            # Vicuna models
            'vicuna:7b', 'vicuna:13b',
            # Wizard models
            'wizardcoder:7b', 'wizardcoder:13b', 'wizard-vicuna:7b', 'wizard-vicuna:13b',
            # DeepSeek models
            'deepseek-coder:1.3b', 'deepseek-coder:6.7b', 'deepseek-coder:33b', 'deepseek:7b',
            # Nous models
            'nous-hermes:7b', 'nous-hermes:13b',
            # Falcon models
            'falcon:7b', 'falcon:40b',
            # Other models
            'dolphin-mixtral:8x7b', 'dolphin-llama3:8b',
            'solar:10.7b',
            'yi:6b', 'yi:34b',
            # Additional popular models
            'openchat:7b', 'openchat:3.5',
            'zephyr:7b', 'zephyr:14b',
            'nous-capybara:7b', 'nous-capybara:34b',
            'airoboros:7b', 'airoboros:13b',
            'alpaca:7b', 'alpaca:13b',
            'guanaco:7b', 'guanaco:13b', 'guanaco:33b',
            'mpt:7b', 'mpt:30b',
            'starcoder:7b', 'starcoder:15b',
            'replit-code:3b', 'replit-code:1.5b'
        ]
        
        # Image generation models (verified installable models)
        # Note: Flux models may require manual installation - use custom input field
        # Some Flux models may not be available in all regions/versions
        image_models = [
            # X/Z Image models (verified working)
            'x/z-image-turbo',
            'x/z-image'
        ]
        
        # Multimodal models
        multimodal_models = [
            'llava', 'bakllava', 'moondream', 'llava-phi3', 'llava-llama3'
        ]
        
        all_models.update(text_models)
        all_models.update(image_models)
        
        return sorted(list(all_models))
    
    def get_model_size(self, model_name: str) -> str:
        """Get approximate download size for a model.
        
        Args:
            model_name: Model name
            
        Returns:
            Size string like "1.2 GB" or "Unknown"
        """
        name_lower = model_name.lower()
        
        # Model size mapping (approximate sizes in GB)
        size_map = {
            # Tiny models (< 1GB)
            'tinyllama:1.1b': '0.6 GB',
            'qwen2:0.5b': '0.4 GB',
            'llama3.2:1b': '0.7 GB',
            'phi3:mini': '0.7 GB',
            'gemma:2b': '1.4 GB',
            'deepseek-coder:1.3b': '0.8 GB',
            
            # Small models (1-5GB)
            'llama3.2:3b': '2.0 GB',
            'qwen2:1.5b': '1.0 GB',
            'orca-mini:3b': '2.0 GB',
            'phi3:medium': '2.3 GB',
            'mistral:7b': '4.1 GB',
            'codellama:7b': '3.8 GB',
            'llama3:8b': '4.7 GB',
            'llama3.1:8b': '4.7 GB',
            'gemma:7b': '4.8 GB',
            'qwen2:7b': '4.4 GB',
            'neural-chat:7b': '4.1 GB',
            'starling-lm:7b': '4.1 GB',
            'vicuna:7b': '4.1 GB',
            'wizardcoder:7b': '3.8 GB',
            'deepseek-coder:6.7b': '3.9 GB',
            'nous-hermes:7b': '4.1 GB',
            'falcon:7b': '4.0 GB',
            'yi:6b': '3.6 GB',
            'solar:10.7b': '6.2 GB',
            'mistral-nemo:12b': '7.0 GB',
            'phi3:14b': '8.2 GB',
            'codellama:13b': '7.3 GB',
            'vicuna:13b': '7.3 GB',
            'wizardcoder:13b': '7.3 GB',
            'deepseek-coder:33b': '18.6 GB',
            'nous-hermes:13b': '7.3 GB',
            'codellama:34b': '19.0 GB',
            'yi:34b': '19.5 GB',
            'llama3:70b': '40.0 GB',
            'llama3.1:70b': '40.0 GB',
            'qwen2:72b': '42.0 GB',
            'falcon:40b': '22.0 GB',
            'mistral:8x7b': '26.0 GB',
            'dolphin-mixtral:8x7b': '26.0 GB',
            
            # X/Z Image models (verified working)
            'x/z-image-turbo': '6.0 GB',
            'x/z-image': '6.0 GB',
            # Multimodal models (can generate images)
            'llava': '4.5 GB',
            'llava:7b': '4.5 GB',
            'llava:13b': '7.3 GB',
            'llava:34b': '19.0 GB',
            'bakllava': '4.5 GB',
            'moondream': '1.6 GB',
            'llava-phi3': '2.3 GB',
            'llava-llama3': '4.7 GB',
        }
        
        # Check exact match first
        if model_name in size_map:
            return size_map[model_name]
        
        # Try to extract size from model name (e.g., "7b" = ~4GB, "13b" = ~7GB, "70b" = ~40GB)
        import re
        size_match = re.search(r'(\d+(?:\.\d+)?)(b|m)', name_lower)
        if size_match:
            size_num = float(size_match.group(1))
            unit = size_match.group(2)
            
            if unit == 'm':  # Millions
                if size_num < 2:
                    return f'{size_num * 0.4:.1f} GB'
                elif size_num < 10:
                    return f'{size_num * 0.6:.1f} GB'
                else:
                    return f'{size_num * 0.7:.1f} GB'
            elif unit == 'b':  # Billions
                if size_num <= 1:
                    return f'{size_num * 0.6:.1f} GB'
                elif size_num <= 3:
                    return f'{size_num * 0.7:.1f} GB'
                elif size_num <= 8:
                    return f'{size_num * 0.6:.1f} GB'
                elif size_num <= 14:
                    return f'{size_num * 0.55:.1f} GB'
                elif size_num <= 35:
                    return f'{size_num * 0.57:.1f} GB'
                elif size_num <= 45:
                    return f'{size_num * 0.58:.1f} GB'
                else:
                    return f'{size_num * 0.6:.1f} GB'
        
        return 'Unknown'
    
    def categorize_model(self, model_name: str) -> str:
        """Categorize a model by type.
        
        Args:
            model_name: Model name
            
        Returns:
            Category string: 'text', 'image', 'multimodal', or 'unknown'
        """
        name_lower = model_name.lower()
        
        # Image generation models
        if any(img in name_lower for img in ['x/z-image', 'image-turbo']):
            return 'image'
        # Flux models - check for namespace format (may need manual installation)
        if 'flux' in name_lower and ('black-forest-labs' in name_lower or '/' in name_lower):
            return 'image'
        
        # Multimodal models (can do both text and images)
        if any(multi in name_lower for multi in ['llava', 'bakllava', 'moondream', 'cogvlm', 'minicpm-v']):
            return 'multimodal'
        
        # Default to text
        return 'text'
    
    def is_model_installed(self, model_name: str) -> bool:
        """Check if a model is installed.
        
        Args:
            model_name: Model name to check
            
        Returns:
            bool: True if model is installed
        """
        models = self.get_available_models()
        model_names = [m.get('name', '') for m in models]
        return model_name in model_names
    
    def get_model_info(self, model_name: str) -> Dict:
        """Get information about a model.
        
        Args:
            model_name: Model name
            
        Returns:
            Model info dict
        """
        models = self.get_available_models()
        for model in models:
            if model.get('name') == model_name:
                return model
        return {}
