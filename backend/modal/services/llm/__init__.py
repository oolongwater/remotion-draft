"""
LLM Service Abstraction Layer
Provides a unified interface for different LLM providers
"""

# Use relative imports within the package
from .anthropic import AnthropicClaudeService
from .base import LLMMessage, LLMResponse, LLMService, LLMServiceError
from .cerebras import CerebrasService
from .factory import (
    SUPPORTED_PROVIDERS,
    create_llm_service,
    get_available_providers,
    get_default_model,
)

__all__ = [
    'LLMMessage',
    'LLMResponse',
    'LLMService',
    'LLMServiceError',
    'AnthropicClaudeService',
    'CerebrasService',
    'create_llm_service',
    'get_available_providers',
    'get_default_model',
    'SUPPORTED_PROVIDERS'
]
