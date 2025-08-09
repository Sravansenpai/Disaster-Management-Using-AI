import React, { useState, useEffect, useCallback } from 'react';

const Weather = () => {
  const [weatherData, setWeatherData] = useState({
    location: 'Loading...',
    forecast: [],
    hourlyForecast: [],
    currentConditions: {
      temp: '--',
      feelsLike: '--',
      humidity: '--',
      windSpeed: '--',
      pressure: '--',
      visibility: '--'
    },
    alerts: [],
    airQuality: {
      aqi: '--',
      mainPollutant: '--',
      level: '--',
      description: '--'
    }
  });

  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [city, setCity] = useState('Hyderabad'); // Default city
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' or 'hourly'
  const [unitSystem, setUnitSystem] = useState('metric'); // 'metric' or 'imperial'
  const [coordinates, setCoordinates] = useState({ lat: 17.3850, lon: 78.4867 }); // Default Hyderabad coordinates

  const apiKey = "b46acb10844c531e163f48b85b046fd2"; // The OpenWeatherMap API key

  // Weather icons mapping for better icons from weatherapi.com
  const getWeatherIcon = (code) => {
    // Map OpenWeatherMap icon code to WeatherAPI.com icon URL
    if (!code) return 'https://cdn.weatherapi.com/weather/64x64/day/116.png'; // default cloudy icon
    
    const isDayTime = code.includes('d');
    const timeOfDay = isDayTime ? 'day' : 'night';
    
    const iconMap = {
      '01': isDayTime ? '113' : '113', // clear sky
      '02': isDayTime ? '116' : '119', // few clouds
      '03': isDayTime ? '119' : '119', // scattered clouds
      '04': isDayTime ? '122' : '122', // broken clouds
      '09': isDayTime ? '296' : '296', // shower rain
      '10': isDayTime ? '176' : '176', // rain
      '11': isDayTime ? '200' : '200', // thunderstorm
      '13': isDayTime ? '326' : '326', // snow
      '50': isDayTime ? '143' : '143'  // mist
    };
    
    const codePrefix = code.substring(0, 2);
    const iconCode = iconMap[codePrefix] || '116'; // default to partly cloudy if mapping not found
    
    return `https://cdn.weatherapi.com/weather/64x64/${timeOfDay}/${iconCode}.png`;
  };

  // Get larger weather icon for current conditions
  const getLargeWeatherIcon = (code) => {
    const iconUrl = getWeatherIcon(code);
    return iconUrl.replace('64x64', '128x128');
  };

  const fetchWeatherData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch current weather
      const currentResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=${unitSystem}`
      );
      
      if (!currentResponse.ok) {
        throw new Error('Failed to fetch current weather data');
      }
      
      const currentData = await currentResponse.json();
      
      // Update coordinates for other API calls
      setCoordinates({
        lat: currentData.coord.lat,
        lon: currentData.coord.lon
      });
      
      // Fetch 5-day forecast
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=${unitSystem}`
      );
      
      if (!forecastResponse.ok) {
        throw new Error('Failed to fetch forecast data');
      }
      
      const forecastData = await forecastResponse.json();
      
      // Get one forecast per day (at 12:00)
      const dailyForecasts = forecastData.list
        .filter(item => item.dt_txt.includes('12:00:00'))
        .slice(0, 5); // Limit to 5 days
      
      // Format the data
      const formattedForecast = dailyForecasts.map(day => {
        const date = new Date(day.dt * 1000);
        return {
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          temp: `${Math.round(day.main.temp)}${unitSystem === 'metric' ? '°C' : '°F'}`,
          minTemp: `${Math.round(day.main.temp_min)}${unitSystem === 'metric' ? '°C' : '°F'}`,
          maxTemp: `${Math.round(day.main.temp_max)}${unitSystem === 'metric' ? '°C' : '°F'}`,
          condition: day.weather[0].description,
          precipitation: `${Math.round(day.pop * 100)}%`,
          humidity: `${day.main.humidity}%`,
          windSpeed: `${day.wind.speed} ${unitSystem === 'metric' ? 'km/h' : 'mph'}`,
          alert: null,
          icon: day.weather[0].icon
        };
      });
      
      // Get hourly forecast for the next 24 hours
      const hourlyForecasts = forecastData.list.slice(0, 8); // 8 x 3-hour intervals = 24 hours
      
      // Format hourly data
      const formattedHourlyForecast = hourlyForecasts.map(hour => {
        const date = new Date(hour.dt * 1000);
        return {
          hour: date.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true }),
          temp: `${Math.round(hour.main.temp)}${unitSystem === 'metric' ? '°C' : '°F'}`,
          condition: hour.weather[0].description,
          precipitation: `${Math.round(hour.pop * 100)}%`,
          humidity: `${hour.main.humidity}%`,
          windSpeed: `${hour.wind.speed} ${unitSystem === 'metric' ? 'km/h' : 'mph'}`,
          icon: hour.weather[0].icon
        };
      });
      
      // Fetch Open-Meteo weather data for additional details
      const openMeteoResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${currentData.coord.lat}&longitude=${currentData.coord.lon}&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,weathercode,visibility,windspeed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&current_weather=true&timezone=auto`
      );
      
      if (openMeteoResponse.ok) {
        // eslint-disable-next-line no-unused-vars
        const openMeteoData = await openMeteoResponse.json();
        
        // Use Open-Meteo data to enhance our forecast if needed
        console.log("Open-Meteo data available for enhanced forecasts");
      }
      
      // Fetch air quality data
      const airQualityResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${currentData.coord.lat}&lon=${currentData.coord.lon}&appid=${apiKey}`
      );
      
      let airQualityData = {
        aqi: '--',
        mainPollutant: '--',
        level: '--',
        description: '--'
      };
      
      if (airQualityResponse.ok) {
        const airQualityResult = await airQualityResponse.json();
        
        if (airQualityResult.list && airQualityResult.list.length > 0) {
          const aqi = airQualityResult.list[0].main.aqi;
          
          const aqiLevels = [
            { level: 'Good', description: 'Air quality is considered satisfactory, and air pollution poses little or no risk.' },
            { level: 'Fair', description: 'Air quality is acceptable; however, for some pollutants there may be a moderate health concern for a very small number of people.' },
            { level: 'Moderate', description: 'Members of sensitive groups may experience health effects. The general public is not likely to be affected.' },
            { level: 'Poor', description: 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.' },
            { level: 'Very Poor', description: 'Health warnings of emergency conditions. The entire population is more likely to be affected.' }
          ];
          
          // Find the main pollutant
          const components = airQualityResult.list[0].components;
          const pollutants = {
            co: 'Carbon Monoxide',
            no: 'Nitrogen Monoxide',
            no2: 'Nitrogen Dioxide', 
            o3: 'Ozone',
            so2: 'Sulphur Dioxide',
            pm2_5: 'Fine Particles',
            pm10: 'Coarse Particles',
            nh3: 'Ammonia'
          };
          
          // Find highest value pollutant
          let maxPollutant = Object.keys(components)[0];
          
          for (const [key] of Object.entries(components)) {
            if (components[key] > components[maxPollutant]) {
              maxPollutant = key;
            }
          }
          
          airQualityData = {
            aqi: aqi,
            mainPollutant: pollutants[maxPollutant] || maxPollutant,
            level: aqiLevels[aqi - 1]?.level || 'Unknown',
            description: aqiLevels[aqi - 1]?.description || 'No data available'
          };
        }
      }
      
      // Fetch alerts if available
      let alerts = [];
      
      try {
        // The OneCall API requires a special subscription, so we'll handle this gracefully
        // Instead of using the OneCall API, we'll use the standard weather alerts if they exist
        if (currentData.weather && currentData.weather.some(w => w.main === 'Thunderstorm' || w.main === 'Tornado')) {
          alerts.push({
            event: currentData.weather[0].main,
            description: `Severe weather alert: ${currentData.weather[0].description}`,
            start: new Date().toLocaleString(),
            end: new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString() // 6 hours from now
          });
        }
        
        // We'll skip the OneCall API call as it requires a different subscription
        // If you have a valid OneCall API subscription, you can uncomment this block
        /*
        const alertsResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/onecall?lat=${currentData.coord.lat}&lon=${currentData.coord.lon}&exclude=minutely,hourly,daily&appid=${apiKey}`
        );
        
        if (alertsResponse.ok) {
          const alertsData = await alertsResponse.json();
          
          if (alertsData.alerts && alertsData.alerts.length > 0) {
            alerts = alertsData.alerts.map(alert => ({
              event: alert.event,
              description: alert.description,
              start: new Date(alert.start * 1000).toLocaleString(),
              end: new Date(alert.end * 1000).toLocaleString()
            }));
          }
        }
        */
      } catch (error) {
        console.warn('Failed to process weather alerts:', error);
        // Not critical, continue without alerts
      }
      
      setWeatherData({
        location: `${currentData.name}, ${currentData.sys.country}`,
        forecast: formattedForecast,
        hourlyForecast: formattedHourlyForecast,
        currentConditions: {
          temp: `${Math.round(currentData.main.temp)}${unitSystem === 'metric' ? '°C' : '°F'}`,
          feelsLike: `${Math.round(currentData.main.feels_like)}${unitSystem === 'metric' ? '°C' : '°F'}`,
          humidity: `${currentData.main.humidity}%`,
          windSpeed: `${currentData.wind.speed} ${unitSystem === 'metric' ? 'km/h' : 'mph'}`,
          pressure: `${currentData.main.pressure} hPa`,
          visibility: `${(currentData.visibility / 1000).toFixed(1)} km`,
          icon: currentData.weather[0].icon,
          description: currentData.weather[0].description,
          sunrise: new Date(currentData.sys.sunrise * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          sunset: new Date(currentData.sys.sunset * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        },
        alerts: alerts,
        airQuality: airQualityData
      });
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch weather data. Please try again.');
      console.error('Weather data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [city, apiKey, unitSystem]);

  useEffect(() => {
    fetchWeatherData();
  }, [fetchWeatherData]);

  const handleLocationChange = (e) => {
    setLocation(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (location.trim()) {
      setCity(location);
      setLocation('');
    }
  };
  
  const toggleUnitSystem = () => {
    setUnitSystem(prev => prev === 'metric' ? 'imperial' : 'metric');
  };
  
  const getWeatherBackgroundClass = () => {
    if (!weatherData.currentConditions.icon) return '';
    
    const icon = weatherData.currentConditions.icon;
    
    // Day conditions
    if (icon.includes('01d')) return 'bg-clear-day'; // clear day
    if (icon.includes('02d') || icon.includes('03d')) return 'bg-cloudy-day'; // partly cloudy
    if (icon.includes('04d')) return 'bg-cloudy'; // cloudy
    if (icon.includes('09d') || icon.includes('10d')) return 'bg-rainy'; // rain
    if (icon.includes('11d')) return 'bg-thunderstorm'; // thunderstorm
    if (icon.includes('13d')) return 'bg-snow'; // snow
    if (icon.includes('50d')) return 'bg-mist'; // mist
    
    // Night conditions
    if (icon.includes('01n')) return 'bg-clear-night'; // clear night
    if (icon.includes('02n') || icon.includes('03n')) return 'bg-cloudy-night'; // partly cloudy night
    if (icon.includes('04n')) return 'bg-cloudy'; // cloudy night
    if (icon.includes('09n') || icon.includes('10n')) return 'bg-rainy'; // rain night
    if (icon.includes('11n')) return 'bg-thunderstorm'; // thunderstorm night
    if (icon.includes('13n')) return 'bg-snow'; // snow night
    if (icon.includes('50n')) return 'bg-mist'; // mist night
    
    // Default to cloudy for other conditions
    return 'bg-cloudy';
  };

  // Get today's date formatted
  const getTodayDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className={`weather-page ${getWeatherBackgroundClass()}`}>
      <div className="weather-header">
        <h2>Weather Forecast & Alerts</h2>
        <p className="today-date">{getTodayDate()}</p>
      </div>

      <div className="weather-controls">
        <form onSubmit={handleSubmit} className="weather-location-search">
          <div className="form-group weather-search">
            <input 
              type="text" 
              placeholder="Enter city or location" 
              value={location}
              onChange={handleLocationChange}
              required 
            />
            <button type="submit" className="button">
              <i className="fas fa-search"></i> Search
            </button>
          </div>
        </form>
        
        <div className="weather-options">
          <button 
            className="button unit-toggle" 
            onClick={toggleUnitSystem}
          >
            {unitSystem === 'metric' ? '°C → °F' : '°F → °C'}
          </button>
          <button 
            className={`button tab-selector ${activeTab === 'daily' ? 'active' : ''}`} 
            onClick={() => setActiveTab('daily')}
          >
            <i className="fas fa-calendar-day"></i> Daily
          </button>
          <button 
            className={`button tab-selector ${activeTab === 'hourly' ? 'active' : ''}`} 
            onClick={() => setActiveTab('hourly')}
          >
            <i className="fas fa-clock"></i> Hourly
          </button>
        </div>
      </div>

      {error && <div className="status-message error">{error}</div>}

      {weatherData.alerts && weatherData.alerts.length > 0 && (
        <div className="card alert-card">
          <h2><i className="fas fa-exclamation-triangle"></i> Weather Alerts</h2>
          {weatherData.alerts.map((alert, index) => (
            <div key={index} className="weather-alert">
              <h3>{alert.event}</h3>
              <p><strong>Effective:</strong> {alert.start} to {alert.end}</p>
              <p>{alert.description}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading weather data...</p>
        </div>
      ) : (
        <div className="weather-dashboard">
          <div className="card weather-main">
            <div className="location">
              <i className="fas fa-map-marker-alt"></i>
              <span>{weatherData.location}</span>
            </div>
            <div className="current-weather">
              <img 
                src={getLargeWeatherIcon(weatherData.currentConditions.icon)} 
                alt={weatherData.currentConditions.description} 
                className="weather-icon-large"
              />
              <div className="weather-info">
                <div className="temp">{weatherData.currentConditions.temp}</div>
                <div className="description">{weatherData.currentConditions.description}</div>
                <div className="feels-like">Feels like: {weatherData.currentConditions.feelsLike}</div>
              </div>
            </div>
            <div className="sun-times">
              <div className="sunrise">
                <i className="fas fa-sun"></i>
                <span>Sunrise: {weatherData.currentConditions.sunrise}</span>
              </div>
              <div className="sunset">
                <i className="fas fa-moon"></i>
                <span>Sunset: {weatherData.currentConditions.sunset}</span>
              </div>
            </div>
          </div>
          
          <div className="card weather-details">
            <h3><i className="fas fa-info-circle"></i> Current Conditions</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <i className="fas fa-wind"></i>
                <h4>Wind Speed</h4>
                <p>{weatherData.currentConditions.windSpeed}</p>
              </div>
              <div className="detail-item">
                <i className="fas fa-tint"></i>
                <h4>Humidity</h4>
                <p>{weatherData.currentConditions.humidity}</p>
              </div>
              <div className="detail-item">
                <i className="fas fa-compress-arrows-alt"></i>
                <h4>Pressure</h4>
                <p>{weatherData.currentConditions.pressure}</p>
              </div>
              <div className="detail-item">
                <i className="fas fa-eye"></i>
                <h4>Visibility</h4>
                <p>{weatherData.currentConditions.visibility}</p>
              </div>
            </div>
          </div>
          
          <div className="card air-quality-card">
            <h3><i className="fas fa-lungs"></i> Air Quality</h3>
            <div className="air-quality-indicator">
              <div className={`aqi-level aqi-level-${weatherData.airQuality.aqi}`}>
                <div className="aqi-number">{weatherData.airQuality.aqi}</div>
                <div className="aqi-text">{weatherData.airQuality.level}</div>
              </div>
              <div className="aqi-details">
                <p><strong>Main Pollutant:</strong> {weatherData.airQuality.mainPollutant}</p>
                <p>{weatherData.airQuality.description}</p>
              </div>
            </div>
          </div>
          
          <div className="card forecast-card">
            <h3>
              {activeTab === 'daily' ? (
                <><i className="fas fa-calendar-week"></i> 5-Day Forecast</>
              ) : (
                <><i className="fas fa-clock"></i> 24-Hour Forecast</>
              )}
            </h3>
            
            {activeTab === 'daily' ? (
              <div className="forecast">
                {weatherData.forecast.map((day, index) => (
                  <div key={index} className="forecast-item">
                    <h4>{day.day}</h4>
                    <p className="forecast-date">{day.date}</p>
                    <img 
                      src={getWeatherIcon(day.icon)} 
                      alt={day.condition} 
                      className="forecast-icon"
                    />
                    <div className="temp-range">
                      <span className="max-temp">{day.maxTemp}</span>
                      <span className="min-temp">{day.minTemp}</span>
                    </div>
                    <p className="condition">{day.condition}</p>
                    <div className="forecast-details">
                      <p><i className="fas fa-tint"></i> {day.precipitation}</p>
                      <p><i className="fas fa-wind"></i> {day.windSpeed}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="hourly-forecast">
                {weatherData.hourlyForecast.map((hour, index) => (
                  <div key={index} className="hourly-item">
                    <h4>{hour.hour}</h4>
                    <img 
                      src={getWeatherIcon(hour.icon)} 
                      alt={hour.condition} 
                      className="hourly-icon"
                    />
                    <p className="hourly-temp">{hour.temp}</p>
                    <p className="condition">{hour.condition}</p>
                    <p><i className="fas fa-tint"></i> {hour.precipitation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="card map-card">
            <h3><i className="fas fa-map"></i> Live Weather Radar</h3>
            <div className="radar-container">
              <iframe 
                src={`https://embed.windy.com/embed2.html?lat=${coordinates.lat}&lon=${coordinates.lon}&zoom=5&level=surface&overlay=radar&menu=true&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=${unitSystem === 'metric' ? 'default' : 'mph'}&metricTemp=${unitSystem === 'metric' ? 'default' : 'fahrenheit'}&radarRange=-1&features=&disabled=geolocation`} 
                frameBorder="0"
                title="Weather Radar"
                allowFullScreen
              ></iframe>
            </div>
            <div className="radar-controls">
              <p>Interact with the map to explore weather conditions. Use the layers menu to view different weather data.</p>
            </div>
          </div>
          
          <div className="card weather-tips-card">
            <h3><i className="fas fa-shield-alt"></i> Weather Safety Tips</h3>
            <div className="weather-tips">
              <div className="tip">
                <h4><i className="fas fa-bolt"></i> Thunderstorms & Lightning</h4>
                <ul>
                  <li>Seek shelter in a building or car with a solid roof</li>
                  <li>Avoid open areas, tall isolated trees, and metal objects</li>
                  <li>Unplug electronic equipment before the storm arrives</li>
                </ul>
              </div>
              <div className="tip">
                <h4><i className="fas fa-water"></i> Floods</h4>
                <ul>
                  <li>Move to higher ground if flash flooding is possible</li>
                  <li>Never walk or drive through flood waters</li>
                  <li>6 inches of moving water can knock you down; 12 inches can carry vehicles away</li>
                </ul>
              </div>
              <div className="tip">
                <h4><i className="fas fa-temperature-high"></i> Extreme Heat</h4>
                <ul>
                  <li>Stay hydrated and avoid direct sunlight during peak hours</li>
                  <li>Wear lightweight, light-colored clothing</li>
                  <li>Check on elderly neighbors and those without air conditioning</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="card">
            <h3><i className="fas fa-satellite"></i> Satellite View</h3>
            <div className="satellite-container">
              <img 
                src="https://mausam.imd.gov.in/Satellite/3Dasiasec_ir1.jpg" 
                className="satellite-view" 
                alt="Satellite View"
              />
            </div>
          </div>
          
          <div className="card powered-by">
            <p>
              Weather data powered by OpenWeatherMap, Open-Meteo, and WeatherAPI.com
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Weather; 