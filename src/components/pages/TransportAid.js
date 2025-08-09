import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import emailjs from '@emailjs/browser';
import AudioRecorder from '../AudioRecorder';
import { useNavigate } from 'react-router-dom';

const TransportAid = () => {
  const [formData, setFormData] = useState({
    requestType: '',
    requestorName: '',
    pickupLocation: '',
    dropoffLocation: '',
    contactNumber: '',
    numPassengers: 1,
    urgency: '',
    specialRequirements: ''
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [requests, setRequests] = useState([]);
  const [submitStatus, setSubmitStatus] = useState({
    message: '',
    isError: false
  });

  const navigate = useNavigate();

  // Validation patterns from the original HTML
  const validationPatterns = {
    requestorName: /^[a-zA-Z\s]{2,50}$/,
    pickupLocation: /^[a-zA-Z0-9\s,.-]{5,100}$/,
    dropoffLocation: /^[a-zA-Z0-9\s,.-]{5,100}$/,
    contactNumber: /^[0-9]{10}$/,
    numPassengers: /^[1-9][0-9]*$/
  };

  // Error messages
  const errorMessages = {
    requestorName: 'Please enter a valid name (2-50 characters)',
    pickupLocation: 'Please enter a valid pickup location (5-100 characters)',
    dropoffLocation: 'Please enter a valid drop location (5-100 characters)',
    contactNumber: 'Please enter a valid 10-digit phone number',
    numPassengers: 'Please enter a valid number of people'
  };

  // EmailJS configuration from form-handler.js
  const EMAIL_SERVICE_ID = 'service_deia867';
  const EMAIL_TEMPLATE_ID = 'template_z8y807j';
  const EMAIL_PUBLIC_KEY = 'keB2V3N-ZcopiB9Nq';

  // Update API base URL to use port 5001
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  // Define the loadTransportRequests function with useCallback
  const loadTransportRequests = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/transport-aid`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        console.error('Failed to fetch transport aid requests');
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  }, [API_BASE_URL]);

  // Initialize EmailJS
  useEffect(() => {
    emailjs.init(EMAIL_PUBLIC_KEY);
  }, [EMAIL_PUBLIC_KEY]);

  // Load existing requests
  useEffect(() => {
    loadTransportRequests();
  }, [loadTransportRequests]);

  // Function to validate a specific field
  const validateField = (field, value) => {
    if (!validationPatterns[field]) return true;
    return validationPatterns[field].test(value);
  };

  // Function to handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };

  // Function to send email notification using EmailJS
  const sendEmailNotification = async (data) => {
    try {
      const templateParams = {
        requestType: data.requestType,
        pickupLocation: data.pickupLocation,
        dropLocation: data.dropoffLocation,
        numberOfPeople: data.numPassengers,
        urgency: data.urgency,
        additionalInfo: data.specialRequirements || 'None',
        submissionTime: new Date().toLocaleString('en-US', { 
          dateStyle: 'full', 
          timeStyle: 'long',
          hour12: true
        })
      };

      console.log('Sending transport email notification with params:', templateParams);

      const response = await emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        templateParams
      );

      console.log('Transport email notification sent:', response);
      return true;
    } catch (error) {
      console.error('Transport email notification error:', error);
      return false;
    }
  };

  const handleFormDataReady = (formData) => {
    // Update form with extracted information
    setFormData(prev => ({
      ...prev,
      pickupLocation: formData.pickupLocation || '',
      dropoffLocation: formData.dropoffLocation || '',
      description: formData.description || '',
      urgency: formData.urgency || 'high'
    }));

    Swal.fire({
      title: 'Success!',
      text: 'Your transport request has been recorded',
      icon: 'success',
      confirmButtonText: 'OK'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous status messages
    setSubmitStatus({
      message: '',
      isError: false
    });
    
    // Check for errors before submitting
    let hasErrors = false;
    const newErrors = {};
    
    // Check required fields and validate patterns
    Object.keys(formData).forEach(field => {
      if (field === 'specialRequirements') return; // This field is optional
      
      // Check if field is empty
      if (!formData[field]) {
        newErrors[field] = `${field} is required`;
        hasErrors = true;
        return;
      }
      
      // Check if field has a validation pattern
      if (validationPatterns[field] && !validateField(field, formData[field])) {
        newErrors[field] = errorMessages[field];
        hasErrors = true;
      }
    });
    
    if (hasErrors) {
      setFormErrors(newErrors);
      return;
    }
    
    setFormErrors({});
    
    try {
      // Prepare form data to match server's expected fields
      const requestData = {
        requestorName: formData.requestorName,
        pickupLocation: formData.pickupLocation,
        dropoffLocation: formData.dropoffLocation,
        contactNumber: formData.contactNumber,
        numPassengers: formData.numPassengers,
        urgency: formData.urgency,
        specialRequirements: formData.specialRequirements || '',
        requestType: formData.requestType
      };
      
      console.log('Submitting transport aid request:', requestData);
      
      // Send form data to server
      const response = await fetch(`${API_BASE_URL}/api/transport-aid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error submitting form:', errorData);
        Swal.fire({
          icon: 'error',
          title: 'Submission Error',
          text: errorData.message || 'Failed to submit transport request'
        });
        return;
      }
      
      const result = await response.json();
      const responseData = result;
      
      // Reload transport requests
      loadTransportRequests();
      
      // Show success message with View Map button
      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Transport request submitted successfully',
        showCancelButton: true,
        confirmButtonText: 'OK',
        cancelButtonText: 'View Map',
        cancelButtonColor: '#3085d6'
      }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
          // Navigate to map view
          navigate(`/aid-map/transport/${responseData.data._id}`);
        }
      });
      
      // Reset form after successful submission
      setFormData({
        requestType: '',
        requestorName: '',
        pickupLocation: '',
        dropoffLocation: '',
        contactNumber: '',
        numPassengers: 1,
        urgency: '',
        specialRequirements: ''
      });
      
      // Send confirmation SMS
      if (formData.contactNumber) {
        const phoneNumber = formData.contactNumber;
        const data = formData;
        
        const smsData = {
          to: phoneNumber,
          body: `Hello, your ${data.requestType} request has been confirmed. We've received your request for transportation from ${data.pickupLocation} to ${data.dropoffLocation} with ${data.urgency} urgency. Our transport team is coordinating resources and will contact you shortly with details. For ${data.numPassengers} people as requested. If your situation changes, please call our helpline at 108. Help is on the way.`
        };
        
        try {
          const smsResponse = await fetch(`${API_BASE_URL}/api/send-sms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(smsData)
          });
          
          const smsResult = await smsResponse.json();
          console.log('SMS result:', smsResult);
        } catch (smsError) {
          console.error('Error sending confirmation SMS:', smsError);
        }
      }
      
      // Send email notification
      try {
        const emailResult = await sendEmailNotification(formData);
        console.log('Email notification result:', emailResult);
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
      }
      
      // Update status message
      setSubmitStatus({
        message: 'Transport request submitted successfully',
        isError: false
      });
      
    } catch (error) {
      console.error('Error:', error);
      // Set error status message
      setSubmitStatus({
        message: `Error: ${error.message || 'Unknown error occurred'}`,
        isError: true
      });
      
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An error occurred while submitting your request.'
      });
    }
  };

  return (
    <div>
      <section className="information">
        <h2>Transport Aid Services</h2>
        <p>
          Our Transport Aid platform connects people in need of evacuation or emergency 
          transportation with available vehicles and volunteer drivers. We help coordinate 
          evacuation efforts and ensure that transportation resources are distributed efficiently 
          during disaster situations.
        </p>
      </section>

      {submitStatus.message && (
        <div className={`status-message ${submitStatus.isError ? 'error' : 'success'}`} 
             style={{ 
               marginTop: '15px',
               padding: '10px 15px',
               borderRadius: '4px',
               backgroundColor: submitStatus.isError ? '#f8d7da' : '#d4edda',
               color: submitStatus.isError ? '#721c24' : '#155724',
               border: `1px solid ${submitStatus.isError ? '#f5c6cb' : '#c3e6cb'}`,
               marginBottom: '20px'
             }}>
          {submitStatus.message}
        </div>
      )}

      <div className="form-container">
        <h3>Request Transportation Assistance</h3>
        
        {/* Speech Recognition Component */}
        <div className="speech-section">
          <h4>Quickly Report a Transport Emergency</h4>
          <p>Click the microphone button and speak your transport request</p>
          <AudioRecorder 
            onFormDataReady={handleFormDataReady}
            type="transport"
          />
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="requestType">Request Type</label>
            <select 
              id="requestType" 
              name="requestType" 
              value={formData.requestType}
              onChange={handleChange}
              className={formErrors.requestType ? 'invalid-input' : ''}
              required
            >
              <option value="">Select Request Type</option>
              <option value="evacuation">Evacuation</option>
              <option value="medical-transport">Medical Transport</option>
              <option value="supply-delivery">Supply Delivery</option>
              <option value="other">Other</option>
            </select>
            {formErrors.requestType && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.requestType}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="requestorName">Requestor Name</label>
            <input 
              type="text" 
              id="requestorName" 
              name="requestorName" 
              value={formData.requestorName}
              onChange={handleChange}
              className={formErrors.requestorName ? 'invalid-input' : ''}
              required 
            />
            {formErrors.requestorName && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.requestorName}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="pickupLocation">Pickup Location</label>
            <input 
              type="text" 
              id="pickupLocation" 
              name="pickupLocation" 
              value={formData.pickupLocation}
              onChange={handleChange}
              className={formErrors.pickupLocation ? 'invalid-input' : ''}
              required 
            />
            {formErrors.pickupLocation && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.pickupLocation}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="dropoffLocation">Destination</label>
            <input 
              type="text" 
              id="dropoffLocation" 
              name="dropoffLocation" 
              value={formData.dropoffLocation}
              onChange={handleChange}
              className={formErrors.dropoffLocation ? 'invalid-input' : ''}
              required 
            />
            {formErrors.dropoffLocation && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.dropoffLocation}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="contactNumber">Contact Number</label>
            <input 
              type="tel" 
              id="contactNumber" 
              name="contactNumber" 
              value={formData.contactNumber}
              onChange={handleChange}
              className={formErrors.contactNumber ? 'invalid-input' : ''}
              required 
            />
            {formErrors.contactNumber && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.contactNumber}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="numPassengers">Number of Passengers</label>
            <input 
              type="number" 
              id="numPassengers" 
              name="numPassengers" 
              min="1" 
              value={formData.numPassengers}
              onChange={handleChange}
              className={formErrors.numPassengers ? 'invalid-input' : ''}
              required 
            />
            {formErrors.numPassengers && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.numPassengers}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="urgency">Urgency Level</label>
            <select 
              id="urgency" 
              name="urgency" 
              value={formData.urgency}
              onChange={handleChange}
              className={formErrors.urgency ? 'invalid-input' : ''}
              required
            >
              <option value="">Select Urgency Level</option>
              <option value="critical">Critical - Immediate evacuation needed</option>
              <option value="high">High - Requires transportation within hours</option>
              <option value="medium">Medium - Needs transportation today</option>
              <option value="low">Low - Can wait 24+ hours</option>
            </select>
            {formErrors.urgency && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.urgency}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="specialRequirements">Special Requirements</label>
            <textarea 
              id="specialRequirements" 
              name="specialRequirements" 
              rows="3"
              value={formData.specialRequirements}
              onChange={handleChange}
              placeholder="Medical equipment, wheelchair access, etc."
            ></textarea>
          </div>
          
          <button type="submit" className="button">Submit Request</button>
        </form>
      </div>

      <section className="card">
        <h2>Active Transport Aid Requests</h2>
        <div id="transportRequestsList" className="grid-container">
          {requests.map(request => (
            <div key={request._id} className="request-card">
              <h3>Transport Request: {request.requestType}</h3>
              <p><strong>From:</strong> {request.pickupLocation}</p>
              <p><strong>To:</strong> {request.dropoffLocation}</p>
              <p><strong>Contact:</strong> {request.contactNumber}</p>
              <p><strong>People:</strong> {request.numPassengers}</p>
              <p><strong>Urgency:</strong> {request.urgency}</p>
              <p><strong>Additional Info:</strong> {request.specialRequirements || 'None'}</p>
              <p><strong>Submitted:</strong> {new Date(request.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {requests.length === 0 && <p>No active transport aid requests.</p>}
        </div>
      </section>
    </div>
  );
};

export default TransportAid; 