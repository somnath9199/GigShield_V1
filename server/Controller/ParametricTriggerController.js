const supabase = require("../config/supabase");
const { getCoordinatesForZone, getWeatherForCoordinates, checkDisastersInBox } = require("../services/ApiIntegrations");


// A mapping to find out which city a rider is in based on their ID
// In a real app we would read this from the `users` table or their active session, 
// but based on your architecture it seems we read city from Riders.js (Mock riders)
const { zomatoRiders, swiggyRiders, zeptoRiders } = require("../data/Riders");
const findRiderSync = (riderId) => {
  return zomatoRiders[riderId] || swiggyRiders[riderId] || zeptoRiders[riderId] || null;
};

const runTriggers = async (req, res) => {
  try {
    // 1. Fetch all users who have an active parametric policy
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*")
      .eq("coverage_status", "Active");

    if (usersError) throw new Error(usersError.message);

    if (!users || users.length === 0) {
      return res.status(200).json({ message: "No active users found for evaluation." });
    }

    const processedZones = new Set();
    const generatedDisruptions = [];
    const generatedPayouts = [];

    // FAST PATH: If force=true, skip all geocoding/weather API calls and
    // directly create disruptions + payouts for every active user
    if (req.query.force === 'true') {
      for (let u of users) {
        const riderData = findRiderSync(u.rider_id) || {};
        const city  = u.city || riderData.city || "Unknown";
        const zone  = u.city || riderData.zone  || "Unknown";

        const newDisruption = {
          external_id: `AUTO_${Date.now()}_${u.rider_id}`,
          state: riderData.state || "Unknown",
          city: city,
          zone: zone,
          disruption_type: "Heavy Rainfall",
          severity: "high",
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

        if (dErr) { console.error("Disruption insert error:", dErr); continue; }
        if (!insertedDisruption) continue;

        generatedDisruptions.push(insertedDisruption);
        const d_id = insertedDisruption.id;

        let payoutAmount = 400;
        if (u.selected_plan?.toLowerCase().includes("rakshak")) payoutAmount = 500;
        if (u.selected_plan?.toLowerCase().includes("suraksha")) payoutAmount = 700;

        const newPayout = {
          user_id: u.id,
          rider_id: u.rider_id,
          disruption_id: d_id,
          amount: payoutAmount,
          status: "paid",
          paid_at: new Date().toISOString(),
          bank_account_number: u.bank_account_number || "DEMO-12345",
          bank_ifsc: u.bank_ifsc || "DEMO00000",
          bank_account_holder: u.bank_account_holder || u.name
        };

        const { data: insertedPayout, error: pErr } = await supabase
          .from("payouts")
          .insert([newPayout])
          .select()
          .maybeSingle();

        if (pErr) console.error("Payout insert error:", pErr);
        else generatedPayouts.push(insertedPayout);
      }

      return res.status(200).json({
        success: true,
        message: "Parametric triggers evaluation completed. [FORCED]",
        zones_evaluated: users.length,
        disruptions_generated: generatedDisruptions.length,
        payouts_triggered: generatedPayouts.length,
        details: { disruptions: generatedDisruptions, payouts: generatedPayouts }
      });
    }

    // REAL-TIME PATH: fetch actual weather from APIs
    for (let u of users) {
      const riderData = findRiderSync(u.rider_id) || {};
      
      const city = u.city || riderData.city;
      const zone = u.city ? u.city : riderData.zone;
      
      if (!city || !zone) continue;
      
      const locationKey = `${zone}_${city}`;

      // We only want to query weather APIs once per zone per run to save API calls
      if (processedZones.has(locationKey)) continue;

      // 2. OpenCage Geocoding
      let lat = riderData.current_lat;
      let lng = riderData.current_lng;
      if (!lat || !lng) {
        const coords = await getCoordinatesForZone(city, zone);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      }

      if (!lat || !lng) continue;
      processedZones.add(locationKey);

      // 3. Weather APIs
      const weather = await getWeatherForCoordinates(lat, lng);

      // 4. NASA EONET
      const disaster = await checkDisastersInBox(lat, lng);

      let triggerMet = false;
      let disruptionType = "";
      let severity = "low";

      if (weather.rain_1h >= 60) {
        triggerMet = true;
        disruptionType = "Heavy Rainfall";
        severity = "high";
      }
      if (!triggerMet && u.include_heat && weather.temp_celsius >= 45) {
        triggerMet = true;
        disruptionType = "Extreme Heat Warning";
        severity = "medium";
      }
      if (!triggerMet && disaster.has_disaster) {
        triggerMet = true;
        disruptionType = disaster.events[0].category || "Natural Disaster";
        severity = "high";
      }

      if (triggerMet) {
        const newDisruption = {
          external_id: `AUTO_${Date.now()}`,
          state: riderData.state || "Unknown",
          city: city,
          zone: zone,
          disruption_type: disruptionType,
          severity: severity,
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

        if (dErr) { console.error("Disruption insert error:", dErr); continue; }
        if (!insertedDisruption) continue;

        generatedDisruptions.push(insertedDisruption);
        const d_id = insertedDisruption.id;

        const affectedUsers = users.filter((affectedUser) => {
           const userCity = affectedUser.city || (findRiderSync(affectedUser.rider_id) || {}).city;
           return userCity === city;
        });

        for (let targetUser of affectedUsers) {
          let payoutAmount = 400; 
          if (targetUser.selected_plan?.toLowerCase().includes("rakshak")) payoutAmount = 500;
          if (targetUser.selected_plan?.toLowerCase().includes("suraksha")) payoutAmount = 700;

          const newPayout = {
            user_id: targetUser.id,
            rider_id: targetUser.rider_id,
            disruption_id: d_id,
            amount: payoutAmount,
            status: "paid",
            paid_at: new Date().toISOString(),
            bank_account_number: targetUser.bank_account_number || "DEMO-12345",
            bank_ifsc: targetUser.bank_ifsc || "DEMO00000",
            bank_account_holder: targetUser.bank_account_holder || targetUser.name
          };

          const { data: insertedPayout, error: pErr } = await supabase
            .from("payouts")
            .insert([newPayout])
            .select()
            .maybeSingle();

          if (pErr) console.error("Payout insert error:", pErr);
          else generatedPayouts.push(insertedPayout);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Parametric triggers evaluation completed.",
      zones_evaluated: processedZones.size,
      disruptions_generated: generatedDisruptions.length,
      payouts_triggered: generatedPayouts.length,
      details: {
        disruptions: generatedDisruptions,
        payouts: generatedPayouts
      }
    });

  } catch (error) {
    console.error("Parametric trigger run failed:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during parametric trigger evaluation.",
      error: error.message
    });
  }
};

module.exports = {
  runTriggers
};
