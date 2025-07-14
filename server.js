require('dotenv').config(); // 🔼 at the top before anything else

const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests
});

app.use(limiter);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/admin', require('./routes/admin'));

// Database check + sync
sequelize.authenticate()
  .then(() => console.log('✅ Connected to database'))
  .catch(err => console.error('❌ Failed to connect DB:', err));

sequelize.sync({ alter: true })
  .then(() => console.log('✅ All models synced'))
  .catch(err => console.error('❌ Sync failed:', err));


  
// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
