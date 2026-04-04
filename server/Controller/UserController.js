const axios = require('axios');
const supabase = require('../config/supabase');

const Signup = async (req, res) => {
  try {
    const { rider_id, Name, email, password, phone_number, city, platform } = req.body;

    if (!rider_id || !Name || !email || !password) {
      return res.status(400).json("Please Fill all Fields");
    }

    const response = await axios.get(
      `http://127.0.0.1:8000/api/zomato/v2/fleet/${rider_id}/profile`
    );

    if (response.data.status == "success") {
      // Clean up city string in case it came from auto-detection
      const cleanCity = city
        ? city.split(",")[0].trim()
        : (response.data.data?.city || "Unknown");

      const { data, error } = await supabase.from('users').insert([
        {
          rider_id: rider_id,
          name: Name,
          email: email,
          password: password,
          phone: phone_number,
          city: cleanCity,
          platform: platform || null,
        },
      ]).select();

      if (error) {
        return res.status(500).json({
          message: 'Something went wrong while inserting data',
          error: error.message,
        });
      }

      return res.status(201).json({ message: `User Created Successfully` });
    }

    return res.status(404).json({ message: "Rider not Found!!" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const sendOTP = async (req, res) => {
  const { Phone_no } = req.body;
  const { data, error } = await supabase.auth.signInWithOtp({ phone: `${Phone_no}` });
  if (error) {
    return res.status(500).json({ message: "Something Went Wrong while Sending OTP" });
  }
  return res.status(200).json({ message: "OTP Send!!" });
};

const verifyOTP = async (req, res) => {
  const { Phone_no, OTP } = req.body;
  const { data, error } = await supabase.auth.verifyOtp({
    phone: Phone_no,
    token: OTP,
    type: 'sms'
  });

  if (error) {
    return res.status(500).json({ message: "OTP mismatched!!" });
  }

  const { data: data1, error: error1 } = await supabase
    .from('users')
    .update({ phone_number_verified: true })
    .eq('phone', `${Phone_no}`);

  if (error1) {
    return res.status(500).json({ message: "Db is Down!!" });
  }

  return res.status(200).json({ message: "OTP Verified" });
};

const addBankInfo = async (req, res) => {
  try {
    const { phone, accountHolder, accountNumber, ifsc } = req.body;

    if (!phone || !accountHolder || !accountNumber || !ifsc) {
      return res.status(400).json({
        success: false,
        message: "All bank fields are required",
      });
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
      return res.status(500).json({
        success: false,
        message: "Failed to save bank details",
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bank details saved successfully",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const { phone } = req.params;

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("phone", decodeURIComponent(phone))
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { Signup, sendOTP, verifyOTP, addBankInfo, getUserProfile };