require('dotenv').config(); // 🔼 at the top before anything else

const rateLimit = require('express-rate-limit');
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests
});

// Apply rate limiting
app.use(limiter);

// Security middleware
const helmet = require('helmet');
app.use(helmet());

// 🔥 CORS Configuration - Allow frontend connections
const corsOptions = {
  origin: [
    'http://localhost:3000',      // React dev server
    'http://localhost:5173',      // Vite dev server  
    'http://127.0.0.1:5500',      // Live Server
    'http://localhost:5500',      // Live Server alt
    'file://', 
    'https://gitgirlels.github.io/cocoa-code/',
    'https://cocoa-code.netlify.app/',    // Local file access
    process.env.FRONTEND_URL      // Your production frontend URL
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
// Parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Request body:', req.body);
  }
  next();
});

// Routes
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/admin', require('./routes/admin'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Cocoa Code API is running!' 
  });
});

// Catch-all route for debugging
app.get('*', (req, res) => {
  console.log(`🤔 Unknown route requested: ${req.path}`);
  res.status(404).json({ 
    error: 'Route not found',
    availableRoutes: [
      'GET /api/health',
      'GET /api/bookings/availability/:month',
      'POST /api/bookings',
      'GET /api/clients',
      'POST /api/clients',
      'GET /api/admin/projects',
      'GET /api/admin/stats'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Database connection and sync
async function initializeDatabase() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    
    // Sync models (create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log('✅ All models synced');
    
    // Log current bookings for debugging
    const { Project } = require('./models');
    const bookings = await Project.findAll({ 
      attributes: ['bookingMonth'],
      raw: true 
    });
    
    console.log('📊 Current bookings in database:', 
      bookings.map(b => b.bookingMonth)
    );
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Initialize database then start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔍 API Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📅 Availability Check: http://localhost:${PORT}/api/bookings/availability/July%202025`);
  });
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});