-- db_setup.sql
-- Run this script in your PostgreSQL database to create the necessary tables.

-- Users Table for staff login
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id)
);

-- Locations Table
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_updated_by INTEGER REFERENCES users(id)
);

-- Seed (idempotent)
INSERT INTO locations(name) VALUES
  ('Poipet'),
  ('Mongkol Borey'),
  ('Sisophon')
ON CONFLICT (name) DO NOTHING;

-- Patients Table
CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    face_id VARCHAR(255) UNIQUE,
    english_name VARCHAR(255) NOT NULL,
    khmer_name VARCHAR(255),
    date_of_birth DATE,
    sex VARCHAR(10),
    phone_number VARCHAR(50),
    address TEXT,
    location_id INTEGER NOT NULL REFERENCES locations(id),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id)
);

-- Visits / Queue numbers (temporary per-day per-location)
CREATE TABLE IF NOT EXISTS visits (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id),
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    queue_no TEXT NOT NULL,
    status TEXT DEFAULT 'waiting',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id),
    UNIQUE (patient_id, visit_date, queue_no)
);

-- Vitals Table
CREATE TABLE IF NOT EXISTS vitals (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    height_cm NUMERIC,
    weight_kg NUMERIC,
    bmi NUMERIC,
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    blood_pressure VARCHAR(50),
    temperature_c NUMERIC,
    vitals_notes TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id)
);

-- HEF table
CREATE TABLE IF NOT EXISTS hef (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    know_hef BOOLEAN NOT NULL,
    have_hef BOOLEAN NOT NULL,
    hef_notes TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id)
);

-- Visual Acuity
CREATE TABLE IF NOT EXISTS visual_acuity (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    left_pin VARCHAR(50) NOT NULL,
    left_no_pin VARCHAR(50) NOT NULL,
    right_pin VARCHAR(50) NOT NULL,
    right_no_pin VARCHAR(50) NOT NULL,
    visual_notes TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id)
);

-- Presenting Complaint
CREATE TABLE IF NOT EXISTS presenting_complaint (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    history TEXT,
    red_flags TEXT,
    systems_review TEXT,
    drug_allergies TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id)
);

-- History
CREATE TABLE IF NOT EXISTS history (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    past TEXT,
    drug_and_treatment TEXT,
    family TEXT,
    social TEXT,
    systems_review TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id)
);

-- Consult
CREATE TABLE IF NOT EXISTS consultation (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id),
    doctor_id INTEGER NOT NULL REFERENCES users(id),
    consultation_notes TEXT,
    prescription TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id)
);

-- Referral
CREATE TABLE IF NOT EXISTS referral (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id),
    doctor_id INTEGER NOT NULL REFERENCES users(id),
    consultation_id INTEGER NOT NULL REFERENCES consultation(id),
    referral_date DATE,
    referral_symptom VARCHAR(50),
    referral_symptom_duration VARCHAR(50),
    referral_reason TEXT, 
    referral_type TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id),
    CHECK (referral_type IN (
      'MongKol Borey Hospital',
      'Optometrist',
      'Dentist',
      'Poipet Referral Hospital',
      'Bong Bondol',
      'SEVA',
      'WSAudiology'
    ))
);

-- Physiotherapy
CREATE TABLE IF NOT EXISTS physiotherapy (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL REFERENCES visits(id),
    doctor_id INTEGER NOT NULL REFERENCES users(id),
    pain_areas_description TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id)
);

-- Pharmacy
CREATE TABLE IF NOT EXISTS pharmacy (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    stock_level INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INTEGER REFERENCES users(id)
);

-- Check for valid queue numbers (digits + optional uppercase letters)
ALTER TABLE visits   ADD CONSTRAINT visits_queue_no_chk   CHECK (queue_no ~ '^[0-9]+[A-Z]*$');
