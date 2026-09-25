const Expense = require('../models/Expense');
const RecurringExpense = require('../models/RecurringExpense');

const MAX_CATCH_UP = 400;

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Date math runs on a copy shifted into the user's local wall-clock time,
// so "same day next month" means the user's day, not the server's UTC day.
function advance(date, frequency, anchorDay, tzOffset = 0) {
  const local = new Date(date.getTime() - tzOffset * 60000);
  if (frequency === 'daily') local.setUTCDate(local.getUTCDate() + 1);
  else if (frequency === 'weekly') local.setUTCDate(local.getUTCDate() + 7);
  else {
    const step = frequency === 'yearly' ? 12 : 1;
    const target = local.getUTCMonth() + step;
    const year = local.getUTCFullYear() + Math.floor(target / 12);
    const month = ((target % 12) + 12) % 12;
    const day = Math.min(anchorDay || local.getUTCDate(), daysInMonth(year, month));
    local.setUTCFullYear(year, month, day);
  }
  return new Date(local.getTime() + tzOffset * 60000);
}

async function materializeDue(userId) {
  const now = new Date();
  const rules = await RecurringExpense.find({ user: userId, active: true, nextDate: { $lte: now } });
  for (const rule of rules) {
    const docs = [];
    let next = rule.nextDate;
    while (next <= now && docs.length < MAX_CATCH_UP) {
      docs.push({
        user: rule.user,
        amount: rule.amount,
        currency: rule.currency,
        category: rule.category,
        paymentMethod: rule.paymentMethod,
        notes: rule.notes,
        date: next,
        recurring: rule._id,
      });
      next = advance(next, rule.frequency, rule.anchorDay, rule.tzOffset);
    }
    // Claim the slot before inserting so two concurrent requests can't both generate it.
    const claimed = await RecurringExpense.updateOne(
      { _id: rule._id, nextDate: rule.nextDate },
      { nextDate: next }
    );
    if (claimed.modifiedCount === 1 && docs.length) await Expense.insertMany(docs);
  }
}

module.exports = { advance, materializeDue };
