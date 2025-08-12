# Veasna Clinical Management System - Backend

A Node.js/Express backend API for managing clinical patient data, optimized for health screenings (public access by default), with comprehensive patient management features.

## 🚀 Features

- **Public-first Access** (JWT optional; routes accept requests without tokens)
- **Simple User Creation** (username only; no password)
- **Comprehensive Patient Management** (CRUD operations)
- **Vitals Tracking** (height, weight, BMI, blood pressure, temperature)
- **HEF, Visual Acuity, Presenting Complaint, History, Consultation, Referral, Physiotherapy** modules
- **Input Validation** and error handling
- **Rate Limiting** and security middleware
- **PostgreSQL Database** with connection pooling
- **Separate Locations Table** (screening sites)
- **Queue Numbers** stored on both `visits` and mirrored on `patients`

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

## 🔐 API Endpoints (Summary)

| Method | Endpoint                                   | Description                                                  | Roles  |
|--------|--------------------------------------------|--------------------------------------------------------------|--------|
| POST   | /api/users                                 | Create username-only user                                    | Public |
| POST   | /api/session/login                         | (Optional) passwordless login, returns JWT                   | Public |
| GET    | /api/locations                             | List screening locations                                     | Public |
| GET    | /api/patients                              | List all patients (filter by location)                       | Public |
| POST   | /api/patients                              | Create new patient (requires location_id)                    | Public |
| GET    | /api/patients/:id                          | Get patient by ID                                            | Public |
| PUT    | /api/patients/:id                          | Update patient                                               | Public |
| DELETE | /api/patients/:id                          | Delete patient                                               | Public |
| POST   | /api/patients/:id/vitals                   | Add vitals for patient                                       | Public |
| PUT    | /api/patients/:id/vitals/:vitalsId         | Update vitals                                                | Public |
| DELETE | /api/patients/:id/vitals/:vitalsId         | Delete vitals                                                | Public |
| GET    | /api/patients/:id/vitals                   | List vitals for patient                                      | Public |
| POST   | /api/patients/:id/hef                      | Add HEF record                                               | Public |
| PUT    | /api/patients/:id/hef/:hefId               | Update HEF record                                            | Public |
| DELETE | /api/patients/:id/hef/:hefId               | Delete HEF record                                            | Public |
| GET    | /api/patients/:id/hef                      | List HEF records                                             | Public |
| POST   | /api/patients/:id/visual_acuity            | Add visual acuity record                                     | Public |
| GET    | /api/patients/:id/visual_acuity            | List visual acuity records                                   | Public |
| POST   | /api/patients/:id/presenting_complaint     | Add presenting complaint                                     | Public |
| GET    | /api/patients/:id/presenting_complaint     | List presenting complaints                                   | Public |
| POST   | /api/patients/:id/history                  | Add history record                                           | Public |
| GET    | /api/patients/:id/history                  | List history records                                         | Public |
| POST   | /api/patients/:id/consultations            | Create consultation                                          | Public |
| GET    | /api/patients/:id/consultations            | List consultations for patient                               | Public |
| POST   | /api/consultations/:id/referrals           | Add referral to consultation                                 | Public |
| GET    | /api/consultations/:id/referrals           | List referrals for consultation                              | Public |
| POST   | /api/patients/:id/physiotherapy            | Add physiotherapy record                                     | Public |
| GET    | /api/patients/:id/physiotherapy            | List physiotherapy records                                   | Public |
| POST   | /api/registration                          | Combined create (patient + vitals + HEF + visit)             | Public |
| PUT    | /api/registration/:patientId               | Combined update (patient + optional append vitals/HEF/visit) | Public |
| DELETE | /api/registration/:patientId               | Combined delete patient (cascades)                           | Public |
| PUT    | /api/visits/:id                            | Update visit queue_no and mirror to patient                  | Public |


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