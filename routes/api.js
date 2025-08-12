// routes/api.js

const express = require('express');
const router = express.Router();

const sessionRoutes = require('./session');
const patientRoutes = require('./patients');
const locationRoutes = require('./locations');
const registrationRoutes = require('./registration');

router.use('/auth', sessionRoutes);
router.use('/patients', patientRoutes);
router.use('/locations', locationRoutes);
router.use('/registration', registrationRoutes);

const { body } = require('express-validator');
const db = require('../config/db');
const { authenticateToken, requireRole, validateRequest } = require('./auth');

// --- User Management (any authenticated user) ---

// GET all users (no auth)
router.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT username
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST create a new user (no auth)
router.post(
  '/users',
  [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  ],
  validateRequest,
  async (req, res) => {
    const { username } = req.body;
    try {
      const query = `
        INSERT INTO users(username)
        VALUES ($1)
        RETURNING id, username;
      `;
      const values = [username];
      const { rows } = await db.query(query, values);
      res.status(201).json({ message: 'User created successfully', user: rows[0] });
    } catch (error) {
      console.error('Create User Error:', error);
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Username already exists.' });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// --- Patient Management ---

// Create a new patient
router.post('/patients', [
  authenticateToken,
  requireRole(['any']),
  body('english_name').notEmpty().withMessage('English name is required'),
  body('date_of_birth').isISO8601().withMessage('Valid date of birth is required'),
  body('sex').isIn(['male', 'female', 'other']).withMessage('Valid sex is required'),
  body('location_id').isInt({ min: 1 }).withMessage('location_id is required'),
], validateRequest, async (req, res) => {
  try {
    const { english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id, queue_no } = req.body;
    const query = `
      INSERT INTO patients(english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id, queue_no)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id, queue_no ? String(queue_no).toUpperCase() : null];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create Patient Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all patients (filter by location_id or location name)
router.get('/patients', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { location_id, location } = req.query;

    let sql = `
      SELECT p.*, l.name AS location_name
      FROM patients p
      JOIN locations l ON l.id = p.location_id
    `;
    const vals = [];

    if (location_id) {
      sql += ' WHERE p.location_id = $1';
      vals.push(Number(location_id));
    } else if (location) {
      sql += ' WHERE LOWER(l.name) = LOWER($1)';
      vals.push(location);
    }

    sql += ' ORDER BY p.created_at DESC';

    const result = await db.query(sql, vals);
    res.json(result.rows);
  } catch (error) {
    console.error('Get Patients Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get a single patient by ID
router.get('/patients/:id', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, l.name AS location_name
         FROM patients p
         JOIN locations l ON l.id = p.location_id
        WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Patient not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Get Patient Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update patient info
router.put('/patients/:id', [
  authenticateToken,
  requireRole(['any']),
  body('english_name').notEmpty().withMessage('English name is required'),
  body('date_of_birth').isISO8601().withMessage('Valid date of birth is required'),
  body('sex').isIn(['male', 'female', 'other']).withMessage('Valid sex is required')
], validateRequest, async (req, res) => {
  try {
    const { english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id, queue_no } = req.body;
    const query = `
      UPDATE patients SET english_name=$1, khmer_name=$2, date_of_birth=$3, sex=$4, phone_number=$5, address=$6, location_id = COALESCE($7, location_id), queue_no = COALESCE($8, queue_no)
      WHERE id=$9 RETURNING *;
    `;
    const values = [english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id || null, queue_no ? String(queue_no).toUpperCase() : null, req.params.id];
    const { rows } = await db.query(query, values);
    if (!rows.length) return res.status(404).json({ message: 'Patient not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Update Patient Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete patient
router.delete('/patients/:id', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM patients WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Patient not found' });
    res.json({ message: 'Patient deleted successfully', patient_id: rows[0].id });
  } catch (error) {
    console.error('Delete Patient Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Vitals Management ---

// Add vitals for a patient
router.post('/patients/:id/vitals', [
  authenticateToken,
  requireRole(['any']),
  body('weight_kg').isFloat({ min: 0 }).withMessage('Valid weight is required'),
  body('height_cm').isFloat({ min: 0 }).withMessage('Valid height is required')
], validateRequest, async (req, res) => {
  try {
    const { height_cm, weight_kg, bmi, blood_pressure, temperature_c, vitals_notes } = req.body;
    const query = `
      INSERT INTO vitals(patient_id, height_cm, weight_kg, bmi, blood_pressure, temperature_c, vitals_notes)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *;
    `;
    const values = [req.params.id, height_cm, weight_kg, bmi, blood_pressure, temperature_c, vitals_notes];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add Vitals Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update a vitals record
router.put('/patients/:id/vitals/:vitalsId', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { height_cm, weight_kg, bmi, blood_pressure, temperature_c, vitals_notes } = req.body;
    const { id, vitalsId } = req.params;
    const upd = await db.query(
      `UPDATE vitals
         SET height_cm = COALESCE($1, height_cm),
             weight_kg = COALESCE($2, weight_kg),
             bmi = COALESCE($3, bmi),
             blood_pressure = COALESCE($4, blood_pressure),
             temperature_c = COALESCE($5, temperature_c),
             vitals_notes = COALESCE($6, vitals_notes)
       WHERE id = $7 AND patient_id = $8
       RETURNING *`,
      [height_cm || null, weight_kg || null, bmi || null, blood_pressure || null, temperature_c || null, vitals_notes || null, vitalsId, id]
    );
    if (!upd.rows.length) return res.status(404).json({ message: 'Vitals not found' });
    res.json(upd.rows[0]);
  } catch (error) {
    console.error('Update Vitals Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a vitals record
router.delete('/patients/:id/vitals/:vitalsId', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const del = await db.query('DELETE FROM vitals WHERE id = $1 AND patient_id = $2 RETURNING id', [req.params.vitalsId, req.params.id]);
    if (!del.rows.length) return res.status(404).json({ message: 'Vitals not found' });
    res.json({ message: 'Vitals deleted', id: del.rows[0].id });
  } catch (error) {
    console.error('Delete Vitals Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get vitals for a patient
router.get('/patients/:id/vitals', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM vitals WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Vitals Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- HEF Management ---

// Add HEF for a patient
router.post('/patients/:id/hef', [
  authenticateToken,
  requireRole(['any']),
  body('know_hef').isBoolean().withMessage('know_hef is required'),
  body('have_hef').isBoolean().withMessage('have_hef is required')
], validateRequest, async (req, res) => {
  try {
    const { know_hef, have_hef, hef_notes } = req.body;
    const query = `INSERT INTO hef(patient_id, know_hef, have_hef, hef_notes) VALUES($1,$2,$3,$4) RETURNING *;`;
    const values = [req.params.id, know_hef, have_hef, hef_notes];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add HEF Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update HEF
router.put('/patients/:id/hef/:hefId', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { know_hef, have_hef, hef_notes } = req.body;
    const upd = await db.query(
      `UPDATE hef
          SET know_hef = COALESCE($1, know_hef),
              have_hef = COALESCE($2, have_hef),
              hef_notes = COALESCE($3, hef_notes)
        WHERE id = $4 AND patient_id = $5
        RETURNING *`,
      [typeof know_hef === 'boolean' ? know_hef : null,
       typeof have_hef === 'boolean' ? have_hef : null,
       hef_notes || null,
       req.params.hefId, req.params.id]
    );
    if (!upd.rows.length) return res.status(404).json({ message: 'HEF not found' });
    res.json(upd.rows[0]);
  } catch (error) {
    console.error('Update HEF Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete HEF
router.delete('/patients/:id/hef/:hefId', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const del = await db.query('DELETE FROM hef WHERE id = $1 AND patient_id = $2 RETURNING id', [req.params.hefId, req.params.id]);
    if (!del.rows.length) return res.status(404).json({ message: 'HEF not found' });
    res.json({ message: 'HEF deleted', id: del.rows[0].id });
  } catch (error) {
    console.error('Delete HEF Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get HEF records for a patient
router.get('/patients/:id/hef', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM hef WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get HEF Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Visual Acuity Management ---

// Add visual acuity for a patient
router.post('/patients/:id/visual_acuity', [
  authenticateToken,
  requireRole(['any']),
  body('left_pin').notEmpty().withMessage('Left pin is required'),
  body('right_pin').notEmpty().withMessage('Right pin is required'),
  body('left_no_pin').notEmpty().withMessage('Left no-pin is required'),
  body('right_no_pin').notEmpty().withMessage('Right no-pin is required'),
], validateRequest, async (req, res) => {
  try {
    const { left_pin, left_no_pin, right_pin, right_no_pin, visual_notes } = req.body;
    const query = `
      INSERT INTO visual_acuity(patient_id, left_pin, left_no_pin, right_pin, right_no_pin, visual_notes)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *;
    `;
    const values = [req.params.id, left_pin, left_no_pin, right_pin, right_no_pin, visual_notes];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add Visual Acuity Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get visual acuity records for a patient
router.get('/patients/:id/visual_acuity', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM visual_acuity WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Visual Acuity Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Presenting Complaint Management ---

// Add presenting complaint
router.post('/patients/:id/presenting_complaint', [
  authenticateToken,
  requireRole(['any']),
  body('history').notEmpty().withMessage('History is required')
], validateRequest, async (req, res) => {
  try {
    const { history, red_flags, systems_review, drug_allergies } = req.body;
    const query = `
      INSERT INTO presenting_complaint(patient_id, history, red_flags, systems_review, drug_allergies)
      VALUES($1,$2,$3,$4,$5) RETURNING *;
    `;
    const values = [req.params.id, history, red_flags, systems_review, drug_allergies];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add Presenting Complaint Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get presenting complaints for a patient
router.get('/patients/:id/presenting_complaint', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM presenting_complaint WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Presenting Complaint Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- History Management ---

// Add history record
router.post('/patients/:id/history', [
  authenticateToken,
  requireRole(['any']),
  body('past').notEmpty().withMessage('Past history is required')
], validateRequest, async (req, res) => {
  try {
    const { past, drug_and_treatment, family, social, systems_review } = req.body;
    const query = `
      INSERT INTO history(patient_id, past, drug_and_treatment, family, social, systems_review)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *;
    `;
    const values = [req.params.id, past, drug_and_treatment, family, social, systems_review];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add History Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get history records for a patient
router.get('/patients/:id/history', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM history WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get History Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Consultation Management ---

// Create a consultation
router.post('/patients/:id/consultations', [
  authenticateToken,  
  requireRole(['any']),
  body('consultation_notes').notEmpty().withMessage('Consultation notes are required')
], validateRequest, async (req, res) => {
  try {
    const { consultation_notes, prescription } = req.body;
    const query = `
      INSERT INTO consultation(patient_id, doctor_id, consultation_notes, prescription)
      VALUES($1,$2,$3,$4) RETURNING *;
    `;
    const values = [req.params.id, req.user.id, consultation_notes, prescription];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create Consultation Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get consultations for a patient
router.get('/patients/:id/consultations', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM consultation WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Consultations Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Referral Management ---

// Add a referral for a consultation
router.post('/consultations/:id/referrals', [
  authenticateToken,
  requireRole(['any']),
  body('referral_type').isIn([    'MongKol Borey Hospital', 'Optometrist', 'Dentist','Poipet Referral Hospital','Bong Bondol','SEVA','WSAudiology' ]).withMessage('Invalid referral type')
], validateRequest, async (req, res) => {
  try {
    const { referral_date, referral_symptom, referral_symptom_duration, referral_reason, referral_type } = req.body;
    const query = `
      INSERT INTO referral(patient_id, doctor_id, consultation_id, referral_date, referral_symptom, referral_symptom_duration, referral_reason, referral_type)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;
    `;
    // fetch consultation to get patient_id
    const cons = await db.query('SELECT patient_id FROM consultation WHERE id=$1',[req.params.id]);
    if(!cons.rows.length) return res.status(404).json({message:'Consultation not found'});
    const patient_id = cons.rows[0].patient_id;
    const values = [patient_id, req.user.id, req.params.id, referral_date, referral_symptom, referral_symptom_duration, referral_reason, referral_type];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add Referral Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get referrals for a consultation
router.get('/consultations/:id/referrals', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM referral WHERE consultation_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Referrals Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Physiotherapy Management ---

// Add physiotherapy for a patient
router.post('/patients/:id/physiotherapy', [
  authenticateToken,
  requireRole(['any']),
  body('pain_areas_description').notEmpty().withMessage('Pain areas description is required')
], validateRequest, async (req, res) => {
  try {
    const { pain_areas_description } = req.body;
    const query = `INSERT INTO physiotherapy(patient_id, doctor_id, pain_areas_description)
      VALUES($1,$2,$3) RETURNING *;`;
    const values = [req.params.id, req.user.id, pain_areas_description];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add Physiotherapy Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get physiotherapy records for a patient
router.get('/patients/:id/physiotherapy', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM physiotherapy WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Physiotherapy Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Visits: update queue number of a specific visit ---

// Update a visit’s queue number
router.put('/visits/:id', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    if (!req.body.queue_no || !String(req.body.queue_no).trim()) {
      return res.status(400).json({ message: 'queue_no is required' });
    }
    const queueToken = String(req.body.queue_no).trim().toUpperCase();
    if (!/^[0-9]+[A-Z]*$/.test(queueToken)) {
      return res.status(400).json({ message: 'queue_no must be a number with optional A–Z suffix, e.g. 2A, 102B, 1000' });
    }

    // Get current visit to know patient/location/date for uniqueness and mirroring
    const cur = await db.query(
      `SELECT id, patient_id, location_id, visit_date FROM visits WHERE id = $1`,
      [ req.params.id ]
    );
    if (!cur.rows.length) return res.status(404).json({ message: 'Visit not found' });

    const upd = await db.query(
      `UPDATE visits SET queue_no = $1 WHERE id = $2 RETURNING *`,
      [ queueToken, req.params.id ]
    );

    // Mirror queue to patient
    await db.query(`UPDATE patients SET queue_no = $1 WHERE id = $2`, [ queueToken, cur.rows[0].patient_id ]);

    res.json(upd.rows[0]);
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ message: 'Duplicate queue number for this location and date' });
    }
    console.error('Update Visit queue_no error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
