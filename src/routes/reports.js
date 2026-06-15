const router = require('express').Router();
const Expense = require('../models/Expense');
const Trip = require('../models/Trip');
const auth = require('../middleware/auth');

router.get('/trip/:tripId', auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id, trip: req.params.tripId });
    const trip = await Trip.findOne({ _id: req.params.tripId, user: req.user.id });

    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
    const byCategory = {};
    expenses.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    res.json({
      trip,
      totalSpent,
      budget: trip?.budget || 0,
      remaining: (trip?.budget || 0) - totalSpent,
      byCategory,
      expenses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/dashboard', auth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const now = new Date();

    const [expenses, trips] = await Promise.all([
      Expense.find({ user: req.user.id, date: { $gte: start, $lt: end } }),
      Trip.find({ user: req.user.id }),
    ]);

    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
    const byMonth = Array(12).fill(0);
    expenses.forEach(e => { byMonth[new Date(e.date).getMonth()] += e.amount; });

    const categoryBreakdown = {};
    expenses.forEach(e => { categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount; });

    // Find active trip (startDate <= now <= endDate)
    const activeTrip = trips.find(t => {
      if (!t.startDate) return false;
      const s = new Date(t.startDate);
      const e = t.endDate ? new Date(t.endDate) : null;
      return now >= s && (!e || now <= e);
    });

    let activeTripData = null;
    if (activeTrip) {
      const tripExpenses = await Expense.find({ user: req.user.id, trip: activeTrip._id });
      const tripTotalSpent = tripExpenses.reduce((s, e) => s + e.amount, 0);
      activeTripData = { ...activeTrip.toObject(), totalSpent: tripTotalSpent, status: 'active' };
    }

    const upcomingCount = trips.filter(t => t.startDate && new Date(t.startDate) > now).length;
    const completedCount = trips.filter(t => t.endDate && new Date(t.endDate) < now).length;

    res.json({
      dashboard: {
        totalSpent,
        byMonth,
        categoryBreakdown,
        tripCount: trips.length,
        upcomingCount,
        completedCount,
        expenseCount: expenses.length,
        activeTrip: activeTripData,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/settle/:tripId', auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id, trip: req.params.tripId });
    const balances = {};

    expenses.forEach(e => {
      if (!e.splitWith?.length) return;
      const share = e.amount / (e.splitWith.length + 1);
      e.splitWith.forEach(m => {
        balances[m.name] = (balances[m.name] || 0) + share;
      });
    });

    const settlements = Object.entries(balances).map(([name, amount]) => ({ name, amount }));
    res.json({ settlements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
