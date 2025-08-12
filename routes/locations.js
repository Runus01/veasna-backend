// routes/locations.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../routes/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name 
      FROM locations 
      WHERE is_active = TRUE 
      ORDER BY name
    `);

    res.json({ locations: result.rows });
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
