const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  recurring: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringExpense' },
  amount: { type: Number, required: true },
  amountInHomeCurrency: { type: Number },
  currency: { type: String, default: 'INR' },
  category: { type: String, required: true },
  description: { type: String },
  notes: { type: String },
  date: { type: Date, default: Date.now },
  paymentMethod: { type: String },
  paidBy: { type: String },
  splitWith: [{ name: String, amount: Number }],
  receipt: { type: String },
}, { timestamps: true });

expenseSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
