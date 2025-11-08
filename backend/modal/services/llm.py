"""
LLM Service Abstraction Layer - Re-export Module
This file re-exports from the llm/ package for backward compatibility
with main_video_generator.py which imports from 'llm'
"""

# Re-export everything from the llm package
from services.llm.base import (
    LLMMessage,
    LLMResponse,
    LLMService,
    LLMServiceError
)
from services.llm.anthropic import AnthropicClaudeService
from services.llm.cerebras import CerebrasService
from services.llm.factory import (
    create_llm_service,
    get_available_providers,
    get_default_model,
    SUPPORTED_PROVIDERS
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
