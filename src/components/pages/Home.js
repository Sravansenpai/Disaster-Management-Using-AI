import React from 'react';
import Slideshow from '../common/Slideshow';
import Card from '../common/Card';

// Using actual image paths
const disasterManagementImg = '/imgs/what-is-disaster-management.jpeg';
const emergencyResponseImg = '/imgs/60dace90-6ccf-443b-a394-57ef5da1bb71_1920x1080.jpg';
const disasterCoverImg = '/imgs/dc-Cover-163423fuvh6oqrv9ack51jfb62-20160925151050.Medi.jpeg';
const floodImg = '/imgs/0289805_0289805_mange.jpg';
const rescueImg = '/imgs/R.jpg';

const Home = () => {
  const slides = [
    {
      image: disasterManagementImg,
      alt: 'Disaster Management Overview',
      caption: 'Comprehensive Disaster Management Approach'
    },
    {
      image: emergencyResponseImg,
      alt: 'Emergency Response',
      caption: 'Emergency Response Teams in Action'
    },
    {
      image: disasterCoverImg,
      alt: 'Disaster Coverage',
      caption: 'Media Coverage of Disaster Events'
    },
    {
      image: floodImg,
      alt: 'Flood Management',
      caption: 'Flood Control and Emergency Measures'
    },
    {
      image: rescueImg,
      alt: 'Rescue Operations',
      caption: 'Rescue Teams Saving Lives'
    }
  ];

  const cardsData = [
    {
      title: 'Medical Aid',
      content: 'Access emergency medical resources, find nearby medical facilities, and request medical assistance during disaster situations.',
      buttonText: 'Access Medical Aid',
      buttonLink: '/medical-aid'
    },
    {
      title: 'Transport Aid',
      content: 'Find available transportation, request evacuation assistance, or volunteer vehicles for emergency transportation needs.',
      buttonText: 'Access Transport Aid',
      buttonLink: '/transport-aid'
    },
    {
      title: 'Volunteer',
      content: 'Join our volunteer network to help communities affected by disasters. Your skills and time can make a significant difference.',
      buttonText: 'Volunteer Now',
      buttonLink: '/volunteer'
    },
    {
      title: 'Live Reports',
      content: 'Access real-time updates and reports from affected areas. Stay informed about the latest developments and emergency alerts.',
      buttonText: 'View Live Reports',
      buttonLink: '/live-reports'
    },
    {
      title: 'Weather Updates',
      content: 'Get the latest weather forecasts, warnings, and advisories to help you prepare for potential natural disasters.',
      buttonText: 'Check Weather',
      buttonLink: '/weather'
    }
  ];

  return (
    <div>
      <Slideshow slides={slides} />
      
      <section className="information">
        <h2>From The Grounds Up - Crowd Sourced Disaster Management</h2>
        <p>
          Welcome to our community-driven disaster management platform. Our mission is to connect people, resources, and information during emergency situations to save lives and support affected communities.
        </p>
      </section>
      
      <div className="grid-container">
        {cardsData.map((card, index) => (
          <Card 
            key={index}
            title={card.title}
            content={card.content}
            buttonText={card.buttonText}
            buttonLink={card.buttonLink}
          />
        ))}
      </div>
    </div>
  );
};

export default Home; 