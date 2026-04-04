require('dotenv').config({ path: '.env' });
const supabase = require('./config/supabase');

(async () => {
  const newDisruption = {
    external_id: `AUTO_${Date.now()}`,
    state: "Test",
    city: "Test",
    zone: "Test",
    disruption_type: "Test",
    severity: "low",
    description: "test",
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

  console.log("Error:", dErr);
  console.log("Data:", insertedDisruption);
})();
