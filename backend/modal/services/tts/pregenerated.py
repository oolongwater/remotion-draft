"""
Pre-generated audio service for manim_voiceover
Loads existing audio files instead of generating new ones
"""

from pathlib import Path
from typing import Dict, Optional

from manim_voiceover.services.base import SpeechService


class PreGeneratedAudioService(SpeechService):
    """
    Service that loads pre-generated audio files instead of generating new ones.
    This allows using pre-generated audio with VoiceoverScene.
    """

    def __init__(self, audio_file_path: str, fallback_to_elevenlabs: bool = True, voice_id: str = None, **kwargs):
        """
        Initialize with path to pre-generated audio file.

        Args:
            audio_file_path: Path to the pre-generated audio file (.mp3)
            fallback_to_elevenlabs: If True, fall back to ElevenLabsService if audio file doesn't exist
            voice_id: Optional voice ID for ElevenLabs fallback. Defaults to male voice if not provided.
        """
        self.audio_file_path = Path(audio_file_path)
        self.fallback_to_elevenlabs = fallback_to_elevenlabs
        self.audio_exists = self.audio_file_path.exists()
        
        # Use provided voice_id or default
        selected_voice_id = voice_id or "pqHfZKP75CvOlQylNhV4"
        
        if not self.audio_exists:
            if fallback_to_elevenlabs:
                print(f"⚠️  Pre-generated audio file not found: {audio_file_path}")
                print(f"⚠️  Falling back to ElevenLabsService for on-the-fly generation")
                # Import and use ElevenLabsService as fallback
                from manim_voiceover.services.elevenlabs import ElevenLabsService
                # Store fallback service
                self._fallback_service = ElevenLabsService(
                    voice_id=selected_voice_id,
                    transcription_model=None,
                    **kwargs
                )
            else:
                raise FileNotFoundError(f"Pre-generated audio file not found: {audio_file_path}")
        else:
            self._fallback_service = None
        
        # Override kwargs to disable transcription
        if 'transcription_model' not in kwargs:
            kwargs['transcription_model'] = None
        
        super().__init__(**kwargs)
        
        if self.audio_exists:
            print(f"✅ PreGeneratedAudioService initialized with audio: {self.audio_file_path.name}")
        else:
            print(f"⚠️  PreGeneratedAudioService initialized with fallback (file not found)")

    def generate_from_text(self, text: str, cache_dir: Optional[str] = None,
                          path: Optional[str] = None) -> Dict:
        """
        Load pre-generated audio file instead of generating new audio.
        This method is called by manim_voiceover when self.voiceover() is used.
        Falls back to ElevenLabsService if audio file doesn't exist.

        Args:
            text: Text to match with audio (used for fallback generation if audio missing)
            cache_dir: Directory for cached audio files
            path: Optional specific path for the audio file

        Returns:
            Dictionary with audio file path and metadata in format expected by manim_voiceover
        """
        # Check if audio file exists (it might have been created since initialization)
        if not self.audio_file_path.exists():
            if self._fallback_service:
                print(f"⚠️  Audio file still not found, using ElevenLabsService fallback")
                return self._fallback_service.generate_from_text(text, cache_dir, path)
            else:
                raise FileNotFoundError(f"Pre-generated audio file not found: {self.audio_file_path}")
        
        # Load the pre-generated audio file
        audio_path = str(self.audio_file_path.absolute())
        
        # Get audio duration using ffprobe if available
        duration = self._get_audio_duration(audio_path)
        
        # Create input data for consistency with other services
        input_data = {
            "input_text": text,
            "service": "pregenerated_audio",
            "audio_file_path": str(self.audio_file_path)
        }
        
        # Return format compatible with manim_voiceover's expectations
        # manim_voiceover expects 'original_audio' or 'audio_path' key
        return {
            "input_text": text,
            "input_data": input_data,
            "original_audio": str(self.audio_file_path.name),
            "audio_path": audio_path,
            "word_timings": [],  # Empty timings - manim_voiceover will handle sync
            "character_alignment": {},
            "service": "pregenerated_audio",
            "duration": duration
        }

    def generate(self, input_data: Dict) -> Dict:
        """
        Load pre-generated audio file instead of generating new audio.
        This is the base class method, delegates to generate_from_text.

        Args:
            input_data: Input data dict containing 'text' key

        Returns:
            Dictionary with audio file path and metadata
        """
        text = input_data.get("text", "")
        return self.generate_from_text(text)

    def _get_audio_duration(self, audio_path: str) -> float:
        """
        Get duration of audio file using ffprobe.

        Args:
            audio_path: Path to audio file

        Returns:
            Duration in seconds
        """
        import subprocess
        
        try:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    audio_path
                ],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0 and result.stdout.strip():
                return float(result.stdout.strip())
        except Exception as e:
            print(f"⚠️  Could not get audio duration: {e}")
        
        # Fallback duration estimate (will be adjusted by manim_voiceover)
        return 5.0

