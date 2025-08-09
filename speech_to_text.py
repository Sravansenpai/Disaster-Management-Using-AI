from faster_whisper import WhisperModel
import os
import json
import logging
import numpy as np
from scipy.io import wavfile
import soundfile as sf
import pickle
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SpeechToText:
    _instance = None
    _model_instance = None
    _model_cache_file = "model_cache.pkl"
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SpeechToText, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._model_instance is None:
            # Use the largest available model for better accuracy
            self.model_size = "large-v2"
            self.language = "en"  # Default to English
            self.compute_type = "float16" if os.environ.get('USE_GPU', 'false').lower() == 'true' else "int8"
            self.device = "cuda" if os.environ.get('USE_GPU', 'false').lower() == 'true' else "cpu"
            
            # Create models directory if it doesn't exist
            models_dir = os.path.join(os.path.dirname(__file__), "models")
            os.makedirs(models_dir, exist_ok=True)
            
            logger.info(f"Initializing Whisper model: {self.model_size} on {self.device}")
            try:
                # Try to load from cache first
                self._model_instance = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type,
                    download_root=models_dir,
                    local_files_only=True  # Try to use cached model first
                )
                logger.info("Successfully loaded cached model")
            except Exception as e:
                logger.info("Cached model not found, downloading...")
                # If cached model not found, download it
                self._model_instance = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type,
                    download_root=models_dir
                )
                logger.info("Successfully downloaded and initialized model")
        
        # Use the cached model instance
        self.model = self._model_instance
        logger.info("Using cached model instance")

    def preprocess_audio(self, audio_path):
        """Preprocess audio file to improve recognition quality"""
        try:
            # Convert to absolute path and normalize separators
            audio_path = os.path.abspath(audio_path)
            audio_path = os.path.normpath(audio_path)
            
            logger.info(f"Processing audio file: {audio_path}")
            
            # Verify file exists and has content
            if not os.path.exists(audio_path):
                logger.error(f"Audio file not found: {audio_path}")
                logger.error(f"Current working directory: {os.getcwd()}")
                logger.error(f"Directory contents: {os.listdir(os.path.dirname(audio_path))}")
                return None
                
            if os.path.getsize(audio_path) == 0:
                logger.error(f"Audio file is empty: {audio_path}")
                return None

            # Convert webm to wav if needed
            if audio_path.endswith('.webm'):
                import subprocess
                import shutil
                
                # Check if ffmpeg is installed
                if not shutil.which('ffmpeg'):
                    logger.error("ffmpeg is not installed or not in PATH")
                    logger.error("Please install ffmpeg using: choco install ffmpeg")
                    return None
                
                wav_path = os.path.splitext(audio_path)[0] + '.wav'
                wav_path = os.path.normpath(wav_path)
                try:
                    logger.info(f"Converting webm to wav using ffmpeg...")
                    logger.info(f"Input file: {audio_path}")
                    logger.info(f"Output file: {wav_path}")
                    
                    # Use ffmpeg to convert webm to wav
                    result = subprocess.run([
                        'ffmpeg', '-i', audio_path,
                        '-acodec', 'pcm_s16le',
                        '-ar', '16000',
                        '-ac', '1',
                        wav_path
                    ], check=True, capture_output=True, text=True)
                    logger.info(f"Converted webm to wav: {wav_path}")
                    audio_path = wav_path
                except subprocess.CalledProcessError as e:
                    logger.error(f"Failed to convert webm to wav: {e.stderr}")
                    logger.error(f"ffmpeg command failed with return code: {e.returncode}")
                    return None
                except Exception as e:
                    logger.error(f"Unexpected error during webm conversion: {str(e)}")
                    return None

            # Read audio file
            try:
                if audio_path.endswith('.wav'):
                    sample_rate, audio_data = wavfile.read(audio_path)
                    logger.info(f"Read WAV file: sample_rate={sample_rate}, shape={audio_data.shape}")
                else:
                    audio_data, sample_rate = sf.read(audio_path)
                    logger.info(f"Read audio file: sample_rate={sample_rate}, shape={audio_data.shape}")
            except Exception as e:
                logger.error(f"Failed to read audio file: {str(e)}")
                return None
            
            # Convert to mono if stereo
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)
                logger.info(f"Converted to mono: shape={audio_data.shape}")
            
            # Normalize audio
            max_val = np.max(np.abs(audio_data))
            if max_val > 0:
                audio_data = audio_data / max_val
                logger.info("Audio normalized")
            else:
                logger.warning("Audio has zero amplitude")
            
            # Save processed audio
            processed_path = os.path.splitext(audio_path)[0] + "_processed.wav"
            try:
                wavfile.write(processed_path, sample_rate, audio_data)
                logger.info(f"Saved processed audio to: {processed_path}")
            except Exception as e:
                logger.error(f"Failed to save processed audio: {str(e)}")
                return None
            
            return processed_path
        except Exception as e:
            logger.error(f"Error preprocessing audio: {str(e)}")
            logger.error(f"Audio file path: {audio_path}")
            if os.path.exists(audio_path):
                logger.error(f"Audio file size: {os.path.getsize(audio_path)} bytes")
            return None

    def transcribe_audio(self, audio_path):
        try:
            # Preprocess audio
            processed_audio = self.preprocess_audio(audio_path)
            
            if processed_audio is None:
                logger.error("Audio preprocessing failed")
                return None
            
            # Transcription parameters for better accuracy
            segments, info = self.model.transcribe(
                processed_audio,
                beam_size=5,  # Reduced beam size for faster processing
                best_of=1,    # Reduced candidates for faster processing
                temperature=0.0,  # Deterministic output
                language=self.language,  # Force English
                vad_filter=False,  # Disable VAD to prevent removing all audio
                initial_prompt="Medical or transport emergency with patient name, condition, and location details. Expecting city names and medical terms."  # More specific prompt
            )
            
            # Combine segments with proper spacing
            full_text = " ".join([segment.text.strip() for segment in segments])
            
            # Log the transcription for debugging
            logger.info(f"Transcribed text: {full_text}")
            logger.info(f"Language detected: {info.language} (probability: {info.language_probability})")
            
            if not full_text.strip():
                logger.warning("No text was transcribed from the audio")
                return None
            
            # Save transcription
            output_path = os.path.splitext(audio_path)[0] + "_transcription.txt"
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(full_text)
            
            # Extract form data
            form_data = self._extract_form_data(full_text)
            
            # Save form data
            json_path = os.path.splitext(audio_path)[0] + "_form_data.json"
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(form_data, f, indent=2)
            
            return {
                "text": full_text,
                "language": info.language,
                "language_probability": info.language_probability,
                "form_data": form_data
            }
        except Exception as e:
            logger.error(f"Error in transcription: {str(e)}")
            logger.error(f"Audio file path: {audio_path}")
            logger.error(f"Audio file exists: {os.path.exists(audio_path)}")
            if os.path.exists(audio_path):
                logger.error(f"Audio file size: {os.path.getsize(audio_path)} bytes")
            return None

    def _extract_form_data(self, text):
        """Enhanced form data extraction with better pattern matching for medical emergencies"""
        text = text.lower()
        
        # Log the raw text for debugging
        logger.info(f"Extracting form data from: '{text}'")
        
        form_data = {
            "type": "medical",
            "patientName": "",
            "condition": "",
            "location": "",
            "contactNumber": "",
            "urgency": "medium",
            "additionalInfo": text
        }

        # Extract locations - look for city names with "at" or "in" before them
        location_patterns = [
            r"(?:at|in)\s+([a-zA-Z]+)",  # matches "at cityname" or "in cityname"
            r"(?:location|address|area|place)(?:\s+is)?\s+([a-zA-Z]+)",  # matches "location cityname"
            r"([a-zA-Z]+)(?:\s+area|location|city)",  # matches "cityname area"
        ]
        
        for pattern in location_patterns:
            matches = re.findall(pattern, text)
            if matches:
                # Take the longest match as it's likely to be more specific
                matches.sort(key=len, reverse=True)
                for match in matches:
                    # Skip common words that might be matched incorrectly
                    if match not in ["the", "a", "an", "with", "and", "or", "for", "is", "at", "in"]:
                        form_data["location"] = match
                        logger.info(f"Found location: {match}")
                        break
                break
        
        # Special case for "Hyderabad" and other common Indian cities
        common_cities = ["hyderabad", "delhi", "mumbai", "chennai", "bangalore", "kolkata", 
                        "pune", "ahmedabad", "jaipur", "surat", "lucknow", "kanpur", 
                        "nagpur", "indore", "thane", "bhopal", "visakhapatnam", "patna"]
        
        for city in common_cities:
            if city in text:
                form_data["location"] = city
                logger.info(f"Found city name: {city}")
                break

        # Extract patient name - look specifically for "name" followed by a word
        name_patterns = [
            r"(?:patient|person)?\s*name\s+(?:is\s+)?([a-zA-Z]+)",  # "patient name is john" or "name john"
            r"(?:patient|person|victim)?\s+(?:called|named)\s+([a-zA-Z]+)",  # "patient called john"
            r"name\s+([a-zA-Z]+)",  # simple "name john"
        ]
        
        for pattern in name_patterns:
            matches = re.findall(pattern, text)
            if matches:
                for match in matches:
                    # Skip common words that might be matched incorrectly
                    if match not in ["the", "a", "an", "with", "and", "or", "for", "is", "at", "in"]:
                        form_data["patientName"] = match.title()  # Capitalize
                        logger.info(f"Found patient name: {match}")
                        break
                break
                
        # If name not found by patterns, try common Indian names
        if not form_data["patientName"]:
            common_names = ["raju", "ram", "sita", "priya", "anand", "suresh", "ramesh", "sunita", 
                           "rahul", "amit", "deepak", "sanjay", "vijay", "ajay", "anil", "sunil"]
            
            words = text.split()
            for word in words:
                word = word.lower()
                if word in common_names:
                    form_data["patientName"] = word.title()
                    logger.info(f"Found common name: {word}")
                    break

        # Special case for head injury
        if "head injury" in text or ("head" in text and any(word in text for word in ["injury", "wound", "trauma", "hurt", "pain", "hit"])):
            form_data["condition"] = "head injury"
            form_data["urgency"] = "high"
            logger.info("Found head injury condition")
            
        # Extract medical condition with more specificity if not already set
        if not form_data["condition"]:
            condition_patterns = {
                "head injury": ["head injury", "head trauma", "head wound", "head", "hit head", "headache"],
                "chest pain": ["chest pain", "heart attack", "chest injury", "chest", "heart", "cardiac"],
                "broken limb": ["broken", "fracture", "sprain", "dislocation", "cut", "wound", "arm", "leg"],
                "bleeding": ["bleeding", "blood", "hemorrhage"],
                "burn": ["burn", "fire", "hot"],
                "unconscious": ["unconscious", "fainted", "passed out", "not responding"],
                "breathing problem": ["breathing", "breath", "asthma", "suffocating", "choking"],
                "allergic reaction": ["allergic", "allergy", "allergies"],
                "medical emergency": ["emergency", "urgent", "critical", "help"]
            }

        # Find specific conditions
        for condition, keywords in condition_patterns.items():
            if any(keyword in text for keyword in keywords):
                form_data["condition"] = condition
                logger.info(f"Found condition: {condition}")
                # Set urgency for serious conditions
                if condition in ["head injury", "chest pain", "unconscious", "breathing problem", "allergic reaction"]:
                    form_data["urgency"] = "high"
                break

        # Extract additional medical information
        medical_info = []
        if "accident" in text:
            medical_info.append("Accident case")
        if "bleeding" in text:
            medical_info.append("Bleeding present")
        if "unconscious" in text:
            medical_info.append("Patient unconscious")
        if "breathing" in text and "problem" in text:
            medical_info.append("Breathing difficulties")
            
        if medical_info:
            form_data["additionalInfo"] = ", ".join(medical_info)
        
        # Log the extracted information
        logger.info(f"Extracted form data: {form_data}")

        return form_data 