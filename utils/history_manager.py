"""Conversation history storage and retrieval."""
import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from utils.paths import get_conversations_path, get_summaries_path

class HistoryManager:
    """Manage conversation history storage."""
    
    def __init__(self):
        """Initialize history manager."""
        self.conversations_path = get_conversations_path()
        self.summaries_path = get_summaries_path()
    
    def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        """Get a conversation by ID.
        
        Args:
            conversation_id: Conversation ID
            
        Returns:
            Conversation dict or None if not found
        """
        file_path = self.conversations_path / f"{conversation_id}.json"
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading conversation {conversation_id}: {e}")
            return None
    
    def save_conversation(self, conversation: Dict):
        """Save a conversation to disk.
        
        Args:
            conversation: Conversation dict with id, title, messages, etc.
        """
        conversation_id = conversation.get('id')
        if not conversation_id:
            return
        
        file_path = self.conversations_path / f"{conversation_id}.json"
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(conversation, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving conversation {conversation_id}: {e}")
    
    def list_conversations(self) -> List[Dict]:
        """List all conversations.
        
        Returns:
            List of conversation dicts (id, title, updated_at)
        """
        conversations = []
        
        for file_path in self.conversations_path.glob('*.json'):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    conv = json.load(f)
                    conversations.append({
                        'id': conv.get('id'),
                        'title': conv.get('title', 'Untitled'),
                        'updated_at': conv.get('updated_at', ''),
                        'created_at': conv.get('created_at', '')
                    })
            except Exception as e:
                print(f"Error reading conversation file {file_path}: {e}")
        
        # Sort by updated_at (most recent first)
        conversations.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
        return conversations
    
    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation.
        
        Args:
            conversation_id: Conversation ID to delete
            
        Returns:
            bool: True if deleted successfully
        """
        file_path = self.conversations_path / f"{conversation_id}.json"
        summary_path = self.summaries_path / f"{conversation_id}.json"
        
        try:
            if file_path.exists():
                file_path.unlink()
            if summary_path.exists():
                summary_path.unlink()
            return True
        except Exception as e:
            print(f"Error deleting conversation {conversation_id}: {e}")
            return False
    
    def get_summary(self, conversation_id: str) -> Optional[str]:
        """Get conversation summary.
        
        Args:
            conversation_id: Conversation ID
            
        Returns:
            Summary string or None
        """
        file_path = self.summaries_path / f"{conversation_id}.json"
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('summary', '')
        except Exception as e:
            print(f"Error reading summary {conversation_id}: {e}")
            return None
    
    def save_summary(self, conversation_id: str, summary: str):
        """Save conversation summary.
        
        Args:
            conversation_id: Conversation ID
            summary: Summary text
        """
        file_path = self.summaries_path / f"{conversation_id}.json"
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({'summary': summary, 'conversation_id': conversation_id}, f, indent=2)
        except Exception as e:
            print(f"Error saving summary {conversation_id}: {e}")
    
    def truncate_conversation(self, conversation_id: str, message_index: int) -> bool:
        """Truncate conversation at a specific message index (remove all messages after that index).
        
        Args:
            conversation_id: Conversation ID
            message_index: Index of the message to keep (0-based). All messages after this will be removed.
            
        Returns:
            bool: True if truncated successfully
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return False
        
        messages = conversation.get('messages', [])
        if message_index < 0 or message_index >= len(messages):
            return False
        
        # Truncate messages
        conversation['messages'] = messages[:message_index + 1]
        conversation['updated_at'] = datetime.now().isoformat()
        
        # Save updated conversation
        self.save_conversation(conversation)
        
        # Delete summary if exists (since conversation changed)
        summary_path = self.summaries_path / f"{conversation_id}.json"
        if summary_path.exists():
            try:
                summary_path.unlink()
            except Exception as e:
                print(f"Error deleting summary {conversation_id}: {e}")
        
        return True
