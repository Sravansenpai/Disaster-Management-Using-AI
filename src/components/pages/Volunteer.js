import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import './Volunteer.css';

const Volunteer = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    primaryLocation: '',
    additionalLocation: '',
    skillset: [],
    availability: true
  });
  
  const [errors, setErrors] = useState({});
  const [volunteers, setVolunteers] = useState([]);
  const [submitStatus, setSubmitStatus] = useState({
    message: '',
    isError: false
  });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [map, setMap] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const mapContainerStyle = {
    width: '100%',
    height: '400px'
  };

  // Available skillsets
  const availableSkillsets = [
    { id: 'medical', label: 'Medical' },
    { id: 'logistics', label: 'Logistics' },
    { id: 'search_rescue', label: 'Search & Rescue' },
    { id: 'communication', label: 'Communication' },
    { id: 'technical', label: 'Technical Support' }
  ];

  // Validation patterns
  const validationPatterns = {
    name: /^[a-zA-Z\s]{2,50}$/,
    email: /^$|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    phone: /^\+?[\d\s-]{10,}$/,
    location: /^[a-zA-Z0-9\s,.-]{5,100}$/
  };

  // Error messages
  const errorMessages = {
    name: 'Name should be 2-50 characters long and contain only letters and spaces',
    email: 'Please enter a valid email address or leave blank',
    phone: 'Please enter a valid phone number',
    location: 'Please enter a valid location'
  };

  // Get API base URL from environment variables
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  // Load volunteers with location-based filtering
  const loadVolunteers = useCallback(async (location = null) => {
    try {
      // Use '/api/volunteers' (plural) for GET requests
      let url = `${API_BASE_URL}/api/volunteers`;
      if (location) {
        url += `?lat=${location.lat}&lng=${location.lng}&radius=10`; // 10km radius
      }
      
      console.log('Fetching volunteers from:', url);
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Volunteers loaded:', data);
        setVolunteers(data);
      } else {
        console.error('Failed to fetch volunteers', await response.text());
        setVolunteers([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error loading volunteers:', error);
      setVolunteers([]); // Set empty array on error
    }
  }, [API_BASE_URL]);

  // Load existing volunteers
  useEffect(() => {
    loadVolunteers();
  }, [loadVolunteers]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    validateField(name, type === 'checkbox' ? checked : value);
  };

  const handleSkillsetChange = (skill) => {
    setFormData(prev => ({
      ...prev,
      skillset: prev.skillset.includes(skill)
        ? prev.skillset.filter(s => s !== skill)
        : [...prev.skillset, skill]
    }));
  };

  const validateField = (name, value) => {
    if (validationPatterns[name] && !validationPatterns[name].test(value)) {
      setErrors(prev => ({
        ...prev,
        [name]: errorMessages[name]
      }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleMapClick = (event) => {
    const location = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    setSelectedLocation(location);
    
    // We'll keep the primary location field as a readable location name
    // The coordinates will be stored separately
    // Don't update the primaryLocation field with coordinates
  };

  const handleGeocode = async (address) => {
    if (!address) return;
    
    try {
      // Use the Google Maps Geocoding API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        setSelectedLocation({ lat, lng });
        
        // If the map is loaded, center it on the new location
        if (map) {
          map.panTo({ lat, lng });
        }
        
        setShowMap(true);
      } else {
        console.error('Geocoding failed:', data.status);
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    Object.keys(formData).forEach(field => {
      validateField(field, formData[field]);
    });

    if (Object.keys(errors).length > 0) {
      return;
    }

    // Prepare the volunteer data with updated location structure
    const volunteerData = {
      ...formData,
      locationText: {
        name: formData.primaryLocation,
        address: formData.primaryLocation
      }
    };
    
    // Only add GeoJSON location if we have valid coordinates
    if (selectedLocation && 
        typeof selectedLocation.lat === 'number' && 
        typeof selectedLocation.lng === 'number') {
      volunteerData._tmpLat = selectedLocation.lat;
      volunteerData._tmpLng = selectedLocation.lng;
    }
    
    console.log('Submitting volunteer data:', volunteerData);

    try {
      // Use '/api/volunteers' (plural) for POST requests
      const response = await fetch(`${API_BASE_URL}/api/volunteers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(volunteerData)
      });

      // Get detailed error information
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', response.status, errorText);
        throw new Error(`Failed to register volunteer: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Registration successful:', result);
      
      setSubmitStatus({
        message: 'Volunteer registration successful!',
        isError: false
      });
      
      setFormData({
        name: '',
        email: '',
        phone: '',
        primaryLocation: '',
        additionalLocation: '',
        skillset: [],
        availability: true
      });
      
      setSelectedLocation(null);
      setShowMap(false);
      loadVolunteers();
      
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Volunteer registration completed successfully',
        confirmButtonText: 'OK'
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      setSubmitStatus({
        message: `Error registering volunteer: ${error.message}`,
        isError: true
      });
      
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to register volunteer: ${error.message}`,
        confirmButtonText: 'OK'
      });
    }
  };

  // Function to view volunteer location
  const viewVolunteerLocation = useCallback((volunteer) => {
    if (map && volunteer.location) {
      map.panTo(volunteer.location);
      map.setZoom(15);
    }
  }, [map]);

  return (
    <div className="volunteer-container">
      <h2>Volunteer Registration</h2>
      
      <form onSubmit={handleSubmit} className="volunteer-form">
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className={errors.email ? 'error' : ''}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className={errors.phone ? 'error' : ''}
          />
          {errors.phone && <span className="error-message">{errors.phone}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="primaryLocation">Primary Location*</label>
          <div className="input-with-button">
            <input
              type="text"
              className={`form-control ${errors.primaryLocation ? 'is-invalid' : ''}`}
              id="primaryLocation"
              name="primaryLocation"
              value={formData.primaryLocation}
              onChange={handleInputChange}
              required
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => handleGeocode(formData.primaryLocation)}
              disabled={!formData.primaryLocation}
            >
              Locate on Map
            </button>
          </div>
          {errors.primaryLocation && <div className="invalid-feedback">{errors.primaryLocation}</div>}
        </div>

        {/* Map Display */}
        {showMap && (
          <div className="form-group map-container">
            <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "AIzaSyCp3IVyfauYmVIP8vZbCgpWlC-jHzka01U"}>
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={selectedLocation || { lat: 20.5937, lng: 78.9629 }} // Default to India center
                zoom={selectedLocation ? 12 : 5}
                onClick={handleMapClick}
                onLoad={map => setMap(map)}
                options={{
                  gestureHandling: 'cooperative',
                  disableDefaultUI: true,
                  zoomControl: true,
                  mapTypeControl: false,
                  streetViewControl: false,
                  fullscreenControl: false
                }}
              >
                {selectedLocation && (
                  <Marker position={selectedLocation} />
                )}
              </GoogleMap>
            </LoadScript>
            <small className="form-text text-muted">
              Click on the map to set your precise location, or adjust the marker.
            </small>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="additionalLocation">Additional Location (Optional)</label>
          <input
            type="text"
            id="additionalLocation"
            name="additionalLocation"
            value={formData.additionalLocation}
            onChange={handleInputChange}
            className={errors.additionalLocation ? 'error' : ''}
          />
          {errors.additionalLocation && (
            <span className="error-message">{errors.additionalLocation}</span>
          )}
        </div>

        <div className="form-group">
          <label>Skillset</label>
          <div className="skillset-grid">
            {availableSkillsets.map(skill => (
              <label key={skill.id} className="skillset-checkbox">
                <input
                  type="checkbox"
                  checked={formData.skillset.includes(skill.id)}
                  onChange={() => handleSkillsetChange(skill.id)}
                />
                {skill.label}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="skillset-checkbox">
            <input
              type="checkbox"
              name="availability"
              checked={formData.availability}
              onChange={handleInputChange}
            />
            Available for immediate response
          </label>
        </div>

        <button type="submit" className="submit-button">
          Register as Volunteer
        </button>
      </form>

      {submitStatus.message && (
        <div className={`submit-status ${submitStatus.isError ? 'error' : 'success'}`}>
          {submitStatus.message}
        </div>
      )}

      <div className="volunteers-list">
        <h3>Active Volunteers</h3>
        <div className="volunteers-grid">
          {volunteers.length > 0 ? (
            volunteers.map(volunteer => (
              <div key={volunteer._id} className="volunteer-card">
                <div className="volunteer-header">
                  <h4>{volunteer.name}</h4>
                  <span className={`availability-badge ${volunteer.availability ? 'available' : 'unavailable'}`}>
                    {volunteer.availability ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                <div className="volunteer-details">
                  <div className="detail-item">
                    <i className="fas fa-phone"></i>
                    <span>{volunteer.phone}</span>
                  </div>
                  <div className="detail-item">
                    <i className="fas fa-map-marker-alt"></i>
                    <span>{volunteer.primaryLocation}</span>
                  </div>
                  {volunteer.additionalLocation && (
                    <div className="detail-item">
                      <i className="fas fa-map-marker-alt"></i>
                      <span>{volunteer.additionalLocation}</span>
                    </div>
                  )}
                  <div className="skills-container">
                    <h5>Skills</h5>
                    <div className="skills-tags">
                      {volunteer.skillset.map(skill => (
                        <span key={skill} className="skill-tag">
                          {availableSkillsets.find(s => s.id === skill)?.label || skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="volunteer-actions">
                    <a href={`tel:${volunteer.phone}`} className="contact-button">
                      <i className="fas fa-phone"></i>
                      Contact
                    </a>
                    <button 
                      className="view-location-button" 
                      onClick={() => viewVolunteerLocation(volunteer)}
                    >
                      <i className="fas fa-map-marker-alt"></i>
                      View Location
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-volunteers">
              <p>No active volunteers found in your area.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Volunteer; 