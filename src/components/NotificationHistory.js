// Import the API config
import apiConfig from '../config/api.js';
import axios from 'axios';

// Then update your useEffect:
useEffect(() => {
  const fetchNotifications = async () => {
    try {
      console.log(`Fetching notifications from: ${apiConfig.endpoints.notifications}`);
      const response = await axios.get(apiConfig.endpoints.notifications);
      setNotifications(response.data);
    } catch (error) {
      const errorDetails = apiConfig.handleError(error);
      console.error('Error fetching notifications:', errorDetails);
      
      // Set a more descriptive error message based on the error type
      if (errorDetails.type === 'server_error' && errorDetails.status === 500) {
        setError('The server encountered an internal error. Our team has been notified.');
      } else if (errorDetails.type === 'network_error') {
        setError('Unable to connect to the server. Please check your internet connection.');
      } else {
        setError('Failed to load notifications. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  fetchNotifications();
}, []);