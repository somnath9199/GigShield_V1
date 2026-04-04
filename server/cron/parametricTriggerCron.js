const cron = require("node-cron");
const supabase = require("../config/supabase");
const { getCoordinatesForZone, getWeatherForCoordinates, checkDisastersInBox } = require("../services/ApiIntegrations");
const { zomatoRiders, swiggyRiders, zeptoRiders } = require("../data/Riders");

const findRiderSync = (riderId) => {
  return zomatoRiders[riderId] || swiggyRiders[riderId] || zeptoRiders[riderId] || null;
};

// Extract clean city name for geocoding (handles "Bhubaneswar Municipal Corporation" → "Bhubaneswar")
const KNOWN_CITIES = [
  "Mumbai","Chennai","Kolkata","Kochi","Bhubaneswar","Visakhapatnam",
  "Hyderabad","Bengaluru","Bangalore","Delhi","Pune","Ahmedabad",
  "Surat","Jaipur","Lucknow","Chandigarh","Indore","Coimbatore",
  "Guwahati","Patna","Nagpur","Bhopal","Vadodara","Agra"
];
const getCleanCityName = (city = "") => {
  const c = city.toLowerCase();
  const match = KNOWN_CITIES.find(k => c.includes(k.toLowerCase()));
  return match || city.split(" ")[0];
};

console.log("🌦️  Parametric trigger cron initialized — runs every 5 minutes.");

// Runs every 5 minutes — change to "0 * * * *" for production (hourly)
cron.schedule("*/5 * * * *", async () => {
  console.log("\n⚡ PARAMETRIC TRIGGER CRON START:", new Date().toLocaleString());

  try {
    // 1. Fetch all active users with a coverage policy
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*")
      .eq("coverage_status", "Active");

    if (usersError) throw new Error(usersError.message);
    if (!users || users.length === 0) {
      console.log("No active users to evaluate.");
      return;
    }

    console.log(`Found ${users.length} active users to evaluate.`);

    const processedZones = new Set();

    for (let u of users) {
      const riderData = findRiderSync(u.rider_id) || {};
      const city     = u.city || riderData.city;
      const zone     = u.city ? u.city : riderData.zone;
      const cleanCity = getCleanCityName(city || "");  // e.g. "Bhubaneswar"

      if (!city || !zone) {
        console.log(`⚠️  Skipping ${u.name} — no city/zone found.`);
        continue;
      }

      const locationKey = `${zone}_${city}`;
      if (processedZones.has(locationKey)) continue;

      // 2. Geocode using clean city name
      let lat = riderData.current_lat;
      let lng = riderData.current_lng;
      if (!lat || !lng) {
        const coords = await getCoordinatesForZone(cleanCity, cleanCity);
        if (coords) { lat = coords.lat; lng = coords.lng; }
      }
      if (!lat || !lng) {
        console.log(`⚠️  Could not geocode ${zone}, ${city}. Skipping.`);
        continue;
      }
      processedZones.add(locationKey);

      // 3. Fetch live weather
      const weather = await getWeatherForCoordinates(lat, lng);
      console.log(`📍 ${city} — Rain: ${weather.rain_1h}mm/hr, Temp: ${weather.temp_celsius}°C [${weather.provider}]`);

      // 4. Fetch NASA disaster data
      const disaster = await checkDisastersInBox(lat, lng);

      // 5. Evaluate trigger conditions
      let triggerMet = false;
      let disruptionType = "";
      let severity = "low";

      if (weather.rain_1h >= 60) {
        triggerMet = true;
        disruptionType = "Heavy Rainfall";
        severity = "high";
        console.log(`🌧️  TRIGGER: Heavy rain (${weather.rain_1h}mm) in ${city}`);
      }

      if (!triggerMet && disaster.has_disaster) {
        triggerMet = true;
        disruptionType = disaster.events[0].category || "Natural Disaster";
        severity = "high";
        console.log(`🌍 TRIGGER: NASA disaster (${disruptionType}) near ${city}`);
      }

      // Heat check — only for users with heat add-on (per-user, not per-zone)
      if (!triggerMet && weather.temp_celsius >= 45) {
        // Don't set global triggerMet — handle heat per-user below
        console.log(`🔥 Heat warning: ${weather.temp_celsius}°C in ${city}`);
      }

      // 6. If zone trigger met, insert disruption + payout for all users in this zone
      if (triggerMet) {
        const newDisruption = {
          external_id: `AUTO_${Date.now()}`,
          state: riderData.state || "Unknown",
          city,
          zone,
          disruption_type: disruptionType,
          severity,
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          payout_trigger: true,
          status: "active"
        };

        const { data: insertedDisruption, error: dErr } = await supabase
          .from("disruptions")
          .insert([newDisruption])
          .select()
          .maybeSingle();

        if (dErr) { console.error("❌ Disruption insert error:", dErr); continue; }
        if (!insertedDisruption) continue;

        console.log(`✅ Disruption created: ID ${insertedDisruption.id} for ${city}`);

        // Find all active users in this city
        const affectedUsers = users.filter((au) => {
          const auCity = au.city || (findRiderSync(au.rider_id) || {}).city;
          return auCity === city;
        });

        for (let targetUser of affectedUsers) {
          let payoutAmount = 400;
          if (targetUser.selected_plan?.toLowerCase().includes("rakshak")) payoutAmount = 500;
          if (targetUser.selected_plan?.toLowerCase().includes("suraksha")) payoutAmount = 700;

          const { error: pErr } = await supabase.from("payouts").insert([{
            user_id: targetUser.id,
            rider_id: targetUser.rider_id,
            disruption_id: insertedDisruption.id,
            amount: payoutAmount,
            status: "paid",
            paid_at: new Date().toISOString(),
            bank_account_number: targetUser.bank_account_number || "DEMO-12345",
            bank_ifsc: targetUser.bank_ifsc || "DEMO00000",
            bank_account_holder: targetUser.bank_account_holder || targetUser.name
          }]);

          if (pErr) console.error(`❌ Payout error for ${targetUser.name}:`, pErr.message);
          else console.log(`💸 Payout of ₹${payoutAmount} queued for ${targetUser.name}`);
        }
      }

      // Handle heat trigger per-user (only if they have the heat add-on)
      if (!triggerMet && weather.temp_celsius >= 45) {
        const heatUsers = users.filter((au) => {
          const auCity = au.city || (findRiderSync(au.rider_id) || {}).city;
          return auCity === city && au.include_heat === true;
        });

        if (heatUsers.length > 0) {
          const heatDisruption = {
            external_id: `HEAT_${Date.now()}`,
            state: riderData.state || "Unknown",
            city, zone,
            disruption_type: "Extreme Heat Warning",
            severity: "medium",
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            payout_trigger: true,
            status: "active"
          };

          const { data: heatDisruptionInserted, error: hdErr } = await supabase
            .from("disruptions").insert([heatDisruption]).select().maybeSingle();

          if (hdErr || !heatDisruptionInserted) continue;

          for (let hu of heatUsers) {
            await supabase.from("payouts").insert([{
              user_id: hu.id,
              rider_id: hu.rider_id,
              disruption_id: heatDisruptionInserted.id,
              amount: 300,
              status: "paid",
              paid_at: new Date().toISOString(),
              bank_account_number: hu.bank_account_number || "DEMO-12345",
              bank_ifsc: hu.bank_ifsc || "DEMO00000",
              bank_account_holder: hu.bank_account_holder || hu.name
            }]);
            console.log(`🌡️  Heat payout of ₹300 queued for ${hu.name}`);
          }
        }
      }
    }

    console.log("✅ PARAMETRIC TRIGGER CRON COMPLETE\n");
  } catch (error) {
    console.error("🔥 PARAMETRIC TRIGGER CRON ERROR:", error.message);
  }
});
