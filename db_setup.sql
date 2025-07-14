-- db_setup.sql
-- Run this script in your PostgreSQL database to create the necessary tables.

-- Users Table for staff login
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Patients Table
CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    english_name VARCHAR(255) NOT NULL,
    khmer_name VARCHAR(255),
    date_of_birth DATE,
    sex VARCHAR(10),
    phone_number VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vitals Table
CREATE TABLE IF NOT EXISTS vitals (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    height_cm NUMERIC,
    weight_kg NUMERIC,
    bmi NUMERIC,
    blood_pressure VARCHAR(50),
    temperature_c NUMERIC,
    vitals_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HEF table
CREATE TABLE IF NOT EXISTS hef (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    know_hef BOOLEAN NOT NULL,
    have_hef BOOLEAN NOT NULL,
    hef_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Visual Acuity
CREATE TABLE IF NOT EXISTS visual_acuity (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    left_pin VARCHAR(50) NOT NULL,
    left_no_pin VARCHAR(50) NOT NULL,
    right_pin VARCHAR(50) NOT NULL,
    right_no_pin VARCHAR(50) NOT NULL,
    visual_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Presenting Complaint
CREATE TABLE IF NOT EXISTS presenting_complaint (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    history TEXT,
    red_flags TEXT,
    systems_review TEXT,
    drug_allergies TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- History
CREATE TABLE IF NOT EXISTS history (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    past TEXT,
    drug_and_treatment TEXT,
    family TEXT,
    social TEXT,
    systems_review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Consult
CREATE TABLE IF NOT EXISTS consultation (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    doctor_id INTEGER NOT NULL REFERENCES users(id),
    consultation_notes TEXT,
    prescription TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Referral
CREATE TABLE IF NOT EXISTS referral (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    doctor_id INTEGER NOT NULL REFERENCES users(id),
    consultation_id INTEGER NOT NULL REFERENCES consultation(id),
    referral_date DATE,
    referral_symptom VARCHAR(50),
    referral_symptom_duration VARCHAR(50),
    referral_reason TEXT, 
    referral_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    doctor_id INTEGER NOT NULL REFERENCES users(id),
    pain_areas_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

