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

async function getToken() {
  const client = getOAuthClient();
  const { token } = await client.getAccessToken();
  return token;
}

function getTokenFromRequest(req) {
  return req.headers['x-gmb-token'] || null;
}

router.get('/accounts', auth, async (req, res) => {
  try {
    const token = getTokenFromRequest(req) || await getToken();
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
    const token = getTokenFromRequest(req) || await getToken();
    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${req.params.accountId}/locations?readMask=name,title,storefrontAddress,websiteUri,primaryCategory`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    console.log('[GMB] locations:', JSON.stringify(data));
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/reviews/:accountId/:locationId', auth, async (req, res) => {
  try {
    const token = getTokenFromRequest(req) || await getToken();
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
    const token = getTokenFromRequest(req) || await getToken();
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

module.exports = router;
