const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

function getToken(req) {
  return req.headers['x-gmb-token'] || null;
}

router.get('/accounts', auth, async (req, res) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(400).json({ message: 'GMB token missing' });
    const response = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    console.log('[GMB] accounts:', JSON.stringify(data));
    res.json(data);
  } catch (err) {
    console.error('[GMB] accounts error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get('/locations/:accountId', auth, async (req, res) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(400).json({ message: 'GMB token missing' });
    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${req.params.accountId}/locations?readMask=name,title,storefrontAddress,websiteUri,primaryCategory`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/reviews/:accountId/:locationId', auth, async (req, res) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(400).json({ message: 'GMB token missing' });
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${req.params.accountId}/locations/${req.params.locationId}/reviews`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/reviews/:accountId/:locationId/:reviewId/reply', auth, async (req, res) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(400).json({ message: 'GMB token missing' });
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${req.params.accountId}/locations/${req.params.locationId}/reviews/${req.params.reviewId}/reply`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: req.body.comment }),
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/insights/:accountId/:locationId', auth, async (req, res) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(400).json({ message: 'GMB token missing' });
    const { startDate, endDate } = req.body;
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${req.params.accountId}/locations/${req.params.locationId}/reportInsights`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationNames: [`accounts/${req.params.accountId}/locations/${req.params.locationId}`],
          basicRequest: {
            metricRequests: [
              { metric: 'QUERIES_DIRECT' },
              { metric: 'QUERIES_INDIRECT' },
              { metric: 'VIEWS_MAPS' },
              { metric: 'VIEWS_SEARCH' },
              { metric: 'ACTIONS_WEBSITE' },
              { metric: 'ACTIONS_PHONE' },
              { metric: 'ACTIONS_DRIVING_DIRECTIONS' },
            ],
            timeRange: { startTime: startDate, endTime: endDate },
          },
        }),
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
