import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import format from 'date-fns/format';
import './NotificationHistory.css';

const NotificationHistory = () => {
  const [notifications, setNotifications] = useState([]);
  const [volunteers, setVolunteers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const result = await axios.get('/api/notifications');
      setNotifications(result.data);
      
      // Load volunteer info for all notifications
      const volunteerIds = [...new Set(result.data.map(n => n.volunteerId))];
      await Promise.all(volunteerIds.map(loadVolunteerInfo));
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load notifications');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const loadVolunteerInfo = async (volunteerId) => {
    try {
      const result = await axios.get(`/api/volunteers/${volunteerId}`);
      setVolunteers(prev => ({
        ...prev,
        [volunteerId]: result.data
      }));
    } catch (error) {
      console.error(`Error fetching volunteer ${volunteerId}:`, error);
    }
  };

  const getStatusBadge = (status) => {
    let className = 'badge';
    
    switch (status) {
      case 'queued':
        className += ' badge-secondary';
        break;
      case 'sent':
        className += ' badge-primary';
        break;
      case 'delivered':
        className += ' badge-info';
        break;
      case 'responded':
        className += ' badge-success';
        break;
      case 'failed':
        className += ' badge-danger';
        break;
      default:
        className += ' badge-light';
    }
    
    return <span className={className}>{status}</span>;
  };

  const resendNotification = async (notification) => {
    try {
      const volunteerId = notification.volunteerId;
      const volunteer = volunteers[volunteerId];
      
      if (!volunteer) {
        alert('Volunteer information not available');
        return;
      }
      
      const payload = {
        volunteerId: volunteerId,
        aidId: notification.aidId,
        aidType: notification.aidType,
        message: notification.messageContent || notification.message
      };
      
      const result = await axios.post('/api/notify-volunteer', payload);
      
      if (result.data.success) {
        alert('Notification resent successfully');
        loadNotifications();
      } else {
        alert(`Failed to resend: ${result.data.message}`);
      }
    } catch (error) {
      console.error('Error resending notification:', error);
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="container text-center">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-card">
          <h3 className="text-danger">Error</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={loadNotifications}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>Notification History</h2>
      <div className="button-row">
        <button className="btn btn-outline-primary" onClick={loadNotifications}>
          Refresh
        </button>
      </div>
      
      <div className="card">
        <div className="card-body">
          <table className="notification-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Volunteer</th>
                <th>Aid Type</th>
                <th>Status</th>
                <th>Message</th>
                <th>Response</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No notifications found</td>
                </tr>
              ) : (
                notifications.map(notification => (
                  <tr key={notification._id}>
                    <td>{format(new Date(notification.createdAt), 'MMM d, yyyy h:mm a')}</td>
                    <td>
                      {volunteers[notification.volunteerId] ? (
                        <>
                          {volunteers[notification.volunteerId].name}<br />
                          <small>{volunteers[notification.volunteerId].phone}</small>
                        </>
                      ) : (
                        <small>Loading...</small>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${notification.aidType === 'medical' ? 'badge-danger' : 'badge-warning'}`}>
                        {notification.aidType === 'medical' ? 'Medical' : 'Transport'}
                      </span>
                    </td>
                    <td>
                      {getStatusBadge(notification.status)}
                      {notification.statusDetails && (
                        <div className="text-danger small-text">
                          {notification.statusDetails}
                        </div>
                      )}
                    </td>
                    <td className="message-cell">
                      {notification.messageContent || notification.message || '-'}
                    </td>
                    <td className="message-cell">
                      {notification.response || '-'}
                    </td>
                    <td>
                      {(notification.status === 'failed' || notification.status === 'queued') && (
                        <button 
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => resendNotification(notification)}
                        >
                          Resend
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NotificationHistory; 