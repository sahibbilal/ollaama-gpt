"""Main Flask application for ChatGPT-Ollama Desktop."""
import os
import sys
import json
import uuid
from datetime import datetime

# Add the directory containing this script to Python path
# This ensures all modules can be imported correctly
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

# Also add parent directory in case files are structured differently
parent_dir = os.path.dirname(script_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from config import FLASK_HOST, FLASK_PORT, FLASK_DEBUG, OLLAMA_MODEL, OLLAMA_BASE_URL
from utils.ollama_client import OllamaClient
from utils.history_manager import HistoryManager
from utils.context_builder import ContextBuilder
from utils.model_manager import ModelManager
from check_dependencies import check_python, check_ollama

app = Flask(__name__)
CORS(app)

# Initialize services
ollama_client = OllamaClient()
history_manager = HistoryManager()
context_builder = ContextBuilder()
model_manager = ModelManager()

@app.route('/api/health')
def health():
    """Health check endpoint."""
    ollama_connected = ollama_client.check_health()
    return jsonify({
        'status': 'ok',
        'ollama_connected': ollama_connected
    })

@app.route('/api/dependencies')
def check_dependencies():
    """Check Python and Ollama installation status."""
    try:
        python_installed, python_version = check_python()
        ollama_installed, ollama_version = check_ollama()
        ollama_running = ollama_client.check_health()
        
        return jsonify({
            'success': True,
            'python': {
                'installed': python_installed,
                'version': python_version,
                'required': '3.8+',
                'status': 'installed' if python_installed else 'not_installed'
            },
            'ollama': {
                'installed': ollama_installed,
                'version': ollama_version,
                'running': ollama_running,
                'status': 'running' if ollama_running else ('installed' if ollama_installed else 'not_installed')
            },
            'all_ok': python_installed and ollama_installed and ollama_running
        })
    except Exception as e:
        # Return error response instead of crashing
        app.logger.error(f'Error checking dependencies: {e}')
        return jsonify({
            'success': False,
            'error': str(e),
            'python': {
                'installed': False,
                'version': None,
                'status': 'unknown'
            },
            'ollama': {
                'installed': False,
                'version': None,
                'running': False,
                'status': 'unknown'
            },
            'all_ok': False
        }), 500

@app.route('/api/models')
def get_models():
    """Get available models, popular models, and all available models from Ollama library."""
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    try:
        # Get installed models
        installed_models = model_manager.get_available_models(refresh=refresh)
        installed_names = {m.get('name') for m in installed_models}
        
        # Get all available models from Ollama library
        all_models_list = model_manager.get_all_available_models_from_ollama()
        
        # Categorize and format all models
        all_models_formatted = []
        for model_name in all_models_list:
            is_installed = model_name in installed_names
            category = model_manager.categorize_model(model_name)
            size = model_manager.get_model_size(model_name)
            
            all_models_formatted.append({
                'name': model_name,
                'installed': is_installed,
                'category': category,
                'size': size,
                'verified': True  # All models in the list are verified
            })
        
        popular_models = model_manager.get_popular_models()
        
        return jsonify({
            'success': True,
            'models': installed_models,  # Currently installed models
            'all_models': all_models_formatted,  # All available models from library
            'popular_models': popular_models,
            'total_installed': len(installed_models),
            'total_available': len(all_models_formatted)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/check/<model_name>')
def check_model(model_name):
    """Check if a model is installed."""
    try:
        installed = model_manager.is_model_installed(model_name)
        model_info = model_manager.get_model_info(model_name) if installed else {}
        
        return jsonify({
            'success': True,
            'installed': installed,
            'model_info': model_info
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/delete', methods=['POST'])
def delete_model():
    """Delete an Ollama model."""
    data = request.get_json()
    model = data.get('model')
    
    if not model:
        return jsonify({'success': False, 'error': 'Model name required'}), 400
    
    # Check if Ollama is running
    if not ollama_client.check_health():
        return jsonify({
            'success': False,
            'error': 'Ollama service is not running. Please start Ollama and try again.'
        }), 503
    
    try:
        # Clear model cache to force refresh after deletion
        model_manager._cached_models = None
        
        ollama_client.delete_model(model)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/install', methods=['POST'])
def install_model():
    """Install an Ollama model (streaming)."""
    data = request.get_json()
    model = data.get('model')
    
    if not model:
        return jsonify({'success': False, 'error': 'Model name required'}), 400
    
    def generate_error_response(error_msg):
        """Generate error response for immediate errors."""
        yield f"data: {json.dumps({'error': error_msg, 'status': 'error'})}\n\n"
    
    # Check if Ollama is running
    if not ollama_client.check_health():
        return Response(
            stream_with_context(generate_error_response('Ollama service is not running. Please start Ollama and try again.')),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            }
        )
    
    def generate():
        try:
            error_occurred = False
            for progress in ollama_client.pull_model(model):
                # Check if Ollama returned an error in the progress update
                if isinstance(progress, dict):
                    if 'error' in progress:
                        error_occurred = True
                        error_msg = progress.get('error', 'Unknown error')
                        # Provide more helpful error messages
                        if 'manifest' in error_msg.lower() or 'file does not exist' in error_msg.lower():
                            error_msg = f"Model '{model}' not found in Ollama registry. Please check:\n1. The model name is correct (e.g., 'llama3:8b', 'mistral:7b')\n2. Your internet connection is working\n3. Ollama can access the model registry"
                        yield f"data: {json.dumps({'error': error_msg, 'status': 'error'})}\n\n"
                        return
                    elif 'status' in progress and progress.get('status') == 'error':
                        error_occurred = True
                        error_msg = progress.get('error', 'Unknown error occurred during model installation')
                        yield f"data: {json.dumps({'error': error_msg, 'status': 'error'})}\n\n"
                        return
                
                yield f"data: {json.dumps(progress)}\n\n"
            
            if not error_occurred:
                # Clear model cache to force refresh after installation
                model_manager._cached_models = None
                
                # Send completion message
                yield f"data: {json.dumps({'status': 'success', 'model': model})}\n\n"
        except Exception as e:
            error_msg = str(e)
            # Provide more helpful error messages
            if 'connection' in error_msg.lower() or 'timeout' in error_msg.lower():
                error_msg = f"Failed to connect to Ollama service. Please ensure:\n1. Ollama is running\n2. Ollama is accessible at {OLLAMA_BASE_URL}\n3. Your firewall is not blocking the connection"
            elif 'manifest' in error_msg.lower() or 'file does not exist' in error_msg.lower():
                error_msg = f"Model '{model}' not found in Ollama registry. Please verify the model name is correct."
            yield f"data: {json.dumps({'error': error_msg, 'status': 'error'})}\n\n"
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )

@app.route('/api/chat', methods=['POST'])
def chat():
    """Send message and get streaming response."""
    data = request.get_json()
    message = data.get('message', '').strip()
    conversation_id = data.get('conversation_id')
    model = data.get('model', OLLAMA_MODEL)
    
    if not message:
        return jsonify({'success': False, 'error': 'Message required'}), 400
    
    # Get or create conversation
    if conversation_id:
        conversation = history_manager.get_conversation(conversation_id)
        if not conversation:
            return jsonify({'success': False, 'error': 'Conversation not found'}), 404
    else:
        # Create new conversation
        conversation_id = str(uuid.uuid4())
        conversation = {
            'id': conversation_id,
            'title': 'New Chat',
            'model': model,
            'messages': [],
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
    
    # Add user message
    user_message = {
        'role': 'user',
        'content': message,
        'timestamp': datetime.now().isoformat()
    }
    conversation['messages'].append(user_message)
    
    # Update title if first message (use first 50 chars of message)
    if len(conversation['messages']) == 1:
        conversation['title'] = message[:50] + ('...' if len(message) > 50 else '')
    
    # Build context
    context_messages = context_builder.build_context(conversation_id, conversation['messages'])
    
    # Stream response
    def generate():
        assistant_content = ''
        try:
            for chunk in ollama_client.chat(model, context_messages, stream=True):
                assistant_content += chunk
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
            
            # Save assistant message
            assistant_message = {
                'role': 'assistant',
                'content': assistant_content,
                'timestamp': datetime.now().isoformat()
            }
            conversation['messages'].append(assistant_message)
            conversation['updated_at'] = datetime.now().isoformat()
            
            # Save conversation
            history_manager.save_conversation(conversation)
            
            # Create summary if needed
            if context_builder.should_summarize(conversation['messages']):
                summary = context_builder.create_summary(conversation['messages'])
                history_manager.save_summary(conversation_id, summary)
            
            # Send final update with conversation_id
            yield f"data: {json.dumps({'content': '', 'done': True, 'conversation_id': conversation_id, 'title': conversation['title']})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )

@app.route('/api/conversations', methods=['GET'])
def list_conversations():
    """List all conversations."""
    try:
        conversations = history_manager.list_conversations()
        return jsonify({
            'success': True,
            'conversations': conversations
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/conversations/new', methods=['POST'])
def new_conversation():
    """Create a new conversation."""
    data = request.get_json()
    title = data.get('title', 'New Chat')
    model = data.get('model', OLLAMA_MODEL)
    
    conversation_id = str(uuid.uuid4())
    conversation = {
        'id': conversation_id,
        'title': title,
        'model': model,
        'messages': [],
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }
    
    history_manager.save_conversation(conversation)
    
    return jsonify({
        'success': True,
        'conversation_id': conversation_id,
        'conversation': conversation
    })

@app.route('/api/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """Get a conversation by ID."""
    conversation = history_manager.get_conversation(conversation_id)
    
    if not conversation:
        return jsonify({
            'success': False,
            'error': 'Conversation not found'
        }), 404
    
    return jsonify({
        'success': True,
        'conversation': conversation
    })

@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Delete a conversation."""
    success = history_manager.delete_conversation(conversation_id)
    
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({
            'success': False,
            'error': 'Failed to delete conversation'
        }), 500

@app.route('/api/conversations/<conversation_id>/truncate', methods=['POST'])
def truncate_conversation(conversation_id):
    """Truncate conversation at a specific message index."""
    data = request.get_json()
    message_index = data.get('message_index')
    
    if message_index is None:
        return jsonify({
            'success': False,
            'error': 'message_index required'
        }), 400
    
    success = history_manager.truncate_conversation(conversation_id, message_index)
    
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({
            'success': False,
            'error': 'Failed to truncate conversation'
        }), 500

if __name__ == '__main__':
    print(f"Starting Flask server on {FLASK_HOST}:{FLASK_PORT}...")
    print("Flask server is ready!")
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=FLASK_DEBUG, use_reloader=False)
