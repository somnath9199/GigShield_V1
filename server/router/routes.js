const router = require('express').Router();
const supabase = require('../config/supabase');

const { Signup, sendOTP, verifyOTP } = require('../Controller/UserController');
const { getRiderProfile } = require('../Controller/ZomatoController');
const {
  getAllDisruptions,
  getActiveDisruptions,
  getUpcomingDisruptions,
  getDisruptionsByLocation,
  getDisruptionById,
  checkRiderDisruption,
} = require('../Controller/MockDistruptionController');
const {
  setupBankDetails,
  getPayoutHistory,
  getAllPayouts,
  getPayoutsByPhone,
  getPayoutById,
} = require('../Controller/PayoutController');
const Dynamic_calculator = require('../Controller/Dynamic_calculator');
const { runTriggers } = require('../Controller/ParametricTriggerController');
const curfewDetection = require('../Controller/CurfewDetectionController');
const { getRiskScore } = require('../Controller/RiskScoreController');

// ── Health ──────────────────────────────────────────
router.get('/health-check', (req, res) => res.status(200).json({ message: 'Working!!' }));

// ── Auth ─────────────────────────────────────────────
router.post('/signup', Signup);
router.post('/getOTP', sendOTP);
router.post('/verifyOTP', verifyOTP);

// ── Zomato Fleet / Dynamic Pricing ───────────────────
router.get('/zomato/v2/fleet/:fleetId/profile', getRiderProfile);
router.get('/premium/:fleetId', Dynamic_calculator);

// ── AI Features ──────────────────────────────────────
router.post('/curfew-detection', curfewDetection);
router.get('/risk-score/:phone', getRiskScore);

// ── Parametric Triggers ───────────────────────────────
router.post('/triggers/run', runTriggers);

// ── Mock Disruptions ──────────────────────────────────
router.get('/mock-disruptions', getAllDisruptions);
router.get('/mock-disruptions/active', getActiveDisruptions);
router.get('/mock-disruptions/upcoming', getUpcomingDisruptions);
router.get('/mock-disruptions/location', getDisruptionsByLocation);
router.get('/mock-disruptions/:id', getDisruptionById);
router.get('/mock-disruptions/check/:riderId', checkRiderDisruption);

// ── Payouts ───────────────────────────────────────────
router.post('/payout/setup-bank', setupBankDetails);
router.get('/payout/history/:phone', getPayoutHistory);
router.get('/payout/all', getAllPayouts);
router.get('/payout/by-phone/:phone', getPayoutsByPhone);
router.get('/payout/:id', getPayoutById);

// ── Disruptions (real table) ──────────────────────────
router.get('/disruption/:id', async (req, res) => {
  const { data, error } = await supabase.from('disruptions').select('*').eq('id', req.params.id).maybeSingle();
  if (error || !data) return res.status(404).json({ success: false, message: 'Not found' });
  return res.status(200).json({ success: true, data });
});

// Legacy test route
router.get('/Test', Signup);

module.exports = router;