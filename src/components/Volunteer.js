// At the top of your file, import the API config
import apiConfig from '../config/api.js';

// Then in your fetchVolunteers function, replace the hardcoded URL:
const fetchVolunteers = async () => {
  setLoading(true);
  try {
    console.log(`Fetching volunteers from: ${apiConfig.endpoints.volunteers}`);
    const response = await fetch(apiConfig.endpoints.volunteers);
    // ... rest of the function
  } catch (error) {
    // ... error handling
  }
};

// Similarly, update your handleSubmit function:
const handleSubmit = async (e) => {
  e.preventDefault();
  // ... existing validation code ...
  
  try {
    console.log('Submitting volunteer data: ', volunteerData);
    const response = await fetch(apiConfig.endpoints.volunteers, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(volunteerData),
    });
    // ... rest of the function
  } catch (error) {
    // ... error handling
  }
};