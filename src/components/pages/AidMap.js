import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import './AidMap.css';
import Swal from 'sweetalert2';
import FeedbackForm from '../FeedbackForm';

const AidMap = () => {
  const [aidRequest, setAidRequest] = useState(null);
  const [volunteers, setVolunteers] = useState([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('volunteers'); // 'volunteers', 'history', or 'feedback'
  const [respondedVolunteers, setRespondedVolunteers] = useState([]);

  const location = useLocation();
  const { id, type } = useParams();

  const mapContainerStyle = {
    width: '100%',
    height: '75vh'
  };

  const defaultCenter = {
    lat: 20.5937,
    lng: 78.9629
  };

  useEffect(() => {
    const fetchAidRequestAndVolunteers = async () => {
      setLoading(true);
      try {
        // Get aid request details
        let aidEndpoint = '';
        if (type === 'medical') {
          aidEndpoint = `/api/medical-aid/${id}`;
        } else if (type === 'transport') {
          aidEndpoint = `/api/transport-aid/${id}`;
        } else {
          throw new Error('Invalid aid type');
        }

        const aidResponse = await axios.get(aidEndpoint);
        const aidData = aidResponse.data;
        setAidRequest(aidData);

        // Get coordinates based on aid type
        let coordinates = null;
        if (type === 'medical' && aidData.coordinates) {
          coordinates = aidData.coordinates;
        } else if (type === 'transport' && aidData.pickupCoordinates) {
          coordinates = aidData.pickupCoordinates;
        }

        if (coordinates) {
          // Find nearby volunteers
          const volunteersResponse = await axios.get(
            `/api/volunteers?lat=${coordinates.lat}&lng=${coordinates.lng}&radius=20`
          );
          setVolunteers(volunteersResponse.data);
        }

        // Fetch notification history
        const historyResponse = await axios.get(`/api/notifications/${type}/${id}`);
        setNotificationHistory(historyResponse.data);
        
        // Extract volunteers who have responded
        const responded = historyResponse.data
          .filter(notification => notification.response === 'YES')
          .map(notification => notification.volunteer);
        
        setRespondedVolunteers(responded);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (id && type) {
      fetchAidRequestAndVolunteers();
    } else if (location.state && location.state.aidRequest) {
      // If aid request is passed via location state
      setAidRequest(location.state.aidRequest);
      
      // Get coordinates based on aid type
      let coordinates = null;
      if (location.state.type === 'medical' && location.state.aidRequest.coordinates) {
        coordinates = location.state.aidRequest.coordinates;
      } else if (location.state.type === 'transport' && location.state.aidRequest.pickupCoordinates) {
        coordinates = location.state.aidRequest.pickupCoordinates;
      }

      if (coordinates) {
        // Find nearby volunteers
        axios.get(`/api/volunteers?lat=${coordinates.lat}&lng=${coordinates.lng}&radius=20`)
          .then(response => {
            setVolunteers(response.data);
            
            // Fetch notification history if we have an ID
            if (location.state.aidRequest._id) {
              axios.get(`/api/notifications/${location.state.type}/${location.state.aidRequest._id}`)
                .then(historyResponse => {
                  setNotificationHistory(historyResponse.data);
                  setLoading(false);
                })
                .catch(err => {
                  console.error('Error fetching notification history:', err);
                  setLoading(false);
                });
            } else {
              setLoading(false);
            }
          })
          .catch(err => {
            console.error('Error fetching volunteers:', err);
            setError(err.message);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
      setError('No aid request specified');
    }
  }, [id, type, location.state]);

  // Function to refresh notification history
  const refreshHistory = async () => {
    try {
      const historyResponse = await axios.get(`/api/notifications/${type}/${id}`);
      setNotificationHistory(historyResponse.data);
    } catch (err) {
      console.error('Error refreshing notification history:', err);
    }
  };

  const getCenter = () => {
    if (!aidRequest) return defaultCenter;

    if (type === 'medical' && aidRequest.coordinates) {
      return aidRequest.coordinates;
    } else if (type === 'transport' && aidRequest.pickupCoordinates) {
      return aidRequest.pickupCoordinates;
    }

    return defaultCenter;
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance.toFixed(1);
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };

  const handleVolunteerClick = (volunteer) => {
    setSelectedVolunteer(volunteer);
  };

  const handleMapLoad = (mapInstance) => {
    // We still need this function for the onLoad prop, but we won't store the map instance
  };

  const getAidIcon = () => {
    return type === 'medical' 
      ? '/icons/medical-aid.svg' 
      : '/icons/transport-aid.svg';
  };

  const getAidDetails = () => {
    if (!aidRequest) return null;

    if (type === 'medical') {
      return (
        <div className="aid-details medical">
          <h3>Medical Aid Request</h3>
          <div className="detail-item">
            <strong>Patient:</strong> {aidRequest.patientName}
          </div>
          <div className="detail-item">
            <strong>Condition:</strong> {aidRequest.condition}
          </div>
          <div className="detail-item">
            <strong>Location:</strong> {aidRequest.location}
          </div>
          <div className="detail-item">
            <strong>Urgency:</strong> {aidRequest.urgency}
          </div>
          <div className="detail-item">
            <strong>Status:</strong> {aidRequest.status || 'pending'}
          </div>
        </div>
      );
    } else if (type === 'transport') {
      return (
        <div className="aid-details transport">
          <h3>Transport Aid Request</h3>
          <div className="detail-item">
            <strong>Requestor:</strong> {aidRequest.requestorName}
          </div>
          <div className="detail-item">
            <strong>Pickup:</strong> {aidRequest.pickupLocation}
          </div>
          <div className="detail-item">
            <strong>Dropoff:</strong> {aidRequest.dropoffLocation}
          </div>
          <div className="detail-item">
            <strong>Passengers:</strong> {aidRequest.numPassengers || 1}
          </div>
          <div className="detail-item">
            <strong>Status:</strong> {aidRequest.status || 'pending'}
          </div>
        </div>
      );
    }
  };

  const notifyVolunteer = async (volunteer) => {
    try {
      // Show loading notification
      const loadingAlert = Swal.fire({
        title: 'Sending notification...',
        text: `Notifying ${volunteer.name} via SMS`,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const response = await axios.post('/api/notify-volunteer', {
        volunteerId: volunteer._id,
        aidId: id,
        aidType: type
      });
      
      // Close loading notification
      loadingAlert.close();
      
      if (response.data.success) {
        let statusMessage = '';
        if (response.data.status === 'processing') {
          statusMessage = ' SMS delivery in progress.';
        } else if (response.data.message.includes('Vonage not available')) {
          statusMessage = ' (SMS simulated - Vonage not configured)';
        }
        
        Swal.fire({
          icon: 'success',
          title: 'Notification Sent',
          text: `Notification sent to ${volunteer.name}${statusMessage}`,
          timer: 3000,
          timerProgressBar: true
        });
        
        // Refresh notification history
        refreshHistory();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Notification Failed',
          text: `Failed to send notification: ${response.data.message}`,
          confirmButtonText: 'OK'
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Error sending notification: ${error.response?.data?.message || error.message}`,
        confirmButtonText: 'OK'
      });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'delivered': return 'status-delivered';
      case 'responded': return 'status-responded';
      case 'failed': return 'status-failed';
      default: return 'status-sent';
    }
  };

  // Handle feedback submission
  const handleFeedbackSubmitted = async (feedback) => {
    Swal.fire({
      title: 'Thank You!',
      text: 'Your feedback helps us improve the volunteer ranking system',
      icon: 'success',
      confirmButtonColor: '#3085d6'
    });
    
    // Refresh the volunteer list to show updated rankings
    if (aidRequest) {
      let coordinates = null;
      if (type === 'medical' && aidRequest.coordinates) {
        coordinates = aidRequest.coordinates;
      } else if (type === 'transport' && aidRequest.pickupCoordinates) {
        coordinates = aidRequest.pickupCoordinates;
      }

      if (coordinates) {
        try {
          const volunteersResponse = await axios.get(
            `/api/volunteers?lat=${coordinates.lat}&lng=${coordinates.lng}&radius=20`
          );
          setVolunteers(volunteersResponse.data);
        } catch (err) {
          console.error('Error refreshing volunteers:', err);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="aid-map-container">
        <div className="loading-spinner">Loading map data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aid-map-container">
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  const center = getCenter();

  return (
    <div className="aid-map-container">
      <div className="map-sidebar">
        {getAidDetails()}
        
        <div className="sidebar-tabs">
          <button 
            className={`tab-button ${activeTab === 'volunteers' ? 'active' : ''}`}
            onClick={() => setActiveTab('volunteers')}
          >
            Nearby Volunteers ({volunteers.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Notification History ({notificationHistory.length})
          </button>
          <button 
            className={`tab-button ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            Provide Feedback
          </button>
        </div>

        {activeTab === 'volunteers' ? (
          <div className="nearby-volunteers">
            {volunteers.length > 0 ? (
              <div className="volunteer-list">
                {volunteers.map(volunteer => {
                  // Calculate distance from aid request
                  const distance = calculateDistance(
                    center.lat,
                    center.lng,
                    volunteer.location.lat,
                    volunteer.location.lng
                  );
                  
                  // Check if volunteer has already been notified
                  const isNotified = notificationHistory.some(
                    notification => notification.volunteerId && notification.volunteerId._id === volunteer._id
                  );
                  
                  return (
                    <div 
                      key={volunteer._id} 
                      className={`volunteer-item ${selectedVolunteer && selectedVolunteer._id === volunteer._id ? 'selected' : ''} ${isNotified ? 'notified' : ''}`}
                      onClick={() => handleVolunteerClick(volunteer)}
                    >
                      <div className="volunteer-name">
                        {volunteer.name}
                        {isNotified && <span className="notified-badge">Notified</span>}
                      </div>
                      <div className="volunteer-distance">{distance} km away</div>
                      <div className="volunteer-skills">
                        {volunteer.skillset && volunteer.skillset.join(', ')}
                      </div>
                      <button 
                        className="notify-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          notifyVolunteer(volunteer);
                        }}
                        disabled={isNotified}
                      >
                        {isNotified ? 'Sent' : 'Notify'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-volunteers">
                No volunteers found in this area.
              </div>
            )}
          </div>
        ) : activeTab === 'history' ? (
          <div className="notification-history">
            <button className="refresh-button" onClick={refreshHistory}>
              Refresh History
            </button>
            
            {notificationHistory.length > 0 ? (
              <div className="notification-list">
                {notificationHistory.map(notification => (
                  <div key={notification._id} className="notification-item">
                    <div className="notification-header">
                      <span className="volunteer-name">
                        {notification.volunteerId ? notification.volunteerId.name : 'Unknown Volunteer'}
                      </span>
                      <span className={`status-badge ${getStatusBadgeClass(notification.status)}`}>
                        {notification.status}
                      </span>
                    </div>
                    <div className="notification-time">
                      {formatDate(notification.createdAt)}
                    </div>
                    <div className="notification-response">
                      {notification.response ? (
                        <>
                          <strong>Response:</strong> {notification.response}
                        </>
                      ) : notification.status === 'failed' ? (
                        <span className="no-response">Failed to send</span>
                      ) : (
                        <span className="no-response">No response yet</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-notifications">
                No notifications sent yet.
              </div>
            )}
          </div>
        ) : (
          <div className="feedback-section">
            <h3>Rate Volunteers Who Responded</h3>
            {respondedVolunteers.length === 0 ? (
              <p>No volunteers have responded to this aid request yet.</p>
            ) : (
              <div>
                {respondedVolunteers.map(volunteer => (
                  <div key={volunteer._id || volunteer.id} className="volunteer-feedback-card">
                    <h4>{volunteer.name}</h4>
                    <FeedbackForm 
                      aidId={id}
                      aidType={type}
                      volunteerId={volunteer._id || volunteer.id}
                      onFeedbackSubmitted={handleFeedbackSubmitted}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="map-container">
        <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={11}
            onLoad={handleMapLoad}
          >
            {/* Aid Request Marker */}
            {center.lat && center.lng && (
              <Marker
                position={center}
                icon={{
                  url: getAidIcon(),
                  scaledSize: { width: 50, height: 50 }
                }}
              />
            )}
            
            {/* Volunteer Markers */}
            {volunteers.map(volunteer => {
              // Check if volunteer has already been notified
              const isNotified = notificationHistory.some(
                notification => notification.volunteerId && notification.volunteerId._id === volunteer._id
              );
              
              return volunteer.location && volunteer.location.lat && volunteer.location.lng && (
                <Marker
                  key={volunteer._id}
                  position={volunteer.location}
                  icon={{
                    url: isNotified ? '/icons/volunteer-notified.svg' : '/icons/volunteer-marker.svg',
                    scaledSize: { width: 40, height: 40 }
                  }}
                  onClick={() => handleVolunteerClick(volunteer)}
                />
              );
            })}
            
            {/* Info Window for selected volunteer */}
            {selectedVolunteer && selectedVolunteer.location && (
              <InfoWindow
                position={selectedVolunteer.location}
                onCloseClick={() => setSelectedVolunteer(null)}
              >
                <div className="volunteer-info">
                  <h3>{selectedVolunteer.name}</h3>
                  <p><strong>Phone:</strong> {selectedVolunteer.phone}</p>
                  <p><strong>Skills:</strong> {selectedVolunteer.skillset ? selectedVolunteer.skillset.join(', ') : 'None specified'}</p>
                  
                  {/* Check if volunteer has already been notified */}
                  {notificationHistory.some(
                    notification => notification.volunteerId && notification.volunteerId._id === selectedVolunteer._id
                  ) ? (
                    <div className="notification-sent">Volunteer has been notified</div>
                  ) : (
                    <button 
                      className="notify-info-button"
                      onClick={() => notifyVolunteer(selectedVolunteer)}
                    >
                      Send Notification
                    </button>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      </div>
    </div>
  );
};

export default AidMap; 