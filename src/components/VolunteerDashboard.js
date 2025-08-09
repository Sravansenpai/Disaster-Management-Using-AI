import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Row, Col, Card, Table, ProgressBar } from 'react-bootstrap';
import { StarFill, Person, GeoAlt, Award, CheckCircle } from 'react-bootstrap-icons';
import './VolunteerDashboard.css';

const VolunteerDashboard = () => {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('averageRating');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    const fetchVolunteers = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/volunteers');
        setVolunteers(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching volunteers:', err);
        setError('Failed to load volunteer data');
        setLoading(false);
      }
    };

    fetchVolunteers();
  }, []);

  const handleSort = (field) => {
    if (field === sortField) {
      // Toggle sort direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field and default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedVolunteers = () => {
    return [...volunteers].sort((a, b) => {
      let aValue = a[sortField] || 0;
      let bValue = b[sortField] || 0;
      
      // For text fields
      if (sortField === 'name' || sortField === 'primaryLocation') {
        aValue = aValue || '';
        bValue = bValue || '';
        
        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }
      
      // For numeric fields
      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  };

  const getSortIcon = (field) => {
    if (field !== sortField) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Calculates the skill distribution across all volunteers
  const getSkillDistribution = () => {
    const skillCount = {};
    
    volunteers.forEach(volunteer => {
      if (volunteer.skillset && Array.isArray(volunteer.skillset)) {
        volunteer.skillset.forEach(skill => {
          skillCount[skill] = (skillCount[skill] || 0) + 1;
        });
      }
    });
    
    // Convert to array and sort by count
    return Object.entries(skillCount)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Show top 8 skills
  };

  // Calculate performance metrics
  const getPerformanceMetrics = () => {
    if (volunteers.length === 0) return { avgRating: 0, responseRate: 0, topPerformers: 0 };
    
    const ratedVolunteers = volunteers.filter(v => v.totalRatings > 0);
    const avgRating = ratedVolunteers.length > 0 
      ? ratedVolunteers.reduce((sum, v) => sum + (v.averageRating || 0), 0) / ratedVolunteers.length
      : 0;
    
    const withResponseRate = volunteers.filter(v => v.responseRate > 0);
    const avgResponseRate = withResponseRate.length > 0
      ? withResponseRate.reduce((sum, v) => sum + (v.responseRate || 0), 0) / withResponseRate.length
      : 0;
    
    const topPerformers = volunteers.filter(v => 
      (v.averageRating || 0) >= 4.5 && (v.totalRatings || 0) >= 3
    ).length;
    
    return {
      avgRating: parseFloat(avgRating.toFixed(2)),
      responseRate: parseFloat((avgResponseRate * 100).toFixed(2)),
      topPerformers
    };
  };

  if (loading) {
    return <div className="text-center p-5">Loading volunteer data...</div>;
  }

  if (error) {
    return <div className="alert alert-danger m-3">{error}</div>;
  }

  const sortedVolunteers = getSortedVolunteers();
  const skillDistribution = getSkillDistribution();
  const metrics = getPerformanceMetrics();

  return (
    <div className="volunteer-dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Volunteer Performance Dashboard</h2>
      </div>
      
      <Row className="mb-4">
        <Col md={4}>
          <Card className="stats-card">
            <Card.Body>
              <div className="stats-icon rating">
                <StarFill size={24} color="white" />
              </div>
              <h5 className="stats-label">Average Rating</h5>
              <div className="stats-value">{metrics.avgRating}</div>
              <p className="stats-description">
                Based on {volunteers.filter(v => v.totalRatings > 0).length} rated volunteers
              </p>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4}>
          <Card className="stats-card">
            <Card.Body>
              <div className="stats-icon response">
                <CheckCircle size={24} color="white" />
              </div>
              <h5 className="stats-label">Response Rate</h5>
              <div className="stats-value">{metrics.responseRate}%</div>
              <p className="stats-description">
                Average volunteer response rate to aid requests
              </p>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4}>
          <Card className="stats-card">
            <Card.Body>
              <div className="stats-icon performers">
                <Award size={24} color="white" />
              </div>
              <h5 className="stats-label">Top Performers</h5>
              <div className="stats-value">{metrics.topPerformers}</div>
              <p className="stats-description">
                Volunteers with 4.5+ rating (min 3 reviews)
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Row className="mb-4">
        <Col lg={8}>
          <div className="rankings-card">
            <div className="rankings-header">
              <h5 className="mb-0">Volunteer Rankings</h5>
            </div>
            <div className="table-responsive">
              <Table className="rankings-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')}>
                      Name {getSortIcon('name')}
                    </th>
                    <th onClick={() => handleSort('primaryLocation')}>
                      Location {getSortIcon('primaryLocation')}
                    </th>
                    <th onClick={() => handleSort('averageRating')}>
                      Rating {getSortIcon('averageRating')}
                    </th>
                    <th onClick={() => handleSort('totalRatings')}>
                      Reviews {getSortIcon('totalRatings')}
                    </th>
                    <th onClick={() => handleSort('responseRate')}>
                      Response Rate {getSortIcon('responseRate')}
                    </th>
                    <th onClick={() => handleSort('completedAids')}>
                      Completed {getSortIcon('completedAids')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedVolunteers.slice(0, 10).map(volunteer => (
                    <tr key={volunteer._id}>
                      <td data-label="Name">
                        <div className="volunteer-info">
                          <div className="volunteer-avatar">
                            <Person size={20} />
                          </div>
                          <div>
                            <span className="volunteer-name">{volunteer.name}</span>
                            {(volunteer.averageRating || 0) >= 4.5 && volunteer.totalRatings >= 3 && (
                              <span className="top-performer-badge">Top Performer</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-label="Location">
                        <div className="volunteer-info">
                          <GeoAlt size={16} />
                          <span>{volunteer.primaryLocation || 'Not specified'}</span>
                        </div>
                      </td>
                      <td data-label="Rating">
                        {volunteer.averageRating ? (
                          <div className="rating-display">
                            <span className="rating-value">
                              {volunteer.averageRating.toFixed(1)}
                            </span>
                            <StarFill size={16} color="#f39c12" />
                          </div>
                        ) : (
                          <span className="text-muted">No ratings</span>
                        )}
                      </td>
                      <td data-label="Reviews">
                        {volunteer.totalRatings || 0}
                      </td>
                      <td data-label="Response Rate">
                        {volunteer.responseRate ? (
                          <div>
                            <div className="response-rate-value">
                              {(volunteer.responseRate * 100).toFixed(0)}%
                            </div>
                            <ProgressBar 
                              className="response-rate-bar"
                              now={volunteer.responseRate * 100} 
                              variant={volunteer.responseRate > 0.7 ? 'success' : 
                                     volunteer.responseRate > 0.4 ? 'warning' : 'danger'}
                            />
                          </div>
                        ) : (
                          <span className="text-muted">N/A</span>
                        )}
                      </td>
                      <td data-label="Completed">
                        {volunteer.completedAids || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        </Col>
        
        <Col lg={4}>
          <div className="skills-card">
            <h5 className="mb-4">Skill Distribution</h5>
            {skillDistribution.length === 0 ? (
              <p className="text-muted">No skill data available</p>
            ) : (
              skillDistribution.map(({ skill, count }) => (
                <div key={skill} className="skill-item">
                  <div className="skill-header">
                    <span className="skill-name">{skill}</span>
                    <span className="skill-count">{count} volunteers</span>
                  </div>
                  <div className="skill-progress">
                    <div 
                      className="skill-progress-bar"
                      style={{ width: `${(count / volunteers.length) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Col>
      </Row>
      
      <div className="text-muted text-center mt-4 pt-3 border-top">
        <small>AI-assisted volunteer ranking system - Updated automatically based on feedback</small>
      </div>
    </div>
  );
};

export default VolunteerDashboard; 