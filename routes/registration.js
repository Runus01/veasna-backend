// routes/registration.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');

async function getOrCreateVisit(clientOrDb, { patientId, location_id, visit_date, queue_no }) {
  const visitDate = visit_date || new Date().toISOString().slice(0,10);
  if (!queue_no || !String(queue_no).trim()) {
    throw Object.assign(new Error('visit.queue_no is required to create a visit'), { status: 400 });
  }
  const q = String(queue_no).trim().toUpperCase();
  const existing = await clientOrDb.query(
    `SELECT id FROM visits WHERE patient_id=$1 AND location_id=$2 AND visit_date=$3 AND queue_no=$4`,
    [patientId, Number(location_id), visitDate, q]
  );
  if (existing.rows.length) return existing.rows[0];

  const ins = await clientOrDb.query(
    `INSERT INTO visits(patient_id, location_id, visit_date, queue_no)
     VALUES($1,$2,$3,$4) RETURNING id`,
    [patientId, Number(location_id), visitDate, q]
  );
  return ins.rows[0];
}

/**
 * POST /api/registration
 * Creates patient + (optional) vitals + (optional) HEF + (optional) visit
 * Body:
 * {
 *   "patient": { face_id?, english_name, khmer_name?, date_of_birth?, sex?, phone_number?, address?, location_id },
 *   "visit"  : { location_id, visit_date?, queue_no },                        // required if vitals or hef provided
 *   "vitals" : { height_cm?, weight_kg?, bmi?, bp_systolic?, bp_diastolic?, blood_pressure?, temperature_c?, vitals_notes? }, // optional
 *   "hef"    : { know_hef, have_hef, hef_notes? }                             // optional
 * }
 */
router.post('/', authenticateToken, requireRole(['any']), async (req, res) => {
  const { patient, vitals, hef, visit } = req.body;

  if (!patient || !patient.english_name || !patient.location_id) {
    return res.status(400).json({ message: 'patient.english_name and patient.location_id are required' });
  }
  // If vitals or HEF provided, enforce a visit block with location_id + queue_no
  if ((vitals || hef) && !(visit && visit.location_id && visit.queue_no)) {
    return res.status(400).json({ message: 'visit{location_id, queue_no} is required when submitting vitals or HEF' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Create patient (include face_id)
    const pRes = await client.query(
      `INSERT INTO patients(face_id, english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        patient.face_id || null,
        patient.english_name,
        patient.khmer_name || null,
        patient.date_of_birth || null,
        patient.sex || null,
        patient.phone_number || null,
        patient.address || null,
        patient.location_id
      ]
    );
    const newPatient = pRes.rows[0];

    // 2) Ensure/obtain visit if requested or required
    let visitRow = null;
    if (visit && visit.location_id) {
      visitRow = await getOrCreateVisit(client, {
        patientId: newPatient.id,
        location_id: visit.location_id,
        visit_date: visit.visit_date,
        queue_no: visit.queue_no
      });
    }

    // 3) Insert vitals (if any) using visit_id
    let vitalsRow = null;
    if (vitals) {
      const vId = visitRow?.id;
      const vRes = await client.query(
        `INSERT INTO vitals(visit_id, height_cm, weight_kg, bmi, bp_systolic, bp_diastolic, blood_pressure, temperature_c, vitals_notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          vId,
          vitals.height_cm || null,
          vitals.weight_kg || null,
          vitals.bmi || null,
          vitals.bp_systolic || null,
          vitals.bp_diastolic || null,
          vitals.blood_pressure || null,
          vitals.temperature_c || null,
          vitals.vitals_notes || null
        ]
      );
      vitalsRow = vRes.rows[0];
    }

    // 4) Insert HEF (if any) using visit_id
    let hefRow = null;
    if (hef) {
      const vId = visitRow?.id;
      const hRes = await client.query(
        `INSERT INTO hef(visit_id, know_hef, have_hef, hef_notes)
         VALUES($1,$2,$3,$4)
         RETURNING *`,
        [
          vId,
          !!hef.know_hef,
          !!hef.have_hef,
          hef.hef_notes || null
        ]
      );
      hefRow = hRes.rows[0];
    }

    await client.query('COMMIT');
    // Return the created records
    res.status(201).json({ patient: newPatient, visit: visitRow, vitals: vitalsRow, hef: hefRow });

  } catch (err) {
    await client.query('ROLLBACK');
    // 23505 could be duplicate face_id or the visits unique (patient_id, visit_date, queue_no)
    if (err && err.code === '23505') {
      return res.status(409).json({ message: 'Conflict (duplicate unique value, e.g., face_id or (patient, date, queue_no))' });
    }
    console.error('Registration create error:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/registration/:patientId
 * Updates patient fields; optionally appends a new vitals/hef record.
 * (Vitals/HEF are append-only for audit.)
 */
router.put('/:patientId', authenticateToken, requireRole(['any']), async (req, res) => {
  const { patient, vitals, hef, visit } = req.body;
  const { patientId } = req.params;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    let updatedPatient = null;
    if (patient) {
      const uRes = await client.query(
        `UPDATE patients
            SET english_name = COALESCE($1, english_name),
                khmer_name   = COALESCE($2, khmer_name),
                date_of_birth= COALESCE($3, date_of_birth),
                sex          = COALESCE($4, sex),
                phone_number = COALESCE($5, phone_number),
                address      = COALESCE($6, address),
                location_id  = COALESCE($7, location_id)
          WHERE id = $8
        RETURNING *`,
        [
          patient.english_name || null, patient.khmer_name || null, patient.date_of_birth || null,
          patient.sex || null, patient.phone_number || null, patient.address || null,
          patient.location_id || null, patientId
        ]
      );
      if (!uRes.rows.length) return res.status(404).json({ message: 'Patient not found' });
      updatedPatient = uRes.rows[0];
    }

    let vitalsRow = null;
    if (vitals) {
      const vRes = await client.query(
        `INSERT INTO vitals(patient_id, height_cm, weight_kg, bmi, blood_pressure, temperature_c, vitals_notes)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          patientId, vitals.height_cm || null, vitals.weight_kg || null, vitals.bmi || null,
          vitals.blood_pressure || null, vitals.temperature_c || null, vitals.vitals_notes || null
        ]
      );
      vitalsRow = vRes.rows[0];
    }

    let hefRow = null;
    if (hef) {
      const hRes = await client.query(
        `INSERT INTO hef(patient_id, know_hef, have_hef, hef_notes)
         VALUES($1,$2,$3,$4) RETURNING *`,
        [ patientId, !!hef.know_hef, !!hef.have_hef, hef.hef_notes || null ]
      );
      hefRow = hRes.rows[0];
    }

    // Optionally update/create visit & mirror queue on patient
    let visitRow = null;
    if (visit && visit.location_id) {
      const visitDate = visit.visit_date || new Date().toISOString().slice(0,10);
      if (!visit.queue_no || !String(visit.queue_no).trim()) {
        return res.status(400).json({ message: 'visit.queue_no is required when visit is provided' });
      }
      const queueToken = String(visit.queue_no).trim().toUpperCase();

      // Try to find an existing visit for this patient/location/date
      const existing = await client.query(
        `SELECT id FROM visits WHERE patient_id = $1 AND location_id = $2 AND visit_date = $3`,
        [ patientId, visit.location_id, visitDate ]
      );

      if (existing.rows.length) {
        const upd = await client.query(
          `UPDATE visits SET queue_no = $1 WHERE id = $2 RETURNING *`,
          [ queueToken, existing.rows[0].id ]
        );
        visitRow = upd.rows[0];
      } else {
        const ins = await client.query(
          `INSERT INTO visits(patient_id, location_id, visit_date, queue_no)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [ patientId, visit.location_id, visitDate, queueToken ]
        );
        visitRow = ins.rows[0];
      }

      // Mirror on patient
      await client.query(`UPDATE patients SET queue_no = $1 WHERE id = $2`, [ queueToken, patientId ]);
      if (updatedPatient) updatedPatient.queue_no = queueToken;
    }

    await client.query('COMMIT');
    res.json({ patient: updatedPatient, vitals: vitalsRow, hef: hefRow, visit: visitRow });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err && err.code === '23505') {
      return res.status(409).json({ message: 'Duplicate queue number for this location and date' });
    }
    console.error('Registration update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/registration/:patientId
 * Removes the patient (cascades to vitals/hef/visits due to FK ON DELETE CASCADE)
 */
router.delete('/:patientId', authenticateToken, requireRole(['any']), async (req, res) => {
  try {
    const del = await db.query('DELETE FROM patients WHERE id = $1 RETURNING id', [ req.params.patientId ]);
    if (!del.rows.length) return res.status(404).json({ message: 'Patient not found' });
    res.json({ message: 'Patient deleted', patient_id: del.rows[0].id });
  } catch (err) {
    console.error('Registration delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
