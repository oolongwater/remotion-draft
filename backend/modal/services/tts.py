"""
Text-to-Speech Services - Re-export Module
This file re-exports from the tts/ package for backward compatibility
"""

# Re-export everything from the tts package
from services.tts.elevenlabs import ElevenLabsTimedService

__all__ = [
    'ElevenLabsTimedService'
]
