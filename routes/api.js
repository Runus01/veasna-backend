// routes/api.js

const express = require('express');
const router = express.Router();

const sessionRoutes = require('./session');
const patientRoutes = require('./patients');
const pharmacyRoutes = require('./pharmacy');
const locationRoutes = require('./locations');
const registrationRoutes = require('./registration');

router.use('/auth', sessionRoutes);
router.use('/patients', patientRoutes);
router.use('/pharmacy', pharmacyRoutes);
router.use('/locations', locationRoutes);
router.use('/registration', registrationRoutes);

const { body } = require('express-validator');
const db = require('../config/db');
const { authenticateToken, requireRole, validateRequest } = require('./auth');

// --- Visit helper (create on demand) ---
async function getOrCreateVisit(clientOrDb, { patientId, location_id, visit_date, queue_no }) {
  if (!patientId) throw new Error('patientId is required to create/find a visit');

  const visitDate = visit_date || new Date().toISOString().slice(0,10);
  if (!queue_no || !String(queue_no).trim()) {
    throw Object.assign(new Error('queue_no is required when creating a visit'), { status: 400 });
  }
  const q = String(queue_no).trim().toUpperCase();

  // Try to find an existing visit for patient + location + date + queue_no
  const existing = await clientOrDb.query(
    `SELECT id, patient_id, location_id, visit_date, queue_no
       FROM visits
      WHERE patient_id = $1 AND location_id = $2 AND visit_date = $3 AND queue_no = $4`,
    [patientId, Number(location_id), visitDate, q]
  );
  if (existing.rows.length) return existing.rows[0];

  // Create a new visit
  const ins = await clientOrDb.query(
    `INSERT INTO visits(patient_id, location_id, visit_date, queue_no)
     VALUES($1,$2,$3,$4) RETURNING id, patient_id, location_id, visit_date, queue_no`,
    [patientId, Number(location_id), visitDate, q]
  );
  return ins.rows[0];
}

// --- User Management (any authenticated user) ---

// GET all users (no auth)
router.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT username
       FROM users
       ORDER BY last_updated DESC`
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
      INSERT INTO patients(face_id, english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [face_id || null, english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id];
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

    sql += ' ORDER BY p.last_updated DESC';

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
    const { face_id, english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id } = req.body;
    const query = `
      UPDATE patients SET 
        face_id = COALESCE($1, face_id), 
        english_name=$2, khmer_name=$3, date_of_birth=$4, sex=$5, 
        phone_number=$6, address=$7, location_id = COALESCE($8, location_id),
        last_updated = CURRENT_TIMESTAMP, last_updated_by = COALESCE($10, last_updated_by)
      WHERE id=$9 
      RETURNING *;
    `;
    const values = [face_id || null, english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id || null, req.params.id, req.user.id || null];
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
  const client = db;
  try {
    const patientId = Number(req.params.id);
    const {
      visit_id,            // optional
      location_id,         // required if visit_id missing
      visit_date,          // optional (defaults today)
      queue_no,            // required if visit_id missing
      height_cm, weight_kg, bmi,
      bp_systolic, bp_diastolic, blood_pressure,
      temperature_c, vitals_notes
    } = req.body;

    let visitId = visit_id;
    if (!visitId) {
      if (!location_id) return res.status(400).json({ message: 'location_id required if visit_id is not provided' });
      const v = await getOrCreateVisit(client, { patientId, location_id, visit_date, queue_no });
      visitId = v.id;
    }

    const ins = await client.query(
      `INSERT INTO vitals(visit_id, height_cm, weight_kg, bmi, bp_systolic, bp_diastolic, blood_pressure, temperature_c, vitals_notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [visitId, height_cm, weight_kg, bmi || null, bp_systolic || null, bp_diastolic || null,
       blood_pressure || null, temperature_c || null, vitals_notes || null]
    );
    res.status(201).json(ins.rows[0]);
  } catch (error) {
    const code = error.status || 500;
    console.error('Add Vitals Error:', error);
    res.status(code).json({ message: error.message || 'Internal server error' });
  }
});

// Update a vitals record
router.put('/patients/:id/vitals/:vitalsId', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const {
      height_cm, weight_kg, bmi,
      bp_systolic, bp_diastolic, blood_pressure,
      temperature_c, vitals_notes
    } = req.body;
    const { vitalsId } = req.params;

    const upd = await db.query(
      `UPDATE vitals
          SET height_cm     = COALESCE($1, height_cm),
              weight_kg     = COALESCE($2, weight_kg),
              bmi           = COALESCE($3, bmi),
              bp_systolic   = COALESCE($4, bp_systolic),
              bp_diastolic  = COALESCE($5, bp_diastolic),
              blood_pressure= COALESCE($6, blood_pressure),
              temperature_c = COALESCE($7, temperature_c),
              vitals_notes  = COALESCE($8, vitals_notes)
        WHERE id = $9
        RETURNING *`,
      [height_cm || null, weight_kg || null, bmi || null, bp_systolic || null, bp_diastolic || null,
       blood_pressure || null, temperature_c || null, vitals_notes || null, vitalsId]
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
    const patientId = Number(req.params.id);
    const { visit_date } = req.query; // optional filter by date

    let sql = `
      SELECT vt.*
        FROM vitals vt
        JOIN visits v ON v.id = vt.visit_id
       WHERE v.patient_id = $1
    `;
    const vals = [patientId];
    if (visit_date) {
      sql += ' AND v.visit_date = $2';
      vals.push(visit_date);
    }
    sql += ' ORDER BY vt.last_updated DESC, vt.id DESC';

    const { rows } = await db.query(sql, vals);
    res.json(rows);
  } catch (error) {
    console.error('Get Vitals Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- HEF Management ---

// Add HEF for a patient
router.post('/patients/:id/hef', [
  authenticateToken, requireRole(['any']),
  body('know_hef').isBoolean().withMessage('know_hef is required'),
  body('have_hef').isBoolean().withMessage('have_hef is required')
], validateRequest, async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_id, location_id, visit_date, queue_no, know_hef, have_hef, hef_notes } = req.body;

    let visitId = visit_id;
    if (!visitId) {
      if (!location_id) return res.status(400).json({ message: 'location_id required if visit_id is not provided' });
      const v = await getOrCreateVisit(db, { patientId, location_id, visit_date, queue_no });
      visitId = v.id;
    }

    const { rows } = await db.query(
      `INSERT INTO hef(visit_id, know_hef, have_hef, hef_notes)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [visitId, !!know_hef, !!have_hef, hef_notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    const code = error.status || 500;
    console.error('Add HEF Error:', error);
    res.status(code).json({ message: error.message || 'Internal server error' });
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
        WHERE id = $4
        RETURNING *`,
      [typeof know_hef === 'boolean' ? know_hef : null,
       typeof have_hef === 'boolean' ? have_hef : null,
       hef_notes || null,
       req.params.hefId]
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
    const patientId = Number(req.params.id);
    const { visit_date } = req.query;

    let sql = `
      SELECT h.*
        FROM hef h
        JOIN visits v ON v.id = h.visit_id
       WHERE v.patient_id = $1
    `;
    const vals = [patientId];
    if (visit_date) {
      sql += ' AND v.visit_date = $2';
      vals.push(visit_date);
    }
    sql += ' ORDER BY h.last_updated DESC, h.id DESC';

    const { rows } = await db.query(sql, vals);
    res.json(rows);
  } catch (error) {
    console.error('Get HEF Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Visual Acuity Management ---

// Add visual acuity for a patient
router.post('/patients/:id/visual_acuity', [
  authenticateToken, requireRole(['any']),
  body('left_pin').notEmpty(),
  body('right_pin').notEmpty(),
  body('left_no_pin').notEmpty(),
  body('right_no_pin').notEmpty(),
], validateRequest, async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_id, location_id, visit_date, queue_no, left_pin, left_no_pin, right_pin, right_no_pin, visual_notes } = req.body;

    let visitId = visit_id;
    if (!visitId) {
      if (!location_id) return res.status(400).json({ message: 'location_id required if visit_id is not provided' });
      const v = await getOrCreateVisit(db, { patientId, location_id, visit_date, queue_no });
      visitId = v.id;
    }

    const { rows } = await db.query(
      `INSERT INTO visual_acuity(visit_id, left_pin, left_no_pin, right_pin, right_no_pin, visual_notes)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [visitId, left_pin, left_no_pin, right_pin, right_no_pin, visual_notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    const code = error.status || 500;
    console.error('Add Visual Acuity Error:', error);
    res.status(code).json({ message: error.message || 'Internal server error' });
  }
});

// Get visual acuity records for a patient
router.get('/patients/:id/visual_acuity', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_date } = req.query;

    let sql = `
      SELECT va.*
        FROM visual_acuity va
        JOIN visits v ON v.id = va.visit_id
       WHERE v.patient_id = $1
    `;
    const vals = [patientId];
    if (visit_date) {
      sql += ' AND v.visit_date = $2';
      vals.push(visit_date);
    }
    sql += ' ORDER BY va.last_updated DESC, va.id DESC';

    const { rows } = await db.query(sql, vals);
    res.json(rows);
  } catch (error) {
    console.error('Get Visual Acuity Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Presenting Complaint Management ---

// Add presenting complaint
router.post('/patients/:id/presenting_complaint', [
  authenticateToken, requireRole(['any']),
  body('history').notEmpty()
], validateRequest, async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_id, location_id, visit_date, queue_no, history, red_flags, systems_review, drug_allergies } = req.body;

    let visitId = visit_id;
    if (!visitId) {
      if (!location_id) return res.status(400).json({ message: 'location_id required if visit_id is not provided' });
      const v = await getOrCreateVisit(db, { patientId, location_id, visit_date, queue_no });
      visitId = v.id;
    }

    const { rows } = await db.query(
      `INSERT INTO presenting_complaint(visit_id, history, red_flags, systems_review, drug_allergies)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [visitId, history, red_flags || null, systems_review || null, drug_allergies || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    const code = error.status || 500;
    console.error('Add Presenting Complaint Error:', error);
    res.status(code).json({ message: error.message || 'Internal server error' });
  }
});

// Get presenting complaints for a patient
router.get('/patients/:id/presenting_complaint', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_date } = req.query;

    let sql = `
      SELECT pc.*
        FROM presenting_complaint pc
        JOIN visits v ON v.id = pc.visit_id
       WHERE v.patient_id = $1
    `;
    const vals = [patientId];
    if (visit_date) {
      sql += ' AND v.visit_date = $2';
      vals.push(visit_date);
    }
    sql += ' ORDER BY pc.last_updated DESC, pc.id DESC';

    const { rows } = await db.query(sql, vals);
    res.json(rows);
  } catch (error) {
    console.error('Get Presenting Complaint Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- History Management ---

// Add history record
router.post('/patients/:id/history', [
  authenticateToken, requireRole(['any']),
  body('past').notEmpty()
], validateRequest, async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_id, location_id, visit_date, queue_no, past, drug_and_treatment, family, social, systems_review } = req.body;

    let visitId = visit_id;
    if (!visitId) {
      if (!location_id) return res.status(400).json({ message: 'location_id required if visit_id is not provided' });
      const v = await getOrCreateVisit(db, { patientId, location_id, visit_date, queue_no });
      visitId = v.id;
    }

    const { rows } = await db.query(
      `INSERT INTO history(visit_id, past, drug_and_treatment, family, social, systems_review)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [visitId, past, drug_and_treatment || null, family || null, social || null, systems_review || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    const code = error.status || 500;
    console.error('Add History Error:', error);
    res.status(code).json({ message: error.message || 'Internal server error' });
  }
});

// Get history records for a patient
router.get('/patients/:id/history', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_date } = req.query;

    let sql = `
      SELECT h.*
        FROM history h
        JOIN visits v ON v.id = h.visit_id
       WHERE v.patient_id = $1
    `;
    const vals = [patientId];
    if (visit_date) {
      sql += ' AND v.visit_date = $2';
      vals.push(visit_date);
    }
    sql += ' ORDER BY h.last_updated DESC, h.id DESC';

    const { rows } = await db.query(sql, vals);
    res.json(rows);
  } catch (error) {
    console.error('Get History Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Consultation Management ---

// Create a consultation
router.post('/patients/:id/consultations', [
  authenticateToken, requireRole(['any']),
  body('consultation_notes').notEmpty()
], validateRequest, async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_id, location_id, visit_date, queue_no, consultation_notes, prescription } = req.body;

    let visitId = visit_id;
    if (!visitId) {
      if (!location_id) return res.status(400).json({ message: 'location_id required if visit_id is not provided' });
      const v = await getOrCreateVisit(db, { patientId, location_id, visit_date, queue_no });
      visitId = v.id;
    }

    const { rows } = await db.query(
      `INSERT INTO consultation(visit_id, doctor_id, consultation_notes, prescription)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [visitId, req.user.id, consultation_notes, prescription || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    const code = error.status || 500;
    console.error('Create Consultation Error:', error);
    res.status(code).json({ message: error.message || 'Internal server error' });
  }
});

// Get consultations for a patient
router.get('/patients/:id/consultations', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_date } = req.query;

    let sql = `
      SELECT c.*
        FROM consultation c
        JOIN visits v ON v.id = c.visit_id
       WHERE v.patient_id = $1
    `;
    const vals = [patientId];
    if (visit_date) {
      sql += ' AND v.visit_date = $2';
      vals.push(visit_date);
    }
    sql += ' ORDER BY c.last_updated DESC, c.id DESC';

    const { rows } = await db.query(sql, vals);
    res.json(rows);
  } catch (error) {
    console.error('Get Consultations Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Referral Management ---

// Add a referral for a consultation
router.post('/consultations/:id/referrals', [
  authenticateToken, requireRole(['any']),
  body('referral_type').isIn(['MongKol Borey Hospital','Optometrist','Dentist','Poipet Referral Hospital','Bong Bondol','SEVA','WSAudiology'])
], validateRequest, async (req, res) => {
  try {
    const { referral_date, referral_symptom, referral_symptom_duration, referral_reason, referral_type } = req.body;

    // Get visit_id (and patient_id if needed) from the consultation
    const cons = await db.query(
      `SELECT c.visit_id, v.patient_id
         FROM consultation c
         JOIN visits v ON v.id = c.visit_id
        WHERE c.id = $1`,
      [req.params.id]
    );
    if (!cons.rows.length) return res.status(404).json({ message:'Consultation not found' });
    const { visit_id, patient_id } = cons.rows[0];

    const { rows } = await db.query(
      `INSERT INTO referral(visit_id, doctor_id, consultation_id, referral_date, referral_symptom, referral_symptom_duration, referral_reason, referral_type)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [visit_id, req.user.id, req.params.id, referral_date || null, referral_symptom || null,
       referral_symptom_duration || null, referral_reason || null, referral_type]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add Referral Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get referrals for a consultation
router.get('/consultations/:id/referrals', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM referral WHERE consultation_id=$1 ORDER BY last_updated DESC, id DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Get Referrals Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Physiotherapy Management ---

// Add physiotherapy for a patient
router.post('/patients/:id/physiotherapy', [
  authenticateToken, requireRole(['any']),
  body('pain_areas_description').notEmpty()
], validateRequest, async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_id, location_id, visit_date, queue_no, pain_areas_description } = req.body;

    let visitId = visit_id;
    if (!visitId) {
      if (!location_id) return res.status(400).json({ message: 'location_id required if visit_id is not provided' });
      const v = await getOrCreateVisit(db, { patientId, location_id, visit_date, queue_no });
      visitId = v.id;
    }

    const { rows } = await db.query(
      `INSERT INTO physiotherapy(visit_id, doctor_id, pain_areas_description)
       VALUES($1,$2,$3) RETURNING *`,
      [visitId, req.user.id, pain_areas_description]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    const code = error.status || 500;
    console.error('Add Physiotherapy Error:', error);
    res.status(code).json({ message: error.message || 'Internal server error' });
  }
});

// Get physiotherapy records for a patient
router.get('/patients/:id/physiotherapy', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_date } = req.query;

    let sql = `
      SELECT p.*
        FROM physiotherapy p
        JOIN visits v ON v.id = p.visit_id
       WHERE v.patient_id = $1
    `;
    const vals = [patientId];
    if (visit_date) {
      sql += ' AND v.visit_date = $2';
      vals.push(visit_date);
    }
    sql += ' ORDER BY p.last_updated DESC, p.id DESC';

    const { rows } = await db.query(sql, vals);
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
    const raw = req.body.queue_no;
    if (!raw || !String(raw).trim()) {
      return res.status(400).json({ message: 'queue_no is required' });
    }
    const queueToken = String(raw).trim().toUpperCase();
    if (!/^[0-9]+[A-Z]*$/.test(queueToken)) {
      return res.status(400).json({ message: 'queue_no must be a number with optional A–Z suffix, e.g. 2A, 102B, 1000' });
    }

    const cur = await db.query(
      `SELECT id FROM visits WHERE id = $1`,
      [ req.params.id ]
    );
    if (!cur.rows.length) return res.status(404).json({ message: 'Visit not found' });

    const upd = await db.query(
      `UPDATE visits SET queue_no = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [ queueToken, req.params.id ]
    );

    res.json(upd.rows[0]);
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ message: 'Duplicate queue number for this patient on this date' });
    }
    console.error('Update Visit queue_no error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/visits/by-location-and-date location_id=...&visit_date=YYYY-MM-DD
router.get('/visits/by-location-and-date', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { location_id, visit_date } = req.query;
    if (!location_id || !visit_date) {
      return res.status(400).json({ message: 'location_id and visit_date are required' });
    }

    const sql = `
      SELECT
        p.*,
        v.queue_no,
        v.visit_date,
        l.name AS location_name
      FROM visits v
      JOIN patients p ON p.id = v.patient_id
      JOIN locations l ON l.id = v.location_id
      WHERE v.location_id = $1
        AND v.visit_date = $2
      ORDER BY v.queue_no::text ASC, p.english_name ASC
    `;
    const { rows } = await db.query(sql, [Number(location_id), visit_date]);
    res.json(rows);
  } catch (err) {
    console.error('Search by location/date error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/patients/:id/vitals-hef[?visit_date=YYYY-MM-DD]
router.get('/patients/:id/vitals-hef', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { visit_date } = req.query;

    let base = `
      SELECT v.id AS visit_id, v.queue_no, v.visit_date
        FROM visits v
       WHERE v.patient_id = $1
    `;
    const vals = [patientId];
    if (visit_date) { base += ' AND v.visit_date = $2'; vals.push(visit_date); }
    base += ' ORDER BY v.visit_date DESC, v.queue_no ASC';

    const visits = (await db.query(base, vals)).rows;

    // Gather vitals & hef per visit
    const out = [];
    for (const vis of visits) {
      const [vt, hf] = await Promise.all([
        db.query('SELECT * FROM vitals WHERE visit_id = $1 ORDER BY last_updated DESC, id DESC', [vis.visit_id]),
        db.query('SELECT * FROM hef    WHERE visit_id = $1 ORDER BY last_updated DESC, id DESC', [vis.visit_id]),
      ]);
      out.push({
        visit_id: vis.visit_id,
        queue_no: vis.queue_no,
        visit_date: vis.visit_date,
        vitals: vt.rows,
        hef: hf.rows
      });
    }

    res.json({ patient_id: patientId, visits: out });
  } catch (err) {
    console.error('Get vitals+hef error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
