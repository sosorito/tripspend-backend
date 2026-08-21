const cron = require('node-cron');
const User = require('../models/User');
const Trip = require('../models/Trip');
const Expense = require('../models/Expense');
const { sendFCM } = require('../services/fcm');

function startNotificationJobs() {
  // Trip reminders — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const trips = await Trip.find({ status: 'upcoming' }).populate('user', 'fcmToken name');

      for (const trip of trips) {
        const token = trip.user?.fcmToken;
        if (!token) continue;

        const start = new Date(trip.startDate);
        const diffMs = start - now;
        const diffHrs = diffMs / (1000 * 60 * 60);

        if (diffHrs > 23.9 && diffHrs < 24.1 && !trip.notified?.dayBefore) {
          await sendFCM(token, `✈️ Trip to ${trip.destinationCity} tomorrow!`, `Your trip starts tomorrow — pack your bags!`);
          await Trip.findByIdAndUpdate(trip._id, { 'notified.dayBefore': true });
        } else if (diffHrs > 1.9 && diffHrs < 2.1 && !trip.notified?.twoHours) {
          await sendFCM(token, `📋 ${trip.destinationCity} — Almost time!`, `Your trip starts in 2 hours — checked your packing list?`);
          await Trip.findByIdAndUpdate(trip._id, { 'notified.twoHours': true });
        } else if (diffHrs > -0.1 && diffHrs < 0.1 && !trip.notified?.tripStart) {
          await sendFCM(token, `🎒 Your ${trip.destinationCity} trip starts now!`, `Have a great trip! Don't forget anything.`);
          await Trip.findByIdAndUpdate(trip._id, { 'notified.tripStart': true });
        }
      }
    } catch (e) {
      console.error('[Job] tripReminder error:', e?.message);
    }
  });

  // Budget alerts — every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const trips = await Trip.find({ status: 'active' }).populate('user', 'fcmToken currency');

      for (const trip of trips) {
        const token = trip.user?.fcmToken;
        if (!token || !trip.budget) continue;

        const expenses = await Expense.find({ trip: trip._id });
        const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const pct = (total / trip.budget) * 100;
        const alerted = trip.budgetAlerted || {};

        if (pct >= 100 && !alerted.p100) {
          await sendFCM(token, '🚨 Budget Exceeded!', `You've gone over your budget on ${trip.name}!`);
          await Trip.findByIdAndUpdate(trip._id, { budgetAlerted: { p50: true, p90: true, p100: true } });
        } else if (pct >= 90 && !alerted.p90) {
          await sendFCM(token, '⚠️ Budget Almost Full!', `90% of your budget used on ${trip.name}. Spend carefully!`);
          await Trip.findByIdAndUpdate(trip._id, { 'budgetAlerted.p90': true });
        } else if (pct >= 50 && !alerted.p50) {
          await sendFCM(token, '💰 Half Budget Used', `50% of your budget spent on ${trip.name}. Keep tracking!`);
          await Trip.findByIdAndUpdate(trip._id, { 'budgetAlerted.p50': true });
        }
      }
    } catch (e) {
      console.error('[Job] budgetAlert error:', e?.message);
    }
  });

  console.log('Notification jobs started');
}

module.exports = { startNotificationJobs };
