const axios = require("axios");

// 1. OpenCage for Reverse/Forward Geocoding
const getCoordinatesForZone = async (city, zone) => {
  const apiKey = process.env.OPENCAGE_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ OPENCAGE_API_KEY missing.");
    return null; // Fallback to missing
  }

  try {
    const query = `${zone}, ${city}, India`;
    const response = await axios.get(`https://api.opencagedata.com/geocode/v1/json`, {
      params: {
        q: query,
        key: apiKey,
        limit: 1,
      }
    });

    if (response.data && response.data.results && response.data.results.length > 0) {
      return {
        lat: parseFloat(response.data.results[0].geometry.lat),
        lng: parseFloat(response.data.results[0].geometry.lng),
      };
    }
    return null; 
  } catch (error) {
    console.error(`OpenCage Error for ${city}, ${zone}:`, error.message);
    return null;
  }
};

// 2. Weather APIs (Weatherbit with OpenWeatherMap Fallback)
const getWeatherForCoordinates = async (lat, lng) => {
  const weatherbitKey = process.env.WEATHERBIT_API_KEY;
  const openWeatherKey = process.env.OPENWEATHERMAP_API_KEY;

  // Try Weatherbit First
  if (weatherbitKey) {
    try {
      const response = await axios.get(`https://api.weatherbit.io/v2.0/current`, {
        params: { lat: lat, lon: lng, key: weatherbitKey },
      });
      const dataArray = response.data.data;
      if (dataArray && dataArray.length > 0) {
        return {
          rain_1h: dataArray[0].precip || 0,
          temp_celsius: dataArray[0].temp || 0,
          is_simulated: false,
          raw: dataArray[0],
          provider: "weatherbit"
        };
      }
    } catch (error) {
      console.error("Weatherbit Error. Falling back...", error.message);
    }
  }

  // Fallback to OpenWeatherMap
  if (openWeatherKey) {
    try {
      const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
        params: { lat, lon: lng, appid: openWeatherKey, units: "metric" },
      });
      const data = response.data;
      return {
        rain_1h: data.rain ? data.rain["1h"] || 0 : 0,
        temp_celsius: data.main ? data.main.temp : 0,
        is_simulated: false,
        raw: data,
        provider: "openweathermap"
      };
    } catch (error) {
      console.error("OpenWeatherMap Error. Falling back...", error.message);
    }
  }

  // Final Fallback: Simulated Data
  console.warn("⚠️ Both Weather APIs failed or keys missing. Using simulated data.");
  const isExtreme = Math.random() < 0.1;
  return {
    rain_1h: isExtreme ? 75.0 : 0.0,
    temp_celsius: isExtreme ? 38 : 30, // Randomly trigger heat
    is_simulated: true,
    provider: "simulated"
  };
};

// 3. NASA EONET (Earth Observatory Natural Event Tracker)
// Public API - Tracks severe events
const checkDisastersInBox = async (lat, lng) => {
  try {
    // Create a ~30km bounding box around the coordinates
    // 1 degree lat/lng ~= 111km, so 0.3 degrees is roughly 30km
    const minLng = lng - 0.3;
    const minLat = lat - 0.3;
    const maxLng = lng + 0.3;
    const maxLat = lat + 0.3;

    const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;

    const response = await axios.get(`https://eonet.gsfc.nasa.gov/api/v3/events`, {
      params: {
        bbox: bbox,
        days: 7, // Events in the last 7 days
      },
    });

    if (response.data && response.data.events && response.data.events.length > 0) {
      // Find events like Severe Storms, Floods, Wildcats, etc.
      return {
        has_disaster: true,
        events: response.data.events.map((e) => ({
          title: e.title,
          category: e.categories[0]?.title,
        })),
      };
    }

    return { has_disaster: false, events: [] };
  } catch (error) {
    console.error("NASA EONET Error:", error.message);
    return { has_disaster: false, events: [] };
  }
};

module.exports = {
  getCoordinatesForZone,
  getWeatherForCoordinates,
  checkDisastersInBox,
};
