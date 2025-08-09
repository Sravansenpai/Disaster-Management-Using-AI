from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os
from speech_to_text import SpeechToText
import uuid
import logging
from flask_cors import CORS
import traceback
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000"]}})

# Configure upload folder
UPLOAD_FOLDER = os.path.abspath('uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize speech-to-text processor
try:
    speech_processor = SpeechToText()
    logger.info("Speech-to-text processor initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize speech processor: {str(e)}")
    logger.error(traceback.format_exc())
    speech_processor = None

@app.route('/api/process-audio', methods=['POST'])
def process_audio():
    try:
        if speech_processor is None:
            return jsonify({
                'success': False,
                'message': 'Speech processor not initialized'
            }), 500

        if 'audio' not in request.files:
            logger.error("No audio file in request")
            return jsonify({
                'success': False,
                'message': 'No audio file provided'
            }), 400

        audio_file = request.files['audio']
        request_type = request.form.get('type', 'medical')

        if audio_file.filename == '':
            logger.error("Empty filename in request")
            return jsonify({
                'success': False,
                'message': 'No selected file'
            }), 400

        # Log file details
        logger.info(f"Received audio file: {audio_file.filename}")
        logger.info(f"Content type: {audio_file.content_type}")
        
        # Generate unique identifier
        file_id = str(uuid.uuid4())
        
        # Create filename with absolute path
        filename = secure_filename(f"{file_id}.webm")
        filepath = os.path.abspath(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        
        # Save the file
        try:
            audio_file.save(filepath)
            file_size = os.path.getsize(filepath)
            logger.info(f"Saved audio file to: {filepath}")
            logger.info(f"File size: {file_size} bytes")
            
            if file_size == 0:
                logger.error("Saved file is empty")
                return jsonify({
                    'success': False,
                    'message': 'Audio file is empty'
                }), 400
                
        except Exception as e:
            logger.error(f"Failed to save audio file: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({
                'success': False,
                'message': 'Failed to save audio file'
            }), 500

        # Process the audio file - just transcribe, don't extract form data
        try:
            # Preprocess and transcribe
            processed_audio = speech_processor.preprocess_audio(filepath)
            
            if processed_audio is None:
                logger.error("Audio preprocessing failed")
                return jsonify({
                    'success': False,
                    'message': 'Failed to preprocess audio. Please ensure ffmpeg is installed.'
                }), 500
                
            # Transcribe with simplified parameters
            segments, info = speech_processor.model.transcribe(
                processed_audio,
                beam_size=5,
                temperature=0.0,
                language="en",
                vad_filter=False,
                initial_prompt="Medical emergency with patient name, condition, and location details."
            )
            
            # Combine segments
            transcription = " ".join([segment.text.strip() for segment in segments])
            logger.info(f"Transcribed text: {transcription}")
            
            # Save transcription to a text file
            transcription_path = os.path.splitext(filepath)[0] + "_transcription.txt"
            with open(transcription_path, "w", encoding="utf-8") as f:
                f.write(transcription)
                
            logger.info(f"Saved transcription to: {transcription_path}")
            
            # Process the transcription separately
            result = process_transcription(transcription)
            
            # Save extracted data
            data_path = os.path.splitext(filepath)[0] + "_form_data.json"
            with open(data_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
                
            logger.info(f"Saved form data to: {data_path}")
            
            # Return success with data
            return jsonify({
                'success': True,
                'message': 'Audio processed successfully',
                'transcription': transcription,
                'form_data': result
            })
            
        except Exception as e:
            logger.error(f"Error during audio processing: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({
                'success': False,
                'message': f'Error processing audio: {str(e)}'
            }), 500

    except Exception as e:
        logger.error(f"Unexpected error in process_audio: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500

def process_transcription(text):
    """Process transcription text and extract information"""
    logger.info(f"Processing transcription: '{text}'")
    
    # Check if the transcription seems valid
    if not text or len(text) < 5:
        logger.warning("Transcription is empty or too short")
        text = "medical emergency"  # Set a default value
        
    # Filter out common unrelated phrases
    unrelated_phrases = [
        "for more un videos", 
        "visit www", 
        "please visit", 
        "for more information", 
        "thank you for watching",
        "please subscribe",
        "click below"
    ]
    
    text_lower = text.lower()
    for phrase in unrelated_phrases:
        if phrase in text_lower:
            logger.warning(f"Found unrelated content: '{phrase}', removing it")
            text_lower = text_lower.replace(phrase, "")
    
    # If after filtering we have very little content, use default
    if len(text_lower.strip()) < 10:
        logger.warning("After filtering, content is too short. Using default.")
        text_lower = "medical emergency"
    
    # Initialize form data with sensible defaults
    form_data = {
        "type": "medical",
        "patientName": "Unknown",  # Default patient name
        "condition": "Medical emergency",  # Default condition
        "location": "Unknown",  # Default location
        "contactNumber": "",
        "urgency": "high",  # Default to high urgency
        "additionalInfo": text  # Keep original text for reference
    }
    
    # Extract locations - look for common Indian cities
    common_cities = ["hyderabad", "delhi", "mumbai", "chennai", "bangalore", "kolkata", 
                    "pune", "ahmedabad", "jaipur", "surat", "lucknow", "kanpur", 
                    "nagpur", "indore", "thane", "bhopal", "visakhapatnam", "patna"]
    
    # Look for specific city names
    for city in common_cities:
        if city in text_lower:
            form_data["location"] = city.title()
            logger.info(f"Found city name: {city}")
            break
            
    # Extract patient name from common Indian names
    common_names = ["raju", "ram", "sita", "priya", "anand", "suresh", "ramesh", "sunita", 
                   "rahul", "amit", "deepak", "sanjay", "vijay", "ajay", "anil", "sunil"]
        
    words = text_lower.split()
    for word in words:
        word = word.strip(".,!?")
        if word in common_names:
            form_data["patientName"] = word.title()
            logger.info(f"Found common name: {word}")
            break
            
    # Check for emergency conditions
    if "head injury" in text_lower or ("head" in text_lower and ("injury" in text_lower or "wound" in text_lower)):
        form_data["condition"] = "Head injury"
        form_data["urgency"] = "high"
    elif "chest pain" in text_lower or "heart" in text_lower:
        form_data["condition"] = "Chest pain"
        form_data["urgency"] = "high"
    elif "fracture" in text_lower or "broken" in text_lower:
        form_data["condition"] = "Fracture"
        form_data["urgency"] = "high"
    elif "bleeding" in text_lower:
        form_data["condition"] = "Bleeding"
        form_data["urgency"] = "high"
    elif "emergency" in text_lower:
        form_data["condition"] = "Medical emergency"
        form_data["urgency"] = "high"
    
    # Create a better additionalInfo that summarizes the situation
    additional_info = f"Medical emergency"
    
    if form_data["condition"] != "Medical emergency":
        additional_info += f" - {form_data['condition']}"
    
    if form_data["location"] != "Unknown":
        additional_info += f" at {form_data['location']}"
    
    if form_data["patientName"] != "Unknown":
        additional_info += f" for patient {form_data['patientName']}"
    
    form_data["additionalInfo"] = additional_info
        
    logger.info(f"Extracted form data: {form_data}")
    return form_data

if __name__ == '__main__':
    # Set the port
    PORT = os.environ.get('PORT', 5000)
    
    # Log server startup information
    logger.info(f"Starting server on port {PORT}")
    logger.info(f"Upload folder: {UPLOAD_FOLDER}")
    logger.info(f"Upload folder exists: {os.path.exists(UPLOAD_FOLDER)}")
    logger.info(f"Upload folder is absolute: {os.path.isabs(UPLOAD_FOLDER)}")
    
    app.run(debug=True, port=PORT) 