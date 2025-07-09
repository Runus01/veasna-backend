# Veasna Clinical Management System - Backend

A secure Node.js/Express backend API for managing clinical patient data with authentication, role-based access control, and comprehensive patient management features.

## 🚀 Features

- **Secure Authentication** with JWT tokens
- **Role-based Access Control** (Admin, Doctor, Nurse)
- **Comprehensive Patient Management** (CRUD operations)
- **Vitals Tracking** (height, weight, BMI, blood pressure, temperature)
- **HEF, Visual Acuity, Presenting Complaint, History, Consultation, Referral, Physiotherapy** modules
- **Input Validation** and error handling
- **Rate Limiting** and security middleware
- **PostgreSQL Database** with connection pooling

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

| Method | Endpoint                                   | Description                                 | Roles                |
|--------|--------------------------------------------|---------------------------------------------|----------------------|
| POST   | /api/signup                                | Create new user account                     | Public               |
| POST   | /api/login                                 | User login                                  | Public               |
| GET    | /api/profile                               | Get current user profile                    | Authenticated        |
| GET    | /api/patients                              | List all patients                           | Admin, Doctor, Nurse |
| POST   | /api/patients                              | Create new patient                          | Admin, Doctor, Nurse |
| GET    | /api/patients/:id                          | Get patient by ID                           | Admin, Doctor, Nurse |
| PUT    | /api/patients/:id                          | Update patient                              | Admin, Doctor, Nurse |
| DELETE | /api/patients/:id                          | Delete patient                              | Admin, Doctor        |
| POST   | /api/patients/:id/vitals                   | Add vitals for patient                      | Admin, Doctor, Nurse |
| GET    | /api/patients/:id/vitals                   | List vitals for patient                     | Admin, Doctor, Nurse |
| POST   | /api/patients/:id/hef                      | Add HEF record                              | Admin, Doctor, Nurse |
| GET    | /api/patients/:id/hef                      | List HEF records                            | Admin, Doctor, Nurse |
| POST   | /api/patients/:id/visual_acuity            | Add visual acuity record                    | Admin, Doctor, Nurse |
| GET    | /api/patients/:id/visual_acuity            | List visual acuity records                  | Admin, Doctor, Nurse |
| POST   | /api/patients/:id/presenting_complaint     | Add presenting complaint                    | Admin, Doctor        |
| GET    | /api/patients/:id/presenting_complaint     | List presenting complaints                  | Admin, Doctor, Nurse |
| POST   | /api/patients/:id/history                  | Add history record                          | Admin, Doctor        |
| GET    | /api/patients/:id/history                  | List history records                        | Admin, Doctor, Nurse |
| POST   | /api/patients/:id/consultations            | Create consultation                         | Admin, Doctor        |
| GET    | /api/patients/:id/consultations            | List consultations for patient              | Admin, Doctor, Nurse |
| POST   | /api/consultations/:id/referrals           | Add referral to consultation                | Admin, Doctor        |
| GET    | /api/consultations/:id/referrals           | List referrals for consultation             | Admin, Doctor, Nurse |
| POST   | /api/patients/:id/physiotherapy            | Add physiotherapy record                    | Admin, Doctor        |
| GET    | /api/patients/:id/physiotherapy            | List physiotherapy records                  | Admin, Doctor, Nurse |

For full request/response details, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

## 🔑 Authentication

All endpoints (except login/signup) require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 👥 User Roles

- **Admin**: Full access
- **Doctor**: Manage patients, consultations, referrals, physiotherapy
- **Nurse**: View patients; add vitals, HEF, visual acuity

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