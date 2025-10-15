// tests/registration_and_components.test.js

const request = require('supertest');
const app = require('../server');

const pickLocationId = async () => {
  const r = await request(app).get('/api/locations');
  return r.body.locations[0].id;
};

describe('Registration + components + visits + pharmacy', () => {
  let patientId;
  let vitalsId;
  let hefId;
  let visitId;
  let locationId;

  beforeAll(async () => {
    locationId = await pickLocationId();
  });

  test('POST /api/registration creates patient + visit + vitals (with bp fields) + HEF (public)', async () => {
    const res = await request(app)
      .post('/api/registration')
      .send({
        patient: {
          face_id: 'face_' + Math.random().toString(36).slice(2, 8),
          english_name: 'Alice Test',
          khmer_name: 'អាលីស',
          date_of_birth: '1995-01-01',
          sex: 'female',
          phone_number: '+85512345',
          address: 'Somewhere',
          location_id: locationId
        },
        // supply visit because we are also adding vitals/hef
        visit: { location_id: locationId, visit_date: '2025-08-12', queue_no: '2a' }, // lower-case to test uppercasing
        vitals: {
          height_cm: 160, weight_kg: 50, bmi: 19.5,
          bp_systolic: 110, bp_diastolic: 70, blood_pressure: '110/70',
          temperature_c: 36.6, vitals_notes: 'Initial'
        },
        hef: { know_hef: true, have_hef: false, hef_notes: 'N/A' }
      });

    expect(res.status).toBe(201);
    expect(res.body.patient.id).toBeDefined();
    patientId = res.body.patient.id;

    expect(res.body.visit.id).toBeDefined();
    expect(res.body.visit.queue_no).toBe('2A');
    visitId = res.body.visit.id;

    expect(res.body.vitals.id).toBeDefined();
    vitalsId = res.body.vitals.id;
    expect(res.body.vitals.bp_systolic).toBe(110);
    expect(res.body.vitals.bp_diastolic).toBe(70);

    expect(res.body.hef.id).toBeDefined();
    hefId = res.body.hef.id;
  });

  test('GET /api/patients?location_id filters by location and returns location_name', async () => {
    const res = await request(app).get(`/api/patients?location_id=${locationId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find(p => p.id === patientId);
    expect(found).toBeTruthy();
    expect(found.location_name).toBeDefined();
  });

  test('GET /api/visits/by-location-and-date returns patients + queue_no for given location/date', async () => {
    const res = await request(app).get(`/api/visits/by-location-and-date?location_id=${locationId}&visit_date=2025-08-12`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find(row => row.id === patientId);
    expect(found).toBeTruthy();
    expect(found.queue_no).toBeDefined();
    expect(found.visit_date).toBe('2025-08-12');
  });

  test('Combined GET /api/patients/:id/vitals-hef provides both vitals & HEF grouped by visit', async () => {
    const res = await request(app).get(`/api/patients/${patientId}/vitals-hef`);
    expect(res.status).toBe(200);
    expect(res.body.patient_id).toBe(patientId);
    expect(Array.isArray(res.body.visits)).toBe(true);
    const visitBundle = res.body.visits.find(v => v.visit_id === visitId);
    expect(visitBundle).toBeTruthy();
    expect(Array.isArray(visitBundle.vitals)).toBe(true);
    expect(Array.isArray(visitBundle.hef)).toBe(true);
  });

  test('Individual Vitals: PUT updates, GET lists, DELETE removes', async () => {
    // Update
    const upd = await request(app)
      .put(`/api/patients/${patientId}/vitals/${vitalsId}`)
      .send({ weight_kg: 51, bp_systolic: 112, bp_diastolic: 72 });
    expect(upd.status).toBe(200);
    expect(parseFloat(upd.body.weight_kg)).toBe(51);
    expect(upd.body.bp_systolic).toBe(112);
    expect(upd.body.bp_diastolic).toBe(72);

    // List
    const list = await request(app).get(`/api/patients/${patientId}/vitals`);
    expect(list.status).toBe(200);
    expect(list.body.some(v => v.id === vitalsId)).toBe(true);

    // Delete
    const del = await request(app).delete(`/api/patients/${patientId}/vitals/${vitalsId}`);
    expect(del.status).toBe(200);
  });

  test('Individual HEF: PUT updates, GET lists, DELETE removes', async () => {
    // Update
    const upd = await request(app)
      .put(`/api/patients/${patientId}/hef/${hefId}`)
      .send({ have_hef: true, hef_notes: 'Enrolled now' });
    expect(upd.status).toBe(200);
    expect(upd.body.have_hef).toBe(true);

    // List
    const list = await request(app).get(`/api/patients/${patientId}/hef`);
    expect(list.status).toBe(200);
    expect(list.body.some(h => h.id === hefId)).toBe(true);

    // Delete
    const del = await request(app).delete(`/api/patients/${patientId}/hef/${hefId}`);
    expect(del.status).toBe(200);
  });

  test('Combined update: PUT /api/registration/:patientId can update patient & visit queue_no', async () => {
    const res = await request(app)
      .put(`/api/registration/${patientId}`)
      .send({
        patient: { phone_number: '+855999' },
        visit: { location_id: locationId, visit_date: '2025-08-12', queue_no: '3B' }
      });
    expect(res.status).toBe(200);
    expect(res.body.visit.queue_no).toBe('3B');
  });

  test('Visit queue update endpoint updates queue_no only', async () => {
    const res = await request(app)
      .put(`/api/visits/${visitId}`)
      .send({ queue_no: '10C' });
    expect(res.status).toBe(200);
    expect(res.body.queue_no).toBe('10C');
  });

  // ─────────── Pharmacy feature tests ───────────
  let pharmacyItemId;

  test('Pharmacy: POST /api/pharmacy creates item', async () => {
    const res = await request(app)
      .post('/api/pharmacy')
      .send({ name: 'Paracetamol 500mg', stock_level: 100 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Paracetamol 500mg');
    expect(res.body.stock_level).toBe(100);
    pharmacyItemId = res.body.id;
  });

  test('Pharmacy: GET /api/pharmacy lists items', async () => {
    const res = await request(app).get('/api/pharmacy');
    expect(res.status).toBe(200);
    const found = res.body.find(i => i.id === pharmacyItemId);
    expect(found).toBeTruthy();
  });

  test('Pharmacy: PUT /api/pharmacy/:id can rename and set absolute stock', async () => {
    const res = await request(app)
      .put(`/api/pharmacy/${pharmacyItemId}`)
      .send({ name: 'Paracetamol 500mg tabs', stock_level: 80 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Paracetamol 500mg tabs');
    expect(res.body.stock_level).toBe(80);
  });

  test('Pharmacy: PATCH /api/pharmacy/:id/adjust applies delta and clamps to >= 0', async () => {
    // -30 -> expect 50
    let res = await request(app)
      .patch(`/api/pharmacy/${pharmacyItemId}/adjust`)
      .send({ delta: -30 });
    expect(res.status).toBe(200);
    expect(res.body.stock_level).toBe(50);

    // +10 -> expect 60
    res = await request(app)
      .patch(`/api/pharmacy/${pharmacyItemId}/adjust`)
      .send({ delta: 10 });
    expect(res.status).toBe(200);
    expect(res.body.stock_level).toBe(60);

    // -100 -> clamp to 0
    res = await request(app)
      .patch(`/api/pharmacy/${pharmacyItemId}/adjust`)
      .send({ delta: -100 });
    expect(res.status).toBe(200);
    expect(res.body.stock_level).toBe(0);
  });

  test('Pharmacy: DELETE /api/pharmacy/:id removes the item', async () => {
    const res = await request(app).delete(`/api/pharmacy/${pharmacyItemId}`);
    expect(res.status).toBe(200);
  });

  test('Combined delete removes patient (and cascades)', async () => {
    const del = await request(app).delete(`/api/registration/${patientId}`);
    expect(del.status).toBe(200);
  });
});
