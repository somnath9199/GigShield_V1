require('dotenv').config({ path: '.env' });
const { getCoordinatesForZone, getWeatherForCoordinates, checkDisastersInBox } = require('./services/ApiIntegrations');
const { zomatoRiders } = require('./data/Riders');

(async () => {
  const rider = zomatoRiders["ZM002"];
  console.log(`Rider Target: ayush (mapped to mock ID ZM002 via Supabase signup)`);
  console.log(`Operating Zone: ${rider.zone}, ${rider.city}, ${rider.state}`);
  console.log("-----------------------------------------");

  console.log("--- 1. Testing OpenCage Geocoding API ---");
  const coords = await getCoordinatesForZone(rider.city, rider.zone);
  console.log("OpenCage Response:", coords);
  console.log("");

  let lat = coords?.lat || 28.5677;
  let lng = coords?.lng || 77.2433;

  console.log("--- 2. Testing Weatherbit API ---");
  const ogOwmKey = process.env.OPENWEATHERMAP_API_KEY;
  process.env.OPENWEATHERMAP_API_KEY = ""; 
  const weatherbitRes = await getWeatherForCoordinates(lat, lng);
  console.log("Weatherbit Output:", {
    rain_1h: weatherbitRes.rain_1h,
    temp_celsius: weatherbitRes.temp_celsius,
    provider: weatherbitRes.provider,
    is_simulated: weatherbitRes.is_simulated
  });
  console.log("");

  console.log("--- 3. Testing OpenWeatherMap API ---");
  process.env.OPENWEATHERMAP_API_KEY = ogOwmKey;
  process.env.WEATHERBIT_API_KEY = "";
  const owmRes = await getWeatherForCoordinates(lat, lng);
  console.log("OpenWeatherMap Output:", {
    rain_1h: owmRes.rain_1h,
    temp_celsius: owmRes.temp_celsius,
    provider: owmRes.provider,
    is_simulated: owmRes.is_simulated
  });
  console.log("");

  console.log("--- 4. Testing NASA EONET API ---");
  const eventRes = await checkDisastersInBox(lat, lng);
  console.log("NASA Output (any live disasters around lat/lng?):", eventRes);
})();
