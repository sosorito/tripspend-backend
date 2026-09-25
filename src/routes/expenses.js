const router = require('express').Router();
const Expense = require('../models/Expense');
const RecurringExpense = require('../models/RecurringExpense');
const auth = require('../middleware/auth');
const { advance, materializeDue } = require('../services/recurring');

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

function stripProtected(body) {
  const { user, _id, recurring, createdAt, updatedAt, ...rest } = body || {};
  return rest;
}

router.get('/', auth, async (req, res) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.trip) filter.trip = req.query.trip;
    else await materializeDue(req.user.id);

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) filter.date.$lt = new Date(req.query.to);
    }
    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.json({ expenses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/daily', auth, async (req, res) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.trip) filter.trip = req.query.trip;
    const expenses = await Expense.find(filter).sort({ date: -1 });

    const daily = {};
    expenses.forEach(e => {
      const day = new Date(e.date).toISOString().split('T')[0];
      if (!daily[day]) daily[day] = { date: day, total: 0, expenses: [] };
      daily[day].total += e.amount;
      daily[day].expenses.push(e);
    });

    res.json({ daily: Object.values(daily).sort((a, b) => b.date.localeCompare(a.date)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const repeat = req.body?.recurring;
    const data = { ...stripProtected(req.body), user: req.user.id };
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Enter a valid amount' });

    let rule = null;
    if (repeat && FREQUENCIES.includes(repeat.frequency)) {
      const date = data.date ? new Date(data.date) : new Date();
      const tzOffset = Number(repeat.tzOffset) || 0;
      const anchorDay = new Date(date.getTime() - tzOffset * 60000).getUTCDate();
      rule = await RecurringExpense.create({
        user: req.user.id,
        amount,
        currency: data.currency,
        category: data.category,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        frequency: repeat.frequency,
        anchorDay,
        tzOffset,
        nextDate: advance(date, repeat.frequency, anchorDay, tzOffset),
      });
      data.recurring = rule._id;
    }

    const expense = await Expense.create(data);
    res.json({ expense, recurring: rule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      stripProtected(req.body),
      { new: true, runValidators: true }
    );
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json({ expense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Expense.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
