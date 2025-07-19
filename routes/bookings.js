const express = require('express');
const router = express.Router();

// Start with the simplest possible routes
console.log('🧪 Creating basic bookings routes...');

// Simple route with no parameters - TEST 1
router.get('/test', (req, res) => {
  res.json({ message: 'Basic bookings route works!' });
});

// Simple POST route - TEST 2
router.post('/test', (req, res) => {
  res.json({ message: 'POST route works!' });
});

// Problematic route - TEST 3 (Comment this out if it crashes)
// router.get('/availability/:month', async (req, res) => {
//   try {
//     res.json({ message: 'Availability route works', month: req.params.month });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

console.log('✅ Basic bookings routes created');

module.exports = router;