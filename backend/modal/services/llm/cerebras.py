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

    def generate_with_cepo(self,
                          prompt: str,
                          system_prompt: Optional[str] = None,
                          max_tokens: Optional[int] = None,
                          temperature: Optional[float] = None,
                          **kwargs) -> str:
        """
        Generate response using CePO (Cerebras Planning & Optimization).
        
        CePO enhances reasoning by using test-time compute with:
        1. Planning: Step-by-step plan generation
        2. Execution: Multiple response generations
        3. Analysis: Inconsistency detection
        4. Best-of-N: Confidence-scored selection
        
        Note: CePO currently supports llama-3.3-70b model.
        Reference: https://inference-docs.cerebras.ai/capabilities/cepo
        
        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            **kwargs: Additional parameters
            
        Returns:
            Generated text response
        """
        import json
        import subprocess
        
        # CePO requires llama-3.3-70b model - override to ensure correct model
        original_model = self.model
        model = "llama-3.3-70b"
        if original_model != model:
            print(f"⚠️  CePO requires llama-3.3-70b, overriding model from {original_model} to {model}")
        
        # Check if OptiLLM is available
        try:
            import importlib.util
            optillm_spec = importlib.util.find_spec("optillm")
            use_programmatic = optillm_spec is not None
        except Exception:
            use_programmatic = False
        
        if not use_programmatic:
            print("⚠️  OptiLLM not installed, using subprocess method")
        
        if use_programmatic:
            # Try programmatic API if available
            try:
                # OptiLLM programmatic usage (if supported)
                from optillm import OptiLLM
                
                optillm_client = OptiLLM(
                    base_url="https://api.cerebras.ai",
                    api_key=self.api_key,
                    approach="cepo"
                )
                
                # Prepare messages
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})
                
                response = optillm_client.generate(
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    **kwargs
                )
                
                return response.content if hasattr(response, 'content') else str(response)
                
            except Exception as e:
                print(f"⚠️  OptiLLM programmatic API failed: {e}")
                print(f"   Falling back to subprocess method")
                use_programmatic = False
        
        if not use_programmatic:
            # Use subprocess to call OptiLLM CLI
            # Prepare input data as JSON
            input_data = {
                "messages": [],
                "model": model  # Override to llama-3.3-70b for CePO
            }
            if system_prompt:
                input_data["messages"].append({"role": "system", "content": system_prompt})
            input_data["messages"].append({"role": "user", "content": prompt})
            
            if max_tokens:
                input_data["max_tokens"] = max_tokens
            if temperature is not None:
                input_data["temperature"] = temperature
            
            input_json = json.dumps(input_data)
            
            try:
                # Build OptiLLM command
                # OptiLLM CLI typically reads from stdin and writes to stdout
                cmd = [
                    "optillm",
                    "--base-url", "https://api.cerebras.ai",
                    "--approach", "cepo"
                ]
                
                if kwargs.get("cepo_print_output", False):
                    cmd.extend(["--cepo_print_output", "true"])
                
                # Set API key in environment
                env = os.environ.copy()
                env["CEREBRAS_API_KEY"] = self.api_key
                
                print(f"🤖 Calling CePO via OptiLLM CLI...")
                print(f"   Model: {model}")
                print(f"   Approach: cepo")
                
                # Run OptiLLM with stdin/stdout
                result = subprocess.run(
                    cmd,
                    input=input_json,
                    capture_output=True,
                    text=True,
                    env=env,
                    check=True,
                    timeout=300  # 5 minute timeout
                )
                
                # Parse output (may be JSON or plain text)
                try:
                    output_data = json.loads(result.stdout)
                    # Extract response content
                    if "content" in output_data:
                        content = output_data["content"]
                    elif "choices" in output_data and output_data["choices"]:
                        content = output_data["choices"][0].get("message", {}).get("content", "")
                    elif "text" in output_data:
                        content = output_data["text"]
                    else:
                        content = result.stdout.strip()
                except json.JSONDecodeError:
                    # If output is not JSON, use stdout directly
                    content = result.stdout.strip()
                
                if not content:
                    # Fallback to stderr if stdout is empty
                    content = result.stderr.strip() if result.stderr else ""
                
                print(f"✅ CePO generation completed")
                return content
                
            except subprocess.CalledProcessError as e:
                print(f"❌ CePO subprocess error: {e}")
                print(f"   stdout: {e.stdout}")
                print(f"   stderr: {e.stderr}")
                raise LLMServiceError(f"CePO generation failed: {e.stderr}")
            except subprocess.TimeoutExpired:
                raise LLMServiceError("CePO generation timed out after 5 minutes")
            except FileNotFoundError:
                raise LLMServiceError(
                    "OptiLLM CLI not found. Install with: pip install optillm"
                )

    async def generate_simple_cepo_async(self,
                                        prompt: str,
                                        system_prompt: Optional[str] = None,
                                        max_tokens: Optional[int] = None,
                                        temperature: Optional[float] = None,
                                        **kwargs) -> str:
        """
        Async version of generate_with_cepo() for parallel API calls.
        """
        import asyncio
        
        # Run CePO generation in executor (it may use subprocess)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.generate_with_cepo(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                **kwargs
            )
        )

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

