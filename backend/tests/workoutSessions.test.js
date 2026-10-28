import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mocks y entorno aislado para probar el sistema de workouts
describe('Pruebas del Sistema de Entrenamientos: Sesiones, Series y Control de Acceso', () => {
  let app;
  let server;
  let baseUrl;

  const mockJwtSecret = 'test_jwt_secret_fitmanager_workouts';

  // Base de datos simulada en memoria
  let mockUsers = [
    { id: 1, name: 'Admin User', email: 'admin@fitmanager.com', role: 'admin', is_active: 1 },
    { id: 2, name: 'Trainer John', email: 'trainer@fitmanager.com', role: 'trainer', is_active: 1 },
    { id: 3, name: 'Member Alice', email: 'alice@fitmanager.com', role: 'member', is_active: 1 },
    { id: 4, name: 'Member Bob', email: 'bob@fitmanager.com', role: 'member', is_active: 1 },
    { id: 5, name: 'Trainer Strangers', email: 'stranger@fitmanager.com', role: 'trainer', is_active: 1 }
  ];

  let mockExercises = [
    { id: 1, name: 'Sentadilla con Barra', muscle_group: 'Piernas' },
    { id: 2, name: 'Press de Banca Plano', muscle_group: 'Pecho' }
  ];

  let mockRoutines = [
    { id: 10, name: 'Rutina Fuerza Piernas', trainer_id: 2, member_id: 3 }, // Trainer 2 asignó a Alice (3)
    { id: 20, name: 'Rutina Hipertrofia Bob', trainer_id: 5, member_id: 4 } // Trainer 5 asignó a Bob (4)
  ];

  let mockSessions = [];
  let mockSetLogs = [];
  let nextSessionId = 1;
  let nextSetLogId = 1;

  // Helper para generar tokens
  function makeToken(user) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, mockJwtSecret);
  }

  before(async () => {
    app = express();
    app.use(express.json());

    // Middleware de autenticacion simulado identico a authMiddleware.js
    const testVerifyToken = (req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, error: { message: 'token no proporcionado', code: 'UNAUTHORIZED' } });
      }
      try {
        const decoded = jwt.verify(auth.split(' ')[1], mockJwtSecret);
        const user = mockUsers.find(u => u.id === decoded.id);
        if (!user || !user.is_active) {
          return res.status(401).json({ ok: false, error: { message: 'usuario invalido o inactivo' } });
        }
        req.user = { id: user.id, email: user.email, role: user.role };
        next();
      } catch (e) {
        return res.status(401).json({ ok: false, error: { message: 'token invalido', code: 'INVALID_TOKEN' } });
      }
    };

    const testRequireRole = (...roles) => (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ ok: false, error: { message: 'permiso denegado', code: 'FORBIDDEN' } });
      }
      next();
    };

    // Montar endpoints reflejando exactamente la logica de workoutController.js
    // 1. POST /api/workouts/sessions
    app.post('/api/workouts/sessions', testVerifyToken, testRequireRole('member', 'admin'), (req, res) => {
      const userId = req.user.id;
      const { routine_id, notes, sets } = req.body;

      let validatedRoutineId = null;
      if (routine_id !== undefined && routine_id !== null) {
        const parsedRoutine = Number(routine_id);
        const routine = mockRoutines.find(r => r.id === parsedRoutine);
        if (!routine) {
          return res.status(404).json({ ok: false, error: { message: 'rutina no existe', code: 'ROUTINE_NOT_FOUND' } });
        }
        if (routine.member_id !== null && Number(routine.member_id) !== Number(userId)) {
          return res.status(403).json({ ok: false, error: { message: 'rutina de otro socio', code: 'FORBIDDEN' } });
        }
        validatedRoutineId = parsedRoutine;
      }

      if (sets !== undefined) {
        if (!Array.isArray(sets)) {
          return res.status(400).json({ ok: false, error: { message: 'sets debe ser array', code: 'INVALID_SETS_PAYLOAD' } });
        }
        for (const s of sets) {
          const ex = mockExercises.find(e => e.id === Number(s.exercise_id));
          if (!ex) {
            return res.status(400).json({ ok: false, error: { message: 'ejercicio no existe', code: 'EXERCISE_NOT_FOUND' } });
          }
          const w = Number(s.weight_kg);
          if (!Number.isFinite(w) || w < 0) {
            return res.status(400).json({ ok: false, error: { message: 'peso invalido', code: 'INVALID_WEIGHT' } });
          }
          const r = Number(s.reps_completed);
          if (!Number.isInteger(r) || r <= 0) {
            return res.status(400).json({ ok: false, error: { message: 'reps invalidas', code: 'INVALID_REPS' } });
          }
        }
      }

      const session = {
        id: nextSessionId++,
        user_id: userId,
        routine_id: validatedRoutineId,
        session_date: new Date().toISOString(),
        notes: notes || null
      };
      mockSessions.push(session);

      if (Array.isArray(sets)) {
        sets.forEach((s, idx) => {
          mockSetLogs.push({
            id: nextSetLogId++,
            session_id: session.id,
            user_id: userId,
            exercise_id: Number(s.exercise_id),
            set_number: s.set_number || idx + 1,
            weight_kg: Number(s.weight_kg),
            reps_completed: Number(s.reps_completed),
            created_at: new Date().toISOString()
          });
        });
      }

      return res.status(201).json({ ok: true, data: { session } });
    });

    // 2. POST /api/workouts/sessions/:sessionId/sets
    app.post('/api/workouts/sessions/:sessionId/sets', testVerifyToken, testRequireRole('member', 'admin'), (req, res) => {
      const userId = req.user.id;
      const session = mockSessions.find(s => s.id === Number(req.params.sessionId));
      if (!session) {
        return res.status(404).json({ ok: false, error: { message: 'sesion no existe', code: 'SESSION_NOT_FOUND' } });
      }
      if (Number(session.user_id) !== Number(userId)) {
        return res.status(403).json({ ok: false, error: { message: 'no tienes permiso', code: 'FORBIDDEN' } });
      }

      const { exercise_id, weight_kg, reps_completed, set_number } = req.body;
      const ex = mockExercises.find(e => e.id === Number(exercise_id));
      if (!ex) {
        return res.status(404).json({ ok: false, error: { message: 'ejercicio no existe', code: 'EXERCISE_NOT_FOUND' } });
      }

      const w = Number(weight_kg);
      if (!Number.isFinite(w) || w < 0) {
        return res.status(400).json({ ok: false, error: { message: 'peso invalido', code: 'INVALID_WEIGHT' } });
      }
      const r = Number(reps_completed);
      if (!Number.isInteger(r) || r <= 0) {
        return res.status(400).json({ ok: false, error: { message: 'reps invalidas', code: 'INVALID_REPS' } });
      }

      const newSet = {
        id: nextSetLogId++,
        session_id: session.id,
        user_id: userId,
        exercise_id: ex.id,
        set_number: Number(set_number) || 1,
        weight_kg: w,
        reps_completed: r,
        created_at: new Date().toISOString()
      };
      mockSetLogs.push(newSet);
      return res.status(201).json({ ok: true, data: { set: newSet } });
    });

    // 3. GET /api/workouts/history
    app.get('/api/workouts/history', testVerifyToken, (req, res) => {
      const { role, id: authUserId } = req.user;
      let targetUserId = authUserId;

      if (req.query.member_id) {
        const queryMemberId = Number(req.query.member_id);
        if (role === 'member' && queryMemberId !== authUserId) {
          return res.status(403).json({ ok: false, error: { message: 'prohibido', code: 'FORBIDDEN' } });
        }
        if (role === 'trainer') {
          const hasAccess = mockRoutines.some(r => r.trainer_id === authUserId && r.member_id === queryMemberId);
          if (!hasAccess) {
            return res.status(403).json({ ok: false, error: { message: 'sin vinculo con el socio', code: 'FORBIDDEN' } });
          }
        }
        targetUserId = queryMemberId;
      }

      const userSessions = mockSessions.filter(s => s.user_id === targetUserId);
      const formatted = userSessions.map(s => ({
        ...s,
        sets: mockSetLogs.filter(sl => sl.session_id === s.id)
      }));
      return res.status(200).json({ ok: true, data: { sessions: formatted } });
    });

    // 4. GET /api/workouts/exercises/:exerciseId/last
    app.get('/api/workouts/exercises/:exerciseId/last', testVerifyToken, (req, res) => {
      const userId = req.user.id;
      const exId = Number(req.params.exerciseId);
      const sets = mockSetLogs.filter(s => s.user_id === userId && s.exercise_id === exId);
      const last = sets.length > 0 ? sets[sets.length - 1] : null;
      return res.status(200).json({ ok: true, data: { last_log: last } });
    });

    // 5. PATCH /api/workouts/sets/:id
    app.patch('/api/workouts/sets/:id', testVerifyToken, testRequireRole('member', 'admin'), (req, res) => {
      const userId = req.user.id;
      const setId = Number(req.params.id);
      const set = mockSetLogs.find(s => s.id === setId);
      if (!set) {
        return res.status(404).json({ ok: false, error: { message: 'serie no encontrada', code: 'SET_NOT_FOUND' } });
      }
      if (Number(set.user_id) !== Number(userId)) {
        return res.status(403).json({ ok: false, error: { message: 'no puedes modificar serie ajena', code: 'FORBIDDEN' } });
      }

      const { weight_kg, reps_completed } = req.body;
      if (weight_kg !== undefined) {
        const w = Number(weight_kg);
        if (!Number.isFinite(w) || w < 0) {
          return res.status(400).json({ ok: false, error: { message: 'peso invalido', code: 'INVALID_WEIGHT' } });
        }
        set.weight_kg = w;
      }
      if (reps_completed !== undefined) {
        const r = Number(reps_completed);
        if (!Number.isInteger(r) || r <= 0) {
          return res.status(400).json({ ok: false, error: { message: 'reps invalidas', code: 'INVALID_REPS' } });
        }
        set.reps_completed = r;
      }

      return res.status(200).json({ ok: true, data: { set } });
    });

    // 6. DELETE /api/workouts/sets/:id
    app.delete('/api/workouts/sets/:id', testVerifyToken, testRequireRole('member', 'admin'), (req, res) => {
      const userId = req.user.id;
      const setId = Number(req.params.id);
      const index = mockSetLogs.findIndex(s => s.id === setId);
      if (index === -1) {
        return res.status(404).json({ ok: false, error: { message: 'serie no encontrada', code: 'SET_NOT_FOUND' } });
      }
      if (Number(mockSetLogs[index].user_id) !== Number(userId)) {
        return res.status(403).json({ ok: false, error: { message: 'no puedes borrar serie ajena', code: 'FORBIDDEN' } });
      }

      mockSetLogs.splice(index, 1);
      return res.status(200).json({ ok: true, message: 'serie eliminada' });
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // PRUEBAS DE SEGURIDAD Y FUNCIONALIDAD

  test('1. Registrar una sesion con series y kilos validos (Alice - member)', async () => {
    const token = makeToken(mockUsers[2]); // Alice (id: 3)
    const res = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        routine_id: 10, // Pertenece a Alice
        notes: 'Buen entrenamiento de piernas',
        sets: [
          { exercise_id: 1, set_number: 1, weight_kg: 80.5, reps_completed: 10 },
          { exercise_id: 1, set_number: 2, weight_kg: 85.0, reps_completed: 8 }
        ]
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.data.session.user_id, 3);
  });

  test('2. Falla con 400 si los kilos son un valor negativo o no numerico', async () => {
    const token = makeToken(mockUsers[2]); // Alice
    const res = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        routine_id: 10,
        sets: [{ exercise_id: 1, set_number: 1, weight_kg: -15, reps_completed: 10 }]
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.error.code, 'INVALID_WEIGHT');
  });

  test('3. Falla con 400 si las repeticiones son menores o iguales a cero', async () => {
    const token = makeToken(mockUsers[2]); // Alice
    const res = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        routine_id: 10,
        sets: [{ exercise_id: 1, set_number: 1, weight_kg: 60, reps_completed: 0 }]
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.error.code, 'INVALID_REPS');
  });

  test('4. Usuario no puede crear sesion referenciando una rutina asignada a otro socio', async () => {
    const token = makeToken(mockUsers[2]); // Alice (id: 3) intentando usar rutina 20 (asignada a Bob - id: 4)
    const res = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        routine_id: 20
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('5. Socio no puede agregar series a una sesion de otro socio', async () => {
    const tokenBob = makeToken(mockUsers[3]); // Bob (id: 4) intentando agregar serie a sesion 1 (creada por Alice)
    const res = await fetch(`${baseUrl}/api/workouts/sessions/1/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({
        exercise_id: 1,
        weight_kg: 100,
        reps_completed: 5
      })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('6. Entrenador NO puede modificar ni registrar marcas de series (rol trainer restringido)', async () => {
    const tokenTrainer = makeToken(mockUsers[1]); // Trainer John (id: 2)
    const res = await fetch(`${baseUrl}/api/workouts/sets/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({ weight_kg: 150 })
    });

    const json = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('7. Entrenador vinculado puede consultar el historial de su alumno', async () => {
    const tokenTrainer = makeToken(mockUsers[1]); // Trainer 2 tiene rutina con Alice (3)
    const res = await fetch(`${baseUrl}/api/workouts/history?member_id=3`, {
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.ok, true);
    assert.strictEqual(Array.isArray(json.data.sessions), true);
    assert.strictEqual(json.data.sessions.length >= 1, true);
  });

  test('8. Entrenador NO vinculado es rechazado con 403 al intentar ver historial de socio ajeno', async () => {
    const tokenStranger = makeToken(mockUsers[4]); // Trainer 5 NO tiene vinculo con Alice (3)
    const res = await fetch(`${baseUrl}/api/workouts/history?member_id=3`, {
      headers: { Authorization: `Bearer ${tokenStranger}` }
    });

    const json = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('9. Consultar ultimo peso registrado en un ejercicio (Alice)', async () => {
    const tokenAlice = makeToken(mockUsers[2]); // Alice
    const res = await fetch(`${baseUrl}/api/workouts/exercises/1/last`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.ok, true);
    assert.strictEqual(json.data.last_log.exercise_id, 1);
    assert.strictEqual(json.data.last_log.weight_kg, 85.0);
    assert.strictEqual(json.data.last_log.reps_completed, 8);
  });

  test('10. Socio puede corregir su propia serie y eliminarla', async () => {
    const tokenAlice = makeToken(mockUsers[2]); // Alice dueña del set 1

    // Corregir peso a 82.5 kg
    const updateRes = await fetch(`${baseUrl}/api/workouts/sets/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ weight_kg: 82.5, reps_completed: 12 })
    });
    const updateJson = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateJson.data.set.weight_kg, 82.5);
    assert.strictEqual(updateJson.data.set.reps_completed, 12);

    // Eliminar serie 1
    const delRes = await fetch(`${baseUrl}/api/workouts/sets/1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    assert.strictEqual(delRes.status, 200);

    // Intentar borrarla de nuevo debe dar 404
    const delAgain = await fetch(`${baseUrl}/api/workouts/sets/1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    assert.strictEqual(delAgain.status, 404);
  });
});
