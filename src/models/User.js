const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  avatar: { type: String },
  profilePhoto: { type: String },
  avatarIcon: { type: String },
  avatarBg: { type: String },
  currency: { type: String, default: 'INR' },
  homeCurrency: { type: String, default: 'INR' },
  subscription: {
    type: { type: String, default: 'free' },
    expiresAt: { type: Date },
    purchaseToken: { type: String },
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
