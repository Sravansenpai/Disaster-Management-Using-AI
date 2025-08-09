import React, { useState, useEffect } from 'react';

// Using actual logo path
const logoPath = '/logo.png';

const Header = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => {
      clearInterval(timer);
    };
  }, []);
  
  const formatTime = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };
  
  return (
    <header>
      <div className="header-logo">
        <img src={logoPath} alt="From The Grounds Up Logo" />
      </div>
      <div className="header-title">
        <h1>AI-Based Disaster Management System </h1>
      </div>
      <div className="time-display">
        {formatTime(currentTime)}
      </div>
    </header>
  );
};

export default Header; 