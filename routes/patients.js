// routes/patients.js

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');

router.get('/', authenticateToken, requireRole(['admin', 'doctor', 'nurse']), async (req, res) => {
  const { location } = req.query;

  try {
    const queryText = location
      ? 'SELECT * FROM patients WHERE address ILIKE $1'
      : 'SELECT * FROM patients';

    const values = location ? [`%${location}%`] : [];

    const result = await pool.query(queryText, values);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
