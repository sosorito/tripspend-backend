const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const auth = require('../middleware/auth');

function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

// Get business accounts
router.get('/accounts', auth, async (req, res) => {
  try {
    const oauth2Client = getOAuthClient();
    const response = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: { Authorization: `Bearer ${(await oauth2Client.getAccessToken()).token}` }
      }
    );
    const data = await response.json();
    console.log('[GMB] accounts response:', JSON.stringify(data));
    res.json(data);
  } catch (err) {
    console.error('[GMB] accounts error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Get locations for an account
router.get('/locations/:accountId', auth, async (req, res) => {
  try {
    const oauth2Client = getOAuthClient();
    const token = (await oauth2Client.getAccessToken()).token;
    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${req.params.accountId}/locations?readMask=name,title,storefrontAddress,websiteUri,regularHours,primaryCategory`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get reviews
router.get('/reviews/:accountId/:locationId', auth, async (req, res) => {
  try {
    const oauth2Client = getOAuthClient();
    const token = (await oauth2Client.getAccessToken()).token;
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${req.params.accountId}/locations/${req.params.locationId}/reviews`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reply to a review
router.put('/reviews/:accountId/:locationId/:reviewId/reply', auth, async (req, res) => {
  try {
    const oauth2Client = getOAuthClient();
    const token = (await oauth2Client.getAccessToken()).token;
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${req.params.accountId}/locations/${req.params.locationId}/reviews/${req.params.reviewId}/reply`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: req.body.comment })
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get insights/performance
router.post('/insights/:accountId/:locationId', auth, async (req, res) => {
  try {
    const oauth2Client = getOAuthClient();
    const token = (await oauth2Client.getAccessToken()).token;
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
            timeRange: { startTime: startDate, endTime: endDate }
          }
        })
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
