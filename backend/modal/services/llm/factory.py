"""
LLM Service Factory
Provides a simple way to create and switch between different LLM services
"""

import os
from typing import Any, Dict, Optional

from .anthropic import AnthropicClaudeService
from .base import LLMService, LLMServiceError
from .cerebras import CerebrasService

# Supported providers
SUPPORTED_PROVIDERS = {
    "anthropic": AnthropicClaudeService,
    "cerebras": CerebrasService,
}


def create_llm_service(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    **kwargs
) -> LLMService:
    """
    Factory function to create an LLM service instance.

    Args:
        provider: Provider name ("anthropic" or "cerebras"). 
                  If None, uses LLM_PROVIDER env var or defaults to "anthropic"
        model: Model name. If None, uses provider defaults:
               - anthropic: "claude-sonnet-4-5-20250929"
               - cerebras: "llama-3.3-70b"
        api_key: API key. If None, uses provider-specific env vars:
                 - anthropic: ANTHROPIC_API_KEY
                 - cerebras: CEREBRAS_API_KEY
        **kwargs: Additional provider-specific parameters

    Returns:
        LLMService instance

    Examples:
        # Use default provider (anthropic)
        service = create_llm_service()

        # Use Cerebras
        service = create_llm_service(provider="cerebras")

        # Use specific model
        service = create_llm_service(provider="cerebras", model="gpt-oss-120b")

        # Use environment variable to set provider
        # export LLM_PROVIDER=cerebras
        service = create_llm_service()  # Will use cerebras
    """
    # Determine provider
    if provider is None:
        provider = os.getenv('LLM_PROVIDER', 'anthropic').lower()

    if provider not in SUPPORTED_PROVIDERS:
        raise LLMServiceError(
            f"Unsupported provider: {provider}. "
            f"Supported providers: {list(SUPPORTED_PROVIDERS.keys())}"
        )

    # Get service class
    service_class = SUPPORTED_PROVIDERS[provider]

    # Set default model if not provided
    if model is None:
        if provider == "anthropic":
            model = "claude-sonnet-4-5-20250929"
        elif provider == "cerebras":
            model = "llama-3.3-70b"

    # Create service instance
    try:
        service = service_class(model=model, api_key=api_key, **kwargs)
        return service
    except Exception as e:
        raise LLMServiceError(
            f"Failed to create {provider} service: {e}"
        )


def get_available_providers() -> Dict[str, str]:
    """
    Get list of available LLM providers and their descriptions.

    Returns:
        Dictionary mapping provider names to descriptions
    """
    return {
        "anthropic": "Anthropic Claude (claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001)",
        "cerebras": "Cerebras (llama-3.3-70b, gpt-oss-120b, qwen-3-32b, etc.)"
    }


def get_default_model(provider: str) -> str:
    """
    Get the default model for a provider.

    Args:
        provider: Provider name

    Returns:
        Default model name
    """
    defaults = {
        "anthropic": "claude-sonnet-4-5-20250929",
        "cerebras": "llama-3.3-70b"
    }
    return defaults.get(provider.lower(), "")

