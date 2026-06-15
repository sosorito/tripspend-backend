const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function makeToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '90d' });
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, currency } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, currency: currency || 'INR', homeCurrency: currency || 'INR' });
    res.json({ token: makeToken(user), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.password) return res.status(400).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });
    res.json({ token: makeToken(user), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { idToken, userInfo } = req.body;
    let googleId, email, name, picture;

    if (idToken) {
      const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      ({ sub: googleId, email, name, picture } = payload);
    } else if (userInfo) {
      ({ id: googleId, email, name, picture } = userInfo);
    } else {
      return res.status(400).json({ message: 'No auth data provided' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (user) {
      if (!user.googleId) { user.googleId = googleId; await user.save(); }
    } else {
      user = await User.create({ name, email, googleId, avatar: picture });
    }
    res.json({ token: makeToken(user), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, currency, homeCurrency, avatar, profilePhoto, avatarIcon, avatarBg } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (currency !== undefined) update.currency = currency;
    if (homeCurrency !== undefined) update.homeCurrency = homeCurrency;
    if (avatar !== undefined) update.avatar = avatar;
    if (profilePhoto !== undefined) update.profilePhoto = profilePhoto;
    if (avatarIcon !== undefined) update.avatarIcon = avatarIcon;
    if (avatarBg !== undefined) update.avatarBg = avatarBg;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/subscription', authMiddleware, async (req, res) => {
  try {
    const { type } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 'subscription.type': type },
      { new: true }
    ).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/verify-purchase', authMiddleware, async (req, res) => {
  try {
    const { productId, purchaseToken } = req.body;
    const isLifetime = productId === 'premium_lifetime';
    const isYearly = productId === 'premium_yearly';
    const expiresAt = isLifetime ? null : new Date(Date.now() + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000);

    const user = await User.findByIdAndUpdate(req.user.id, {
      'subscription.type': 'premium',
      'subscription.expiresAt': expiresAt,
      'subscription.purchaseToken': purchaseToken,
    }, { new: true }).select('-password');

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
