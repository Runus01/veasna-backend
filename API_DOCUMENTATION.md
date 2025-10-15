# API Documentation

## Base URL

`http://localhost:3000/api`

## Authentication

Authentication is **optional**. Endpoints accept requests without a token. If you choose to log in, include a JWT in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Conventions & Schema Glossary (Standardized)

### Naming & Types
- **Database & JSON fields**: `snake_case`.
- **IDs**: integers unless stated otherwise.
- **Dates**: `YYYY-MM-DD` (no time).
- **Timestamps**: ISO 8601 with timezone (server-generated).
- `last_updated` is set by server; `last_updated_by` is set to the authenticated user’s `users.id` or `null` if unauthenticated.

### Visit Linking Pattern
Most clinical records are attached to a **visit**. When creating such records, you must provide **either**:
- `visit_id` **(use an existing visit)**, **or**
- `{ location_id, queue_no, visit_date? }` **(to create/reuse a visit for that patient)**

**`queue_no` format**: digits with an optional uppercase A–Z suffix (e.g., `"2"`, `"10A"`). Regex: `^[0-9]+[A-Z]*$`.

### DB Tables → Fields (from `db_setup.sql`)
- **locations**: `id`, `name`, `is_active`, `last_updated`, `last_updated_by`
- **users**: `id`, `username`, `last_updated`, `last_updated_by`
- **patients**: `id`, `face_id` (UNIQUE), `english_name`, `khmer_name`, `date_of_birth`, `sex`, `phone_number`, `address`, `location_id`, `last_updated`, `last_updated_by`
- **visits**: `id`, `patient_id`, `location_id`, `visit_date`, `queue_no`, `status`, `last_updated`, `last_updated_by`, **UNIQUE**(`patient_id`, `visit_date`, `queue_no`)
- **vitals**: `id`, `visit_id`, `height_cm`, `weight_kg`, `bmi`, `bp_systolic`, `bp_diastolic`, `blood_pressure`, `temperature_c`, `vitals_notes`, `last_updated`, `last_updated_by`
- **hef**: `id`, `visit_id`, `know_hef`, `have_hef`, `hef_notes`, `last_updated`, `last_updated_by`
- **visual_acuity**: `id`, `visit_id`, `left_pin`, `left_no_pin`, `right_pin`, `right_no_pin`, `visual_notes`, `last_updated`, `last_updated_by`
- **presenting_complaint**: `id`, `visit_id`, `history`, `red_flags`, `systems_review`, `drug_allergies`, `last_updated`, `last_updated_by`
- **history**: `id`, `visit_id`, `past`, `drug_and_treatment`, `family`, `social`, `systems_review`, `last_updated`, `last_updated_by`
- **consultation**: `id`, `visit_id`, `doctor_id`, `consultation_notes`, `prescription`, `last_updated`, `last_updated_by`
- **referral**: `id`, `visit_id`, `doctor_id`, `consultation_id`, `referral_date`, `referral_symptom`, `referral_symptom_duration`, `referral_reason`, `referral_type`, `last_updated`, `last_updated_by`
- **physiotherapy**: `id`, `visit_id`, `doctor_id`, `pain_areas_description`, `last_updated`, `last_updated_by`
- **pharmacy**: `id`, `name` (UNIQUE), `stock_level`, `last_updated`, `last_updated_by`

---

## Endpoints

### Authentication

**POST** `users`  
Creates a new user with just a username.

* **Body**
  ```json
  { "username": "alice" }
  ```

* **Response (201)**
  ```json
  {
    "message": "User created successfully",
    "user": { "id": 1, "username": "alice" }
  }
  ```

---

**POST** `session/login`  
Passwordless login (optional) that upserts the user and returns a JWT.

* **Body**
  ```json
  { "username": "alice" }
  ```

* **Response (200)**
  ```json
  {
    "token": "<jwt-token>",
    "user": { "id": 1, "username": "alice" }
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

### Locations

**GET** `locations`  
List active locations.

* **Response (200)**
  ```json
  { "locations": [ { "id": 1, "name": "Poipet" }, { "id": 2, "name": "Mongkol Borey" } ] }
  ```

---

### Patients

**GET** `patients`  
List all patients. Optional filters: `?location_id=1` or `?location=Poipet`.

**POST** `patients`  
Create a new patient.

* **Body**
  ```json
  {
    "face_id": "abc123",                // optional, unique
    "english_name": "John Smith",
    "khmer_name": "ចន ស្មីត",
    "date_of_birth": "1990-01-01",
    "sex": "male",                      // one of: male | female | other
    "phone_number": "+855123456789",
    "address": "Phnom Penh, Cambodia",
    "location_id": 1
  }
  ```

**GET** `patients/{id}`  
Fetch a patient by ID.

**PUT** `patients/{id}`  
Update a patient’s info (same fields as POST). `face_id` must remain unique.

**DELETE** `patients/{id}`  
Delete a patient (cascades to visits and related records).

---

### Visits

**GET** `visits/by-location-and-date?location_id={id}&visit_date=YYYY-MM-DD`  
Return all **patients** seen at a location on a date, including each patient’s `queue_no` and `visit_date` from the `visits` table.

* **Response (200)**
  ```json
  [
    {
      "id": 10,                   // patient.id
      "face_id": "abc123",
      "english_name": "John Smith",
      "khmer_name": "ចន ស្មីត",
      "date_of_birth": "1990-01-01",
      "sex": "male",
      "phone_number": "+855123456789",
      "address": "Phnom Penh, Cambodia",
      "location_id": 1,
      "last_updated": "2025-10-15T01:23:45.678Z",
      "last_updated_by": 2,
      "queue_no": "12A",          // from visits
      "visit_date": "2025-10-15",
      "location_name": "Poipet"
    }
  ]
  ```

**PUT** `visits/{id}`  
Update a visit’s queue number.

* **Body**
  ```json
  { "queue_no": "15B" }
  ```

* **Errors**
  - **400** invalid format (must match `^[0-9]+[A-Z]*$`)
  - **409** uniqueness conflict on `(patient_id, visit_date, queue_no)`

---

### Vitals

**POST** `patients/{patientId}/vitals`  
Add a vitals record for a **visit**.

* **Body (Option A — use existing visit)**
  ```json
  {
    "visit_id": 123,
    "height_cm": 175,
    "weight_kg": 70,
    "bmi": 22.9,
    "bp_systolic": 120,
    "bp_diastolic": 80,
    "blood_pressure": "120/80",
    "temperature_c": 36.8,
    "vitals_notes": "Patient appears healthy"
  }
  ```

* **Body (Option B — create/reuse visit)**
  ```json
  {
    "location_id": 1,
    "queue_no": "12A",
    "visit_date": "2025-10-15",
    "height_cm": 175,
    "weight_kg": 70
  }
  ```

**GET** `patients/{id}/vitals`  
List vitals for a patient (joined via visits). Optional filter: `?visit_date=YYYY-MM-DD`.

---

### HEF

**POST** `patients/{patientId}/hef`  
Add an HEF record (visit required via `visit_id` or `{location_id, queue_no, visit_date?}`).

* **Body**
  ```json
  {
    "visit_id": 123,
    "know_hef": true,
    "have_hef": false,
    "hef_notes": "Explained benefits"
  }
  ```

**GET** `patients/{id}/hef`  
List HEF records for a patient. Optional filter: `?visit_date=YYYY-MM-DD`.

---

### Visual Acuity

**POST** `patients/{patientId}/visual_acuity`  
Add a visual acuity record (visit required).

* **Body**
  ```json
  {
    "visit_id": 123,
    "left_pin": "6/9",
    "left_no_pin": "6/18",
    "right_pin": "6/6",
    "right_no_pin": "6/9",
    "visual_notes": "Re-test in 6 months"
  }
  ```

**GET** `patients/{id}/visual_acuity`  
List visual acuity records. Optional `?visit_date=YYYY-MM-DD`.

---

### Presenting Complaint

**POST** `patients/{patientId}/presenting_complaint`  
Add a presenting complaint (visit required).

* **Body**
  ```json
  {
    "visit_id": 123,
    "history": "Headache",
    "red_flags": null,
    "systems_review": "Negative",
    "drug_allergies": "NKA"
  }
  ```

**GET** `patients/{id}/presenting_complaint`  
List presenting complaints. Optional `?visit_date=YYYY-MM-DD`.

---

### History

**POST** `patients/{patientId}/history`  
Add a history record (visit required).

* **Body**
  ```json
  {
    "visit_id": 123,
    "past": "Childhood asthma",
    "drug_and_treatment": "Salbutamol PRN",
    "family": "HTN in father",
    "social": "Non-smoker",
    "systems_review": "Unremarkable"
  }
  ```

**GET** `patients/{id}/history`  
List history records. Optional `?visit_date=YYYY-MM-DD`.

---

### Consultation

**POST** `patients/{patientId}/consultations`  
Create a consultation (visit required).

* **Body**
  ```json
  {
    "visit_id": 123,
    "consultation_notes": "Viral URTI",
    "prescription": "Paracetamol 500mg"
  }
  ```

**GET** `patients/{id}/consultations`  
List consultations for a patient. Optional `?visit_date=YYYY-MM-DD`.

---

### Referral

**POST** `consultations/{consultationId}/referrals`  
Add a referral to a consultation. The `visit_id` is inferred from the consultation.

* **Body**
  ```json
  {
    "referral_type": "Optometrist",
    "referral_date": "2025-10-15",
    "referral_symptom": "Blurred vision",
    "referral_symptom_duration": "2 weeks",
    "referral_reason": "Further assessment"
  }
  ```

**GET** `consultations/{consultationId}/referrals`  
List referrals for a consultation.

---

### Physiotherapy

**POST** `patients/{patientId}/physiotherapy`  
Add a physiotherapy record (visit required).

* **Body**
  ```json
  {
    "visit_id": 123,
    "pain_areas_description": "Lower back stiffness"
  }
  ```

**GET** `patients/{id}/physiotherapy`  
List physiotherapy records. Optional `?visit_date=YYYY-MM-DD`.

---

### Combined (Vitals + HEF)

**GET** `patients/{id}/vitals-hef`  
Return both vitals and HEF grouped by visit. Optional `?visit_date=YYYY-MM-DD`.

* **Response (200)**
  ```json
  {
    "patient_id": 10,
    "visits": [
      {
        "visit_id": 123,
        "queue_no": "12A",
        "visit_date": "2025-10-15",
        "vitals": [ /* vitals rows */ ],
        "hef": [ /* hef rows */ ]
      }
    ]
  }
  ```

---

### Pharmacy

**GET** `pharmacy`  
List all pharmacy items.

* **Response (200)**
  ```json
  [
    { "id": 1, "name": "Paracetamol 500mg", "stock_level": 120, "last_updated": "...", "last_updated_by": 2 }
  ]
  ```

**POST** `pharmacy`  
Create a new pharmacy item.

* **Body**
  ```json
  { "name": "Ibuprofen 200mg", "stock_level": 50 }
  ```

**PUT** `pharmacy/{id}`  
Rename and/or set stock to an exact value (clamped to ≥ 0).

* **Body**
  ```json
  { "name": "Ibuprofen 400mg", "stock_level": 30 }
  ```

**PATCH** `pharmacy/{id}/adjust`  
Adjust stock by a delta (positive or negative, clamped to ≥ 0).

* **Body**
  ```json
  { "delta": -5 }
  ```

**DELETE** `pharmacy/{id}`  
Delete an item.

---

### Combined Registration

**POST** `registration`  
Create a patient and optionally create/reuse a visit and append vitals/HEF in one request.

* **Body**
  ```json
  {
    "patient": {
      "face_id": "abc123",
      "english_name": "John Smith",
      "location_id": 1
    },
    "visit": { "location_id": 1, "queue_no": "12A", "visit_date": "2025-10-15" },
    "vitals": { "height_cm": 175, "weight_kg": 70, "bp_systolic": 120, "bp_diastolic": 80 },
    "hef": { "know_hef": true, "have_hef": false }
  }
  ```
> If `vitals` or `hef` is provided, a `visit` block with `location_id` and `queue_no` is required (the system will create or reuse the visit).

**PUT** `registration/{patientId}`  
Combined update (patient + optional append vitals/HEF/visit). Same shapes as POST.

**DELETE** `registration/{patientId}`  
Delete a patient (cascades to vitals/HEF/visits).

---

## Error Responses

* **400 Validation Error**
  ```json
  { "message": "Validation failed", "errors": [ /* field errors */ ] }
  ```

* **401 Authentication Error**
  ```json
  { "message": "Access token required" }
  ```

* **403 Authorization Error**
  ```json
  { "message": "Insufficient permissions" }
  ```

* **404 Not Found**
  ```json
  { "message": "Resource not found" }
  ```

* **409 Conflict**
  ```json
  { "message": "Conflict (e.g., duplicate unique value or visit uniqueness violation)" }
  ```

* **500 Server Error**
  ```json
  { "message": "Internal server error" }
  ```

---

## Rate Limiting

100 requests per 15 minutes per IP.
