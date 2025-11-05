const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, validateRequest } = require('./auth'); // Assuming auth.js is in the same folder
const { body } = require('express-validator');

// GET all referrals for a specific visit
// GET /api/referrals?visit_id=...
router.get('/', authenticateToken, async (req, res) => {
    const { visit_id } = req.query;
    if (!visit_id) {
        return res.status(400).json({ error: 'visit_id is required' });
    }
    try {
        const query = 'SELECT * FROM referral WHERE visit_id = $1 ORDER BY created_at ASC';
        const { rows } = await db.query(query, [visit_id]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching referrals:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST create a new referral for a visit
// POST /api/referrals
router.post('/', authenticateToken, [
    body('visit_id').isInt({ min: 1 }).withMessage('Valid visit_id is required'),
    body('referralDate').isISO8601().withMessage('Valid referralDate is required'),
    // Add other validations as needed
], validateRequest, async (req, res) => {
    const { visit_id, referralDate, referralType, illness, duration, reason } = req.body;
    const last_updated_by = req.user.id;
    try {
        const query = `
            INSERT INTO referral (visit_id, referral_date, referral_type, illness, duration, reason, last_updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const { rows } = await db.query(query, [visit_id, referralDate, referralType, illness, duration, reason, last_updated_by]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating referral:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT update an existing referral
// PUT /api/referrals/:referralId
router.put('/:referralId', authenticateToken, [
    // Add validations as needed
], validateRequest, async (req, res) => {
    const { referralId } = req.params;
    const { referralDate, referralType, illness, duration, reason } = req.body;
    const last_updated_by = req.user.id;
    try {
        const query = `
            UPDATE referral SET
                referral_date = $1,
                referral_type = $2,
                illness = $3,
                duration = $4,
                reason = $5,
                last_updated_by = $6,
                last_updated_at = NOW()
            WHERE id = $7
            RETURNING *;
        `;
        const { rows, rowCount } = await db.query(query, [referralDate, referralType, illness, duration, reason, last_updated_by, referralId]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Referral not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Error updating referral:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;