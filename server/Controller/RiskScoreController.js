const supabase = require("../config/supabase");
const {
  getCoordinatesForZone,
  getWeatherForCoordinates,
  checkDisastersInBox,
} = require("../services/ApiIntegrations");

// Risk Zone definition for Indian cities (partial match)
const CITY_RISK_ZONES = [
  { names: ["Mumbai"],         zone: "HIGH" },
  { names: ["Chennai"],        zone: "HIGH" },
  { names: ["Kolkata"],        zone: "HIGH" },
  { names: ["Kochi"],          zone: "HIGH" },
  { names: ["Bhubaneswar"],    zone: "HIGH" },
  { names: ["Visakhapatnam","Vizag"], zone: "HIGH" },
  { names: ["Hyderabad"],      zone: "MODERATE" },
  { names: ["Bengaluru","Bangalore"], zone: "MODERATE" },
  { names: ["Delhi","New Delhi"],     zone: "MODERATE" },
  { names: ["Pune"],           zone: "MODERATE" },
  { names: ["Ahmedabad"],      zone: "MODERATE" },
  { names: ["Surat"],          zone: "MODERATE" },
  { names: ["Jaipur"],         zone: "SAFE" },
  { names: ["Lucknow"],        zone: "SAFE" },
  { names: ["Chandigarh"],     zone: "SAFE" },
  { names: ["Indore"],         zone: "SAFE" },
  { names: ["Coimbatore"],     zone: "SAFE" },
];

const getRiskZone = (city = "") => {
  const c = city.toLowerCase();
  const match = CITY_RISK_ZONES.find(entry =>
    entry.names.some(n => c.includes(n.toLowerCase()))
  );
  return match ? match.zone : "MODERATE";
};

// Extract clean city keyword for geo-lookup (first recognisable word)
const getCleanCityName = (city = "") => {
  const c = city.toLowerCase();
  for (const entry of CITY_RISK_ZONES) {
    for (const n of entry.names) {
      if (c.includes(n.toLowerCase())) return n;
    }
  }
  return city.split(" ")[0]; // fallback: first word
};

const ZONE_BASE_SCORE = { HIGH: 40, MODERATE: 20, SAFE: 5 };

const getRiskScore = async (req, res) => {
  try {
    const { phone } = req.params;
    if (!phone) return res.status(400).json({ success: false, message: "Phone required" });

    // 1. Fetch rider profile
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", decodeURIComponent(phone))
      .maybeSingle();

    if (userError || !user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const city = user.city || "Delhi";
    const cleanCity = getCleanCityName(city);   // e.g. "Bhubaneswar"
    const riskZone  = getRiskZone(city);          // HIGH / MODERATE / SAFE

    // 2. Get coordinates + live weather using clean city name
    let coords  = await getCoordinatesForZone(cleanCity, cleanCity);
    let weather = { rain_1h: 0, temp_celsius: 30, is_simulated: false, provider: "none" };
    let disaster = { has_disaster: false, events: [] };

    if (coords) {
      [weather, disaster] = await Promise.all([
        getWeatherForCoordinates(coords.lat, coords.lng),
        checkDisastersInBox(coords.lat, coords.lng),
      ]);
    }

    // 3. Fetch recent payouts (= past disruption events for this rider)
    const { data: recentPayouts } = await supabase
      .from("payouts")
      .select("amount, paid_at, status")
      .eq("user_id", user.id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(10);

    const pastDisruptionCount = recentPayouts?.length || 0;

    // 4. Compute risk score (0-100)
    let score = 0;
    const factors = [];

    // a) Zone base
    const zoneScore = ZONE_BASE_SCORE[riskZone];
    score += zoneScore;
    factors.push({
      label: "Location Risk Zone",
      value: riskZone,
      points: zoneScore,
      icon: riskZone === "HIGH" ? "🔴" : riskZone === "MODERATE" ? "🟡" : "🟢",
      detail: `${city} is classified as a ${riskZone} disruption zone`,
    });

    // b) Rainfall risk
    const rain = weather.rain_1h || 0;
    let rainScore = 0;
    let rainLabel = "No rain";
    if (rain >= 60) { rainScore = 30; rainLabel = `Heavy rain (${rain}mm/hr)`; }
    else if (rain >= 30) { rainScore = 20; rainLabel = `Moderate rain (${rain}mm/hr)`; }
    else if (rain >= 10) { rainScore = 10; rainLabel = `Light rain (${rain}mm/hr)`; }
    score += rainScore;
    factors.push({
      label: "Live Rainfall",
      value: rainLabel,
      points: rainScore,
      icon: rain >= 30 ? "🌧️" : rain > 0 ? "🌦️" : "☀️",
      detail: `Current precipitation: ${rain}mm/hr`,
    });

    // c) Temperature risk
    const temp = weather.temp_celsius || 30;
    let heatScore = 0;
    let heatLabel = `${temp}°C`;
    if (temp >= 45) { heatScore = 15; heatLabel = `Extreme heat (${temp}°C)`; }
    else if (temp >= 40) { heatScore = 8; heatLabel = `High heat (${temp}°C)`; }
    score += heatScore;
    if (heatScore > 0) {
      factors.push({
        label: "Heat Alert",
        value: heatLabel,
        points: heatScore,
        icon: "🌡️",
        detail: "Extreme heat may affect your ability to work safely",
      });
    }

    // d) NASA disaster
    let disasterScore = 0;
    if (disaster.has_disaster) {
      disasterScore = 20;
      score += disasterScore;
      factors.push({
        label: "Active NASA Disaster",
        value: disaster.events[0]?.title || "Natural Event Detected",
        points: disasterScore,
        icon: "🛰️",
        detail: `NASA EONET reports: ${disaster.events.map(e => e.title).join(", ")}`,
      });
    }

    // e) Historical disruptions
    let historyScore = Math.min(pastDisruptionCount * 3, 15);
    score += historyScore;
    factors.push({
      label: "Past Disruptions",
      value: `${pastDisruptionCount} events`,
      points: historyScore,
      icon: "📋",
      detail: `You have had ${pastDisruptionCount} payout-eligible disruptions`,
    });

    // Cap score at 100
    score = Math.min(score, 100);

    // 5. Generate recommendation
    let riskLevel, riskColor, recommendation;
    if (score >= 70) {
      riskLevel = "High";
      riskColor = "#f26c6c";
      recommendation = user.selected_plan?.toLowerCase().includes("suraksha")
        ? "You're on the best plan. Stay safe and avoid unnecessary trips today."
        : "Consider upgrading to SURAKSHA for maximum ₹700/day coverage during high-risk periods.";
    } else if (score >= 35) {
      riskLevel = "Moderate";
      riskColor = "#f5a623";
      recommendation = user.selected_plan?.toLowerCase().includes("rakshak") || user.selected_plan?.toLowerCase().includes("suraksha")
        ? "Your current plan covers moderate disruptions well. Stay alert."
        : "Consider the RAKSHAK plan for ₹500/day payout coverage.";
    } else {
      riskLevel = "Low";
      riskColor = "#4ade80";
      recommendation = "Conditions look safe today. A great day to maximize your earnings!";
    }

    return res.status(200).json({
      success: true,
      data: {
        score,
        riskLevel,
        riskColor,
        recommendation,
        city,
        riskZone,
        weather: {
          rain_1h: rain,
          temp_celsius: temp,
          is_simulated: weather.is_simulated,
          provider: weather.provider,
        },
        disaster,
        factors,
        currentPlan: user.selected_plan || "None",
        coverageStatus: user.coverage_status || "Inactive",
        pastDisruptionCount,
      },
    });
  } catch (err) {
    console.error("Risk Score Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getRiskScore };
