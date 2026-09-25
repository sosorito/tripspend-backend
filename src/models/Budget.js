const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: String, required: true }, // YYYY-MM
  amount: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
  categories: [{
    category: String,
    planned: Number,
  }],
}, { timestamps: true });

budgetSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
