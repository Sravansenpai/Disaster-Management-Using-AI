import React, { useState, useEffect, useCallback } from 'react';

const Slideshow = ({ slides }) => {
  const [slideIndex, setSlideIndex] = useState(1);

  const changeSlide = useCallback((n) => {
    let newIndex = slideIndex + n;
    if (newIndex > slides.length) {
      newIndex = 1;
    }
    if (newIndex < 1) {
      newIndex = slides.length;
    }
    setSlideIndex(newIndex);
  }, [slideIndex, slides.length]);

  const currentSlide = (n) => {
    setSlideIndex(n);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      changeSlide(1);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [changeSlide]);

  return (
    <div>
      <div className="slideshow-container">
        {slides.map((slide, index) => (
          <div 
            key={index} 
            className="slide fade" 
            style={{ display: index + 1 === slideIndex ? 'block' : 'none' }}
          >
            <img src={slide.image} alt={slide.alt} />
            <div className="slide-caption">{slide.caption}</div>
          </div>
        ))}
        
        <button className="prev" onClick={() => changeSlide(-1)}>&#10094;</button>
        <button className="next" onClick={() => changeSlide(1)}>&#10095;</button>
      </div>

      <div className="dot-container">
        {slides.map((_, index) => (
          <span 
            key={index}
            className={`dot ${index + 1 === slideIndex ? 'active-dot' : ''}`} 
            onClick={() => currentSlide(index + 1)}
          ></span>
        ))}
      </div>
    </div>
  );
};

export default Slideshow; 