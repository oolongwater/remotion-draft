"""
ElevenLabs TTS service implementation
Fallback TTS provider with character-level timing for perfect sync
Uses the createSpeechWithTiming API endpoint for precise synchronization
"""

import base64
import hashlib
import json
import os
import requests
from pathlib import Path
from typing import Dict, List, Optional
from manim_voiceover.services.base import SpeechService


class ElevenLabsTimedService(SpeechService):
    """
    ElevenLabs TTS service with character-level timing for perfect sync.
    Uses the createSpeechWithTiming API endpoint for precise synchronization.
    """

    def __init__(self,
                 api_key: Optional[str] = None,
                 voice_id: str = "pqHfZKP75CvOlQylNhV4",  # Specified voice ID
                 model_id: str = "eleven_multilingual_v2",
                 stability: float = 0.5,
                 similarity_boost: float = 0.75,
                 style: float = 0.0,
                 use_speaker_boost: bool = True,
                 transcription_model: Optional[str] = None,  # Disable transcription by default
                 **kwargs):
        """
        Initialize ElevenLabs TTS service with timing support.

        Args:
            api_key: ElevenLabs API key (or set via ELEVENLABS_API_KEY env var)
            voice_id: Voice ID to use (default: pqHfZKP75CvOlQylNhV4)
            model_id: Model to use (eleven_multilingual_v2, eleven_monolingual_v1, etc.)
            stability: Voice stability (0-1, higher = more consistent)
            similarity_boost: Voice clarity (0-1, higher = more similar to original)
            style: Style exaggeration (0-1, higher = more expressive)
            use_speaker_boost: Whether to use speaker boost
        """

        # Get API key from parameter or environment (check multiple possible names)
        self.api_key = (api_key or
                       os.getenv('ELEVENLABS_API_KEY') or
                       os.getenv('elevenlabs_key') or  # Modal secret format
                       os.getenv('ELEVENLABS_KEY'))

        print(f"🔑 [ElevenLabs] API key found: {'Yes' if self.api_key else 'No'}")
        if self.api_key:
            print(f"🔑 [ElevenLabs] API key prefix: {self.api_key[:10]}...")

        if not self.api_key:
            raise ValueError(
                "ElevenLabs API key required. Set ELEVENLABS_API_KEY environment variable "
                "or pass api_key parameter."
            )

        self.voice_id = voice_id
        self.model_id = model_id
        self.voice_settings = {
            "stability": stability,
            "similarity_boost": similarity_boost,
            "style": style,
            "use_speaker_boost": use_speaker_boost
        }

        self.base_url = "https://api.elevenlabs.io/v1"

        # Override kwargs to disable transcription if not explicitly requested
        # This prevents the interactive package installation prompt
        if 'transcription_model' not in kwargs:
            kwargs['transcription_model'] = None

        super().__init__(**kwargs)

        # Ensure cache_dir is set
        if not hasattr(self, 'cache_dir') or self.cache_dir is None:
            self.cache_dir = "media/voiceovers"

        print(f"✅ ElevenLabs TTS initialized with voice: {voice_id}")

    def calculate_cost(self, text: str) -> float:
        """
        Calculate the cost of generating TTS for the given text.

        ElevenLabs pricing is character-based:
        - Starter ($5/month): ~30,000 characters/month
        - Creator ($22/month): ~100,000 characters/month
        - Pro ($99/month): ~500,000 characters/month
        - Scale ($330/month): ~2 million characters/month

        For API usage, approximate rates:
        - $0.30 per 1,000 characters (professional models)
        - $0.15 per 1,000 characters (turbo models)

        Args:
            text: Text to be converted to speech

        Returns:
            Estimated cost in USD
        """
        character_count = len(text)

        # Use the professional model rate as it's most commonly used
        # $0.30 per 1,000 characters = $0.0003 per character
        cost_per_character = 0.0003

        total_cost = character_count * cost_per_character

        return total_cost

    def get_data_hash(self, input_data: Dict) -> str:
        """
        Generate hash for caching based on input parameters.
        """
        data_str = json.dumps(input_data, sort_keys=True)
        return hashlib.sha256(data_str.encode('utf-8')).hexdigest()

    def _extract_word_timings(self, characters: List[str],
                            start_times: List[float],
                            end_times: List[float]) -> List[Dict]:
        """
        Convert character-level timing to word-level timing for easier use in Manim.

        Args:
            characters: List of characters from API response
            start_times: Start times for each character
            end_times: End times for each character

        Returns:
            List of word timing dictionaries with 'text', 'start', 'end'
        """
        if not characters or not start_times or not end_times:
            return []

        words = []
        current_word = {
            'text': '',
            'start': start_times[0] if start_times else 0,
            'end': 0,
            'char_start_index': 0,
            'char_end_index': 0
        }

        for i, char in enumerate(characters):
            if char in [' ', '\n', '\t']:
                # End current word if it has content
                if current_word['text'].strip():
                    current_word['end'] = end_times[i-1] if i > 0 else start_times[i]
                    current_word['char_end_index'] = i - 1
                    words.append(current_word.copy())

                # Start new word (skip whitespace)
                next_char_idx = i + 1
                while next_char_idx < len(characters) and characters[next_char_idx] in [' ', '\n', '\t']:
                    next_char_idx += 1

                if next_char_idx < len(characters):
                    current_word = {
                        'text': '',
                        'start': start_times[next_char_idx] if next_char_idx < len(start_times) else 0,
                        'end': 0,
                        'char_start_index': next_char_idx,
                        'char_end_index': next_char_idx
                    }
            else:
                current_word['text'] += char
                current_word['char_end_index'] = i

        # Add the last word if it has content
        if current_word['text'].strip():
            current_word['end'] = end_times[-1] if end_times else 0
            words.append(current_word)

        return words

    def _call_elevenlabs_api(self, text: str) -> Dict:
        """
        Call ElevenLabs API with timing support.

        Args:
            text: Text to convert to speech

        Returns:
            API response with audio and timing data
        """
        url = f"{self.base_url}/text-to-speech/{self.voice_id}/with-timestamps"

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }

        payload = {
            "text": text,
            "model_id": self.model_id,
            "voice_settings": self.voice_settings
        }

        try:
            print(f"🔊 [ElevenLabs] Generating audio for text: {text[:50]}...")
            print(f"🔧 [ElevenLabs] Using voice_id: {self.voice_id}")
            print(f"🔧 [ElevenLabs] Using model: {self.model_id}")

            response = requests.post(url, json=payload, headers=headers, timeout=60)
            print(f"📡 [ElevenLabs] API response status: {response.status_code}")

            response.raise_for_status()

            result = response.json()
            print(f"✅ [ElevenLabs] Audio generated successfully")
            print(f"📊 [ElevenLabs] Response keys: {list(result.keys())}")

            return result

        except requests.exceptions.RequestException as e:
            raise Exception(f"ElevenLabs API error: {e}")

    def generate_from_text(self, text: str, cache_dir: Optional[str] = None,
                          path: Optional[str] = None) -> Dict:
        """
        Generate audio from text with timing information.

        Args:
            text: Text to convert to speech
            cache_dir: Directory for cached audio files
            path: Optional specific path for the audio file

        Returns:
            Dictionary containing audio file info, timing data, and metadata
        """
        if cache_dir is None:
            cache_dir = self.cache_dir

        # Ensure cache directory exists
        Path(cache_dir).mkdir(parents=True, exist_ok=True)

        # Create input data for hashing
        input_data = {
            "input_text": text,
            "service": "elevenlabs_timed",
            "voice_id": self.voice_id,
            "model_id": self.model_id,
            "voice_settings": self.voice_settings
        }

        # Check for cached result (simplified caching)
        hash_key = self.get_data_hash(input_data)
        cached_audio_path = Path(cache_dir) / f"{hash_key}.mp3"

        if cached_audio_path.exists():
            print(f"📋 [ElevenLabs] Using cached audio for: {text[:30]}...")
            print(f"📁 [ElevenLabs] Cache file: {cached_audio_path}")
            # Try to load timing data
            timing_file = cached_audio_path.with_suffix('.timing.json')
            word_timings = []
            character_alignment = {}

            if timing_file.exists():
                try:
                    timing_data = json.loads(timing_file.read_text())
                    word_timings = timing_data.get('word_timings', [])
                    character_alignment = timing_data.get('character_alignment', {})
                except:
                    pass

            # Calculate cost even for cached results (for tracking purposes)
            cached_cost = self.calculate_cost(text)

            return {
                "input_text": text,
                "input_data": input_data,
                "original_audio": cached_audio_path.name,
                "word_timings": word_timings,
                "character_alignment": character_alignment,
                "service": "elevenlabs_timed",
                "cost": cached_cost,
                "character_count": len(text),
                "from_cache": True
            }

        # Generate new audio via API
        print(f"🎯 [ElevenLabs] Generating fresh audio via API...")
        api_response = self._call_elevenlabs_api(text)

        # Check API response structure
        print(f"📋 [ElevenLabs] API response structure: {list(api_response.keys())}")

        # Decode audio from base64
        if 'audio_base64' in api_response:
            audio_bytes = base64.b64decode(api_response['audio_base64'])
            print(f"🎵 [ElevenLabs] Audio decoded, size: {len(audio_bytes)} bytes")
        else:
            print(f"❌ [ElevenLabs] ERROR: No 'audio_base64' in API response!")
            print(f"🔍 [ElevenLabs] Available keys: {api_response.keys()}")
            raise Exception("ElevenLabs API response missing audio data")

        # Determine output path
        if path is None:
            audio_filename = self.get_data_hash(input_data) + ".mp3"
        else:
            audio_filename = path

        audio_path = Path(cache_dir) / Path(audio_filename).name
        print(f"📂 [ElevenLabs] Saving to: {audio_path}")

        # Save audio file
        audio_path.write_bytes(audio_bytes)
        print(f"💾 [ElevenLabs] Audio file saved successfully ({audio_path.stat().st_size} bytes)")

        # Extract timing information
        alignment = api_response.get('alignment', {})
        characters = alignment.get('characters', [])
        char_start_times = alignment.get('character_start_times_seconds', [])
        char_end_times = alignment.get('character_end_times_seconds', [])

        print(f"⏱️  [ElevenLabs] Timing data: {len(characters)} chars, {len(char_start_times)} start times")

        # Convert to word-level timing
        word_timings = self._extract_word_timings(characters, char_start_times, char_end_times)
        print(f"📝 [ElevenLabs] Extracted {len(word_timings)} word timings")

        # Save timing data separately for debugging/analysis
        timing_file = audio_path.with_suffix('.timing.json')
        timing_data = {
            "text": text,
            "word_timings": word_timings,
            "character_alignment": alignment
        }
        timing_file.write_text(json.dumps(timing_data, indent=2))

        print(f"💾 [ElevenLabs] Timing data saved to: {timing_file}")
        print(f"✅ [ElevenLabs] Audio generation complete!")

        # Calculate cost for this generation
        text_cost = self.calculate_cost(text)

        # Return data in expected format
        result = {
            "input_text": text,
            "input_data": input_data,
            "original_audio": str(audio_filename),
            "word_timings": word_timings,
            "character_alignment": alignment,
            "service": "elevenlabs_timed",
            "cost": text_cost,
            "character_count": len(text)
        }

        print(f"💰 [ElevenLabs] Cost: ${text_cost:.4f} ({len(text)} characters)")

        return result

    def get_available_voices(self) -> List[Dict]:
        """
        Get list of available voices from ElevenLabs API.

        Returns:
            List of voice dictionaries with id, name, and other metadata
        """
        url = f"{self.base_url}/voices"
        headers = {"xi-api-key": self.api_key}

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json().get('voices', [])
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Could not fetch voices: {e}")
            return []

    def print_voice_info(self):
        """Print information about the current voice and available alternatives."""
        voices = self.get_available_voices()
        current_voice = next((v for v in voices if v['voice_id'] == self.voice_id), None)

        print(f"\n🎤 Current Voice: {self.voice_id}")
        if current_voice:
            print(f"   Name: {current_voice.get('name', 'Unknown')}")
            print(f"   Description: {current_voice.get('description', 'No description')}")

        print(f"\n📊 Available Voices ({len(voices)} total):")
        for voice in voices[:5]:  # Show first 5
            print(f"   {voice['voice_id']}: {voice.get('name', 'Unnamed')}")

        if len(voices) > 5:
            print(f"   ... and {len(voices) - 5} more")
