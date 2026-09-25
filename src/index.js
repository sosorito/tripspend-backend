require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    const { startNotificationJobs } = require('./jobs/notificationJob');
    startNotificationJobs();
  })
  .catch(err => console.error('MongoDB error:', err));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/money', require('./routes/money'));
app.use('/api/gmb', require('./routes/gmb'));

app.get('/api/version', (req, res) => {
  res.json({ version: '1.5.2', buildNumber: 47, forceUpdate: false, downloadUrl: '', message: '' });
});

app.get('/', (req, res) => res.json({ status: 'TripSpend API running' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
