"""
LLM Service Abstraction Layer
Provides a unified interface for different LLM providers
"""

# Use relative imports within the package
from .base import (
    LLMMessage,
    LLMResponse,
    LLMService,
    LLMServiceError
)
from .anthropic import AnthropicClaudeService

__all__ = [
    'LLMMessage',
    'LLMResponse',
    'LLMService',
    'LLMServiceError',
    'AnthropicClaudeService'
]
