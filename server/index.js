const express = require('express');
const router = require('./router/routes');
const cors = require('cors');
require('dotenv').config();

// Cron jobs — only load files that exist
// require("./cron/saveDisruptionsCron");   // missing - disabled
// require("./cron/payoutEligibilityCron"); // missing - disabled
// require("./cron/processPayoutCron");     // missing - disabled
require("./cron/parametricTriggerCron");

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', router);

const port = process.env.PORT || 8000;

app.get('/health-check', (req, res) => {
  res.json({ message: 'Healthy 🚀' });
});

app.listen(port, () => {
  console.log(`🚀 Server running at port ${port}`);
});