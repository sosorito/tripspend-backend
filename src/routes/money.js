const router = require('express').Router();
const auth = require('../middleware/auth');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const RecurringExpense = require('../models/RecurringExpense');
const Expense = require('../models/Expense');
const User = require('../models/User');
const { advance } = require('../services/recurring');

const MONTH_RE = /^\d{4}-\d{2}$/;
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const str = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

router.use(auth);

// ── Monthly budget ─────────────────────────────────
router.get('/budget/:month', async (req, res) => {
  try {
    const { month } = req.params;
    if (!MONTH_RE.test(month)) return res.status(400).json({ message: 'Invalid month' });
    const budget = await Budget.findOne({ user: req.user.id, month });
    if (budget) return res.json({ budget, inherited: false });

    // No plan for this month yet: carry the most recent earlier plan forward (not saved).
    const previous = await Budget.findOne({ user: req.user.id, month: { $lt: month } }).sort({ month: -1 });
    if (!previous) return res.json({ budget: null, inherited: false });
    const { amount, target, categories } = previous.toObject();
    res.json({ budget: { month, amount, target, categories }, inherited: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/budget/:month', async (req, res) => {
  try {
    const { month } = req.params;
    if (!MONTH_RE.test(month)) return res.status(400).json({ message: 'Invalid month' });
    const categories = (Array.isArray(req.body.categories) ? req.body.categories : [])
      .map(c => ({ category: str(c.category, 40), planned: num(c.planned) }))
      .filter(c => c.category && c.planned > 0);
    const budget = await Budget.findOneAndUpdate(
      { user: req.user.id, month },
      { amount: num(req.body.amount), target: num(req.body.target), categories },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ budget });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Savings goals ──────────────────────────────────
router.get('/goals', async (req, res) => {
  try {
    const goals = await SavingsGoal.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({ goals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/goals', async (req, res) => {
  try {
    const name = str(req.body.name);
    const target = num(req.body.target);
    if (!name || target <= 0) return res.status(400).json({ message: 'Name and target amount are required' });
    const saved = num(req.body.saved);
    const goal = await SavingsGoal.create({
      user: req.user.id,
      name,
      target,
      saved,
      icon: str(req.body.icon, 40),
      color: str(req.body.color, 20),
      deposits: saved > 0 ? [{ amount: saved }] : [],
    });
    res.json({ goal });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/goals/:id', async (req, res) => {
  try {
    const update = {};
    if (req.body.name !== undefined) update.name = str(req.body.name);
    if (req.body.target !== undefined) update.target = num(req.body.target);
    if (req.body.icon !== undefined) update.icon = str(req.body.icon, 40);
    if (req.body.color !== undefined) update.color = str(req.body.color, 20);
    if (update.name === '' || update.target === 0) return res.status(400).json({ message: 'Name and target amount are required' });
    const goal = await SavingsGoal.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, update, { new: true });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    res.json({ goal });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Positive amount adds money, negative withdraws; the balance never goes below zero.
router.post('/goals/:id/deposit', async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ message: 'Enter a valid amount' });
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    const applied = Math.max(amount, -goal.saved);
    goal.saved += applied;
    goal.deposits.push({ amount: applied, note: str(req.body.note, 120) });
    await goal.save();
    res.json({ goal });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/goals/:id', async (req, res) => {
  try {
    await SavingsGoal.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Recurring expenses ─────────────────────────────
router.get('/recurring', async (req, res) => {
  try {
    const recurring = await RecurringExpense.find({ user: req.user.id }).sort({ active: -1, nextDate: 1 });
    res.json({ recurring });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/recurring/:id', async (req, res) => {
  try {
    const update = {};
    if (req.body.active !== undefined) update.active = !!req.body.active;
    if (req.body.amount !== undefined) {
      update.amount = num(req.body.amount);
      if (update.amount <= 0) return res.status(400).json({ message: 'Enter a valid amount' });
    }
    if (req.body.category !== undefined) update.category = str(req.body.category, 40);
    if (req.body.paymentMethod !== undefined) update.paymentMethod = str(req.body.paymentMethod, 40);
    if (req.body.notes !== undefined) update.notes = str(req.body.notes, 200);
    if (req.body.frequency !== undefined && FREQUENCIES.includes(req.body.frequency)) update.frequency = req.body.frequency;

    // Resuming a paused rule shouldn't back-fill every missed payment.
    if (update.active === true) {
      const rule = await RecurringExpense.findOne({ _id: req.params.id, user: req.user.id });
      if (rule && !rule.active && rule.nextDate < new Date()) {
        let next = rule.nextDate;
        while (next < new Date()) next = advance(next, update.frequency || rule.frequency, rule.anchorDay, rule.tzOffset);
        update.nextDate = next;
      }
    }

    const rule = await RecurringExpense.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, update, { new: true });
    if (!rule) return res.status(404).json({ message: 'Recurring expense not found' });
    res.json({ recurring: rule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/recurring/:id', async (req, res) => {
  try {
    await RecurringExpense.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Custom categories & payment methods ────────────
router.put('/preferences', async (req, res) => {
  try {
    const update = {};
    if (Array.isArray(req.body.customCategories)) {
      update.customCategories = req.body.customCategories.slice(0, 100)
        .map(c => ({ key: str(c.key, 40), label: str(c.label, 30), icon: str(c.icon, 40), color: str(c.color, 20), hidden: !!c.hidden }))
        .filter(c => c.key && c.label);
    }
    if (Array.isArray(req.body.customPaymentMethods)) {
      update.customPaymentMethods = req.body.customPaymentMethods.slice(0, 50)
        .map(p => ({ key: str(p.key, 40), label: str(p.label, 30), hidden: !!p.hidden }))
        .filter(p => p.key && p.label);
    }
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Backup ─────────────────────────────────────────
router.get('/backup', async (req, res) => {
  try {
    const [user, expenses, budgets, goals, recurring] = await Promise.all([
      User.findById(req.user.id).select('-password -fcmToken -subscription.purchaseToken'),
      Expense.find({ user: req.user.id }).sort({ date: -1 }),
      Budget.find({ user: req.user.id }).sort({ month: -1 }),
      SavingsGoal.find({ user: req.user.id }),
      RecurringExpense.find({ user: req.user.id }),
    ]);
    res.json({ exportedAt: new Date(), user, expenses, budgets, goals, recurring });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
