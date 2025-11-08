Choosing a speech service
Manim Voiceover defines the SpeechService class for adding new speech synthesizers. The classes introduced below are all derived from SpeechService.

Comparison of available speech services
Speech service

Quality

Can run offline?

Paid / requires an account?

Notes

RecorderService

N/A

N/A

N/A

This is a utility class to record your own voiceovers with a microphone.

AzureService

Very good, human-like

No

Yes

Azure gives 500min/month free TTS quota. However, registration still needs a credit or debit card. See Azure free account FAQ for more details.

ElevenLabsService

Very good, human-like

No

Yes

Requires ElevenLabs account. Click here to sign up.

CoquiService

Good, human-like

Yes

No

Requires PyTorch to run. May be difficult to set up on certain platforms.

GTTSService

Good

No

No

It’s a free API subsidized by Google, so there is a likelihood it may stop working in the future.

OpenAIService

Very good, human-like

No

Yes

Requires OpenAI developer account. See platform to sign up, and the pricing page for more details.

PyTTSX3Service

Bad

Yes

No

Requires espeak. Does not work reliably on Mac.

It is on our roadmap to provide a high quality TTS engine that runs locally for free. If you have any suggestions, please let us know in the Discord server.

RecorderService
This is not a speech synthesizer but a utility class to record your own voiceovers with a microphone. It provides a command line interface to record voiceovers during rendering.

Install Manim Voiceover with the recorder extra in order to use RecorderService:

pip install "manim-voiceover[recorder]"
Refer to the example usage to get started.

AzureService
As of now, the highest quality text-to-speech service available in Manim Voiceover is Microsoft Azure Speech Service. To use it, you will need to create an Azure account.

Tip

Azure currently offers free TTS of 500 minutes/month. This is more than enough for most projects.

Install Manim Voiceover with the azure extra in order to use AzureService:

pip install "manim-voiceover[azure]"
Then, you need to find out your subscription key and service region:

Sign in to Azure portal and create a new Speech Service resource.

Go to the Azure Cognitive Services page.

Click on the resource you created and go to the Keys and Endpoint tab. Copy the Key 1 and Location values.

Create a file called .env that contains your authentication information in the same directory where you call Manim.

AZURE_SUBSCRIPTION_KEY="..." # insert Key 1 here
AZURE_SERVICE_REGION="..."   # insert Location here
Check out Azure docs for more details.

Refer to the example usage to get started.

CoquiService
Coqui TTS is an open source neural text-to-speech engine. It is a fork of Mozilla TTS, which is an implementation of Tacotron 2. It is a very good TTS engine that produces human-like speech. However, it requires PyTorch to run, which may be difficult to set up on certain platforms.

Install Manim Voiceover with the coqui extra in order to use CoquiService:

pip install "manim-voiceover[coqui]"
If you run into issues with PyTorch or NumPy, try changing your Python version to 3.9.

Refer to the example usage to get started.

GTTSService
gTTS is a text-to-speech library that wraps Google Translate’s text-to-speech API. It needs an internet connection to work.

Install Manim Voiceover with the gtts extra in order to use GTTSService:

pip install "manim-voiceover[gtts]"
Refer to the example usage to get started.

OpenAIService
OpenAI provides a text-to-speech service. It is through an API, so it requires an internet connection to work. It also requires an API key to use. Register for one here.

Install Manim Voiceover with the openai extra in order to use OpenAIService:

pip install "manim-voiceover[openai]"
Then, you need to find out your api key:

Sign in to OpenAI platform and click into Api Keys from the left panel.

Click create a new secret key and copy it.

Create a file called .env that contains your authentication information in the same directory where you call Manim.

OPENAI_API_KEY="..." # insert the secret key here. It should start with "sk-"
Check out OpenAI docs for more details.

Refer to the example usage to get started.

PyTTSX3Service
pyttsx3 is a text-to-speech library that wraps espeak, a formant synthesis speech synthesizer.

Install Manim Voiceover with the pyttsx3 extra in order to use PyTTSX3Service:

pip install "manim-voiceover[pyttsx3]"
Refer to the example usage to get started.

ElevenLabsService
ElevenLabs offers one of the most natural sounding speech service APIs. It has a range of realistic and emotive voices, and also allows you to clone your own voice by uploading a few minutes of your speech. To use it, you will need to create an account at Eleven Labs.

Tip

ElevenLabs currently offers free TTS of 10,000 characters/month and up to 3 custom voices.

Install Manim Voiceover with the elevenlabs extra in order to use ElevenLabsService:

pip install "manim-voiceover[elevenlabs]"
Then, you need to find out your API key.

Sign in to ElevenLabs portal and go to your profile to obtain the key

Set the environment variable ELEVEN_API_KEY to your key

Create a file called .env that contains your authentication information in the same directory where you call Manim.

ELEVEN_API_KEY="..." # insert Key 1 here
Check out ElevenLabs docs for more details.

Refer to the example usage to get started.


API Reference
This reference manual details modules, functions, and variables included in Manim Voiceover, describing what they are and what they do. For learning how to use Manim Voiceover, see Quickstart.

Voiceover scene
class VoiceoverScene(renderer=None, camera_class=<class 'manim.camera.camera.Camera'>, always_update_mobjects=False, random_seed=None, skip_animations=False)[source]
Bases: Scene

A scene class that can be used to add voiceover to a scene.

add_voiceover_text(text, subcaption=None, max_subcaption_len=70, subcaption_buff=0.1, **kwargs)[source]
Adds voiceover to the scene.

Parameters:
text (str) – The text to be spoken.

subcaption (Optional[str], optional) – Alternative subcaption text. If not specified, text is chosen as the subcaption. Defaults to None.

max_subcaption_len (int, optional) – Maximum number of characters for a subcaption. Subcaptions that are longer are split into chunks that are smaller than max_subcaption_len. Defaults to 70.

subcaption_buff (float, optional) – The duration between split subcaption chunks in seconds. Defaults to 0.1.

Returns:
The tracker object for the voiceover.

Return type:
VoiceoverTracker

add_wrapped_subcaption(subcaption, duration, subcaption_buff=0.1, max_subcaption_len=70)[source]
Adds a subcaption to the scene. If the subcaption is longer than max_subcaption_len, it is split into chunks that are smaller than max_subcaption_len.

Parameters:
subcaption (str) – The subcaption text.

duration (float) – The duration of the subcaption in seconds.

max_subcaption_len (int, optional) – Maximum number of characters for a subcaption. Subcaptions that are longer are split into chunks that are smaller than max_subcaption_len. Defaults to 70.

subcaption_buff (float, optional) – The duration between split subcaption chunks in seconds. Defaults to 0.1.

Return type:
None

safe_wait(duration)[source]
Waits for a given duration. If the duration is less than one frame, it waits for one frame.

Parameters:
duration (float) – The duration to wait for in seconds.

Return type:
None

set_speech_service(speech_service, create_subcaption=True)[source]
Sets the speech service to be used for the voiceover. This method should be called before adding any voiceover to the scene.

Parameters:
speech_service (SpeechService) – The speech service to be used.

create_subcaption (bool, optional) – Whether to create subcaptions for the scene. Defaults to True. If config.save_last_frame is True, the argument is

created. (ignored and no subcaptions will be) –

Return type:
None

voiceover(text=None, ssml=None, **kwargs)[source]
The main function to be used for adding voiceover to a scene.

Parameters:
text (str, optional) – The text to be spoken. Defaults to None.

ssml (str, optional) – The SSML to be spoken. Defaults to None.

Yields:
Generator[VoiceoverTracker, None, None] – The voiceover tracker object.

Return type:
Generator[VoiceoverTracker, None, None]

wait_for_voiceover()[source]
Waits for the voiceover to finish.

Return type:
None

wait_until_bookmark(mark)[source]
Waits until a bookmark is reached.

Parameters:
mark (str) – The mark attribute of the bookmark to wait for.

Return type:
None

class VoiceoverTracker(scene, data, cache_dir)[source]
Bases: object

Class to track the progress of a voiceover in a scene.

Initializes a VoiceoverTracker object.

Parameters:
scene (Scene) – The scene to which the voiceover belongs.

path (str) – The path to the JSON file containing the voiceover data.

data (dict) –

cache_dir (str) –

get_remaining_duration(buff=0.0)[source]
Returns the remaining duration of the voiceover.

Parameters:
buff (float, optional) – A buffer to add to the remaining duration. Defaults to 0.

Returns:
The remaining duration of the voiceover in seconds.

Return type:
int

time_until_bookmark(mark, buff=0, limit=None)[source]
Returns the time until a bookmark.

Parameters:
mark (str) – The mark attribute of the bookmark to count up to.

buff (int, optional) – A buffer to add to the remaining duration, in seconds. Defaults to 0.

limit (Optional[int], optional) – A maximum value to return. Defaults to None.

Return type:
int

Speech services
class SpeechService(global_speed=1.0, cache_dir=None, transcription_model=None, transcription_kwargs={}, **kwargs)[source]
Bases: ABC

Abstract base class for a speech service.

Parameters:
global_speed (float, optional) – The speed at which to play the audio. Defaults to 1.00.

cache_dir (str, optional) – The directory to save the audio files to. Defaults to voiceovers/.

transcription_model (str, optional) – The OpenAI Whisper model to use for transcription. Defaults to None.

transcription_kwargs (dict, optional) – Keyword arguments to pass to the transcribe() function. Defaults to {}.

audio_callback(audio_path, data, **kwargs)[source]
Callback function for when the audio file is ready. Override this method to do something with the audio file, e.g. noise reduction.

Parameters:
audio_path (str) – The path to the audio file.

data (dict) – The data dictionary.

abstract generate_from_text(text, cache_dir=None, path=None)[source]
Implement this method for each speech service. Refer to AzureService for an example.

Parameters:
text (str) – The text to synthesize speech from.

cache_dir (str, optional) – The output directory to save the audio file and data to. Defaults to None.

path (str, optional) – The path to save the audio file to. Defaults to None.

Returns:
Output data dictionary. TODO: Define the format.

Return type:
dict

set_transcription(model=None, kwargs={})[source]
Set the transcription model and keyword arguments to be passed to the transcribe() function.

Parameters:
model (str, optional) – The Whisper model to use for transcription. Defaults to None.

kwargs (dict, optional) – Keyword arguments to pass to the transcribe() function. Defaults to {}.

class RecorderService(format=None, channels=1, rate=44100, chunk=512, device_index=None, transcription_model='base', trim_silence_threshold=-40.0, trim_buffer_start=200, trim_buffer_end=200, callback_delay=0.05, **kwargs)[source]
Bases: SpeechService

Speech service that records from a microphone during rendering.

Initialize the speech service.

Parameters:
format (int, optional) – Format of the audio. Defaults to pyaudio.paInt16.

channels (int, optional) – Number of channels. Defaults to 1.

rate (int, optional) – Sampling rate. Defaults to 44100.

chunk (int, optional) – Chunk size. Defaults to 512.

device_index (int, optional) – Device index, if you don’t want to choose it every time you render. Defaults to None.

transcription_model (str, optional) –

The OpenAI Whisper model to use for transcription. Defaults to “base”.

trim_silence_threshold (float, optional) – Threshold for trimming silence in decibels. Defaults to -40.0 dB.

trim_buffer_start (int, optional) – Buffer duration for trimming silence at the start. Defaults to 200 ms.

trim_buffer_end (int, optional) – Buffer duration for trimming silence at the end. Defaults to 200 ms.

callback_delay (float) –

class AzureService(voice='en-US-AriaNeural', style=None, output_format='Audio48Khz192KBitRateMonoMp3', prosody=None, **kwargs)[source]
Bases: SpeechService

Speech service for Azure TTS API.

Parameters:
voice (str, optional) – The voice to use. See the API page for all the available options. Defaults to en-US-AriaNeural.

style (str, optional) – The style to use. See the API page to see how you can see available styles for a given voice. Defaults to None.

output_format (str, optional) – The output format to use. See the API page for all the available options. Defaults to Audio48Khz192KBitRateMonoMp3.

prosody (dict, optional) – Global prosody settings to use. See the API page for all the available options. Defaults to None.

class CoquiService(model_name='tts_models/en/ljspeech/tacotron2-DDC', config_path=None, vocoder_path=None, vocoder_config_path=None, progress_bar=True, gpu=False, speaker_idx=0, language_idx=0, **kwargs)[source]
Bases: SpeechService

Speech service for Coqui TTS. Default model: tts_models/en/ljspeech/tacotron2-DDC.

Parameters:
global_speed (float, optional) – The speed at which to play the audio. Defaults to 1.00.

cache_dir (str, optional) – The directory to save the audio files to. Defaults to voiceovers/.

transcription_model (str, optional) –

The OpenAI Whisper model to use for transcription. Defaults to None.

transcription_kwargs (dict, optional) – Keyword arguments to pass to the transcribe() function. Defaults to {}.

model_name (str) –

config_path (str) –

vocoder_path (str) –

vocoder_config_path (str) –

progress_bar (bool) –

generate_from_text(text, cache_dir=None, path=None, **kwargs)[source]
Implement this method for each speech service. Refer to AzureService for an example.

Parameters:
text (str) – The text to synthesize speech from.

cache_dir (str, optional) – The output directory to save the audio file and data to. Defaults to None.

path (str, optional) – The path to save the audio file to. Defaults to None.

Returns:
Output data dictionary. TODO: Define the format.

Return type:
dict

class GTTSService(lang='en', tld='com', **kwargs)[source]
Bases: SpeechService

SpeechService class for Google Translate’s Text-to-Speech API. This is a wrapper for the gTTS library. See the gTTS documentation for more information.

Parameters:
lang (str, optional) – Language to use for the speech. See Google Translate docs for all the available options. Defaults to “en”.

tld (str, optional) – Top level domain of the Google Translate URL. Defaults to “com”.

class OpenAIService(voice='alloy', model='tts-1-hd', transcription_model='base', **kwargs)[source]
Bases: SpeechService

Speech service class for OpenAI TTS Service. See the OpenAI API page for more information about voices and models.

Parameters:
voice (str, optional) – The voice to use. See the API page for all the available options. Defaults to "alloy".

model (str, optional) – The TTS model to use. See the API page for all the available options. Defaults to "tts-1-hd".

class PyTTSX3Service(engine=None, **kwargs)[source]
Bases: SpeechService

Speech service class for pyttsx3.

Defaults
DEEPL_SOURCE_LANG = {'bg': 'Bulgarian', 'cs': 'Czech', 'da': 'Danish', 'de': 'German', 'el': 'Greek', 'en': 'English', 'es': 'Spanish', 'et': 'Estonian', 'fi': 'Finnish', 'fr': 'French', 'hu': 'Hungarian', 'id': 'Indonesian', 'it': 'Italian', 'ja': 'Japanese', 'lt': 'Lithuanian', 'lv': 'Latvian', 'nl': 'Dutch', 'pl': 'Polish', 'pt': 'Portuguese (all Portuguese varieties mixed)', 'ro': 'Romanian', 'ru': 'Russian', 'sk': 'Slovak', 'sl': 'Slovenian', 'sv': 'Swedish', 'tr': 'Turkish', 'uk': 'Ukrainian', 'zh': 'Chinese'}
Available source languages for DeepL

DEEPL_TARGET_LANG = {'bg': 'Bulgarian', 'cs': 'Czech', 'da': 'Danish', 'de': 'German', 'el': 'Greek', 'en': 'Alias for en-us', 'en-gb': 'English (British)', 'en-us': 'English (American)', 'es': 'Spanish', 'et': 'Estonian', 'fi': 'Finnish', 'fr': 'French', 'hu': 'Hungarian', 'id': 'Indonesian', 'it': 'Italian', 'ja': 'Japanese', 'lt': 'Lithuanian', 'lv': 'Latvian', 'nl': 'Dutch', 'pl': 'Polish', 'pt': 'Alias for pt-pt', 'pt-br': 'Portuguese (Brazilian)', 'pt-pt': 'Portuguese (all Portuguese varieties excluding Brazilian Portuguese)', 'ro': 'Romanian', 'ru': 'Russian', 'sk': 'Slovak', 'sl': 'Slovenian', 'sv': 'Swedish', 'tr': 'Turkish', 'uk': 'Ukrainian', 'zh': 'Chinese (simplified)'}
Available target languages for DeepL
