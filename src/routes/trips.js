const router = require('express').Router();
const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');

function computeStatus(trip) {
  if (trip.status === 'completed') return 'completed';
  if (!trip.startDate) return trip.status || 'upcoming';
  const now = new Date();
  const start = new Date(trip.startDate);
  const end = trip.endDate ? new Date(trip.endDate) : null;
  if (end && now > end) return 'completed';
  if (now >= start) return 'active';
  return 'upcoming';
}

router.get('/', auth, async (req, res) => {
  try {
    const trips = await Trip.find({ user: req.user.id }).sort({ startDate: -1 });
    const expenseAgg = await Expense.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$trip', totalSpent: { $sum: { $ifNull: ['$amountInHomeCurrency', '$amount'] } } } },
    ]);
    const spentMap = {};
    expenseAgg.forEach(e => { spentMap[e._id.toString()] = e.totalSpent; });
    let updated = trips.map(t => {
      const obj = t.toObject();
      obj.status = computeStatus(obj);
      obj.totalSpent = spentMap[obj._id.toString()] || 0;
      return obj;
    });
    if (req.query.status) {
      updated = updated.filter(t => t.status === req.query.status);
    }
    res.json({ trips: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, user: req.user.id });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    const obj = trip.toObject();
    obj.status = computeStatus(obj);
    const agg = await Expense.aggregate([
      { $match: { trip: trip._id, user: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: null, totalSpent: { $sum: { $ifNull: ['$amountInHomeCurrency', '$amount'] } } } },
    ]);
    obj.totalSpent = agg[0]?.totalSpent || 0;
    res.json({ trip: obj });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const trip = await Trip.create({ ...req.body, user: req.user.id });
    res.json({ trip });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
    );
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json({ trip });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Trip.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    await Expense.deleteMany({ trip: req.params.id, user: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/transportation', auth, async (req, res) => {
  try {
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $push: { transportation: req.body } },
      { new: true }
    );
    res.json({ trip });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/accommodation', auth, async (req, res) => {
  try {
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $push: { accommodation: req.body } },
      { new: true }
    );
    res.json({ trip });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/members', auth, async (req, res) => {
  try {
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $push: { members: req.body } },
      { new: true }
    );
    res.json({ trip });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
