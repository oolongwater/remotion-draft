# LLM Service Layer

Unified interface for different LLM providers (Anthropic Claude, Cerebras, etc.)

## Quick Start

### Using the Factory (Recommended)

The easiest way to switch between providers:

```python
from services.llm import create_llm_service

# Use default provider (Anthropic)
service = create_llm_service()

# Switch to Cerebras
service = create_llm_service(provider="cerebras")

# Use specific model
service = create_llm_service(
    provider="cerebras",
    model="gpt-oss-120b"
)

# Use environment variable to set provider
# export LLM_PROVIDER=cerebras
service = create_llm_service()  # Will use cerebras
```

### Direct Usage

You can also import services directly:

```python
from services.llm import AnthropicClaudeService, CerebrasService

# Anthropic
anthropic_service = AnthropicClaudeService(
    model="claude-sonnet-4-5-20250929"
)

# Cerebras
cerebras_service = CerebrasService(
    model="llama-3.3-70b"
)
```

## Usage Examples

### Simple Text Generation

```python
from services.llm import create_llm_service

service = create_llm_service(provider="cerebras")

response = service.generate_simple(
    prompt="Explain quantum computing in simple terms",
    system_prompt="You are a helpful teacher.",
    max_tokens=500,
    temperature=0.7
)

print(response)
```

### Conversation with Message History

```python
from services.llm import create_llm_service, LLMMessage

service = create_llm_service(provider="anthropic")

messages = [
    LLMMessage(role="system", content="You are a helpful assistant."),
    LLMMessage(role="user", content="What is Python?"),
    LLMMessage(role="assistant", content="Python is a programming language..."),
    LLMMessage(role="user", content="Tell me more about it.")
]

response = service.generate(messages=messages)
print(response.content)
print(f"Tokens used: {response.usage['total_tokens']}")
print(f"Cost: ${response.usage['cost']:.4f}")
```

### Async Generation

```python
import asyncio
from services.llm import create_llm_service

async def main():
    service = create_llm_service(provider="cerebras")

    response = await service.generate_simple_async(
        prompt="Write a haiku about coding",
        max_tokens=100
    )

    print(response)

asyncio.run(main())
```

## Available Providers

### Anthropic Claude

**Models:**

- `claude-sonnet-4-5-20250929` (default, higher quality)
- `claude-haiku-4-5-20251001` (faster, cheaper)

**Environment Variables:**

- `ANTHROPIC_API_KEY` - API key

**Example:**

```python
service = create_llm_service(
    provider="anthropic",
    model="claude-haiku-4-5-20251001"
)
```

### Cerebras

**Models:**

- `llama-3.3-70b` (default)
- `llama3.1-8b`
- `qwen-3-32b`
- `gpt-oss-120b`
- `qwen-3-235b-a22b-instruct-2507` (preview)
- `qwen-3-235b-a22b-thinking-2507` (preview)
- `zai-glm-4.6` (preview)

**Environment Variables:**

- `CEREBRAS_API_KEY` - API key

**Example:**

```python
service = create_llm_service(
    provider="cerebras",
    model="gpt-oss-120b"
)
```

## Switching Providers

### Method 1: Environment Variable

```bash
export LLM_PROVIDER=cerebras
```

Then in your code:

```python
service = create_llm_service()  # Uses cerebras
```

### Method 2: Code Parameter

```python
service = create_llm_service(provider="cerebras")
```

### Method 3: Direct Import

```python
from services.llm import CerebrasService
service = CerebrasService()
```

## Helper Functions

```python
from services.llm import get_available_providers, get_default_model

# List available providers
providers = get_available_providers()
print(providers)
# {'anthropic': '...', 'cerebras': '...'}

# Get default model for a provider
default_model = get_default_model("cerebras")
print(default_model)  # "llama-3.3-70b"
```

## API Compatibility

All services implement the same interface:

- `generate(messages, max_tokens, temperature, **kwargs)` -> `LLMResponse`
- `generate_simple(prompt, system_prompt, max_tokens, temperature, **kwargs)` -> `str`
- `generate_async(messages, max_tokens, temperature, **kwargs)` -> `LLMResponse`
- `generate_simple_async(prompt, system_prompt, max_tokens, temperature, **kwargs)` -> `str`
- `get_provider_name()` -> `str`
- `validate_api_key()` -> `bool`

This means you can switch providers without changing your code!
