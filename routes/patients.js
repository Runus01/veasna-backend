// routes/patients.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');

router.get('/', authenticateToken, requireRole(['any']), async (req, res) => {
  const { location_id, location } = req.query;

  try {
    let queryText = `
      SELECT p.*, l.name AS location_name
      FROM patients p
      JOIN locations l ON l.id = p.location_id
    `;
    const values = [];

    if (location_id) {
      queryText += ' WHERE p.location_id = $1';
      values.push(Number(location_id));
    } else if (location) {
      queryText += ' WHERE LOWER(l.name) = LOWER($1)';
      values.push(location);
    }

    queryText += ' ORDER BY p.created_at DESC';

    const result = await db.query(queryText, values);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
