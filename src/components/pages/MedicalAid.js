import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import emailjs from '@emailjs/browser';
import AudioRecorder from '../AudioRecorder';
import ChatBot from '../ChatBot';

const MedicalAid = () => {
  // Add a ref for the ChatBot
  const chatBotRef = useRef(null);
  
  const [formData, setFormData] = useState({
    patientName: '',
    condition: '',
    location: '',
    contactNumber: '',
    urgency: '',
    additionalInfo: ''
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [requests, setRequests] = useState([]);
  const [submitStatus, setSubmitStatus] = useState({
    message: '',
    isError: false
  });

  // Validation patterns from the original HTML
  const validationPatterns = {
    patientName: /^[a-zA-Z\s]{2,50}$/,
    contactNumber: /^[0-9]{10}$/,
    location: /^[a-zA-Z0-9\s,.-]{5,100}$/
  };

  // Error messages
  const errorMessages = {
    patientName: 'Please enter a valid name (2-50 characters, letters only)',
    contactNumber: 'Please enter a valid 10-digit phone number',
    location: 'Please enter a valid location (5-100 characters)'
  };

  // EmailJS configuration from form-handler.js
  const EMAIL_SERVICE_ID = 'service_deia867';
  const EMAIL_TEMPLATE_ID = 'template_jxkgpxv';
  const EMAIL_PUBLIC_KEY = 'keB2V3N-ZcopiB9Nq';

  // Update API base URL to use port 5001
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  // Define the loadMedicalRequests function with useCallback
  const loadMedicalRequests = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/medical-aid`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        console.error('Failed to fetch medical aid requests');
      }
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  }, [API_BASE_URL]);

  // Initialize EmailJS
  useEffect(() => {
    emailjs.init(EMAIL_PUBLIC_KEY);
  }, [EMAIL_PUBLIC_KEY]);

  // Load existing requests and reset chatbot on page load
  useEffect(() => {
    loadMedicalRequests();
    
    // Reset the chatbot when the page loads
    if (chatBotRef.current) {
      chatBotRef.current.resetChat();
    }
    
    // Also reset session ID to force a new chat session
    localStorage.removeItem('chatbot_session_id');
  }, [loadMedicalRequests]);

  const validateField = (name, value) => {
    if (!validationPatterns[name]) return true;
    
    const isValid = validationPatterns[name].test(value);
    
    if (!isValid && name === 'contactNumber' && value.length > 0) {
      // Show SweetAlert2 notification for phone number
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Phone Number',
        text: 'Please enter a valid 10-digit phone number',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }
    
    return isValid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prevFormData => {
      const updatedFormData = {
        ...prevFormData,
        [name]: value
      };
      
      // Trigger the ChatBot if condition or additionalInfo fields are updated
      // and have sufficient content to analyze
      if ((name === 'condition' || name === 'additionalInfo') && 
          value.length > 10 && 
          document.querySelector('.chatbot-container')) {
        // Find and click the ChatBot toggle if it's closed
        const chatToggle = document.querySelector('.chat-toggle');
        if (chatToggle && !document.querySelector('.chat-window.open')) {
          chatToggle.click();
        }
      }
      
      return updatedFormData;
    });
    
    // Validate on input change
    const isValid = validateField(name, value);
    setFormErrors({
      ...formErrors,
      [name]: isValid ? '' : errorMessages[name]
    });
  };

  // Add a useEffect to monitor significant form changes that should update the chatbot
  useEffect(() => {
    // Check if we have meaningful data to trigger the chatbot
    const hasMeaningfulData = 
      (formData.condition && formData.condition.length > 0) || 
      (formData.additionalInfo && formData.additionalInfo.length > 10);
    
    // If we have meaningful data and the chatbot is already open, it will automatically update
    // due to the formData prop being passed to the ChatBot component
    
    console.log('Form data updated that ChatBot can use:', 
      hasMeaningfulData ? formData : 'Not enough meaningful data yet');
    
  }, [formData.condition, formData.additionalInfo, formData]);

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;
    
    // Check required fields and validate patterns
    Object.keys(formData).forEach(field => {
      if (field === 'additionalInfo') return; // This field is optional
      
      // Check if field is empty
      if (!formData[field]) {
        newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
        isValid = false;
      } 
      // Validate against patterns
      else if (validationPatterns[field] && !validateField(field, formData[field])) {
        newErrors[field] = errorMessages[field];
        isValid = false;
      }
    });
    
    setFormErrors(newErrors);
    return isValid;
  };

  // Function to send email notification
  const sendEmailNotification = async (data) => {
    try {
      const templateParams = {
        patientName: data.patientName,
        condition: data.condition,
        location: data.location,
        contactNumber: data.contactNumber,
        urgency: data.urgency,
        additionalInfo: data.additionalInfo || 'None',
        submissionTime: new Date().toLocaleString('en-US', { 
          dateStyle: 'full', 
          timeStyle: 'long',
          hour12: true
        })
      };

      console.log('Sending email notification with params:', templateParams);

      const response = await emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        templateParams
      );

      console.log('Email notification sent:', response);
      return true;
    } catch (error) {
      console.error('Email notification error:', error);
      return false;
    }
  };

  // Function to send SMS notification using backend API
  const sendSmsNotification = async (data) => {
    try {
      let phoneNumber = data.contactNumber;
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+91' + phoneNumber.replace(/\D/g, '');
      }
      
      const smsData = {
        to: phoneNumber,
        body: `Hello ${data.patientName}, your medical aid request for ${data.condition} has been received. We understand this is a ${data.urgency} situation at ${data.location}. Our medical team has been notified and will reach out to you shortly. If your condition worsens, please call our emergency hotline at 108. Stay safe and know that help is on the way.`
      };

      console.log('Sending SMS notification with data:', smsData);

      const response = await fetch(`${API_BASE_URL}/api/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(smsData)
      });

      const result = await response.json();
      console.log('SMS notification result:', result);
      return response.ok;
    } catch (error) {
      console.error('SMS notification error:', error);
      return false;
    }
  };

  const handleFormDataReady = (formData) => {
    // Update form with extracted information
    setFormData(prev => ({
      ...prev,
      condition: formData.condition || '',
      location: formData.location || '',
      additionalInfo: formData.additionalInfo || '',
      urgency: formData.urgency || 'high'
    }));

    Swal.fire({
      title: 'Success!',
      text: 'Your emergency request has been recorded',
      icon: 'success',
      confirmButtonText: 'OK'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      Swal.fire({
        icon: 'error',
        title: 'Form Error',
        text: 'Please correct the highlighted fields before submitting',
        confirmButtonColor: '#dc3545'
      });
      return;
    }
    
    try {
      // Create a copy of the form data for submission
      const formDataToSubmit = { ...formData };
      
      // Map 'critical' urgency to 'high' for the backend since the schema only accepts 'low', 'medium', and 'high'
      if (formDataToSubmit.urgency === 'critical') {
        formDataToSubmit.urgency = 'high';
      }
      
      console.log('Submitting form data:', formDataToSubmit);
      
      const response = await fetch(`${API_BASE_URL}/api/medical-aid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formDataToSubmit)
      });
      
      const result = await response.json();
      console.log('Submission result:', result);
      
      if (response.ok) {
        // Send notifications after successful form submission
        const emailSent = await sendEmailNotification(formDataToSubmit);
        const smsSent = await sendSmsNotification(formDataToSubmit);
        
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Medical aid request submitted successfully!' + 
                (emailSent ? ' Confirmation email sent.' : '') + 
                (smsSent ? ' SMS confirmation sent.' : ''),
          confirmButtonColor: '#28a745'
        });
        
        setSubmitStatus({
          message: 'Medical aid request submitted successfully!',
          isError: false
        });
        
        // Create a comprehensive summary for the ChatBot
        const medicalSummary = createMedicalSummary(formDataToSubmit);
        
        // Trigger the ChatBot to provide advice with the summary
        if (chatBotRef.current) {
          chatBotRef.current.triggerAdvice({
            ...formDataToSubmit,
            // Add the comprehensive summary
            additionalInfo: medicalSummary
          });
        }
        
        // Store response data
        const responseData = result;

        // Reload the requests list
        loadMedicalRequests();

        // Show success message with option to view map
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Medical aid request submitted successfully',
          confirmButtonText: 'OK',
          showCancelButton: true,
          cancelButtonText: 'View Map',
          cancelButtonColor: '#3085d6'
        }).then((swalResult) => {
          if (!swalResult.isConfirmed) {
            // If user clicked "View Map", open in new tab instead of navigating
            const mapUrl = `${window.location.origin}/aid-map/medical/${responseData.data._id}`;
            window.open(mapUrl, '_blank');
          }
        });
        
        // Reset form AFTER triggering the ChatBot
        setFormData({
          patientName: '',
          condition: '',
          location: '',
          contactNumber: '',
          urgency: '',
          additionalInfo: ''
        });
      } else {
        throw new Error(result.message || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Submission error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Submission Error',
        text: 'There was an error saving your request. Please try again.',
        confirmButtonColor: '#dc3545'
      });
      
      setSubmitStatus({
        message: `Error: ${error.message || 'Network error'}`,
        isError: true
      });
    }
  };

  // Helper function to create a comprehensive medical summary
  const createMedicalSummary = (data) => {
    const urgencyLevel = {
      'critical': 'CRITICAL - Immediate assistance needed',
      'high': 'HIGH - Requires attention within hours',
      'medium': 'MEDIUM - Needs attention today',
      'low': 'LOW - Can wait 24+ hours'
    };
    
    return `
Medical Emergency Report:
Patient: ${data.patientName || 'Unknown'}
Condition: ${data.condition || 'Unspecified medical condition'}
Location: ${data.location || 'Unknown location'}
Urgency: ${urgencyLevel[data.urgency] || data.urgency || 'Unknown'}
Contact: ${data.contactNumber || 'No contact provided'}

Additional Details:
${data.additionalInfo || 'No additional information provided.'}

Medical services have been notified and help is on the way. Please provide appropriate first aid advice, medication recommendations, and information on when to seek immediate emergency care.
`.trim();
  };

  return (
    <div>
      <section className="information">
        <h2>Medical Aid Services</h2>
        <p>
          Our Medical Aid services connect those in need with medical professionals, 
          resources, and facilities during emergency situations. Through our platform, 
          you can request medical assistance, find nearby medical centers, and access 
          critical medical information.
        </p>
      </section>

      {submitStatus.message && (
        <div className={`status-message ${submitStatus.isError ? 'error' : 'success'}`}>
          {submitStatus.message}
        </div>
      )}

      <div className="form-container">
        <h3>Request Medical Assistance</h3>
        
        {/* Speech Recognition Component */}
        <div className="speech-section">
          <h4>Quickly Report an Emergency</h4>
          <p>Click the microphone button and speak your emergency request</p>
          <AudioRecorder 
            onFormDataReady={handleFormDataReady}
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
              className={formErrors.patientName ? 'invalid-input' : ''}
              required 
            />
            {formErrors.patientName && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.patientName}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="condition">Medical Condition</label>
            <select 
              id="condition" 
              name="condition" 
              value={formData.condition}
              onChange={handleChange}
              className={formErrors.condition ? 'invalid-input' : ''}
              required
            >
              <option value="">Select Condition Type</option>
              <option value="injury">Injury</option>
              <option value="illness">Illness</option>
              <option value="medication">Medication Needed</option>
              <option value="other">Other</option>
            </select>
            {formErrors.condition && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.condition}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="location">Current Location</label>
            <input 
              type="text" 
              id="location" 
              name="location" 
              value={formData.location}
              onChange={handleChange}
              className={formErrors.location ? 'invalid-input' : ''}
              required 
            />
            {formErrors.location && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.location}</div>
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
              <option value="critical">Critical - Immediate assistance needed</option>
              <option value="high">High - Requires attention within hours</option>
              <option value="medium">Medium - Needs attention today</option>
              <option value="low">Low - Can wait 24+ hours</option>
            </select>
            {formErrors.urgency && (
              <div className="error-message" style={{display: 'block'}}>{formErrors.urgency}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="additionalInfo">Additional Information</label>
            <textarea 
              id="additionalInfo" 
              name="additionalInfo" 
              rows="4" 
              value={formData.additionalInfo}
              onChange={handleChange}
            ></textarea>
          </div>
          
          <button type="submit" className="button">Submit Request</button>
        </form>
      </div>

      <section className="card">
        <h2>Active Medical Aid Requests</h2>
        <div id="medicalRequestsList" className="grid-container">
          {requests.map(request => (
            <div key={request._id} className="request-card">
              <h3>Patient: {request.patientName}</h3>
              <p><strong>Condition:</strong> {request.condition}</p>
              <p><strong>Location:</strong> {request.location}</p>
              <p><strong>Contact:</strong> {request.contactNumber}</p>
              <p><strong>Urgency:</strong> {request.urgency}</p>
              <p><strong>Additional Info:</strong> {request.additionalInfo || 'None'}</p>
              <p><strong>Submitted:</strong> {new Date(request.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {requests.length === 0 && <p>No active medical aid requests.</p>}
        </div>
      </section>
      
      {/* Dr. Chopper ChatBot - now with ref */}
      <ChatBot ref={chatBotRef} formData={null} />
    </div>
  );
};

export default MedicalAid; 