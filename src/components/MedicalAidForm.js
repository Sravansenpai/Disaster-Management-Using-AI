import React, { useState } from 'react';
import SpeechRecognition from './SpeechRecognition';
import axios from 'axios';
import Swal from 'sweetalert2';

const MedicalAidForm = () => {
  const [formData, setFormData] = useState({
    patientName: '',
    condition: '',
    location: '',
    contactNumber: '',
    urgency: 'medium',
    additionalInfo: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSpeechTranscript = async (processedData) => {
    try {
      // Send the processed speech data to the backend
      const response = await axios.post('/api/process-speech', {
        text: processedData.originalText,
        type: 'medical',
        summary: processedData.summary
      });

      if (response.data.success) {
        // Update form with extracted information
        setFormData(prev => ({
          ...prev,
          condition: processedData.summary,
          additionalInfo: processedData.originalText,
          urgency: 'high' // Default to high for speech requests
        }));

        Swal.fire({
          title: 'Success!',
          text: 'Your emergency request has been recorded',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      Swal.fire({
        title: 'Error!',
        text: 'Failed to process your speech request',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/medical-aid', formData);
      if (response.data) {
        Swal.fire({
          title: 'Success!',
          text: 'Medical aid request submitted successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
        setFormData({
          patientName: '',
          condition: '',
          location: '',
          contactNumber: '',
          urgency: 'medium',
          additionalInfo: ''
        });
      }
    } catch (error) {
      Swal.fire({
        title: 'Error!',
        text: 'Failed to submit medical aid request',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  };

  return (
    <div className="medical-aid-form">
      <h2>Emergency Medical Aid Request</h2>
      
      {/* Speech Recognition Component */}
      <div className="speech-section">
        <h3>Or Speak Your Emergency</h3>
        <p>Click the microphone button and speak your emergency request</p>
        <SpeechRecognition 
          onTranscriptComplete={handleSpeechTranscript}
          type="medical"
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="patientName">Patient Name</label>
          <input
            type="text"
            id="patientName"
            name="patientName"
            value={formData.patientName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="condition">Medical Condition</label>
          <textarea
            id="condition"
            name="condition"
            value={formData.condition}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="contactNumber">Contact Number</label>
          <input
            type="tel"
            id="contactNumber"
            name="contactNumber"
            value={formData.contactNumber}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="urgency">Urgency Level</label>
          <select
            id="urgency"
            name="urgency"
            value={formData.urgency}
            onChange={handleChange}
            required
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="additionalInfo">Additional Information</label>
          <textarea
            id="additionalInfo"
            name="additionalInfo"
            value={formData.additionalInfo}
            onChange={handleChange}
          />
        </div>

        <button type="submit" className="submit-button">
          Submit Emergency Request
        </button>
      </form>
    </div>
  );
};

export default MedicalAidForm; 