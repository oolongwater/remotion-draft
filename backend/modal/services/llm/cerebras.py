"""
Cerebras LLM service implementation
"""

import os
from typing import List, Optional

from .base import LLMMessage, LLMResponse, LLMService, LLMServiceError


class CerebrasService(LLMService):
    """
    Cerebras LLM service implementation.

    Available models:
    - llama3.1-8b
    - llama-3.3-70b
    - qwen-3-32b
    - qwen-3-235b-a22b-instruct-2507 (preview)
    - qwen-3-235b-a22b-thinking-2507 (preview)
    - gpt-oss-120b
    - zai-glm-4.6 (preview)
    """

    def __init__(self,
                 model: str = "llama-3.3-70b",  # Default model
                 api_key: Optional[str] = None,
                 **kwargs):
        """
        Initialize Cerebras service.

        Args:
            model: Cerebras model to use
            api_key: Cerebras API key (or set via CEREBRAS_API_KEY env var)
            **kwargs: Additional parameters
        """
        super().__init__(model, **kwargs)

        # Import cerebras here to make it optional
        try:
            from cerebras.cloud.sdk import Cerebras  # type: ignore
            self.Cerebras = Cerebras
        except ImportError:
            raise LLMServiceError(
                "Cerebras package not installed. Run: pip install cerebras-cloud-sdk"
            )

        # Get API key (check multiple possible environment variable names)
        self.api_key = (api_key or
                       os.getenv('CEREBRAS_API_KEY') or
                       os.getenv('cerebras-key'))
        if not self.api_key:
            raise LLMServiceError(
                "Cerebras API key required. Set CEREBRAS_API_KEY environment variable "
                "or pass api_key parameter."
            )

        # Initialize client
        self.client = self.Cerebras(api_key=self.api_key)

        print(f"✅ Cerebras service initialized with model: {model}")

    def generate(self,
                messages: List[LLMMessage],
                max_tokens: Optional[int] = None,
                temperature: Optional[float] = None,
                **kwargs) -> LLMResponse:
        """
        Generate response using Cerebras API.
        """
        max_tokens = max_tokens or self.default_max_tokens
        temperature = temperature or self.default_temperature

        # Convert messages to Cerebras format
        # Note: System prompts must be passed as a string in the messages array
        cerebras_messages = []

        for msg in messages:
            if msg.role == "system":
                # Cerebras requires system prompts as strings in messages
                cerebras_messages.append({
                    "role": "system",
                    "content": msg.content
                })
            else:
                cerebras_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        try:
            # Prepare API call parameters
            # Note: Cerebras uses max_completion_tokens instead of max_tokens
            api_params = {
                "model": self.model,
                "max_completion_tokens": max_tokens,
                "temperature": temperature,
                "messages": cerebras_messages
            }

            # Add any additional kwargs
            api_params.update(kwargs)

            print(f"🤖 Calling Cerebras API with model: {self.model}")
            print(f"   Max completion tokens: {max_tokens}, Temperature: {temperature}")

            response = self.client.chat.completions.create(**api_params)

            # Extract content from response
            # Response structure: response.choices[0].message.content
            content = response.choices[0].message.content if response.choices else ""

            # Debug logging: log full response structure
            print(f"🔍 [DEBUG] Cerebras API response structure:")
            print(f"   Response type: {type(response)}")
            print(f"   Has choices: {hasattr(response, 'choices') and response.choices}")
            if response.choices:
                print(f"   Number of choices: {len(response.choices)}")
                print(f"   First choice type: {type(response.choices[0])}")
                if hasattr(response.choices[0], 'message'):
                    print(f"   Message type: {type(response.choices[0].message)}")
                    if hasattr(response.choices[0].message, 'content'):
                        print(f"   Content type: {type(response.choices[0].message.content)}")
                        print(f"   Content length: {len(content) if content else 0}")
                        print(f"   Content preview (first 500 chars): {content[:500] if content else 'None'}")

            # Extract usage information
            usage = {
                "input_tokens": getattr(response.usage, 'prompt_tokens', 0),
                "output_tokens": getattr(response.usage, 'completion_tokens', 0),
                "total_tokens": getattr(response.usage, 'total_tokens', 0)
            }

            # Calculate cost (Cerebras pricing may vary, adjust as needed)
            cost = self.calculate_cost(usage["input_tokens"], usage["output_tokens"])
            usage["cost"] = cost

            # Extract finish reason
            finish_reason = response.choices[0].finish_reason if response.choices else None

            print(f"✅ API call completed. Tokens: {usage['total_tokens']} | Cost: ${cost:.4f}")

            return LLMResponse(
                content=content,
                model=response.model,
                usage=usage,
                finish_reason=finish_reason,
                metadata={"provider": "cerebras"}
            )

        except Exception as e:
            print(f"❌ Cerebras API error: {e}")
            print(f"🔍 [DEBUG] Error type: {type(e).__name__}")
            import traceback
            print(f"🔍 [DEBUG] Full traceback:")
            print(traceback.format_exc())
            raise LLMServiceError(f"Cerebras API error: {e}")

    def generate_simple(self,
                       prompt: str,
                       system_prompt: Optional[str] = None,
                       max_tokens: Optional[int] = None,
                       temperature: Optional[float] = None,
                       **kwargs) -> str:
        """
        Simple text generation using Cerebras.
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
        Note: Cerebras SDK may not have async support, this uses sync client in async context.
        """
        import asyncio

        # Run sync call in executor for async compatibility
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.generate(messages, max_tokens, temperature, **kwargs)
        )

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
        Calculate cost based on Cerebras pricing tiers.
        Note: Actual pricing may vary by model. Adjust as needed.

        Args:
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Total cost in USD (placeholder - update with actual pricing)
        """
        # Placeholder pricing - update with actual Cerebras pricing
        # These are example values, adjust based on actual Cerebras pricing
        input_cost_per_million = 0.50  # Placeholder
        output_cost_per_million = 1.50  # Placeholder

        input_cost = (input_tokens / 1_000_000) * input_cost_per_million
        output_cost = (output_tokens / 1_000_000) * output_cost_per_million

        return input_cost + output_cost

    def get_provider_name(self) -> str:
        """Return provider name."""
        return "cerebras"

    def validate_api_key(self) -> bool:
        """Validate Cerebras API key."""
        try:
            # Simple test call
            self.client.chat.completions.create(
                model=self.model,
                max_completion_tokens=10,
                messages=[{"role": "user", "content": "Hello"}]
            )
            return True
        except Exception:
            return False

