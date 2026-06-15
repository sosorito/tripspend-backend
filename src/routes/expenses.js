const router = require('express').Router();
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.trip) filter.trip = req.query.trip;
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
    const expense = await Expense.create({ ...req.body, user: req.user.id });
    res.json({ expense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
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
