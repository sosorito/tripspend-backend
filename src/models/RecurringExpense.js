const mongoose = require('mongoose');

const recurringExpenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  category: { type: String, required: true },
  paymentMethod: { type: String },
  notes: { type: String },
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
  nextDate: { type: Date, required: true },
  // Day-of-month the rule was created on, so Jan 31 -> Feb 28 -> Mar 31 doesn't drift.
  anchorDay: { type: Number },
  // Client's Date#getTimezoneOffset(), so "next month" is computed in the user's local calendar.
  tzOffset: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('RecurringExpense', recurringExpenseSchema);
