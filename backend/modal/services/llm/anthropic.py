"""
Anthropic Claude LLM service implementation
"""

import os
from typing import List, Optional
from .base import LLMService, LLMMessage, LLMResponse, LLMServiceError


class AnthropicClaudeService(LLMService):
    """
    Anthropic Claude LLM service implementation.

    Available models:
    - claude-haiku-4-5-20251001 (fast, cheaper)
    - claude-sonnet-4-5-20250929 (smarter, more expensive) ← CURRENTLY ACTIVE
    """

    def __init__(self,
                 # model: str = "claude-haiku-4-5-20251001",  # Commented out - using Sonnet for higher quality
                 model: str = "claude-sonnet-4-5-20250929",  # Active - higher quality for production
                 api_key: Optional[str] = None,
                 **kwargs):
        """
        Initialize Anthropic Claude service.

        Args:
            model: Claude model to use
            api_key: Anthropic API key (or set via ANTHROPIC_API_KEY env var)
            **kwargs: Additional parameters
        """
        super().__init__(model, **kwargs)

        # Import anthropic here to make it optional
        try:
            from anthropic import Anthropic, AsyncAnthropic
            self.anthropic = Anthropic
            self.async_anthropic = AsyncAnthropic
        except ImportError:
            raise LLMServiceError(
                "Anthropic package not installed. Run: pip install anthropic"
            )

        # Get API key (check multiple possible environment variable names)
        self.api_key = (api_key or
                       os.getenv('ANTHROPIC_API_KEY') or
                       os.getenv('anthropic_key') or  # Modal secret format
                       os.getenv('ANTHROPIC_KEY'))
        if not self.api_key:
            raise LLMServiceError(
                "Anthropic API key required. Set ANTHROPIC_API_KEY environment variable "
                "or pass api_key parameter."
            )

        # Initialize clients (sync and async)
        self.client = self.anthropic(api_key=self.api_key)
        self.async_client = self.async_anthropic(api_key=self.api_key)

        print(f"✅ Anthropic Claude service initialized with model: {model}")

    def generate(self,
                messages: List[LLMMessage],
                max_tokens: Optional[int] = None,
                temperature: Optional[float] = None,
                **kwargs) -> LLMResponse:
        """
        Generate response using Anthropic Claude API.
        """
        max_tokens = max_tokens or self.default_max_tokens
        temperature = temperature or self.default_temperature

        # Convert messages to Anthropic format
        anthropic_messages = []
        system_prompt = None

        for msg in messages:
            if msg.role == "system":
                system_prompt = msg.content
            else:
                anthropic_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        try:
            # Prepare API call parameters
            api_params = {
                "model": self.model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": anthropic_messages
            }

            if system_prompt:
                api_params["system"] = system_prompt

            # Add any additional kwargs
            api_params.update(kwargs)

            print(f"🤖 Calling Anthropic API with model: {self.model}")
            print(f"   Max tokens: {max_tokens}, Temperature: {temperature}")

            response = self.client.messages.create(**api_params)

            # Extract usage information
            usage = {
                "input_tokens": getattr(response.usage, 'input_tokens', 0),
                "output_tokens": getattr(response.usage, 'output_tokens', 0),
                "total_tokens": getattr(response.usage, 'input_tokens', 0) + getattr(response.usage, 'output_tokens', 0)
            }

            # Calculate cost based on Claude pricing
            cost = self.calculate_cost(usage["input_tokens"], usage["output_tokens"])
            usage["cost"] = cost

            print(f"✅ API call completed. Tokens: {usage['total_tokens']} | Cost: ${cost:.4f}")

            return LLMResponse(
                content=response.content[0].text,
                model=response.model,
                usage=usage,
                finish_reason=response.stop_reason,
                metadata={"provider": "anthropic"}
            )

        except Exception as e:
            print(f"❌ Anthropic API error: {e}")
            raise LLMServiceError(f"Anthropic API error: {e}")

    def generate_simple(self,
                       prompt: str,
                       system_prompt: Optional[str] = None,
                       max_tokens: Optional[int] = None,
                       temperature: Optional[float] = None,
                       **kwargs) -> str:
        """
        Simple text generation using Claude.
        """
        messages = []

        if system_prompt:
            messages.append(LLMMessage(role="system", content=system_prompt))

        messages.append(LLMMessage(role="user", content=prompt))

        response = self.generate(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs
        )

        return response.content

    async def generate_async(self,
                            messages: List[LLMMessage],
                            max_tokens: Optional[int] = None,
                            temperature: Optional[float] = None,
                            **kwargs) -> LLMResponse:
        """
        Async version of generate() for parallel API calls.
        """
        max_tokens = max_tokens or self.default_max_tokens
        temperature = temperature or self.default_temperature

        # Convert messages to Anthropic format
        anthropic_messages = []
        system_prompt = None

        for msg in messages:
            if msg.role == "system":
                system_prompt = msg.content
            else:
                anthropic_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        try:
            # Prepare API call parameters
            api_params = {
                "model": self.model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": anthropic_messages
            }

            if system_prompt:
                api_params["system"] = system_prompt

            # Add any additional kwargs
            api_params.update(kwargs)

            # Async API call
            response = await self.async_client.messages.create(**api_params)

            # Extract usage information
            usage = {
                "input_tokens": getattr(response.usage, 'input_tokens', 0),
                "output_tokens": getattr(response.usage, 'output_tokens', 0),
                "total_tokens": getattr(response.usage, 'input_tokens', 0) + getattr(response.usage, 'output_tokens', 0)
            }

            # Calculate cost based on Claude pricing
            cost = self.calculate_cost(usage["input_tokens"], usage["output_tokens"])
            usage["cost"] = cost

            return LLMResponse(
                content=response.content[0].text,
                model=response.model,
                usage=usage,
                finish_reason=response.stop_reason,
                metadata={"provider": "anthropic"}
            )

        except Exception as e:
            raise LLMServiceError(f"Anthropic async API error: {e}")

    async def generate_simple_async(self,
                                   prompt: str,
                                   system_prompt: Optional[str] = None,
                                   max_tokens: Optional[int] = None,
                                   temperature: Optional[float] = None,
                                   **kwargs) -> str:
        """
        Async version of generate_simple() for parallel API calls.
        """
        messages = []

        if system_prompt:
            messages.append(LLMMessage(role="system", content=system_prompt))

        messages.append(LLMMessage(role="user", content=prompt))

        response = await self.generate_async(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs
        )

        return response.content

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Calculate cost based on Claude pricing tiers.

        Args:
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Total cost in USD
        """
        # Claude pricing (as of latest rates)
        # Input: $3.00 per million tokens
        # Output: $15.00 per million tokens
        input_cost_per_million = 3.00
        output_cost_per_million = 15.00

        input_cost = (input_tokens / 1_000_000) * input_cost_per_million
        output_cost = (output_tokens / 1_000_000) * output_cost_per_million

        return input_cost + output_cost

    def get_provider_name(self) -> str:
        """Return provider name."""
        return "anthropic"

    def validate_api_key(self) -> bool:
        """Validate Anthropic API key."""
        try:
            # Simple test call
            test_response = self.client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hello"}]
            )
            return True
        except Exception:
            return False
