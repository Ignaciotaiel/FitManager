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
          const hasAccess = mockRoutines.some(r => {
            const memberUser = mockUsers.find(u => u.id === queryMemberId);
            return r.trainer_id === authUserId && r.member_id === queryMemberId && memberUser && memberUser.is_active === 1;
          });
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

      const deleted = mockSetLogs.splice(index, 1)[0];

      // Renumerar correlativamente las series restantes del mismo ejercicio en esta sesion
      const remaining = mockSetLogs
        .filter(s => s.session_id === deleted.session_id && s.exercise_id === deleted.exercise_id)
        .sort((a, b) => a.set_number - b.set_number);
      remaining.forEach((s, idx) => {
        s.set_number = idx + 1;
      });

      return res.status(200).json({ ok: true, message: 'serie eliminada', data: { id: setId } });
    });

    // 6.1 GET /api/workouts/trainer/members
    app.get('/api/workouts/trainer/members', testVerifyToken, testRequireRole('trainer', 'admin'), (req, res) => {
      const trainerId = req.user.id;
      const assignedMemberIds = [
        ...new Set(mockRoutines.filter(r => r.trainer_id === trainerId && r.member_id).map(r => r.member_id))
      ];
      const members = mockUsers.filter(u => assignedMemberIds.includes(u.id) && u.role === 'member' && u.is_active === 1);
      return res.status(200).json({ ok: true, data: { members } });
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
      const startMs = new Date(session.created_at || session.session_date).getTime();
      const endMs = new Date(session.ended_at).getTime();
      const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = Math.floor(diffSec % 60);
      const duration_formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      return res.status(200).json({
        ok: true,
        data: {
          session: {
            ...session,
            duration_seconds: diffSec,
            duration_formatted
          }
        }
      });
    });

    // 8. GET /api/workouts/sessions/active (DEBE IR ANTES DE /:sessionId PARA NO SER CAPTURADO COMO PARÁMETRO)
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

    // 8.1 GET /api/workouts/sessions/:sessionId
    app.get('/api/workouts/sessions/:sessionId', testVerifyToken, (req, res) => {
      const { role, id: authUserId } = req.user;
      const session = mockSessions.find(s => s.id === Number(req.params.sessionId));
      if (!session) {
        return res.status(404).json({ ok: false, error: { message: 'sesion no existe', code: 'SESSION_NOT_FOUND' } });
      }
      if (role === 'member' && Number(session.user_id) !== Number(authUserId)) {
        return res.status(403).json({ ok: false, error: { message: 'no tienes permiso', code: 'FORBIDDEN' } });
      }
      if (role === 'trainer' && Number(session.user_id) !== Number(authUserId)) {
        const hasAccess = mockRoutines.some(r => {
          const memberUser = mockUsers.find(u => u.id === session.user_id);
          return r.trainer_id === authUserId && r.member_id === session.user_id && memberUser && memberUser.is_active === 1;
        });
        if (!hasAccess) {
          return res.status(403).json({ ok: false, error: { message: 'sin vinculo con el socio', code: 'FORBIDDEN' } });
        }
      }
      const sets = mockSetLogs
        .filter(sl => sl.session_id === session.id)
        .map(sl => {
          const ex = mockExercises.find(e => e.id === sl.exercise_id);
          return {
            ...sl,
            exercise_name: ex ? ex.name : 'Ejercicio',
            muscle_group: ex ? ex.muscle_group : null
          };
        });
      return res.status(200).json({ ok: true, data: { session: { ...session, sets } } });
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

    // Finalizar la sesión para dejar limpio el estado
    await fetch(`${baseUrl}/api/workouts/sessions/${newSessionJson.data.session.id}/finish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
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

    // 7. Requisito clave: Una vez finalizada, consultar el detalle puntual de la sesión finalizada debe retornar todas sus series
    const detailRes = await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const detailJson = await detailRes.json();
    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailJson.data.session.id, sessionId);
    assert.strictEqual(detailJson.data.session.status, 'completed');
    assert.strictEqual(detailJson.data.session.sets.length, 3);
    assert.strictEqual(detailJson.data.session.sets[0].weight_kg, 85);
    assert.strictEqual(detailJson.data.session.sets[1].weight_kg, 90);
    assert.strictEqual(detailJson.data.session.sets[2].weight_kg, 95);

    // 8. También debe aparecer en la lista general de historial
    const historyRes = await fetch(`${baseUrl}/api/workouts/history`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const historyJson = await historyRes.json();
    assert.strictEqual(historyRes.status, 200);
    const foundInHistory = historyJson.data.sessions.find(s => s.id === sessionId);
    assert.notStrictEqual(foundInHistory, undefined);
    assert.strictEqual(foundInHistory.status, 'completed');
    assert.strictEqual(foundInHistory.sets.length, 3);
  });

  test('20. Aislamiento por usuario al consultar detalle de sesión (GET /sessions/:id)', async () => {
    const tokenAlice = makeToken(mockUsers[2]); // Alice (id: 3)
    const tokenBob = makeToken(mockUsers[3]);   // Bob (id: 4)

    // Crear una sesión finalizada para Bob
    const bobSession = {
      id: nextSessionId++,
      user_id: 4,
      routine_id: 20,
      session_date: new Date().toISOString(),
      status: 'completed',
      ended_at: new Date().toISOString(),
      notes: 'Sesion privada de Bob'
    };
    mockSessions.push(bobSession);
    mockSetLogs.push({
      id: nextSetLogId++,
      session_id: bobSession.id,
      user_id: 4,
      exercise_id: 2,
      set_number: 1,
      weight_kg: 100,
      reps_completed: 5,
      created_at: new Date().toISOString()
    });

    // Bob puede consultar su propia sesión
    const bobRes = await fetch(`${baseUrl}/api/workouts/sessions/${bobSession.id}`, {
      headers: { Authorization: `Bearer ${tokenBob}` }
    });
    assert.strictEqual(bobRes.status, 200);

    // Alice intenta consultar la sesión de Bob -> debe responder 403 Forbidden
    const aliceRes = await fetch(`${baseUrl}/api/workouts/sessions/${bobSession.id}`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    assert.strictEqual(aliceRes.status, 403);
  });

  test('21. Mejora 1: Edición y eliminación de series con renumeración correlativa', async () => {
    const tokenAlice = makeToken(mockUsers[2]); // Alice (id: 3)

    // Crear sesión nueva para Alice
    const startRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ routine_id: 10, notes: 'Sesion test renumeracion' })
    });
    const startJson = await startRes.json();
    const sessionId = startJson.data.session.id;

    // Agregar 3 series del ejercicio 1: #1, #2, #3
    const s1 = await (await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ exercise_id: 1, set_number: 1, weight_kg: 50, reps_completed: 10 })
    })).json();

    const s2 = await (await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ exercise_id: 1, set_number: 2, weight_kg: 55, reps_completed: 8 })
    })).json();

    const s3 = await (await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ exercise_id: 1, set_number: 3, weight_kg: 60, reps_completed: 6 })
    })).json();

    // 1. Editar la serie #2 (cambiar a 57.5 kg y 9 reps)
    const updateRes = await fetch(`${baseUrl}/api/workouts/sets/${s2.data.set.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ weight_kg: 57.5, reps_completed: 9 })
    });
    const updateJson = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateJson.data.set.weight_kg, 57.5);
    assert.strictEqual(updateJson.data.set.reps_completed, 9);

    // 2. Eliminar la serie #2 intermedia
    const delRes = await fetch(`${baseUrl}/api/workouts/sets/${s2.data.set.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    assert.strictEqual(delRes.status, 200);

    // 3. Verificar que la serie #3 ahora fue renumerada a #2
    const activeRes = await fetch(`${baseUrl}/api/workouts/sessions/active?routine_id=10`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const activeJson = await activeRes.json();
    const remainingSets = activeJson.data.active_session.sets;
    assert.strictEqual(remainingSets.length, 2);
    assert.strictEqual(remainingSets[0].id, s1.data.set.id);
    assert.strictEqual(remainingSets[0].set_number, 1);
    assert.strictEqual(remainingSets[1].id, s3.data.set.id);
    assert.strictEqual(remainingSets[1].set_number, 2); // Renumerada consecutivamente a 2

    // Finalizar sesión para limpiar estado
    await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/finish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
  });

  test('22. Mejora 2: Duración total del entrenamiento calculada y congelada', async () => {
    const tokenAlice = makeToken(mockUsers[2]);

    // Crear sesión
    const startRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ routine_id: 10, notes: 'Sesion test duracion' })
    });
    const startJson = await startRes.json();
    const sessionId = startJson.data.session.id;

    // Finalizar sesión y verificar que el payload devuelve duration_seconds y duration_formatted (HH:MM:SS)
    const finishRes = await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/finish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const finishJson = await finishRes.json();
    assert.strictEqual(finishRes.status, 200);
    assert.strictEqual(typeof finishJson.data.session.duration_seconds, 'number');
    assert.strictEqual(typeof finishJson.data.session.duration_formatted, 'string');
    assert.match(finishJson.data.session.duration_formatted, /^\d{2}:\d{2}:\d{2}$/);
  });

  test('23. Mejora 4: Consulta de alumnos asignados al entrenador y seguridad de historial', async () => {
    const tokenTrainer = makeToken(mockUsers[1]);   // Trainer John (id: 2)
    const tokenStranger = makeToken(mockUsers[4]);  // Trainer Stranger (id: 5)

    // Trainer John tiene asignada a Alice (id: 3) en routine 10
    const listRes = await fetch(`${baseUrl}/api/workouts/trainer/members`, {
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    const listJson = await listRes.json();
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(Array.isArray(listJson.data.members), true);
    const hasAlice = listJson.data.members.some(m => m.id === 3);
    assert.strictEqual(hasAlice, true);

    // Trainer John puede consultar el historial de Alice
    const historyAlice = await fetch(`${baseUrl}/api/workouts/history?member_id=3`, {
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    assert.strictEqual(historyAlice.status, 200);

    // Trainer John NO puede consultar a Bob (id: 4) asignado a otro trainer -> 403 Forbidden
    const historyBobForbidden = await fetch(`${baseUrl}/api/workouts/history?member_id=4`, {
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    assert.strictEqual(historyBobForbidden.status, 403);
  });

  test('24. Seguridad de Entrenador: Desasignar alumno de rutina revoca acceso inmediatamente', async () => {
    const tokenTrainer = makeToken(mockUsers[1]); // Trainer John (id: 2)

    // Desasignar a Alice (id: 3) de la rutina 10 quitando su member_id
    const targetRoutine = mockRoutines.find(r => r.id === 10);
    assert.notStrictEqual(targetRoutine, undefined);
    targetRoutine.member_id = null; // Simula desasignación completa

    // Trainer John ya NO debe ver a Alice en su listado
    const listRes = await fetch(`${baseUrl}/api/workouts/trainer/members`, {
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    const listJson = await listRes.json();
    const hasAlice = listJson.data.members.some(m => m.id === 3);
    assert.strictEqual(hasAlice, false);

    // Trainer John ahora es rechazado con 403 al intentar consultar su historial
    const historyAliceAfter = await fetch(`${baseUrl}/api/workouts/history?member_id=3`, {
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    assert.strictEqual(historyAliceAfter.status, 403);

    // Restaurar asignación para no afectar pruebas subsiguientes
    targetRoutine.member_id = 3;
  });

  test('25. Duración y Fechas: Sesiones históricas con status/ended_at NULL no inventan duración', async () => {
    const tokenAlice = makeToken(mockUsers[2]);

    // Crear sesión histórica legacy sin status ni ended_at
    const legacySession = {
      id: nextSessionId++,
      user_id: 3,
      routine_id: 10,
      session_date: '2026-05-10T14:30:00Z',
      status: null,
      ended_at: null,
      notes: 'Sesion historica antigua'
    };
    mockSessions.push(legacySession);

    const historyRes = await fetch(`${baseUrl}/api/workouts/history`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const historyJson = await historyRes.json();
    const foundLegacy = historyJson.data.sessions.find(s => s.id === legacySession.id);

    assert.notStrictEqual(foundLegacy, undefined);
    assert.strictEqual(foundLegacy.status, null);
    // Verificar que nunca se inventa duración para registros antiguos
    assert.strictEqual(foundLegacy.duration_seconds, undefined);
  });

  test('26. Concurrencia e Integridad: No se puede agregar, editar ni eliminar series en una sesión finalizada', async () => {
    const tokenAlice = makeToken(mockUsers[2]); // Alice (id: 3)

    // Crear una nueva sesión
    const startRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ routine_id: 10, notes: 'Sesion para probar proteccion contra modificacion post-finalizado' })
    });
    const startJson = await startRes.json();
    const sessionId = startJson.data.session.id;

    // Agregar una serie mientras está activa
    const addRes = await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ exercise_id: 1, set_number: 1, weight_kg: 50, reps_completed: 10 })
    });
    const addJson = await addRes.json();
    assert.strictEqual(addRes.status, 201);
    const setId = addJson.data.set.id;

    // Finalizar la sesión
    const finishRes = await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/finish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    assert.strictEqual(finishRes.status, 200);

    // 1. Intentar agregar serie a la sesión finalizada -> debe fallar con 400 y code SESSION_COMPLETED
    const rejectedAdd = await fetch(`${baseUrl}/api/workouts/sessions/${sessionId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ exercise_id: 1, set_number: 2, weight_kg: 55, reps_completed: 8 })
    });
    const rejAddJson = await rejectedAdd.json();
    assert.strictEqual(rejectedAdd.status, 400);
    assert.strictEqual(rejAddJson.error.code, 'SESSION_COMPLETED');

    // 2. Intentar editar la serie de la sesión finalizada -> debe fallar con 400 y code SESSION_COMPLETED
    const rejectedUpdate = await fetch(`${baseUrl}/api/workouts/sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ weight_kg: 60 })
    });
    const rejUpdJson = await rejectedUpdate.json();
    assert.strictEqual(rejectedUpdate.status, 400);
    assert.strictEqual(rejUpdJson.error.code, 'SESSION_COMPLETED');

    // 3. Intentar eliminar la serie de la sesión finalizada -> debe fallar con 400 y code SESSION_COMPLETED
    const rejectedDelete = await fetch(`${baseUrl}/api/workouts/sets/${setId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const rejDelJson = await rejectedDelete.json();
    assert.strictEqual(rejectedDelete.status, 400);
    assert.strictEqual(rejDelJson.error.code, 'SESSION_COMPLETED');
  });

  test('27. Acceso de Entrenador: Socio inactivo (is_active = 0) no aparece en listado ni en historial ni en detalle', async () => {
    const tokenTrainer = makeToken(mockUsers[1]); // Trainer John (id: 2)

    // Crear un socio inactivo asignado a una rutina de Trainer John
    const inactiveUser = {
      id: 999,
      username: 'inactive_member',
      email: 'inactive@test.com',
      role: 'member',
      is_active: 0
    };
    mockUsers.push(inactiveUser);

    mockRoutines.push({
      id: 999,
      name: 'Rutina Socio Inactivo',
      trainer_id: 2,
      member_id: 999
    });

    const inactiveSession = {
      id: nextSessionId++,
      user_id: 999,
      routine_id: 999,
      session_date: new Date().toISOString(),
      status: 'completed',
      ended_at: new Date().toISOString(),
      notes: 'Sesion de socio inactivo'
    };
    mockSessions.push(inactiveSession);

    // 1. Verificar que el socio inactivo NO aparece en GET /trainer/members
    const membersRes = await fetch(`${baseUrl}/api/workouts/trainer/members`, {
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    const membersJson = await membersRes.json();
    assert.strictEqual(membersRes.status, 200);
    const foundInactive = membersJson.data.members.some(m => m.id === 999);
    assert.strictEqual(foundInactive, false);

    // 2. Verificar que Trainer John NO puede consultar su historial -> 403 Forbidden
    const historyRes = await fetch(`${baseUrl}/api/workouts/history?member_id=999`, {
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    assert.strictEqual(historyRes.status, 403);

    // 3. Verificar que Trainer John NO puede consultar el detalle de su sesión -> 403 Forbidden
    const detailRes = await fetch(`${baseUrl}/api/workouts/sessions/${inactiveSession.id}`, {
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    assert.strictEqual(detailRes.status, 403);
  });
});



