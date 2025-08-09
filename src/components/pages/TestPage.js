import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TestPage = () => {
  const [apiStatus, setApiStatus] = useState('Checking...');
  const [googleMapsStatus, setGoogleMapsStatus] = useState('Checking...');
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // SMS Testing states
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState(null);

  useEffect(() => {
    const checkServices = async () => {
      try {
        // Check API status
        const apiResponse = await axios.get('/api/test');
        setApiStatus(apiResponse.data.message || 'OK');

        // Check Google Maps API
        setGoogleMapsStatus(process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? 'API Key found' : 'API Key missing');

        // Check Volunteers endpoint
        const volunteersResponse = await axios.get('/api/volunteers');
        setVolunteers(volunteersResponse.data || []);
        
        setLoading(false);
      } catch (err) {
        console.error('Error checking services:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    checkServices();
  }, []);

  const handleSendSMS = async (e) => {
    e.preventDefault();
    
    if (!smsPhone || !smsMessage) {
      setSmsResult({
        success: false,
        message: 'Phone number and message are required'
      });
      return;
    }
    
    try {
      setSmsSending(true);
      setSmsResult(null);
      
      const response = await axios.post('/api/send-sms', {
        to: smsPhone,
        body: smsMessage
      });
      
      setSmsResult({
        success: true,
        message: response.data.message || 'SMS sent successfully'
      });
    } catch (error) {
      setSmsResult({
        success: false,
        message: error.response?.data?.message || error.message
      });
    } finally {
      setSmsSending(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>System Status</h1>
      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h2>API Server</h2>
        <p>Status: <span style={{ fontWeight: 'bold', color: apiStatus === 'Checking...' ? 'orange' : 'green' }}>{apiStatus}</span></p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Google Maps API</h2>
        <p>Status: <span style={{ fontWeight: 'bold', color: googleMapsStatus.includes('found') ? 'green' : 'red' }}>{googleMapsStatus}</span></p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Volunteers ({volunteers.length})</h2>
        {loading ? (
          <p>Loading volunteers...</p>
        ) : volunteers.length === 0 ? (
          <p>No volunteers found in the database.</p>
        ) : (
          <ul>
            {volunteers.map(volunteer => (
              <li key={volunteer._id} style={{ marginBottom: '10px' }}>
                <strong>{volunteer.name}</strong> - {volunteer.phone}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div style={{ marginBottom: '20px', maxWidth: '500px' }}>
        <h2>SMS Testing</h2>
        <form onSubmit={handleSendSMS}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Phone Number (with country code):
            </label>
            <input
              type="text"
              value={smsPhone}
              onChange={(e) => setSmsPhone(e.target.value)}
              placeholder="+917894561230"
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Message:
            </label>
            <textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              placeholder="Enter your message here"
              style={{ width: '100%', padding: '8px', minHeight: '100px' }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={smsSending}
            style={{
              padding: '10px 15px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: smsSending ? 'not-allowed' : 'pointer'
            }}
          >
            {smsSending ? 'Sending...' : 'Send SMS'}
          </button>
        </form>
        
        {smsResult && (
          <div 
            style={{ 
              marginTop: '15px', 
              padding: '10px', 
              backgroundColor: smsResult.success ? '#DFF2BF' : '#FFBABA',
              color: smsResult.success ? '#4F8A10' : '#D8000C',
              borderRadius: '4px'
            }}
          >
            {smsResult.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestPage; 