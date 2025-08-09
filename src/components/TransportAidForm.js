import React, { useState } from 'react';
import SpeechRecognition from './SpeechRecognition';
import axios from 'axios';
import Swal from 'sweetalert2';

const TransportAidForm = () => {
  const [formData, setFormData] = useState({
    pickupLocation: '',
    dropoffLocation: '',
    urgency: 'medium',
    description: '',
    status: 'pending'
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
        type: 'transport',
        summary: processedData.summary
      });

      if (response.data.success) {
        // Update form with extracted information
        setFormData(prev => ({
          ...prev,
          description: processedData.originalText,
          urgency: 'high' // Default to high for speech requests
        }));

        Swal.fire({
          title: 'Success!',
          text: 'Your transport request has been recorded',
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
      const response = await axios.post('/api/transport-aid', formData);
      if (response.data) {
        Swal.fire({
          title: 'Success!',
          text: 'Transport aid request submitted successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
        setFormData({
          pickupLocation: '',
          dropoffLocation: '',
          urgency: 'medium',
          description: '',
          status: 'pending'
        });
      }
    } catch (error) {
      Swal.fire({
        title: 'Error!',
        text: 'Failed to submit transport aid request',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  };

  return (
    <div className="transport-aid-form">
      <h2>Emergency Transport Request</h2>
      
      {/* Speech Recognition Component */}
      <div className="speech-section">
        <h3>Or Speak Your Transport Request</h3>
        <p>Click the microphone button and speak your transport request</p>
        <SpeechRecognition 
          onTranscriptComplete={handleSpeechTranscript}
          type="transport"
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="pickupLocation">Pickup Location</label>
          <input
            type="text"
            id="pickupLocation"
            name="pickupLocation"
            value={formData.pickupLocation}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="dropoffLocation">Drop-off Location</label>
          <input
            type="text"
            id="dropoffLocation"
            name="dropoffLocation"
            value={formData.dropoffLocation}
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
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="submit-button">
          Submit Transport Request
        </button>
      </form>
    </div>
  );
};

export default TransportAidForm; 