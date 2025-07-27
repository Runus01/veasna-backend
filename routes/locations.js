// routes/locations.js

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../routes/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT address
      FROM patients
      WHERE address IS NOT NULL AND address <> ''
      ORDER BY address
    `);

    const locations = result.rows.map(row => row.address);
    res.json({ locations });
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
