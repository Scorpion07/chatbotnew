// backend/src/services/weatherService.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHER_API_BASE = 'https://api.openweathermap.org/data/2.5';

/**
 * Get current weather for a city
 * @param {string} city - City name (e.g., "London", "New York", "Tokyo")
 * @returns {Promise<object>} Weather data
 */
export async function getCurrentWeather(city) {
  if (!OPENWEATHER_API_KEY) {
    throw new Error('OpenWeatherMap API key not configured');
  }

  try {
    const url = `${WEATHER_API_BASE}/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`City "${city}" not found`);
      }
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      city: data.name,
      country: data.sys.country,
      temperature: {
        current: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        min: Math.round(data.main.temp_min),
        max: Math.round(data.main.temp_max),
        unit: 'Celsius'
      },
      weather: {
        main: data.weather[0].main,
        description: data.weather[0].description,
        icon: data.weather[0].icon
      },
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      wind: {
        speed: data.wind.speed,
        deg: data.wind.deg
      },
      clouds: data.clouds.all,
      visibility: data.visibility,
      timestamp: new Date(data.dt * 1000).toISOString()
    };
  } catch (error) {
    console.error('❌ Weather API error:', error.message);
    throw error;
  }
}

/**
 * Get weather forecast for a city (5 day / 3 hour)
 * @param {string} city - City name
 * @returns {Promise<object>} Forecast data
 */
export async function getWeatherForecast(city) {
  if (!OPENWEATHER_API_KEY) {
    throw new Error('OpenWeatherMap API key not configured');
  }

  try {
    const url = `${WEATHER_API_BASE}/forecast?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`City "${city}" not found`);
      }
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      city: data.city.name,
      country: data.city.country,
      forecast: data.list.slice(0, 8).map(item => ({ // Next 24 hours (8 x 3-hour periods)
        time: new Date(item.dt * 1000).toISOString(),
        temperature: Math.round(item.main.temp),
        feels_like: Math.round(item.main.feels_like),
        weather: item.weather[0].description,
        humidity: item.main.humidity,
        wind_speed: item.wind.speed
      }))
    };
  } catch (error) {
    console.error('❌ Weather Forecast API error:', error.message);
    throw error;
  }
}

/**
 * Format weather data for AI context
 * @param {object} weatherData - Weather data from getCurrentWeather
 * @returns {string} Formatted string for AI
 */
export function formatWeatherForAI(weatherData) {
  return `Current weather in ${weatherData.city}, ${weatherData.country}:
- Temperature: ${weatherData.temperature.current}°C (feels like ${weatherData.temperature.feels_like}°C)
- Conditions: ${weatherData.weather.description}
- Humidity: ${weatherData.humidity}%
- Wind: ${weatherData.wind.speed} m/s
- Pressure: ${weatherData.pressure} hPa
- Visibility: ${weatherData.visibility / 1000} km`;
}

console.log('🌤️ Weather Service initialized:', !!OPENWEATHER_API_KEY ? 'Ready' : 'Missing API key');
