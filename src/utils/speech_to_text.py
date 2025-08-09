from faster_whisper import WhisperModel
import os
import json
import re

class SpeechToText:
    def __init__(self):
        self.model_size = "large-v3"
        # Initialize model based on available hardware
        if os.environ.get('USE_GPU', 'false').lower() == 'true':
            self.model = WhisperModel(self.model_size, device="cuda", compute_type="float16")
        else:
            self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8")

    def transcribe_audio(self, audio_path):
        """
        Transcribe audio file and return the text
        """
        try:
            segments, info = self.model.transcribe(audio_path, beam_size=5)
            
            # Combine all segments into one text
            full_text = " ".join([segment.text for segment in segments])
            
            # Save transcription to a text file
            output_path = os.path.splitext(audio_path)[0] + "_transcription.txt"
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(full_text)
            
            # Extract form data based on content
            form_data = self._extract_form_data(full_text)
            
            # Save form data to JSON file
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
            print(f"Error in transcription: {str(e)}")
            return None

    def _extract_form_data(self, text):
        """
        Extract relevant information for form filling based on text content
        """
        text_lower = text.lower()
        
        # Default form data structure
        form_data = {
            "type": "medical",  # default to medical, can be changed based on content
            "patientName": "",
            "condition": "",
            "location": "",
            "contactNumber": "",
            "urgency": "medium",
            "additionalInfo": text
        }

        # Check if it's a transport request
        transport_keywords = ["transport", "pickup", "dropoff", "vehicle", "car", "ambulance", "pick up", "drop off"]
        if any(keyword in text_lower for keyword in transport_keywords):
            form_data = {
                "type": "transport",
                "requestorName": "",
                "pickupLocation": "",
                "dropoffLocation": "",
                "contactNumber": "",
                "urgency": "medium",
                "description": text
            }
            
            # Extract pickup location
            pickup_patterns = [
                r"(?:pickup|pick up|from)\s+(?:at|in|near|location|address)?\s*:?\s*([A-Za-z\s]+?)(?:[\.,]|to|$)",
                r"(?:pickup|pick up)\s+([A-Za-z\s]+?)(?:[\.,]|to|$)"
            ]
            for pattern in pickup_patterns:
                match = re.search(pattern, text_lower)
                if match:
                    form_data["pickupLocation"] = match.group(1).strip()
                    break

            # Extract dropoff location
            dropoff_patterns = [
                r"(?:dropoff|drop off|to)\s+(?:at|in|near|location|address)?\s*:?\s*([A-Za-z\s]+?)(?:[\.,]|$)",
                r"(?:dropoff|drop off)\s+([A-Za-z\s]+?)(?:[\.,]|$)"
            ]
            for pattern in dropoff_patterns:
                match = re.search(pattern, text_lower)
                if match:
                    form_data["dropoffLocation"] = match.group(1).strip()
                    break

        # For medical requests, extract patient name
        if form_data["type"] == "medical":
            name_patterns = [
                r"patient\s+name\s+([A-Za-z]+?)(?:[\.,]|$)",
                r"name\s+is\s+([A-Za-z]+?)(?:[\.,]|$)",
                r"name\s*:\s*([A-Za-z]+?)(?:[\.,]|$)"
            ]
            for pattern in name_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    form_data["patientName"] = match.group(1).strip()
                    break
        else:
            # For transport requests, extract requestor name
            name_patterns = [
                r"(?:requestor|requester|my)\s+name\s+(?:is\s+)?([A-Za-z]+?)(?:[\.,]|$)",
                r"name\s+(?:is\s+)?([A-Za-z]+?)(?:[\.,]|$)"
            ]
            for pattern in name_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    form_data["requestorName"] = match.group(1).strip()
                    break

        # Extract contact number for both types
        contact_patterns = [
            r"contact\s+(?:number|no|#)?\s*:?\s*(\d+?)(?:[\.,]|$)",
            r"phone\s+(?:number|no|#)?\s*:?\s*(\d+?)(?:[\.,]|$)",
            r"(?:number|no|#)\s*:?\s*(\d+?)(?:[\.,]|$)"
        ]
        for pattern in contact_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                form_data["contactNumber"] = match.group(1).strip()
                break

        # Extract urgency level for both types
        if "critical" in text_lower:
            form_data["urgency"] = "high"
        elif "emergency" in text_lower or "urgent" in text_lower:
            form_data["urgency"] = "high"
        elif "24 hours" in text_lower or "24hrs" in text_lower:
            form_data["urgency"] = "medium"
        
        # Extract condition for medical requests
        if form_data["type"] == "medical":
            if "emergency" in text_lower:
                form_data["condition"] = "Medical Emergency"
                if "critical" in text_lower:
                    form_data["condition"] = "Critical Medical Emergency"

            # Extract location if mentioned for medical requests
            location_patterns = [
                r"(?:at|in|near|location|address)\s+([A-Za-z\s]+?)(?:[\.,]|$)",
                r"([A-Za-z\s]+?)(?:[\.,]\s*(?:contact|number|emergency|critical|$))"
            ]
            for pattern in location_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    location = match.group(1).strip()
                    if location.lower() not in ["contact", "number", "emergency", "critical"]:
                        form_data["location"] = location
                        break

            # Create a comprehensive additionalInfo
            details = []
            if form_data["patientName"]:
                details.append(f"Patient: {form_data['patientName']}")
            if form_data["condition"]:
                details.append(form_data["condition"])
            if form_data["location"]:
                details.append(f"Location: {form_data['location']}")
            if form_data["urgency"] == "high":
                details.append("Urgency: Critical/High")
            elif form_data["urgency"] == "medium":
                details.append("Urgency: Medium (24 hours)")
            
            form_data["additionalInfo"] = " - ".join(details) if details else text

        return form_data 