const supabase = require("../config/supabase");

// POST /api/payout/setup-bank
const setupBankDetails = async (req, res) => {
  try {
    const { phone, accountHolder, accountNumber, ifsc } = req.body;

    if (!phone || !accountHolder || !accountNumber || !ifsc) {
      return res.status(400).json({ success: false, message: "All bank fields are required" });
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        bank_account_holder: accountHolder,
        bank_account_number: accountNumber,
        bank_ifsc: ifsc,
        payout_setup_done: true,
      })
      .eq("phone", phone)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, message: "Failed to save bank details", error: error.message });
    }

    return res.status(200).json({ success: true, message: "Bank details saved successfully", data });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// GET /api/payout/history/:phone
const getPayoutHistory = async (req, res) => {
  try {
    const { phone } = req.params;

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, rider_id, phone")
      .eq("phone", decodeURIComponent(phone))
      .maybeSingle();

    if (userError || !user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { data: payouts, error: payoutsError } = await supabase
      .from("payouts")
      .select("*")
      .eq("user_id", user.id)
      .order("paid_at", { ascending: false });

    if (payoutsError) {
      return res.status(500).json({ success: false, message: "Failed to fetch payouts", error: payoutsError.message });
    }

    return res.status(200).json({ success: true, data: payouts || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// GET /api/payout/all
const getAllPayouts = async (req, res) => {
  try {
    const { data, error } = await supabase.from("payouts").select("*").order("paid_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payout/by-phone/:phone
const getPayoutsByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const { data: user } = await supabase
      .from("users").select("id").eq("phone", decodeURIComponent(phone)).maybeSingle();

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { data, error } = await supabase
      .from("payouts").select("*").eq("user_id", user.id).order("paid_at", { ascending: false });

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/payout/:id
const getPayoutById = async (req, res) => {
  try {
    const { data, error } = await supabase.from("payouts").select("*").eq("id", req.params.id).maybeSingle();
    if (error || !data) return res.status(404).json({ success: false, message: "Payout not found" });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { setupBankDetails, getPayoutHistory, getAllPayouts, getPayoutsByPhone, getPayoutById };
