const { zomatoRiders } = require("../data/Riders");

const Dynamic_calculator = async (req, res) => {
  try {
    const { fleetId } = req.params;

    const rider = zomatoRiders[fleetId];

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    // Eligibility check
    if (rider.status !== "active") {
      return res.status(400).json({
        success: false,
        message: `Rider is not eligible because account status is ${rider.status}`,
      });
    }

    // --- ML API Integration ---
    const highRiskCities = ['Mumbai', 'Chennai', 'Kolkata', 'Kochi', 'Bhubaneswar', 'Visakhapatnam'];
    const safeCities = ['Jaipur', 'Lucknow', 'Chandigarh', 'Indore', 'Coimbatore'];
    const riskZone = highRiskCities.includes(rider.city) ? 'HIGH' : (safeCities.includes(rider.city) ? 'SAFE' : 'MODERATE');

    const mlPayload = {
      city: rider.city,
      risk_zone: riskZone,
      plan: 'RAKSHAK',
      claim_history: 0,
      policy_year: 1,
      heat_addon: 0,
      monthly_earnings: rider.avg_earnings_per_day * 26,
      daily_hours: rider.avg_daily_hours,
      vehicle_type: rider.vehicle_type === 'bicycle' ? 'cycle' : 'two_wheeler',
      platform: "Zomato",
      disruption_days_hist: riskZone === 'HIGH' ? 12 : (riskZone === 'SAFE' ? 3 : 7)
    };

    const response = await fetch('http://localhost:5000/predict/premium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mlPayload)
    });

    const mlResult = await response.json();

    if (!mlResult.success) {
      throw new Error(mlResult.message || "Failed to calculate AI premium");
    }

    const aiAssignedAnnualPremium = mlResult.data.final_price;
    let final_price = Math.round(aiAssignedAnnualPremium / 52);

    return res.status(200).json({
      success: true,
      message: "Dynamic premium calculated successfully via AI Model",
      data: {
        fleet_id: rider.rider_id,
        rider_name: rider.full_name,
        city: rider.city,
        zone: rider.zone,
        account_status: rider.status,
        base_annual_premium: aiAssignedAnnualPremium,
        ml_inputs: mlPayload,
        final_price,
      },
    });
  } catch (error) {
    console.error("Dynamic calculator error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = Dynamic_calculator;