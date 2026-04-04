const supabase = require("../config/supabase");

const curfewDetection = async (req, res) => {
  try {
    const { imageBase64, userPhone } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: "No image provided" });
    }

    // 1. Call the Python AI Microservice
    const response = await fetch('http://localhost:5000/predict/curfew', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_base64: imageBase64 })
    });

    const aiResult = await response.json();

    if (!response.ok || !aiResult.success) {
      throw new Error(aiResult.message || "AI Model inference failed");
    }

    const { prediction, confidence, is_blocked } = aiResult.data;

    // 2. Business Logic based on AI output
    if (is_blocked && confidence > 0.65) { // 65% certainty threshold 

      if (userPhone) {
        // Try the phone as-is first, then strip/add +91 prefix
        let { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('phone', userPhone)
          .maybeSingle();

        if (!user) {
          // Try with +91 prefix if not already there
          const altPhone = userPhone.startsWith('+91')
            ? userPhone.replace('+91', '')
            : `+91${userPhone}`;
          ({ data: user } = await supabase
            .from('users')
            .select('*')
            .eq('phone', altPhone)
            .maybeSingle());
        }

        if (user && user.coverage_status === 'Active') {
          // Calculate payout amount based on plan
          let payoutAmount = 400;
          if (user.selected_plan?.toLowerCase().includes('rakshak')) payoutAmount = 500;
          if (user.selected_plan?.toLowerCase().includes('suraksha')) payoutAmount = 700;

          // Insert disruption record
          const { data: disruption, error: dErr } = await supabase
            .from('disruptions')
            .insert([{
              external_id: `CURFEW_AI_${Date.now()}`,
              city: user.city || 'Unknown',
              zone: user.city || 'Unknown',
              state: 'Unknown',
              disruption_type: 'Road Blockade (AI Verified)',
              severity: 'high',
              start_time: new Date().toISOString(),
              end_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
              payout_trigger: true,
              status: 'active'
            }])
            .select()
            .maybeSingle();

          if (dErr) console.error('Disruption insert error:', dErr.message);

          // Insert the payout
          const { error: pErr } = await supabase
            .from('payouts')
            .insert([{
              user_id: user.id,
              rider_id: user.rider_id,
              disruption_id: disruption?.id || null,
              amount: payoutAmount,
              status: 'paid',
              paid_at: new Date().toISOString(),
              bank_account_number: user.bank_account_number || 'DEMO-12345',
              bank_ifsc: user.bank_ifsc || 'DEMO00000',
              bank_account_holder: user.bank_account_holder || user.name
            }]);

          if (pErr) {
            console.error('Payout insert error:', pErr.message);
          } else {
            console.log(`✅ Curfew payout issued: ₹${payoutAmount} to ${user.name}`);
          }
        } else if (!user) {
          console.warn('CurfewDetection: user not found for phone', userPhone);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Blockade AI-Verified!",
        data: {
          prediction,
          confidence,
          payout_issued: true
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Analyzed successfully",
      data: {
        prediction,
        confidence,
        payout_issued: false
      }
    });

  } catch (error) {
    console.error("AI Curfew detection error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = curfewDetection;
