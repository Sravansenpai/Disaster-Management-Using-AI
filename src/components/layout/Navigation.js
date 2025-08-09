import React from 'react';
import { Link } from 'react-router-dom';

const Navigation = () => {
  return (
    <nav>
      <ul>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/medical-aid">Medical Aid</Link></li>
        <li><Link to="/transport-aid">Transport Aid</Link></li>
        <li><Link to="/volunteer">Volunteer</Link></li>
        <li><Link to="/live-reports">Live Reports</Link></li>
        <li><Link to="/weather">Weather</Link></li>
        <li><Link to="/notifications">Notifications</Link></li>
        <li><Link to="/volunteer-dashboard">Volunteer Dashboard</Link></li>
      </ul>
    </nav>
  );
};

export default Navigation; 