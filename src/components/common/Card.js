import React from 'react';
import { Link } from 'react-router-dom';

const Card = ({ title, content, buttonText, buttonLink }) => {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{content}</p>
      {buttonText && buttonLink && (
        <Link to={buttonLink} className="button">
          {buttonText}
        </Link>
      )}
    </div>
  );
};

export default Card; 