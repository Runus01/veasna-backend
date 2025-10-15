# Veasna Clinical Management System - Backend

A Node.js/Express backend API for managing clinical patient data, optimized for health screenings (public access by default), with comprehensive patient management features.

## 🚀 Features

- **Public-first Access** (JWT optional; routes accept requests without tokens)
- **Simple User Creation** (username only; no password)
- **Comprehensive Patient Management** (CRUD operations)
- **Visit-Centric Data Model** — clinical entries attach to a **visit**
- **Vitals Tracking** (height, weight, BMI, **bp_systolic**, **bp_diastolic**, blood pressure, temperature)
- **HEF, Visual Acuity, Presenting Complaint, History, Consultation, Referral, Physiotherapy** modules
- **Automatic Visit Creation** when adding vitals/HEF/visual acuity/presenting complaint/history/consultation/referral/physiotherapy (if you provide `{ location_id, queue_no, visit_date? }`)
- **Advanced Search by Location + Date** (returns patients with `queue_no`/`visit_date`)
- **Combined Endpoint** to fetch **Vitals + HEF** grouped by visit
- **Pharmacy Inventory** (CRUD + stock adjustments)
- **Input Validation** and error handling
- **Rate Limiting** and security middleware
- **PostgreSQL Database** with connection pooling
- **Separate Locations Table** (screening sites)
- **Queue Numbers stored on `visits` only**; uniqueness per patient per date (`UNIQUE (patient_id, visit_date, queue_no)`)
- **Face ID** support on patients (`patients.face_id`, unique)

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🛠️ Installation & Setup

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd veasna-backend
npm install
```

### 2. Database Setup

#### Install PostgreSQL
- **macOS**: `brew install postgresql`
- **Ubuntu**: `sudo apt-get install postgresql postgresql-contrib`
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Create Database and User
```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create database and user
CREATE DATABASE veasna_backend;
CREATE USER your_postgres_user WITH PASSWORD 'your_postgres_password';
GRANT ALL PRIVILEGES ON DATABASE veasna_backend TO your_postgres_user;
\q
```

#### Run Database Setup Script
```bash
psql -U your_postgres_user -d veasna_backend -f db_setup.sql
```

### 3. Environment Configuration

Copy the `.env` file and update with your actual values:

```bash
cp .env .env.example
```

Update `.env` with your database credentials:
```env
DB_USER=your_actual_postgres_user
DB_HOST=localhost
DB_NAME=veasna_backend
DB_PASSWORD=your_actual_postgres_password
DB_PORT=5432

PORT=3000
NODE_ENV=development

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
FRONTEND_URL=http://localhost:3000
```

### 4. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## 📚 Conventions & Schema (Standardized)

- **Field naming**: `snake_case` for DB and JSON.
- **IDs**: integers unless stated otherwise.
- **Dates**: `YYYY-MM-DD` (no time).
- **Timestamps**: ISO 8601 with timezone (`last_updated` is server-generated).
- **Audit**: `last_updated_by` is the authenticated `users.id` or `null` (public).
- **Visit Linking**: For clinical tables (vitals, hef, visual_acuity, presenting_complaint, history, consultation, referral, physiotherapy) provide **either**:
  - an existing `visit_id`, **or**
  - `{ location_id, queue_no, visit_date? }` to create/reuse a visit for that patient.
- **`queue_no` format**: digits with optional uppercase suffix (e.g. `2`, `10A`), regex `^[0-9]+[A-Z]*$`.
- **Key schema fields** (from `db_setup.sql`):
  - `patients`: `id`, `face_id` (UNIQUE), `english_name`, `khmer_name`, `date_of_birth`, `sex`, `phone_number`, `address`, `location_id`, `last_updated`, `last_updated_by`
  - `visits`: `id`, `patient_id`, `location_id`, `visit_date`, `queue_no`, `status`, `last_updated`, `last_updated_by`, **UNIQUE**(`patient_id`, `visit_date`, `queue_no`)
  - `vitals`: `id`, `visit_id`, `height_cm`, `weight_kg`, `bmi`, `bp_systolic`, `bp_diastolic`, `blood_pressure`, `temperature_c`, `vitals_notes`, `last_updated`, `last_updated_by`
  - `hef`: `id`, `visit_id`, `know_hef`, `have_hef`, `hef_notes`, `last_updated`, `last_updated_by`
  - `visual_acuity`: `id`, `visit_id`, `left_pin`, `left_no_pin`, `right_pin`, `right_no_pin`, `visual_notes`, `last_updated`, `last_updated_by`
  - `presenting_complaint`: `id`, `visit_id`, `history`, `red_flags`, `systems_review`, `drug_allergies`, `last_updated`, `last_updated_by`
  - `history`: `id`, `visit_id`, `past`, `drug_and_treatment`, `family`, `social`, `systems_review`, `last_updated`, `last_updated_by`
  - `consultation`: `id`, `visit_id`, `doctor_id`, `consultation_notes`, `prescription`, `last_updated`, `last_updated_by`
  - `referral`: `id`, `visit_id`, `doctor_id`, `consultation_id`, `referral_date`, `referral_symptom`, `referral_symptom_duration`, `referral_reason`, `referral_type`, `last_updated`, `last_updated_by`
  - `physiotherapy`: `id`, `visit_id`, `doctor_id`, `pain_areas_description`, `last_updated`, `last_updated_by`
  - `pharmacy`: `id`, `name` (UNIQUE), `stock_level`, `last_updated`, `last_updated_by`

## 🔐 API Endpoints (Summary)

| Method | Endpoint                                   | Description                                                                 | Roles  |
|--------|--------------------------------------------|-----------------------------------------------------------------------------|--------|
| POST   | /api/users                                 | Create username-only user                                                   | Public |
| POST   | /api/session/login                         | (Optional) passwordless login, returns JWT                                  | Public |
| GET    | /api/locations                             | List screening locations                                                    | Public |
| GET    | /api/patients                              | List all patients (filter by location)                                      | Public |
| POST   | /api/patients                              | Create new patient (supports optional `face_id`)                            | Public |
| GET    | /api/patients/:id                          | Get patient by ID                                                           | Public |
| PUT    | /api/patients/:id                          | Update patient (incl. `face_id`)                                            | Public |
| DELETE | /api/patients/:id                          | Delete patient                                                              | Public |
| GET    | /api/visits/by-location-and-date           | **New**: Patients by `location_id` + `visit_date` with each `queue_no`      | Public |
| PUT    | /api/visits/:id                            | Update visit `queue_no`                                                     | Public |
| POST   | /api/patients/:id/vitals                   | Add vitals (visit required or auto-create via `{location_id, queue_no}`)    | Public |
| PUT    | /api/patients/:id/vitals/:vitalsId         | Update vitals                                                               | Public |
| DELETE | /api/patients/:id/vitals/:vitalsId         | Delete vitals                                                               | Public |
| GET    | /api/patients/:id/vitals                   | List vitals for patient                                                     | Public |
| POST   | /api/patients/:id/hef                      | Add HEF (visit required or auto-create)                                     | Public |
| PUT    | /api/patients/:id/hef/:hefId               | Update HEF                                                                  | Public |
| DELETE | /api/patients/:id/hef/:hefId               | Delete HEF                                                                  | Public |
| GET    | /api/patients/:id/hef                      | List HEF records                                                            | Public |
| POST   | /api/patients/:id/visual_acuity            | Add visual acuity (visit required or auto-create)                           | Public |
| GET    | /api/patients/:id/visual_acuity            | List visual acuity records                                                  | Public |
| POST   | /api/patients/:id/presenting_complaint     | Add presenting complaint (visit required or auto-create)                    | Public |
| GET    | /api/patients/:id/presenting_complaint     | List presenting complaints                                                  | Public |
| POST   | /api/patients/:id/history                  | Add history (visit required or auto-create)                                 | Public |
| GET    | /api/patients/:id/history                  | List history                                                                | Public |
| POST   | /api/patients/:id/consultations            | Create consultation (visit required or auto-create)                          | Public |
| GET    | /api/patients/:id/consultations            | List consultations for patient                                              | Public |
| POST   | /api/consultations/:id/referrals           | Add referral to consultation (visit inferred from consultation)             | Public |
| GET    | /api/consultations/:id/referrals           | List referrals for consultation                                             | Public |
| POST   | /api/patients/:id/physiotherapy            | Add physiotherapy (visit required or auto-create)                           | Public |
| GET    | /api/patients/:id/physiotherapy            | List physiotherapy                                                          | Public |
| GET    | /api/patients/:id/vitals-hef               | **New**: Combined vitals + HEF grouped by visit                             | Public |
| GET    | /api/pharmacy                              | **New**: List pharmacy items                                                | Public |
| POST   | /api/pharmacy                              | **New**: Create pharmacy item                                               | Public |
| PUT    | /api/pharmacy/:id                          | **New**: Rename and/or set stock (clamped to ≥ 0)                           | Public |
| PATCH  | /api/pharmacy/:id/adjust                   | **New**: Adjust stock by delta (positive/negative, clamped to ≥ 0)          | Public |
| DELETE | /api/pharmacy/:id                          | **New**: Delete pharmacy item                                               | Public |
| POST   | /api/registration                          | Combined create (patient + optional visit + vitals + HEF)                   | Public |
| PUT    | /api/registration/:patientId               | Combined update (patient + optional append vitals/HEF/visit)                | Public |
| DELETE | /api/registration/:patientId               | Combined delete patient (cascades)                                          | Public |

For full request/response details, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

## 🔑 Authentication

Authentication is **optional**. You may call endpoints without a token. If you do log in, include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🧪 Testing

```bash
npm test
```

## 📝 Development

```bash
# Run with auto-restart
npm run dev

# Format code
npm run format
```

## 🔧 Troubleshooting

### Database Connection Issues
1. Ensure PostgreSQL is running
2. Verify database credentials in `.env`
3. Check if database exists: `psql -U your_user -d veasna_backend`

### Port Already in Use
Change the PORT in `.env` or kill the process using the port:
```bash
lsof -ti:3000 | xargs kill -9
```

### JWT Token Issues
- Ensure JWT_SECRET is set in `.env`
- Check token expiration (default: 24 hours)

## 🚀 Production Deployment

1. Set `NODE_ENV=production`
2. Use a strong JWT_SECRET
3. Configure proper CORS origins
4. Set up SSL/TLS
5. Use a process manager like PM2

## 📄 License

ISC License