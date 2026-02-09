"""Intelligent context building for conversations."""
from typing import List, Dict
from config import MAX_RECENT_MESSAGES, SUMMARY_THRESHOLD, CONTEXT_WINDOW_SIZE
from utils.history_manager import HistoryManager

class ContextBuilder:
    """Build intelligent context for AI conversations."""
    
    def __init__(self):
        """Initialize context builder."""
        self.history_manager = HistoryManager()
    
    def build_context(self, conversation_id: str, messages: List[Dict]) -> List[Dict]:
        """Build context for a conversation.
        
        Args:
            conversation_id: Conversation ID
            messages: Current messages in conversation
            
        Returns:
            List of message dicts with context
        """
        # Get recent messages (last N messages)
        recent_messages = messages[-MAX_RECENT_MESSAGES:] if len(messages) > MAX_RECENT_MESSAGES else messages
        
        # If conversation is long, include summary
        if len(messages) > SUMMARY_THRESHOLD:
            summary = self.history_manager.get_summary(conversation_id)
            if summary:
                # Prepend summary as a system message
                context = [{
                    'role': 'system',
                    'content': f"Previous conversation summary: {summary}"
                }]
                context.extend(recent_messages)
                return context
        
        return recent_messages
    
    def should_summarize(self, messages: List[Dict]) -> bool:
        """Check if conversation should be summarized.
        
        Args:
            messages: List of messages
            
        Returns:
            bool: True if should summarize
        """
        return len(messages) > SUMMARY_THRESHOLD
    
    def create_summary(self, messages: List[Dict]) -> str:
        """Create a summary of conversation messages.
        
        Args:
            messages: List of messages to summarize
            
        Returns:
            Summary string
        """
        # Improved summary: extract key information from messages
        # Focus on user questions and important topics
        summary_parts = []
        user_messages = [msg for msg in messages if msg.get('role') == 'user']
        
        # Include first few user messages (questions/topics)
        for msg in user_messages[:5]:
            content = msg.get('content', '').strip()
            if content and len(content) > 10:
                # Extract first sentence or first 80 chars
                first_sentence = content.split('.')[0] if '.' in content else content[:80]
                summary_parts.append(first_sentence[:100])
        
        # Include key assistant responses if available
        assistant_messages = [msg for msg in messages if msg.get('role') == 'assistant']
        if assistant_messages and len(summary_parts) < 3:
            for msg in assistant_messages[:2]:
                content = msg.get('content', '').strip()
                if content and len(content) > 20:
                    # Extract first meaningful part
                    first_part = content.split('\n')[0][:80]
                    summary_parts.append(first_part)
        
        summary = ' | '.join(summary_parts[:5]) if summary_parts else 'Conversation summary'
        
        # Add message count for context
        if len(messages) > 10:
            summary += f' ({len(messages)} messages)'
        
        return summary
