"""
Base classes and data structures for LLM services
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class LLMMessage:
    """Standard message format for LLM interactions."""
    role: str  # "user", "assistant", "system"
    content: str


@dataclass
class LLMResponse:
    """Standard response format from LLM services."""
    content: str
    model: str
    usage: Optional[Dict[str, Any]] = None
    finish_reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class LLMServiceError(Exception):
    """Base exception for LLM service errors."""
    pass


class LLMService(ABC):
    """
    Abstract base class for LLM services.
    Provides a unified interface for different LLM providers.
    """

    def __init__(self, model: str, **kwargs):
        self.model = model
        self.default_max_tokens = kwargs.get('max_tokens', 4000)
        self.default_temperature = kwargs.get('temperature', 0.3)

    @abstractmethod
    def generate(self,
                messages: List[LLMMessage],
                max_tokens: Optional[int] = None,
                temperature: Optional[float] = None,
                **kwargs) -> LLMResponse:
        """
        Generate a response from the LLM.

        Args:
            messages: List of messages (conversation history)
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-1)
            **kwargs: Provider-specific parameters

        Returns:
            LLMResponse with generated content
        """
        pass

    @abstractmethod
    def generate_simple(self,
                       prompt: str,
                       system_prompt: Optional[str] = None,
                       max_tokens: Optional[int] = None,
                       temperature: Optional[float] = None,
                       **kwargs) -> str:
        """
        Simple text-in, text-out generation.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            **kwargs: Provider-specific parameters

        Returns:
            Generated text content
        """
        pass

    @abstractmethod
    async def generate_async(self,
                            messages: List[LLMMessage],
                            max_tokens: Optional[int] = None,
                            temperature: Optional[float] = None,
                            **kwargs) -> LLMResponse:
        """
        Async version of generate().

        Args:
            messages: List of messages (conversation history)
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0-1)
            **kwargs: Provider-specific parameters

        Returns:
            LLMResponse with generated content
        """
        pass

    @abstractmethod
    async def generate_simple_async(self,
                                    prompt: str,
                                    system_prompt: Optional[str] = None,
                                    max_tokens: Optional[int] = None,
                                    temperature: Optional[float] = None,
                                    **kwargs) -> str:
        """
        Async version of generate_simple().

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            **kwargs: Provider-specific parameters

        Returns:
            Generated text content
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the name of the LLM provider."""
        pass

    def validate_api_key(self) -> bool:
        """Validate that the API key is properly configured."""
        return True  # Override in subclasses if needed
