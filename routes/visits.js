// routes/visits.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');

// POST /api/visits (Create a new patient visit)
router.post('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const last_updated_by = req.user.id;
    const { patientInfo, visit, vitals, hef } = req.body;


    try {
        await db.query('BEGIN');

        // Step 1: Insert or Find the patient
        let patientId = patientInfo.id;
        if (!patientId) {
            // New patient: Insert into patients table
            const patientQuery = `
                INSERT INTO patients (face_id, location_id, english_name, khmer_name, date_of_birth, sex, address, phone_number, last_updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id;
            `;
            const patientValues = [
                patientInfo.face_id,
                patientInfo.location_id,
                patientInfo.english_name,
                patientInfo.khmer_name,
                patientInfo.date_of_birth || null,
                patientInfo.sex,
                patientInfo.address,
                patientInfo.phone_number,
                last_updated_by
            ];
            const patientResult = await db.query(patientQuery, patientValues);
            patientId = patientResult.rows[0].id
        }

        // Step 2: Insert into visits table
        const visitQuery = `
            INSERT INTO visits (patient_id, location_id, queue_no, visit_date, last_updated_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, created_at;
        `;
        const visitValues = [
            patientId, 
            patientInfo.location_id, 
            visit.queue_no, 
            new Date(), 
            last_updated_by
        ];
        const visitResult = await db.query(visitQuery, visitValues);
        const visitId = visitResult.rows[0].id;
        const visitTimestamp = visitResult.rows[0].created_at;

        // Step 3: Insert into vitals table
        const vitalsQuery = `
            INSERT INTO vitals (visit_id, height, weight, bmi, below_3rd_percentile, bp_systolic, bp_diastolic, temperature, notes, last_updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        `;
        const vitalsValues = [
            visitId, 
            parseFloat(vitals.height), 
            parseFloat(vitals.weight), 
            parseFloat(vitals.bmi),
            vitals.below_3rd_percentile,
            parseInt(vitals.bp_systolic),
            parseInt(vitals.bp_diastolic),
            parseFloat(vitals.temperature),
            vitals.notes,
            last_updated_by
        ];
        await db.query(vitalsQuery, vitalsValues);

        // Step 4: Insert into HEF table
        const hefQuery = `
            INSERT INTO hef (visit_id, know_of_hef, has_hef, notes, last_updated_by)
            VALUES ($1, $2, $3, $4, $5);
        `;

        const hefValues = [
            visitId, 
            hef.know_of_hef === 'yes', 
            hef.has_hef === 'yes', 
            hef.notes, 
            last_updated_by
        ];
        await db.query(hefQuery, hefValues);

        // if all queries succeed, commit the transaction
        await db.query('COMMIT');

        // respond with the newly created QueuedPatient Object
        res.status(201).json({
            visit_id: visitId,
            patient_id: patientId,
            queue_no: visit.queue_no,
            english_name: patientInfo.english_name,
            khmer_name: patientInfo.khmer_name,
            age: patientInfo.age,
            sex: patientInfo.sex,
            timestamp: new Date(visitTimestamp).toLocaleTimeString()
        });

    } catch (err) {
        // if any query fails, roll back entire transaction
        await db.query('ROLLBACK');
        console.error('Error in registration transaction:', err);
        res.status(500).json({ error: 'Failed to register patient' });
    // } finally {
    //     // Release the db back to the pool
    //     db.release();
    }
});

// GET: vitals
router.get('/vitals/:id/:visit_id', authenticateToken, requireRole(['any']), async (req, res) => {
  const { id } = req.params;
  const { visit_id } = req.params;

  if (!id || !visit_id) {
    return res.status(400).json({ error: 'Patient and visit ids are required' });
  }

  try {
    const queryText = `
      SELECT v.*
      FROM vitals v
      INNER JOIN visits vi ON vi.id = v.visit_id
      WHERE vi.patient_id = $1 AND vi.id = $2
    `;

    const result = await db.query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vitals not found' });
    }

    res.status(200).json(result.rows[0]);

  } catch (err) {
    console.error('Error fetching patient vitals:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: history
router.get('/history/:id/:visit_id', authenticateToken, requireRole(['any']), async (req, res) => {
  const { id, visit_id } = req.params;

  if (!id || !visit_id) {
    return res.status(400).json({ error: 'Patient and visit ids are required' });
  }

  try {
    const queryText = `
      SELECT h.*
      FROM history h
      INNER JOIN visits vi ON vi.id = h.visit_id
      WHERE vi.patient_id = $1 AND vi.id = $2
    `;

    const result = await db.query(queryText, [id, visit_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'History not found' });
    }

    res.status(200).json(result.rows[0]);

  } catch (err) {
    console.error('Error fetching patient history:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: visual_acuity
router.get('/visual-acuity/:id/:visit_id', authenticateToken, requireRole(['any']), async (req, res) => {
  const { id, visit_id } = req.params;

  if (!id || !visit_id) {
    return res.status(400).json({ error: 'Patient id and Visit id are required' });
  }

  try {
    const queryText = `
      SELECT va.*
      FROM visual_acuity va
      INNER JOIN visits vi ON vi.id = va.visit_id
      WHERE vi.patient_id = $1 AND va.visit_id = $2
    `;

    const result = await db.query(queryText, [id, visit_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Visual acuity data not found for this patient/visit" });
    }

    res.status(200).json(result.rows[0]); // one record per visit
  } catch (err) {
    console.error('Error fetching visual acuity:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: presenting complaints
router.get('/presenting-complaint/:id/:visit_id', authenticateToken, requireRole(['any']), async (req, res) => {
  const { id, visit_id } = req.params;

  if (!id || !visit_id) {
    return res.status(400).json({ error: 'Patient id and Visit id are required' });
  }

  try {
    const queryText = `
      SELECT pc.*
      FROM presenting_complaint pc
      INNER JOIN visits vi ON vi.id = pc.visit_id
      WHERE vi.patient_id = $1 AND pc.visit_id = $2
    `;

    const result = await db.query(queryText, [id, visit_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Presenting complaint not found for this patient/visit" });
    }

    res.status(200).json(result.rows[0]); // one record per visit
  } catch (err) {
    console.error('Error fetching presenting complaint:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;