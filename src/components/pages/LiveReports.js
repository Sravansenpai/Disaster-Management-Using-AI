import React, { useState, useEffect } from 'react';

const LiveReports = () => {
  const [reports, setReports] = useState([
    {
      id: 1,
      title: 'Flooding in Downtown Area',
      content: 'Several streets in the downtown area are experiencing flooding due to heavy rainfall. Authorities advise residents to avoid the area and seek higher ground if necessary.',
      date: '2023-01-15T08:30:00',
      severity: 'high',
      location: 'Downtown'
    },
    {
      id: 2,
      title: 'Power Outage in Eastern District',
      content: 'A widespread power outage is affecting the eastern district. Utility companies are working to restore power. Estimated time for restoration is 4-6 hours.',
      date: '2023-01-15T10:15:00',
      severity: 'medium',
      location: 'Eastern District'
    },
    {
      id: 3,
      title: 'Emergency Shelter Open',
      content: 'An emergency shelter has been opened at Central High School. The shelter is providing food, water, and temporary accommodation for those affected by the recent events.',
      date: '2023-01-15T11:45:00',
      severity: 'info',
      location: 'Central Area'
    },
    {
      id: 4,
      title: 'Road Closure Update',
      content: 'Highway 24 remains closed between exits 10-14 due to debris on the road. Cleanup crews are on site. Expected to reopen by tomorrow morning.',
      date: '2023-01-15T14:20:00',
      severity: 'medium',
      location: 'Highway 24'
    }
  ]);

  const [formData, setFormData] = useState({
    title: '',
    location: '',
    type: '',
    details: '',
    contactInfo: '',
    severity: 'medium'
  });

  const [statusMessage, setStatusMessage] = useState({
    show: false,
    type: '',
    message: ''
  });

  const [filteredReports, setFilteredReports] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (filter === 'all') {
      setFilteredReports(reports);
    } else {
      setFilteredReports(reports.filter(report => report.severity === filter));
    }
  }, [reports, filter]);

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const getSeverityClass = (severity) => {
    switch(severity) {
      case 'high':
        return 'severity-high';
      case 'medium':
        return 'severity-medium';
      case 'low':
        return 'severity-low';
      default:
        return 'severity-info';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFilterChange = (e) => {
    setFilter(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate the form
    if (!formData.title || !formData.location || !formData.type || !formData.details) {
      setStatusMessage({
        show: true,
        type: 'error',
        message: 'Please fill in all required fields'
      });
      return;
    }
    
    // In a real app, this would submit to a backend
    const newReport = {
      id: reports.length + 1,
      title: formData.title,
      content: formData.details,
      date: new Date().toISOString(),
      severity: formData.severity,
      location: formData.location
    };
    
    setReports([...reports, newReport]);
    
    // Reset form
    setFormData({
      title: '',
      location: '',
      type: '',
      details: '',
      contactInfo: '',
      severity: 'medium'
    });
    
    // Show success message
    setStatusMessage({
      show: true,
      type: 'success',
      message: 'Report submitted successfully'
    });
    
    // Hide the message after 3 seconds
    setTimeout(() => {
      setStatusMessage({ show: false, type: '', message: '' });
    }, 3000);
  };

  return (
    <div className="live-reports-page">
      <section className="information">
        <h2>Live Emergency Reports</h2>
        <p>
          Stay informed with real-time updates and reports from affected areas. 
          This page displays verified information about ongoing emergency situations, 
          road closures, shelter locations, and other critical updates.
        </p>
      </section>

      <div className="filter-container">
        <label htmlFor="severity-filter">Filter by Severity:</label>
        <select 
          id="severity-filter" 
          value={filter} 
          onChange={handleFilterChange}
          className="severity-filter"
        >
          <option value="all">All Reports</option>
          <option value="high">High Severity</option>
          <option value="medium">Medium Severity</option>
          <option value="low">Low Severity</option>
          <option value="info">Information</option>
        </select>
      </div>

      <div className="reports-container">
        {filteredReports.length === 0 ? (
          <p className="no-reports">No reports match your filter criteria.</p>
        ) : (
          filteredReports.map(report => (
            <div key={report.id} className={`report-card ${getSeverityClass(report.severity)}`}>
              <div className="report-header">
                <h3>{report.title}</h3>
                <span className="report-date">{formatDate(report.date)}</span>
              </div>
              <div className="report-meta">
                <span className="report-location"><i className="fas fa-map-marker-alt"></i> {report.location}</span>
                <span className={`report-severity ${getSeverityClass(report.severity)}`}>
                  {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}
                </span>
              </div>
              <p className="report-content">{report.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="form-container">
        <h3>Submit a Report</h3>
        {statusMessage.show && (
          <div className={`status-message ${statusMessage.type}`}>
            {statusMessage.message}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Report Title</label>
            <input 
              type="text" 
              id="title" 
              name="title" 
              value={formData.title}
              onChange={handleInputChange}
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input 
              type="text" 
              id="location" 
              name="location" 
              value={formData.location}
              onChange={handleInputChange}
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="type">Type of Incident</label>
            <select 
              id="type" 
              name="type" 
              value={formData.type}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Incident Type</option>
              <option value="flooding">Flooding</option>
              <option value="fire">Fire</option>
              <option value="power-outage">Power Outage</option>
              <option value="road-issue">Road Closure/Damage</option>
              <option value="building-damage">Building Damage</option>
              <option value="medical">Medical Emergency</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="severity">Severity</label>
            <select 
              id="severity" 
              name="severity" 
              value={formData.severity}
              onChange={handleInputChange}
            >
              <option value="high">High - Life-threatening</option>
              <option value="medium">Medium - Significant Impact</option>
              <option value="low">Low - Minor Impact</option>
              <option value="info">Information Only</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="details">Details</label>
            <textarea 
              id="details" 
              name="details" 
              rows="4" 
              value={formData.details}
              onChange={handleInputChange}
              required
            ></textarea>
          </div>
          
          <div className="form-group">
            <label htmlFor="contactInfo">Your Contact Information (Optional)</label>
            <input 
              type="text" 
              id="contactInfo" 
              name="contactInfo" 
              placeholder="Email or phone number"
              value={formData.contactInfo}
              onChange={handleInputChange}
            />
          </div>
          
          <button type="submit" className="button">Submit Report</button>
        </form>
      </div>
    </div>
  );
};

export default LiveReports; 