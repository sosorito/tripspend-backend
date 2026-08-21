const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  destinationCity: { type: String },
  destinationState: { type: String },
  destinationCountry: { type: String },
  countryCode: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  budget: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  status: { type: String, default: 'upcoming' },
  travelType: { type: String, default: 'solo' },
  tripScope: { type: String, default: 'domestic' },
  numberOfTravelers: { type: Number, default: 1 },
  coverImage: { type: String },
  notes: { type: String },
  checklist: [mongoose.Schema.Types.Mixed],
  budgetAlerted: { p50: Boolean, p90: Boolean, p100: Boolean },
  notified: { dayBefore: Boolean, twoHours: Boolean, tripStart: Boolean },
  transportation: [{
    type: { type: String },
    from: String,
    to: String,
    date: Date,
    cost: Number,
    notes: String,
  }],
  accommodation: [{
    name: String,
    checkIn: Date,
    checkOut: Date,
    cost: Number,
    notes: String,
  }],
  members: [{
    name: String,
    email: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('Trip', tripSchema);
