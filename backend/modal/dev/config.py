"""
Configuration and constants for dev environment video generator
"""

# LLM Configuration
TEMP = 0.3
MAX_TOKENS = 16000

# Rendering Configuration
MAX_RENDER_ATTEMPTS = 2
RENDER_TIMEOUT = 600  # seconds (10 minutes)
RENDER_MEMORY = 8192  # MB (8GB)
RENDER_CPU = 4.0

# Main Pipeline Configuration
MAIN_TIMEOUT = 3600  # seconds (1 hour)
MAIN_MEMORY = 16384  # MB (16GB)
MAIN_CPU = 8.0

# Modal Configuration
APP_NAME = "main-video-generator-dev"
VOLUME_NAME = "video-outputs-main-dev"

# Secrets Configuration
RENDER_SECRETS = [
    "anthropic-key",  # For code repair
    "elevenlabs-key",  # For TTS
    "gcp-credentials",  # For GCS uploads (contains GCP_SERVICE_ACCOUNT_JSON)
]

MAIN_SECRETS = [
    "anthropic-key",
    "elevenlabs-key",
    "gcp-credentials",  # For GCS uploads (contains GCP_SERVICE_ACCOUNT_JSON)
]
