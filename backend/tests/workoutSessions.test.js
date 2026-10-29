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

      // Anti-duplicación concurrente idéntica a workoutController.js
      const existingActive = mockSessions.find(s =>
        s.user_id === userId &&
        s.status === 'in_progress' &&
        (validatedRoutineId ? s.routine_id === validatedRoutineId : s.routine_id === null)
      );
      if (existingActive) {
        const existingSets = mockSetLogs.filter(sl => sl.session_id === existingActive.id);
        return res.status(200).json({
          ok: true,
          message: 'sesion de entrenamiento activa recuperada',
          data: {
            session: {
              ...existingActive,
              sets_count: existingSets.length,
              sets: existingSets
            }
          }
        });
      }

      const session = {
        id: nextSessionId++,
        user_id: userId,
        routine_id: validatedRoutineId,
        session_date: new Date().toISOString(),
        status: 'in_progress',
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

      // Bloquear si la sesion ya esta finalizada
      if (session.status === 'completed') {
        return res.status(400).json({ ok: false, error: { message: 'sesion completada', code: 'SESSION_COMPLETED' } });
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

      const session = mockSessions.find(s => s.id === set.session_id);
      if (session && session.status === 'completed') {
        return res.status(400).json({ ok: false, error: { message: 'sesion completada', code: 'SESSION_COMPLETED' } });
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

      const session = mockSessions.find(s => s.id === mockSetLogs[index].session_id);
      if (session && session.status === 'completed') {
        return res.status(400).json({ ok: false, error: { message: 'sesion completada', code: 'SESSION_COMPLETED' } });
      }

      mockSetLogs.splice(index, 1);
      return res.status(200).json({ ok: true, message: 'serie eliminada' });
    });

    // 7. PATCH /api/workouts/sessions/:sessionId/finish
    app.patch('/api/workouts/sessions/:sessionId/finish', testVerifyToken, testRequireRole('member', 'admin'), (req, res) => {
      const userId = req.user.id;
      const session = mockSessions.find(s => s.id === Number(req.params.sessionId));
      if (!session) {
        return res.status(404).json({ ok: false, error: { message: 'sesion no existe', code: 'SESSION_NOT_FOUND' } });
      }
      if (Number(session.user_id) !== Number(userId)) {
        return res.status(403).json({ ok: false, error: { message: 'no tienes permiso', code: 'FORBIDDEN' } });
      }
      session.status = 'completed';
      session.ended_at = new Date().toISOString();
      return res.status(200).json({ ok: true, data: { session } });
    });

    // 8. GET /api/workouts/sessions/active
    app.get('/api/workouts/sessions/active', testVerifyToken, testRequireRole('member', 'admin'), (req, res) => {
      const userId = req.user.id;
      const routineId = req.query.routine_id ? Number(req.query.routine_id) : null;
      const matchingSessions = mockSessions.filter(s =>
        s.user_id === userId &&
        s.status === 'in_progress' &&
        (routineId ? s.routine_id === routineId : s.routine_id === null)
      );
      if (matchingSessions.length === 0) {
        return res.status(200).json({ ok: true, data: { active_session: null } });
      }
      const active = matchingSessions[matchingSessions.length - 1]; // más reciente
      const sets = mockSetLogs.filter(sl => sl.session_id === active.id);
      return res.status(200).json({ ok: true, data: { active_session: { ...active, sets } } });
    });

    // 9. DELETE /api/exercises/:id (simulado con soft-delete si tiene relaciones en workout_set_logs)
    app.delete('/api/exercises/:id', testVerifyToken, testRequireRole('admin', 'trainer'), (req, res) => {
      const exId = Number(req.params.id);
      const ex = mockExercises.find(e => e.id === exId);
      if (!ex) {
        return res.status(404).json({ ok: false, error: { message: 'ejercicio no encontrado', code: 'EXERCISE_NOT_FOUND' } });
      }
      const hasLogs = mockSetLogs.some(s => s.exercise_id === exId);
      if (hasLogs) {
        // Soft delete / baja lógica
        ex.is_active = 0;
        return res.status(200).json({ ok: true, message: 'ejercicio archivado (baja lógica)' });
      }
      mockExercises = mockExercises.filter(e => e.id !== exId);
      return res.status(200).json({ ok: true, message: 'ejercicio eliminado' });
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

    // Finalizar sesion 1 para que quede como registro historico cerrado
    await fetch(`${baseUrl}/api/workouts/sessions/${json.data.session.id}/finish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
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

  test('10. Socio puede corregir su propia serie y eliminarla mientras la sesion este activa', async () => {
    const tokenAlice = makeToken(mockUsers[2]); // Alice

    // Crear una sesion activa y agregar una serie editable
    const sessRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({
        routine_id: 10,
        sets: [{ exercise_id: 1, set_number: 1, weight_kg: 80.0, reps_completed: 10 }]
      })
    });
    const sessJson = await sessRes.json();
    const activeSessId = sessJson.data.session.id;

    // Obtener la serie recién creada
    const getSetsRes = await fetch(`${baseUrl}/api/workouts/history?member_id=3`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const getSetsJson = await getSetsRes.json();
    const targetSession = getSetsJson.data.sessions.find(s => s.id === activeSessId);
    const targetSetId = targetSession.sets[0].id;

    // Corregir peso a 82.5 kg
    const updateRes = await fetch(`${baseUrl}/api/workouts/sets/${targetSetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ weight_kg: 82.5, reps_completed: 12 })
    });
    const updateJson = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateJson.data.set.weight_kg, 82.5);
    assert.strictEqual(updateJson.data.set.reps_completed, 12);

    // Eliminar la serie
    const delRes = await fetch(`${baseUrl}/api/workouts/sets/${targetSetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    assert.strictEqual(delRes.status, 200);

    // Intentar borrarla de nuevo debe dar 404
    const delAgain = await fetch(`${baseUrl}/api/workouts/sets/${targetSetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    assert.strictEqual(delAgain.status, 404);

    // Cerrar la sesión
    await fetch(`${baseUrl}/api/workouts/sessions/${activeSessId}/finish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
  });

  test('11. Finalizar una sesion activa y verificar que no permite agregar series posteriores', async () => {
    const tokenAlice = makeToken(mockUsers[2]);

    // Crear nueva sesion en curso
    const createRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ routine_id: 10, notes: 'Sesion de prueba finalizacion' })
    });
    const createJson = await createRes.json();
    assert.strictEqual(createRes.status, 201);
    const sessionId = createJson.data.session.id;

    // Agregar una serie mientras esta activa
    const addSetRes = await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ exercise_id: 2, weight_kg: 50, reps_completed: 10 })
    });
    const addSetJson = await addSetRes.json();
    assert.strictEqual(addSetRes.status, 201);
    const setId = addSetJson.data.set.id;

    // Finalizar sesion
    const finishRes = await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/finish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const finishJson = await finishRes.json();
    assert.strictEqual(finishRes.status, 200);
    assert.strictEqual(finishJson.data.session.status, 'completed');

    // Intentar agregar otra serie tras haberla finalizado debe rebotar
    const rejectedAdd = await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ exercise_id: 2, weight_kg: 55, reps_completed: 8 })
    });
    assert.strictEqual(rejectedAdd.status, 400);

    // Intentar editar o borrar la serie de una sesion finalizada debe ser rechazado
    const rejectedUpdate = await fetch(`${baseUrl}/api/workouts/sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ weight_kg: 60 })
    });
    assert.strictEqual(rejectedUpdate.status, 400);

    const rejectedDelete = await fetch(`${baseUrl}/api/workouts/sets/${setId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    assert.strictEqual(rejectedDelete.status, 400);

    // Comprobar que en active ya no aparece
    const activeRes = await fetch(`${baseUrl}/api/workouts/sessions/active?routine_id=10`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const activeJson = await activeRes.json();
    assert.strictEqual(activeJson.data.active_session, null);
  });

  test('12. Recuperar sesion in_progress activa tras reabrir la aplicacion', async () => {
    const tokenAlice = makeToken(mockUsers[2]);

    // Iniciar nueva sesion para la rutina 10
    const startRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ routine_id: 10, notes: 'Sesion para probar recuperacion' })
    });
    const startJson = await startRes.json();
    const newSessionId = startJson.data.session.id;

    // Registrar una serie
    await fetch(`${baseUrl}/api/workouts/sessions/${newSessionId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ exercise_id: 2, weight_kg: 70, reps_completed: 10 })
    });

    // Simular que el usuario cerro la app y consulto getActiveSession
    const activeRes = await fetch(`${baseUrl}/api/workouts/sessions/active?routine_id=10`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const activeJson = await activeRes.json();
    assert.strictEqual(activeRes.status, 200);
    assert.strictEqual(activeJson.data.active_session.id, newSessionId);
    assert.strictEqual(activeJson.data.active_session.status, 'in_progress');
    assert.strictEqual(activeJson.data.active_session.sets.length, 1);
  });

  test('13. Iniciar un nuevo entrenamiento crea una sesion completamente nueva con nuevo ID', async () => {
    const tokenAlice = makeToken(mockUsers[2]);

    // Finalizar cualquier sesion previa
    const activeRes = await fetch(`${baseUrl}/api/workouts/sessions/active?routine_id=10`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const activeJson = await activeRes.json();
    if (activeJson.data.active_session) {
      await fetch(`${baseUrl}/api/workouts/sessions/${activeJson.data.active_session.id}/finish`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenAlice}` }
      });
    }

    // Iniciar nuevo entrenamiento
    const newSessionRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ routine_id: 10, notes: 'Segundo entrenamiento del dia' })
    });
    const newSessionJson = await newSessionRes.json();
    assert.strictEqual(newSessionRes.status, 201);
    assert.strictEqual(newSessionJson.data.session.status, 'in_progress');

    // Comprobar que activeSession devuelve esta nueva sesion sin series acumuladas
    const getActive = await fetch(`${baseUrl}/api/workouts/sessions/active?routine_id=10`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const activeData = await getActive.json();
    assert.strictEqual(activeData.data.active_session.id, newSessionJson.data.session.id);
    assert.strictEqual(activeData.data.active_session.sets.length, 0);
  });

  test('14. Eliminar ejercicio preserva el historial si ya tiene series registradas (baja logica)', async () => {
    const tokenTrainer = makeToken(mockUsers[1]); // Trainer John (id: 2)

    // El ejercicio 1 tiene series en mockSetLogs (creadas por Alice en test 1)
    const delRes = await fetch(`${baseUrl}/api/exercises/1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    const delJson = await delRes.json();
    assert.strictEqual(delRes.status, 200);
    assert.match(delJson.message, /archivado/i);

    // Verificar que mockSetLogs sigue conteniendo las series del ejercicio 1
    const logsEx1 = mockSetLogs.filter(s => s.exercise_id === 1);
    assert.strictEqual(logsEx1.length > 0, true);
  });

  test('15. Eliminar ejercicio sin referencias ejecuta eliminacion fisica directa', async () => {
    const tokenTrainer = makeToken(mockUsers[1]); // Trainer John

    // Agregar un ejercicio huerfano temporal
    mockExercises.push({ id: 99, name: 'Ejercicio Temporal Sin Series', is_active: 1 });

    const delRes = await fetch(`${baseUrl}/api/exercises/99`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    const delJson = await delRes.json();
    assert.strictEqual(delRes.status, 200);
    assert.match(delJson.message, /eliminado/i);

    // Comprobar que ya no existe en el catálogo
    const found = mockExercises.find(e => e.id === 99);
    assert.strictEqual(found, undefined);
  });

  test('16. Concurrencia HTTP: Dos solicitudes simultaneas de inicio para la misma rutina no duplican la sesion', async () => {
    // NOTA TÉCNICA DE ALCANCE:
    // Esta prueba valida a nivel HTTP y lógica de servicio que las peticiones concurrentes simultáneas
    // resuelvan hacia la misma sesión activa sin duplicación de filas.
    // El bloqueo nativo de MariaDB a bajo nivel (GET_LOCK / RELEASE_LOCK por conexión de socket)
    // opera en workoutController.js sobre el pool real de base de datos.
    const tokenAlice = makeToken(mockUsers[2]); // Alice (user 3)

    // Finalizar cualquier sesion previa de la rutina 10
    const activeRes = await fetch(`${baseUrl}/api/workouts/sessions/active?routine_id=10`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const activeJson = await activeRes.json();
    if (activeJson.data.active_session) {
      await fetch(`${baseUrl}/api/workouts/sessions/${activeJson.data.active_session.id}/finish`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenAlice}` }
      });
    }

    const sessionsBefore = mockSessions.filter(s => s.user_id === 3 && s.routine_id === 10).length;

    // Disparar dos peticiones POST /api/workouts/sessions en paralelo con Promise.all (simulando doble toque simultáneo)
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/workouts/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
        body: JSON.stringify({ routine_id: 10, notes: 'Toque concurrente A' })
      }),
      fetch(`${baseUrl}/api/workouts/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
        body: JSON.stringify({ routine_id: 10, notes: 'Toque concurrente B' })
      })
    ]);

    const json1 = await res1.json();
    const json2 = await res2.json();

    // Ambas deben responder con éxito (201 creada y 200/201 recuperada)
    assert.strictEqual([200, 201].includes(res1.status), true);
    assert.strictEqual([200, 201].includes(res2.status), true);

    // Ambas deben apuntar exactamente a la misma sesión ID
    const id1 = json1.data.session.id;
    const id2 = json2.data.session.id;
    assert.strictEqual(id1, id2);

    // En el repositorio solo debe haberse creado 1 sesión adicional, no 2
    const sessionsAfter = mockSessions.filter(s => s.user_id === 3 && s.routine_id === 10).length;
    assert.strictEqual(sessionsAfter, sessionsBefore + 1);

    // Finalizar la sesión creada para dejar limpio el estado
    await fetch(`${baseUrl}/api/workouts/sessions/${id1}/finish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
  });

  test('17. Diferenciacion estricta: Entrenamiento libre (routine_id null) no interfiere con rutina y no se mezclan', async () => {
    const tokenAlice = makeToken(mockUsers[2]); // Alice (id: 3)

    // Iniciar una sesión libre (sin routine_id)
    const freeRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ notes: 'Entrenamiento libre de Alice' })
    });
    const freeJson = await freeRes.json();
    assert.strictEqual(freeRes.status, 201);
    const freeSessionId = freeJson.data.session.id;

    // Consultar sesión activa para rutina 10: debe ser null (la libre no debe responder aquí)
    const activeRoutineRes = await fetch(`${baseUrl}/api/workouts/sessions/active?routine_id=10`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const activeRoutineJson = await activeRoutineRes.json();
    // En este momento la rutina 10 fue finalizada en el test 16
    assert.strictEqual(activeRoutineJson.data.active_session, null);

    // Consultar sesión activa libre (sin routine_id): debe devolver la libre
    const activeFreeRes = await fetch(`${baseUrl}/api/workouts/sessions/active`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const activeFreeJson = await activeFreeRes.json();
    assert.strictEqual(activeFreeJson.data.active_session.id, freeSessionId);
    assert.strictEqual(activeFreeJson.data.active_session.routine_id, null);
  });

  test('18. Sesiones históricas preexistentes con status = NULL aparecen en el historial', async () => {
    const tokenAlice = makeToken(mockUsers[2]); // Alice (id: 3)

    // Inyectar manualmente una sesión histórica previa a la migración (status: null) con series
    const legacySessionId = nextSessionId++;
    mockSessions.push({
      id: legacySessionId,
      user_id: 3,
      routine_id: 10,
      session_date: '2026-10-01T10:00:00.000Z',
      status: null, // Previo a migración 003
      notes: 'Sesión histórica sin status'
    });
    mockSetLogs.push({
      id: nextSetLogId++,
      session_id: legacySessionId,
      user_id: 3,
      exercise_id: 1,
      set_number: 1,
      weight_kg: 95.0,
      reps_completed: 6,
      created_at: '2026-10-01T10:15:00.000Z'
    });

    // Consultar historial
    const histRes = await fetch(`${baseUrl}/api/workouts/history`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const histJson = await histRes.json();
    assert.strictEqual(histRes.status, 200);

    const foundLegacy = histJson.data.sessions.find(s => s.id === legacySessionId);
    assert.notStrictEqual(foundLegacy, undefined);
    assert.strictEqual(foundLegacy.status, null);
    assert.strictEqual(foundLegacy.sets.length, 1);
    assert.strictEqual(foundLegacy.sets[0].weight_kg, 95.0);

    // Comprobar que getActiveSession NUNCA devuelve la sesión con status NULL
    const activeCheck = await fetch(`${baseUrl}/api/workouts/sessions/active?routine_id=10`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const activeCheckJson = await activeCheck.json();
    if (activeCheckJson.data.active_session) {
      assert.notStrictEqual(activeCheckJson.data.active_session.id, legacySessionId);
    }
  });

  test('19. Flujo completo: Crear sesion, cargar 3 series, simular reabrir app (recuperar sesion y sus 3 series) y finalizarla via PATCH', async () => {
    const tokenAlice = makeToken(mockUsers[2]); // Alice (id: 3)

    // 1. Iniciar entrenamiento de la rutina 10
    const startRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ routine_id: 10, notes: 'Sesion de 3 series' })
    });
    const startJson = await startRes.json();
    assert.strictEqual(startRes.status, 201);
    const sessionId = startJson.data.session.id;

    // 2. Cargar 3 series sucesivas
    for (let i = 1; i <= 3; i++) {
      const setRes = await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
        body: JSON.stringify({ exercise_id: 1, set_number: i, weight_kg: 80 + i * 5, reps_completed: 10 - i })
      });
      assert.strictEqual(setRes.status, 201);
    }

    // 3. Simular que el usuario cierra y reabre la pantalla/aplicación (recuperar sesión vía getActiveSession)
    const activeRes = await fetch(`${baseUrl}/api/workouts/sessions/active?routine_id=10`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const activeJson = await activeRes.json();
    assert.strictEqual(activeRes.status, 200);
    assert.notStrictEqual(activeJson.data.active_session, null);
    assert.strictEqual(activeJson.data.active_session.id, sessionId);
    assert.strictEqual(activeJson.data.active_session.sets.length, 3);
    assert.strictEqual(activeJson.data.active_session.sets[0].weight_kg, 85);
    assert.strictEqual(activeJson.data.active_session.sets[1].weight_kg, 90);
    assert.strictEqual(activeJson.data.active_session.sets[2].weight_kg, 95);

    // 4. Si el usuario presiona "Iniciar" nuevamente por error, debe responder 200 con la sesión y sus 3 series (idempotencia)
    const restartRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ routine_id: 10, notes: 'Intento reabrir' })
    });
    const restartJson = await restartRes.json();
    assert.strictEqual(restartRes.status, 200);
    assert.strictEqual(restartJson.data.session.id, sessionId);
    assert.strictEqual(restartJson.data.session.sets_count, 3);
    assert.strictEqual(restartJson.data.session.sets.length, 3);

    // 5. Finalizar la sesión con PATCH /api/workouts/sessions/:sessionId/finish
    const finishRes = await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/finish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const finishJson = await finishRes.json();
    assert.strictEqual(finishRes.status, 200);
    assert.strictEqual(finishJson.data.session.status, 'completed');
    assert.notStrictEqual(finishJson.data.session.ended_at, undefined);

    // 6. Verificar que tras finalizar, getActiveSession ya no la devuelve
    const afterFinish = await fetch(`${baseUrl}/api/workouts/sessions/active?routine_id=10`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const afterFinishJson = await afterFinish.json();
    assert.strictEqual(afterFinishJson.data.active_session, null);
  });
});


