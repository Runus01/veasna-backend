BEGIN;

-- ─────────────────────────────
-- Users (username is UNIQUE)
-- ─────────────────────────────
INSERT INTO users (username) VALUES
  ('alice'),    -- doctor
  ('bob'),      -- nurse
  ('charlie'),  -- doctor
  ('davy')      -- physio
ON CONFLICT (username) DO NOTHING;

-- ─────────────────────────────
-- Patients (no queue_no column)
-- ─────────────────────────────
INSERT INTO patients
  (face_id, english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id)
VALUES
  -- Poipet
  ('face_sophea',  'Sophea Chan',  'សុភា ចាន់',  '1985-03-14', 'female', '+85510100001', 'Thma Koul, Poipet', (SELECT id FROM locations WHERE name='Poipet')),
  (NULL,           'Vuthy Sorn',   'វុទ្ធី សូន',  '1979-08-22', 'male',   '+85510100002', 'Kbal Spean, Poipet', (SELECT id FROM locations WHERE name='Poipet')),
  (NULL,           'Sareth Kim',   'សារ៉េត គីម',  '1992-12-05', 'male',   '+85510100003', 'O’Russey, Poipet',   (SELECT id FROM locations WHERE name='Poipet')),

  -- Mongkol Borey
  (NULL,           'Dara Long',    'ដារ៉ា លង',   '1990-01-11', 'male',   '+85510100004', 'Kouk Ballang, MB',    (SELECT id FROM locations WHERE name='Mongkol Borey')),
  (NULL,           'Sreyneang Im', 'ស្រីណាង អ៊ីម', '1988-06-09', 'female', '+85510100005', 'Prey Chhor, MB',      (SELECT id FROM locations WHERE name='Mongkol Borey')),
  (NULL,           'Raksmey Oum',  'រាក់ស்மை អ៊ុំ', '1970-03-30', 'female', '+85510100006', 'Chamkar, MB',         (SELECT id FROM locations WHERE name='Mongkol Borey')),

  -- Sisophon
  (NULL,           'Piseth Mean',  'ពីសេធ មៀន', '1995-05-17', 'male',   '+85510100007', 'Svay Dangkum, Siso',  (SELECT id FROM locations WHERE name='Sisophon')),
  (NULL,           'Sokunthea Ty', 'សុខន្ធា ទី', '1982-10-03', 'female', '+85510100008', 'Phsar Ler, Siso',     (SELECT id FROM locations WHERE name='Sisophon')),
  (NULL,           'Makara Nuon',  'មករា នួន',  '2001-02-21', 'other',  '+85510100009', 'Kokor, Siso',         (SELECT id FROM locations WHERE name='Sisophon'));

-- ─────────────────────────────
-- Visits (per-day per-location queues)
-- ─────────────────────────────
-- Poipet 2025-08-12
INSERT INTO visits (patient_id, location_id, visit_date, queue_no)
VALUES
  ((SELECT id FROM patients WHERE phone_number='+85510100001'), (SELECT id FROM locations WHERE name='Poipet'), '2025-08-12', '1A'),
  ((SELECT id FROM patients WHERE phone_number='+85510100002'), (SELECT id FROM locations WHERE name='Poipet'), '2025-08-12', '2');

-- Mongkol Borey 2025-08-12
INSERT INTO visits (patient_id, location_id, visit_date, queue_no)
VALUES
  ((SELECT id FROM patients WHERE phone_number='+85510100004'), (SELECT id FROM locations WHERE name='Mongkol Borey'), '2025-08-12', '3B'),
  ((SELECT id FROM patients WHERE phone_number='+85510100005'), (SELECT id FROM locations WHERE name='Mongkol Borey'), '2025-08-12', '4');

-- Sisophon 2025-08-12
INSERT INTO visits (patient_id, location_id, visit_date, queue_no)
VALUES
  ((SELECT id FROM patients WHERE phone_number='+85510100007'), (SELECT id FROM locations WHERE name='Sisophon'), '2025-08-12', '5A'),
  ((SELECT id FROM patients WHERE phone_number='+85510100008'), (SELECT id FROM locations WHERE name='Sisophon'), '2025-08-12', '6');

-- ─────────────────────────────
-- Vitals (use visit_id and bp fields)
-- ─────────────────────────────
INSERT INTO vitals (visit_id, height_cm, weight_kg, bmi, bp_systolic, bp_diastolic, blood_pressure, temperature_c, vitals_notes) VALUES
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100001') AND visit_date='2025-08-12'), 158, 54, 21.6, 112, 70, '112/70', 36.6, 'Initial screening'),
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100001') AND visit_date='2025-08-12'), 158, 55, 22.0, 118, 72, '118/72', 36.7, 'Follow-up weight'),

  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100004') AND visit_date='2025-08-12'), 170, 68, 23.5, 120, 80, '120/80', 36.8, 'Healthy baseline'),
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100004') AND visit_date='2025-08-12'), 170, 69, 23.9, 122, 82, '122/82', 36.7, 'Slight weight gain'),

  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100007') AND visit_date='2025-08-12'), 165, 62, 22.8, 118, 76, '118/76', 36.6, 'No complaints');

-- ─────────────────────────────
-- HEF (link by visit_id)
-- ─────────────────────────────
INSERT INTO hef (visit_id, know_hef, have_hef, hef_notes) VALUES
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100001') AND visit_date='2025-08-12'), TRUE,  FALSE, 'Aware but not enrolled'),
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100005') AND visit_date='2025-08-12'), TRUE,  TRUE,  'Has valid HEF card'),
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100007') AND visit_date='2025-08-12'), FALSE, FALSE, 'Not aware of HEF');

-- ─────────────────────────────
-- Visual Acuity (link by visit_id)
-- ─────────────────────────────
INSERT INTO visual_acuity (visit_id, left_pin, left_no_pin, right_pin, right_no_pin, visual_notes) VALUES
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100001') AND visit_date='2025-08-12'), '6/12', '6/18', '6/9',  '6/12', 'Mild myopia suspected'),
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100005') AND visit_date='2025-08-12'), '6/6',  '6/9',  '6/6',  '6/9',  'Near-normal'),
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100007') AND visit_date='2025-08-12'), '6/18', '6/24', '6/12', '6/18', 'Blurred distance vision');

-- ─────────────────────────────
-- Presenting Complaint (link by visit_id)
-- ─────────────────────────────
INSERT INTO presenting_complaint (visit_id, history, red_flags, systems_review, drug_allergies) VALUES
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100001') AND visit_date='2025-08-12'), 'Headaches, worse in sun', 'None', 'No chest pain/SOB', 'NKDA'),
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100005') AND visit_date='2025-08-12'), 'Eye strain after reading', 'None', 'No neuro deficits', 'NKDA');

-- ─────────────────────────────
-- History (link by visit_id)
-- ─────────────────────────────
INSERT INTO history (visit_id, past, drug_and_treatment, family, social, systems_review) VALUES
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100001') AND visit_date='2025-08-12'), 'No chronic illnesses', 'Occasional paracetamol', 'Mother HTN', 'Farmer, non-smoker', 'Unremarkable'),
  ((SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100004') AND visit_date='2025-08-12'), 'Childhood asthma (resolved)', 'Salbutamol prn (past)', 'Father DM2', 'Teacher, rare alcohol', 'No GI/GU issues');

-- ─────────────────────────────
-- Consultations (link by visit_id)
-- ─────────────────────────────
INSERT INTO consultation (visit_id, doctor_id, consultation_notes, prescription) VALUES
  (
    (SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100001') AND visit_date='2025-08-12'),
    (SELECT id FROM users WHERE username='alice'),
    'Probable tension headache; hydration and rest advised',
    'Paracetamol 500mg q6h prn x3 days'
  ),
  (
    (SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100005') AND visit_date='2025-08-12'),
    (SELECT id FROM users WHERE username='charlie'),
    'Eye strain; recommend refraction and ergonomic advice',
    'Artificial tears prn'
  );

-- ─────────────────────────────
-- Referrals (link by visit_id; constrained referral_type)
-- Allowed: 'MongKol Borey Hospital','Optometrist','Dentist','Poipet Referral Hospital','Bong Bondol','SEVA','WSAudiology'
-- ─────────────────────────────
INSERT INTO referral (visit_id, doctor_id, consultation_id, referral_date, referral_symptom, referral_symptom_duration, referral_reason, referral_type)
VALUES
  (
    (SELECT visit_id FROM consultation WHERE consultation.visit_id IN (
       SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100005') AND visit_date='2025-08-12'
     ) ORDER BY consultation.id DESC LIMIT 1),
    (SELECT id FROM users WHERE username='charlie'),
    (SELECT id FROM consultation WHERE visit_id IN (
       SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100005') AND visit_date='2025-08-12'
     ) ORDER BY id DESC LIMIT 1),
    '2025-08-12',
    'Eye strain',
    '2 months',
    'Formal refraction and visual aids',
    'Optometrist'
  );

-- ─────────────────────────────
-- Physiotherapy (link by visit_id)
-- ─────────────────────────────
INSERT INTO physiotherapy (visit_id, doctor_id, pain_areas_description) VALUES
  (
    (SELECT id FROM visits WHERE patient_id=(SELECT id FROM patients WHERE phone_number='+85510100004') AND visit_date='2025-08-12'),
    (SELECT id FROM users WHERE username='davy'),
    'Lower back ache after farm work'
  );

-- ─────────────────────────────
-- Pharmacy seed (optional)
-- ─────────────────────────────
INSERT INTO pharmacy (name, stock_level)
VALUES ('Amoxicillin 500mg', 200)
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Quick sanity checks (optional):
-- SELECT id,name FROM locations ORDER BY id;
-- SELECT id,username FROM users ORDER BY id;
-- SELECT id,english_name,location_id FROM patients ORDER BY id;
-- SELECT id,patient_id,location_id,visit_date,queue_no FROM visits ORDER BY id DESC;
