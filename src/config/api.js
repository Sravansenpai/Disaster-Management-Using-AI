// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Helper function to handle API errors
const handleApiError = (error) => {
  if (error.response) {
    console.error('API Error Response:', error.response.status, error.response.data);
    return {
      type: 'server_error',
      status: error.response.status,
      message: error.response.data?.message || 'Server error occurred'
    };
  } else if (error.request) {
    console.error('API No Response:', error.request);
    return {
      type: 'network_error',
      message: 'No response received from server. Please check your connection.'
    };
  } else {
    console.error('API Request Error:', error.message);
    return {
      type: 'request_error',
      message: 'Error setting up request: ' + error.message
    };
  }
};

export default {
  baseUrl: API_BASE_URL,
  endpoints: {
    volunteers: `${API_BASE_URL}/api/volunteers`,
    notifications: `${API_BASE_URL}/api/notifications`,
    medicalAid: `${API_BASE_URL}/api/medical-aid`,
    emergencies: `${API_BASE_URL}/api/emergencies`,
    resources: `${API_BASE_URL}/api/resources`,
    users: `${API_BASE_URL}/api/users`,
    auth: `${API_BASE_URL}/api/auth`
  },
  handleError: handleApiError
};