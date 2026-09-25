const mongoose = require('mongoose');

const savingsGoalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  icon: { type: String, default: 'savings' },
  color: { type: String, default: '#1a56db' },
  target: { type: Number, required: true },
  saved: { type: Number, default: 0 },
  deposits: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    note: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);
