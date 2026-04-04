// Mock disruption events for testing
// In production these come from the disruptions table in Supabase

const now = new Date();

const mockDisruptions = [
  {
    id: "MOCK_001",
    external_id: "WB_FLOOD_2024_01",
    state: "West Bengal",
    city: "Kolkata",
    zone: "South Kolkata",
    disruption_type: "Flood",
    description: "Heavy flooding reported in South Kolkata due to cyclone aftermath",
    severity: "high",
    start_time: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    payout_trigger: true,
    status: "active",
  },
  {
    id: "MOCK_002",
    external_id: "MH_RAIN_2024_01",
    state: "Maharashtra",
    city: "Mumbai",
    zone: "Western Suburbs",
    disruption_type: "Heavy Rainfall",
    description: "IMD red alert issued — extreme rainfall expected across Mumbai",
    severity: "high",
    start_time: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
    payout_trigger: true,
    status: "active",
  },
  {
    id: "MOCK_003",
    external_id: "DL_CURFEW_2024_01",
    state: "Delhi",
    city: "Delhi",
    zone: "Central Delhi",
    disruption_type: "Local Curfew",
    description: "Section 144 imposed in Central Delhi due to political unrest",
    severity: "medium",
    start_time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString(),
    payout_trigger: true,
    status: "scheduled",
  },
];

module.exports = mockDisruptions;
