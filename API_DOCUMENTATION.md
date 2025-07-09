# API Documentation

## Base URL

`http://localhost:3000/api`

## Authentication

Most endpoints require a valid JWT in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### Authentication

**POST** `signup`
Creates a new user account.

* **Body**

  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "password": "password123",
    "role": "doctor"
  }
  ```

* **Response (201)**

  ```json
  {
    "message": "User created successfully",
    "user": {
      "id": 1,
      "username": "johndoe",
      "role": "doctor",
      "first_name": "John",
      "last_name": "Doe"
    },
    "token": "<jwt-token>"
  }
  ```

---

**POST** `login`
Authenticates a user and returns a JWT.

* **Body**

  ```json
  {
    "username": "johndoe",
    "password": "password123"
  }
  ```

* **Response (200)**

  ```json
  {
    "message": "Login successful",
    "user": {
      "id": 1,
      "username": "johndoe",
      "role": "doctor",
      "first_name": "John",
      "last_name": "Doe"
    },
    "token": "<jwt-token>"
  }
  ```

---

**GET** `profile`
Fetches the current user’s profile.

* **Response (200)**

  ```json
  {
    "id": 1,
    "username": "johndoe",
    "role": "doctor",
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2025-07-09T07:00:00.000Z"
  }
  ```

---

### Patients

**GET** `patients`
List all patients.
(Requires role: admin, doctor, nurse)

**POST** `patients`
Create a new patient.
(Requires role: admin, doctor, nurse)

* **Body**

  ```json
  {
    "english_name": "John Smith",
    "khmer_name": "ចន ស្មីត",
    "date_of_birth": "1990-01-01",
    "sex": "male",
    "phone_number": "+855123456789",
    "address": "Phnom Penh, Cambodia"
  }
  ```

**GET** `patients/{id}`
Fetch a patient by ID.
(Requires role: admin, doctor, nurse)

**PUT** `patients/{id}`
Update a patient’s info.
(Requires role: admin, doctor, nurse)

**DELETE** `patients/{id}`
Delete a patient.
(Requires role: admin, doctor)

---

### Vitals

**POST** `patients/{id}/vitals`
Add a vitals record to a patient.
(Requires role: admin, doctor, nurse)

* **Body**

  ```json
  {
    "height_cm": 175.0,
    "weight_kg": 70.0,
    "bmi": 22.9,
    "blood_pressure": "120/80",
    "temperature_c": 36.8,
    "vitals_notes": "Patient appears healthy"
  }
  ```

**GET** `patients/{id}/vitals`
List all vitals records for a patient.
(Requires role: admin, doctor, nurse)

---

### HEF

**POST** `patients/{id}/hef`
Add an HEF record.
(Requires role: admin, doctor, nurse)

**GET** `patients/{id}/hef`
List HEF records.
(Requires role: admin, doctor, nurse)

---

### Visual Acuity

**POST** `patients/{id}/visual_acuity`
Add a visual acuity record.
(Requires role: admin, doctor, nurse)

**GET** `patients/{id}/visual_acuity`
List visual acuity records.
(Requires role: admin, doctor, nurse)

---

### Presenting Complaint

**POST** `patients/{id}/presenting_complaint`
Add a presenting complaint.
(Requires role: admin, doctor)

**GET** `patients/{id}/presenting_complaint`
List presenting complaints.
(Requires role: admin, doctor, nurse)

---

### History

**POST** `patients/{id}/history`
Add a history record.
(Requires role: admin, doctor)

**GET** `patients/{id}/history`
List history records.
(Requires role: admin, doctor, nurse)

---

### Consultation

**POST** `patients/{id}/consultations`
Create a consultation.
(Requires role: admin, doctor)

**GET** `patients/{id}/consultations`
List consultations for a patient.
(Requires role: admin, doctor, nurse)

---

### Referral

**POST** `consultations/{id}/referrals`
Add a referral to a consultation.
(Requires role: admin, doctor)

**GET** `consultations/{id}/referrals`
List referrals for a consultation.
(Requires role: admin, doctor, nurse)

---

### Physiotherapy

**POST** `patients/{id}/physiotherapy`
Add a physiotherapy record.
(Requires role: admin, doctor)

**GET** `patients/{id}/physiotherapy`
List physiotherapy records.
(Requires role: admin, doctor, nurse)

---

## Error Responses

* **400 Validation Error**

  ```json
  {
    "message": "Validation failed",
    "errors": [ /* field errors */ ]
  }
  ```
* **401 Authentication Error**

  ```json
  {
    "message": "Access token required"
  }
  ```
* **403 Authorization Error**

  ```json
  {
    "message": "Insufficient permissions"
  }
  ```
* **404 Not Found**

  ```json
  {
    "message": "Resource not found"
  }
  ```
* **500 Server Error**

  ```json
  {
    "message": "Internal server error"
  }
  ```

---

## User Roles

* **admin**: Full access
* **doctor**: Manage patients, consultations, referrals, physiotherapy
* **nurse**: View patients; add vitals, HEF, visual acuity

---

## Rate Limiting

100 requests per 15 minutes per IP.
