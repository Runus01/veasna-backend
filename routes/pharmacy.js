// routes/pharmacy.js

const express = require('express');
const router = express.Router();

const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');

// GET /api/pharmacy
// List all pharmacy items
router.get('/', [authenticateToken, requireRole(['any'])], async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, stock_level, last_updated, last_updated_by
         FROM pharmacy
        ORDER BY name ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error('List pharmacy error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/pharmacy
// Create a new item
router.post('/', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { name, stock_level } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }
    const lvl = stock_level === undefined ? 0 : Number(stock_level);
    if (!Number.isFinite(lvl) || lvl < 0) {
      return res.status(400).json({ message: 'stock_level must be a non-negative number' });
    }

    const { rows } = await db.query(
      `INSERT INTO pharmacy(name, stock_level, last_updated_by)
       VALUES($1, $2, $3)
       RETURNING id, name, stock_level, last_updated, last_updated_by`,
      [name.trim(), lvl, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('Create pharmacy item error:', e);
    if (e.code === '23505') {
      return res.status(409).json({ message: 'Item name already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/pharmacy/:id
// Rename and/or set stock to an exact value (clamped to >= 0)
router.put('/:id', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId)) {
      return res.status(400).json({ message: 'Invalid item id' });
    }

    const { name, stock_level } = req.body;
    const lvl =
      stock_level === undefined ? null : Number(stock_level);
    if (lvl !== null && (!Number.isFinite(lvl) || lvl < 0)) {
      return res
        .status(400)
        .json({ message: 'stock_level must be a non-negative number' });
    }

    const { rows } = await db.query(
      `UPDATE pharmacy
          SET name = COALESCE($1, name),
              stock_level = GREATEST(0, COALESCE($2, stock_level)),
              last_updated = CURRENT_TIMESTAMP,
              last_updated_by = $3
        WHERE id = $4
        RETURNING id, name, stock_level, last_updated, last_updated_by`,
      [name ? name.trim() : null, lvl, req.user.id, itemId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Item not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Update pharmacy item error:', e);
    if (e.code === '23505') {
      return res.status(409).json({ message: 'Item name already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/pharmacy/:id/adjust
// Adjust stock by a delta (positive or negative, clamped to >= 0)
router.patch('/:id/adjust', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId)) {
      return res.status(400).json({ message: 'Invalid item id' });
    }

    const { delta } = req.body;
    const d = Number(delta);
    if (!Number.isFinite(d)) {
      return res.status(400).json({ message: 'delta is required and must be a number' });
    }

    const { rows } = await db.query(
      `UPDATE pharmacy
          SET stock_level = GREATEST(0, stock_level + $1),
              last_updated = CURRENT_TIMESTAMP,
              last_updated_by = $2
        WHERE id = $3
        RETURNING id, name, stock_level, last_updated, last_updated_by`,
      [d, req.user.id, itemId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Item not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Adjust pharmacy stock error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/pharmacy/:id
// Delete an item
router.delete('/:id', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    if (!Number.isInteger(itemId)) {
      return res.status(400).json({ message: 'Invalid item id' });
    }

    const del = await db.query(
      'DELETE FROM pharmacy WHERE id = $1 RETURNING id',
      [itemId]
    );
    if (!del.rows.length) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted', id: del.rows[0].id });
  } catch (e) {
    console.error('Delete pharmacy item error:', e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
