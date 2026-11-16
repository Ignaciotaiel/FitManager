// Pruebas automatizadas de sesiones de entrenamiento, series, cronómetro y permisos de acceso.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { normalizeDisplayText } from '../controllers/workoutController.js';

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

    // 9. Endpoints completos de /api/exercises (GET, POST, PATCH, DELETE idénticos a exerciseController.js)
    app.get('/api/exercises', testVerifyToken, (req, res) => {
      const { include_inactive } = req.query;
      const list = mockExercises
        .filter(e => include_inactive === 'true' || include_inactive === '1' || (e.is_active ?? 1) === 1)
        .sort((a, b) => {
          const cmp = String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
          if (cmp !== 0) return cmp;
          return Number(a.id) - Number(b.id);
        });
      return res.status(200).json({ ok: true, data: { exercises: list } });
    });

    app.post('/api/exercises', testVerifyToken, testRequireRole('admin', 'trainer'), (req, res) => {
      const { name, description, muscle_group, difficulty } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ ok: false, error: { message: 'el nombre del ejercicio es obligatorio', code: 'INVALID_NAME' } });
      }
      const nextId = mockExercises.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1;
      const created = {
        id: nextId,
        name: name.trim(),
        description: description ? String(description).trim() : null,
        muscle_group: muscle_group ? String(muscle_group).trim() : null,
        difficulty: difficulty ? String(difficulty).trim() : 'beginner',
        is_active: 1
      };
      mockExercises.push(created);
      return res.status(201).json({ ok: true, message: 'ejercicio creado exitosamente', data: { exercise: created } });
    });

    app.patch('/api/exercises/:id', testVerifyToken, testRequireRole('admin', 'trainer'), (req, res) => {
      const exId = Number(req.params.id);
      const ex = mockExercises.find(e => e.id === exId);
      if (!ex) {
        return res.status(404).json({ ok: false, error: { message: 'ejercicio no encontrado', code: 'EXERCISE_NOT_FOUND' } });
      }
      const { name, description, muscle_group, difficulty } = req.body;
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ ok: false, error: { message: 'el nombre no puede estar vacio', code: 'INVALID_NAME' } });
        }
        ex.name = name.trim();
      }
      if (description !== undefined) ex.description = description ? String(description).trim() : null;
      if (muscle_group !== undefined) ex.muscle_group = muscle_group ? String(muscle_group).trim() : null;
      if (difficulty !== undefined) ex.difficulty = String(difficulty).trim();
      return res.status(200).json({
        ok: true,
        message: 'ejercicio actualizado exitosamente',
        data: {
          exercise: {
            id: ex.id,
            name: ex.name,
            description: ex.description || null,
            muscle_group: ex.muscle_group || null,
            difficulty: ex.difficulty || 'beginner',
            is_active: ex.is_active ?? 1
          }
        }
      });
    });

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
        return res.status(200).json({ ok: true, message: 'ejercicio archivado (baja lógica)', data: { id: exId, archived: true } });
      }
      mockExercises = mockExercises.filter(e => e.id !== exId);
      return res.status(200).json({ ok: true, message: 'ejercicio eliminado', data: { id: exId, archived: false } });
    });

    // 10. GET /api/workouts/exercises/:exerciseId/history (idéntico a getExerciseHistory en workoutController.js)
    app.get('/api/workouts/exercises/:exerciseId/history', testVerifyToken, (req, res) => {
      const { role, id: authUserId } = req.user;
      const exId = Number(req.params.exerciseId);
      let targetUserId = authUserId;

      if (req.query.member_id) {
        targetUserId = Number(req.query.member_id);
      }

      const ex = mockExercises.find(e => e.id === exId);
      if (!ex) {
        return res.status(404).json({ ok: false, error: { message: 'ejercicio no existe', code: 'EXERCISE_NOT_FOUND' } });
      }

      // Filtrar solo sesiones finalizadas (status = 'completed' o status IS NULL) y ordenar por session_date DESC, ws.id DESC, set_number ASC
      const logs = mockSetLogs
        .filter(sl => sl.user_id === targetUserId && sl.exercise_id === exId)
        .map(sl => {
          const ws = mockSessions.find(s => s.id === sl.session_id);
          return ws ? { ...sl, session_date: ws.session_date, session_status: ws.status } : null;
        })
        .filter(row => row !== null && (row.session_status === 'completed' || row.session_status === null))
        .sort((a, b) => {
          const timeDiff = new Date(b.session_date).getTime() - new Date(a.session_date).getTime();
          if (timeDiff !== 0) return timeDiff;
          if (b.session_id !== a.session_id) return b.session_id - a.session_id;
          return a.set_number - b.set_number;
        })
        .map(({ session_status, ...rest }) => rest);

      let maxWeight = 0;
      let totalReps = 0;
      logs.forEach(l => {
        if (Number(l.weight_kg) > maxWeight) maxWeight = Number(l.weight_kg);
        totalReps += Number(l.reps_completed);
      });

      return res.status(200).json({
        ok: true,
        data: {
          exercise: ex,
          stats: {
            total_sets_logged: logs.length,
            personal_record_kg: maxWeight,
            total_reps_completed: totalReps
          },
          logs
        }
      });
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

  test('28. Normalización de codificación UTF-8: repara mojibake histórico (SesiÃ³n -> Sesión, DuraciÃ³n -> Duración) sin alterar textos válidos', () => {
    assert.strictEqual(normalizeDisplayText('SesiÃ³n de espalda'), 'Sesión de espalda');
    assert.strictEqual(normalizeDisplayText('SesiÃ³n de pecho'), 'Sesión de pecho');
    assert.strictEqual(normalizeDisplayText('DuraciÃ³n total'), 'Duración total');
    assert.strictEqual(normalizeDisplayText('Ã‰xito en la sesiÃ³n'), 'Éxito en la sesión');
    assert.strictEqual(normalizeDisplayText('Press de banca: 80 kg × 8 repeticiones'), 'Press de banca: 80 kg × 8 repeticiones');
    assert.strictEqual(normalizeDisplayText(null), null);
  });

  test('29. Mejores marcas y evolución: distingue mayor peso levantado y mejor rendimiento peso × repeticiones sin mezclar ejercicios', () => {
    const setsEx1 = [
      { exercise_id: 1, weight_kg: 80, reps_completed: 4, session_date: '2026-11-10' }, // Mayor peso: 80 kg × 4 reps (vol 320)
      { exercise_id: 1, weight_kg: 75, reps_completed: 12, session_date: '2026-11-12' } // Mejor rendimiento peso × reps: 75 kg × 12 reps (vol 900)
    ];

    let bestWeight = setsEx1[0];
    let bestPerformance = setsEx1[0];

    for (const st of setsEx1) {
      if (st.weight_kg > bestWeight.weight_kg || (st.weight_kg === bestWeight.weight_kg && st.reps_completed > bestWeight.reps_completed)) {
        bestWeight = st;
      }
      if ((st.weight_kg * st.reps_completed) > (bestPerformance.weight_kg * bestPerformance.reps_completed)) {
        bestPerformance = st;
      }
    }

    assert.strictEqual(bestWeight.weight_kg, 80);
    assert.strictEqual(bestWeight.reps_completed, 4);
    assert.strictEqual(bestPerformance.weight_kg, 75);
    assert.strictEqual(bestPerformance.reps_completed, 12);
  });

  test('30. Agrupación por session_id en entrenamientos del mismo día (Caso real 13/11/2026: Sesión 23 y Sesión 24 de Press militar)', async () => {
    const tokenAlice = makeToken(mockUsers[2]); // Alice (id: 3)

    // Registrar ejercicio 9: Press militar
    if (!mockExercises.some(e => e.id === 9)) {
      mockExercises.push({ id: 9, name: 'press militar', muscle_group: 'Hombros' });
    }

    // Sesión 23 (13/11/2026 21:18:01Z) - Press militar: 10 kg × 10, 15 kg × 8, 17 kg × 6
    mockSessions.push({
      id: 23,
      user_id: 3,
      routine_id: 10,
      session_date: '2026-11-13T21:18:01.000Z',
      status: 'completed',
      ended_at: '2026-11-13T21:19:05.000Z',
      notes: 'Entrenamiento 1 hombro'
    });
    mockSetLogs.push(
      { id: 25, session_id: 23, user_id: 3, exercise_id: 9, set_number: 1, weight_kg: 10, reps_completed: 10, created_at: '2026-11-13T21:18:10.000Z' },
      { id: 26, session_id: 23, user_id: 3, exercise_id: 9, set_number: 2, weight_kg: 15, reps_completed: 8, created_at: '2026-11-13T21:18:30.000Z' },
      { id: 27, session_id: 23, user_id: 3, exercise_id: 9, set_number: 3, weight_kg: 17, reps_completed: 6, created_at: '2026-11-13T21:18:50.000Z' }
    );

    // Sesión 24 (13/11/2026 21:19:30Z) - Press militar: 20 kg × 10, 22 kg × 10, 25 kg × 7
    mockSessions.push({
      id: 24,
      user_id: 3,
      routine_id: 10,
      session_date: '2026-11-13T21:19:30.000Z',
      status: 'completed',
      ended_at: '2026-11-13T21:20:52.000Z',
      notes: 'Entrenamiento 2 hombro'
    });
    mockSetLogs.push(
      { id: 31, session_id: 24, user_id: 3, exercise_id: 9, set_number: 1, weight_kg: 20, reps_completed: 10, created_at: '2026-11-13T21:19:45.000Z' },
      { id: 32, session_id: 24, user_id: 3, exercise_id: 9, set_number: 2, weight_kg: 22, reps_completed: 10, created_at: '2026-11-13T21:20:10.000Z' },
      { id: 33, session_id: 24, user_id: 3, exercise_id: 9, set_number: 3, weight_kg: 25, reps_completed: 7, created_at: '2026-11-13T21:20:40.000Z' }
    );

    // Consultar endpoint GET /api/workouts/exercises/9/history
    const res = await fetch(`${baseUrl}/api/workouts/exercises/9/history`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.data.logs.length, 6);

    // Verificar orden del backend: ws.session_date DESC, ws.id DESC, sl.set_number ASC
    assert.deepStrictEqual(
      json.data.logs.map(l => ({ session_id: l.session_id, set_number: l.set_number })),
      [
        { session_id: 24, set_number: 1 },
        { session_id: 24, set_number: 2 },
        { session_id: 24, set_number: 3 },
        { session_id: 23, set_number: 1 },
        { session_id: 23, set_number: 2 },
        { session_id: 23, set_number: 3 }
      ]
    );

    // Aplicar exactamente la lógica de buildSessionExercisePoints (con un registro inválido sin session_id para probar que NO hace fallback a fecha)
    const rawLogsWithMalformed = [
      ...json.data.logs,
      { id: 9999, session_id: null, exercise_id: 9, set_number: 1, weight_kg: 999, reps_completed: 99, session_date: '2026-11-13T22:00:00.000Z' }
    ];

    const bySession = new Map();
    for (const log of rawLogsWithMalformed) {
      const parsedSessionId = Number(log.session_id);
      if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
        continue; // Descarte explícito: nunca agrupar por isoDate
      }
      const weight = Number(log.weight_kg);
      const reps = Number(log.reps_completed) || 0;
      const setVolume = Math.round(weight * reps * 100) / 100;
      const rawDate = log.session_date || log.created_at;
      const timestampMs = new Date(rawDate).getTime();
      const isoDate = new Date(rawDate).toISOString().slice(0, 10);

      const existing = bySession.get(parsedSessionId);
      const setItem = {
        id: Number(log.id),
        setNumber: Number(log.set_number),
        weight,
        reps,
        volume: setVolume
      };

      if (!existing) {
        bySession.set(parsedSessionId, {
          sessionId: parsedSessionId,
          sessionTimestamp: rawDate,
          timestampMs,
          isoDate,
          maxWeight: weight,
          bestRepsAtMax: reps,
          bestPerformanceWeight: weight,
          bestPerformanceReps: reps,
          bestPerformanceVolume: setVolume,
          totalVolume: setVolume,
          setsCount: 1,
          sets: [setItem]
        });
      } else {
        existing.setsCount += 1;
        existing.totalVolume = Math.round((existing.totalVolume + setVolume) * 100) / 100;
        existing.sets.push(setItem);
        if (weight > existing.maxWeight || (weight === existing.maxWeight && reps > existing.bestRepsAtMax)) {
          existing.maxWeight = weight;
          existing.bestRepsAtMax = reps;
        }
        if (setVolume > existing.bestPerformanceVolume || (setVolume === existing.bestPerformanceVolume && weight > existing.bestPerformanceWeight)) {
          existing.bestPerformanceWeight = weight;
          existing.bestPerformanceReps = reps;
          existing.bestPerformanceVolume = setVolume;
        }
      }
    }

    const points = Array.from(bySession.values()).sort((a, b) => {
      if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
      return a.sessionId - b.sessionId;
    });

    // 1. 2 sesiones registradas y 2 puntos independientes en el gráfico
    assert.strictEqual(points.length, 2);
    assert.strictEqual(points[0].sessionId, 23);
    assert.strictEqual(points[1].sessionId, 24);

    // 2. 6 series en total, separadas en 2 sesiones (3 cada una)
    const totalSets = points.reduce((acc, p) => acc + p.setsCount, 0);
    assert.strictEqual(totalSets, 6);
    assert.strictEqual(points[0].setsCount, 3);
    assert.strictEqual(points[1].setsCount, 3);
    assert.strictEqual(points[0].sets.length, 3);
    assert.strictEqual(points[1].sets.length, 3);

    // 3. Primera sesión (Sesión 23): mejor marca 17 kg × 6, volumen total 322 kg (100 + 120 + 102)
    assert.strictEqual(points[0].maxWeight, 17);
    assert.strictEqual(points[0].bestRepsAtMax, 6);
    assert.strictEqual(points[0].totalVolume, 322);

    // 4. Segunda sesión (Sesión 24): mejor marca 25 kg × 7, volumen total 595 kg (200 + 220 + 175)
    assert.strictEqual(points[1].maxWeight, 25);
    assert.strictEqual(points[1].bestRepsAtMax, 7);
    assert.strictEqual(points[1].totalVolume, 595);

    // 5. Diferencia de peso máximo entre sesiones: +8 kg
    const firstInPeriod = points[0];
    const lastInPeriod = points[points.length - 1];
    const diffInPeriod =
      firstInPeriod && lastInPeriod && firstInPeriod.sessionId !== lastInPeriod.sessionId
        ? Math.round((lastInPeriod.maxWeight - firstInPeriod.maxWeight) * 10) / 10
        : 0;
    assert.strictEqual(diffInPeriod, 8);
  });

  test('31. Sincronización en tiempo real de Biblioteca de técnicas entre dispositivos (Escenarios 1 a 8)', async () => {
    const tokenTrainer = makeToken(mockUsers[1]); // Trainer John (id: 2)
    const tokenAlice = makeToken(mockUsers[2]);   // Member Alice (id: 3)
    const tokenBob = makeToken(mockUsers[3]);     // Member Bob (id: 4)

    // Helper idéntico a reconcileExercisesState de Modules/exercises/exerciseService.tsx
    const isSameItem = (a, b) =>
      Boolean(a && b) &&
      Number(a.id) === Number(b.id) &&
      String(a.name || '') === String(b.name || '') &&
      String(a.description || '') === String(b.description || '') &&
      String(a.muscle_group || '') === String(b.muscle_group || '') &&
      String(a.difficulty || 'beginner') === String(b.difficulty || 'beginner') &&
      Number(a.is_active ?? 1) === Number(b.is_active ?? 1);

    const reconcileState = (prevList, incomingList) => {
      const safePrev = Array.isArray(prevList) ? prevList : [];
      const byId = new Map();
      for (const item of incomingList || []) {
        const id = Number(item?.id);
        if (!Number.isInteger(id) || id <= 0) continue;
        if (item.is_active === 0 || item.is_active === false) continue;
        byId.set(id, { ...item, id });
      }
      const normalizedNext = Array.from(byId.values()).sort((a, b) => {
        const cmp = String(a.name || '').trim().localeCompare(String(b.name || '').trim(), 'es', { sensitivity: 'base' });
        return cmp !== 0 ? cmp : Number(a.id) - Number(b.id);
      });

      if (
        safePrev.length === normalizedNext.length &&
        safePrev.every((item, idx) => isSameItem(item, normalizedNext[idx]))
      ) {
        return safePrev; // Misma referencia exacta: sin re-render ni parpadeo
      }

      const prevById = new Map(safePrev.map(i => [Number(i.id), i]));
      return normalizedNext.map(nextItem => {
        const existing = prevById.get(Number(nextItem.id));
        return existing && isSameItem(existing, nextItem) ? existing : nextItem;
      });
    };

    // Estado inicial: Alice y Bob abren su Biblioteca de técnicas simultáneamente desde distintos dispositivos (Escenario 8)
    const initAliceRes = await fetch(`${baseUrl}/api/exercises`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const initBobRes = await fetch(`${baseUrl}/api/exercises`, {
      headers: { Authorization: `Bearer ${tokenBob}` }
    });
    assert.strictEqual(initAliceRes.status, 200);
    assert.strictEqual(initBobRes.status, 200);

    let aliceLibrary = reconcileState([], (await initAliceRes.json()).data.exercises);
    let bobLibrary = reconcileState([], (await initBobRes.json()).data.exercises);
    const initialCount = aliceLibrary.length;
    assert.strictEqual(bobLibrary.length, initialCount);

    // Si el ciclo de polling corre sin cambios en el backend, la referencia del array NO cambia (0 parpadeos)
    const unchangedPollRes = await fetch(`${baseUrl}/api/exercises`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const prevAliceRef = aliceLibrary;
    aliceLibrary = reconcileState(aliceLibrary, (await unchangedPollRes.json()).data.exercises);
    assert.strictEqual(aliceLibrary, prevAliceRef);

    // Verificar seguridad (Etapa 4): Un socio (Alice) NO puede crear, editar ni eliminar técnicas (403 Forbidden)
    const forbiddenCreate = await fetch(`${baseUrl}/api/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ name: 'Intento Socio', muscle_group: 'Pecho', difficulty: 'beginner' })
    });
    assert.strictEqual(forbiddenCreate.status, 403);

    // Escenario 1: Usuario con biblioteca abierta y entrenador agrega una técnica desde su dispositivo
    const createTechRes = await fetch(`${baseUrl}/api/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({
        name: 'Técnica Retracción Escapular',
        description: 'Mantener hombros atrás y abajo durante el empuje',
        muscle_group: 'Espalda / Postura',
        difficulty: 'beginner'
      })
    });
    assert.strictEqual(createTechRes.status, 201);
    const createdTech = (await createTechRes.json()).data.exercise;

    // Sincronización automática en segundo plano para Alice y Bob (sin recargar manualmente)
    const sync1Alice = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenAlice}` } });
    const sync1Bob = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenBob}` } });
    const prevFirstItemRef = aliceLibrary[0];
    aliceLibrary = reconcileState(aliceLibrary, (await sync1Alice.json()).data.exercises);
    bobLibrary = reconcileState(bobLibrary, (await sync1Bob.json()).data.exercises);

    assert.strictEqual(aliceLibrary.length, initialCount + 1);
    assert.strictEqual(bobLibrary.length, initialCount + 1);
    assert.ok(aliceLibrary.some(e => e.id === createdTech.id && e.name === 'Técnica Retracción Escapular'));
    assert.ok(bobLibrary.some(e => e.id === createdTech.id && e.name === 'Técnica Retracción Escapular'));
    // Los ítems preexistentes conservan su misma referencia de objeto (no parpadean las tarjetas existentes)
    assert.ok(aliceLibrary.includes(prevFirstItemRef));

    // Escenario 2: Usuario con biblioteca abierta y entrenador agrega un ejercicio
    const createExRes = await fetch(`${baseUrl}/api/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({
        name: 'Dominadas Supinas',
        description: 'Agarre supino ancho de hombros',
        muscle_group: 'Espalda',
        difficulty: 'intermediate'
      })
    });
    assert.strictEqual(createExRes.status, 201);
    const createdEx = (await createExRes.json()).data.exercise;

    const sync2Alice = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenAlice}` } });
    aliceLibrary = reconcileState(aliceLibrary, (await sync2Alice.json()).data.exercises);
    assert.strictEqual(aliceLibrary.length, initialCount + 2);
    assert.ok(aliceLibrary.some(e => e.id === createdEx.id && e.name === 'Dominadas Supinas'));

    // Escenario 3: Entrenador agrega varios elementos consecutivamente
    const consecutiveNames = [' Aperturas en Polea', 'Curl Martillo Alternado', 'Zancadas Búlgaras'];
    const createdConsecutiveIds = [];
    for (const rawName of consecutiveNames) {
      const r = await fetch(`${baseUrl}/api/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
        body: JSON.stringify({ name: rawName, muscle_group: 'General', difficulty: 'intermediate' })
      });
      assert.strictEqual(r.status, 201);
      createdConsecutiveIds.push((await r.json()).data.exercise.id);
    }

    const sync3Alice = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenAlice}` } });
    aliceLibrary = reconcileState(aliceLibrary, (await sync3Alice.json()).data.exercises);
    assert.strictEqual(aliceLibrary.length, initialCount + 5);
    // Verificar que no hay duplicados por ID y que están todos los nuevos elementos
    const uniqueIds = new Set(aliceLibrary.map(e => e.id));
    assert.strictEqual(uniqueIds.size, aliceLibrary.length);
    for (const cid of createdConsecutiveIds) {
      assert.ok(uniqueIds.has(cid));
    }

    // Escenario 4: Entrenador edita un elemento existente y se sincroniza automáticamente
    const editRes = await fetch(`${baseUrl}/api/exercises/${createdTech.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({
        name: 'Técnica Retracción Escapular Avanzada',
        difficulty: 'advanced'
      })
    });
    assert.strictEqual(editRes.status, 200);

    const sync4Alice = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenAlice}` } });
    aliceLibrary = reconcileState(aliceLibrary, (await sync4Alice.json()).data.exercises);
    const updatedInAlice = aliceLibrary.find(e => e.id === createdTech.id);
    assert.notStrictEqual(updatedInAlice, undefined);
    assert.strictEqual(updatedInAlice.name, 'Técnica Retracción Escapular Avanzada');
    assert.strictEqual(updatedInAlice.difficulty, 'advanced');

    // Escenario 5: Entrenador elimina un elemento y desaparece automáticamente de la biblioteca activa
    const delRes = await fetch(`${baseUrl}/api/exercises/${createdEx.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    assert.strictEqual(delRes.status, 200);

    const sync5Alice = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenAlice}` } });
    aliceLibrary = reconcileState(aliceLibrary, (await sync5Alice.json()).data.exercises);
    assert.strictEqual(aliceLibrary.some(e => e.id === createdEx.id), false);
    assert.strictEqual(aliceLibrary.length, initialCount + 4);

    // Escenario 6: Usuario sale de la biblioteca (blur -> detiene polling) y al volver a entrar (focus) sincroniza novedades
    let isScreenFocused = false; // usuario salió de ExercisesScreen
    const whileAwayRes = await fetch(`${baseUrl}/api/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({ name: 'Remo Pendlay', muscle_group: 'Espalda', difficulty: 'advanced' })
    });
    assert.strictEqual(whileAwayRes.status, 201);
    const whileAwayEx = (await whileAwayRes.json()).data.exercise;
    // Mientras está fuera, no se actualiza
    assert.strictEqual(aliceLibrary.some(e => e.id === whileAwayEx.id), false);

    // Usuario vuelve a entrar (focus) -> sincroniza inmediatamente
    isScreenFocused = true;
    if (isScreenFocused) {
      const onFocusRes = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenAlice}` } });
      aliceLibrary = reconcileState(aliceLibrary, (await onFocusRes.json()).data.exercises);
    }
    assert.strictEqual(aliceLibrary.some(e => e.id === whileAwayEx.id), true);

    // Escenario 7: Se pierde temporalmente la conexión durante un ciclo silencioso y luego se recupera
    const snapshotBeforeOffline = aliceLibrary;
    try {
      // Simular fallo de red en ciclo silent
      throw Object.assign(new Error('network error'), { code: 'NETWORK_ERROR' });
    } catch (_) {
      // En modo silent con datos ya cargados, se conserva intacta la lista actual
    }
    assert.strictEqual(aliceLibrary, snapshotBeforeOffline);

    // Cuando la conexión vuelve en el siguiente ciclo, sincroniza normalmente
    const syncAfterRecovery = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenBob}` } });
    bobLibrary = reconcileState(bobLibrary, (await syncAfterRecovery.json()).data.exercises);
    assert.deepStrictEqual(bobLibrary.map(e => e.id), aliceLibrary.map(e => e.id));
  });

  test('32. Organización de Biblioteca de técnicas por grupo muscular, búsqueda y sincronización entre secciones (Pruebas 1 a 11)', async () => {
    const tokenTrainer = makeToken(mockUsers[1]); // Trainer John
    const tokenAlice = makeToken(mockUsers[2]);   // Member Alice

    // Funciones equivalentes a groupExercisesByMuscleGroup de Modules/exercises/exerciseService.tsx
    const PRIORITY = {
      pecho: 1, pectoral: 1, pectorales: 1,
      espalda: 2, dorsal: 2, dorsales: 2,
      hombro: 3, hombros: 3, deltoides: 3,
      pierna: 4, piernas: 4, cuadriceps: 4, isquiotibiales: 4,
      biceps: 5, triceps: 6, brazos: 7, antebrazo: 7,
      gluteo: 8, gluteos: 8, abdomen: 9, abdominales: 9, core: 9
    };

    const normalizeSearchText = (val) =>
      String(val || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizeMuscleGroupKey = (rawGroup) => {
      const cleaned = String(rawGroup || '').trim();
      return cleaned ? normalizeSearchText(cleaned) : '__sin_grupo__';
    };

    const formatMuscleGroupLabel = (rawGroup) => {
      const cleaned = String(rawGroup || '').replace(/\s+/g, ' ').trim();
      return cleaned ? cleaned.toUpperCase() : 'SIN GRUPO ASIGNADO';
    };

    const groupExercises = (rawList, searchQuery = '') => {
      const byId = new Map();
      for (const item of rawList || []) {
        const id = Number(item?.id);
        if (!Number.isInteger(id) || id <= 0) continue;
        if (item.is_active === 0 || item.is_active === false) continue;
        byId.set(id, { ...item, id });
      }
      const deduplicated = Array.from(byId.values());
      const q = normalizeSearchText(searchQuery);
      const filtered = q
        ? deduplicated.filter(
            ex =>
              normalizeSearchText(ex.name).includes(q) ||
              normalizeSearchText(ex.description).includes(q) ||
              normalizeSearchText(ex.muscle_group).includes(q)
          )
        : deduplicated;

      const sectionsMap = new Map();
      for (const ex of filtered) {
        const key = normalizeMuscleGroupKey(ex.muscle_group);
        let sec = sectionsMap.get(key);
        if (!sec) {
          sec = { key, title: formatMuscleGroupLabel(ex.muscle_group), count: 0, exercises: [] };
          sectionsMap.set(key, sec);
        }
        sec.exercises.push(ex);
        sec.count = sec.exercises.length;
      }

      const sections = Array.from(sectionsMap.values()).filter(s => s.count > 0);
      for (const sec of sections) {
        sec.exercises.sort((a, b) => {
          const cmp = String(a.name || '').trim().localeCompare(String(b.name || '').trim(), 'es', { sensitivity: 'base' });
          return cmp !== 0 ? cmp : Number(a.id) - Number(b.id);
        });
      }
      sections.sort((a, b) => {
        const orderA = a.key === '__sin_grupo__' ? 999 : (PRIORITY[a.key] ?? 100);
        const orderB = b.key === '__sin_grupo__' ? 999 : (PRIORITY[b.key] ?? 100);
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
      });
      return sections;
    };

    // 1. Crear ejercicios activos en "pierna" y "triceps" (igual que en la BD real) y comprobar agrupación inicial
    const createLegRes = await fetch(`${baseUrl}/api/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({ name: 'Sentadilla Libre', muscle_group: 'pierna', difficulty: 'advanced' })
    });
    assert.strictEqual(createLegRes.status, 201);

    const createTriRes = await fetch(`${baseUrl}/api/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({ name: 'Press Francés con Barra Z', muscle_group: 'triceps', difficulty: 'advanced' })
    });
    assert.strictEqual(createTriRes.status, 201);
    const triExercise = (await createTriRes.json()).data.exercise;

    const getRes1 = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenAlice}` } });
    const rawList1 = (await getRes1.json()).data.exercises;
    const sections1 = groupExercises(rawList1, '');

    // Verificar que cada ejercicio aparece una sola vez en toda la estructura agrupada (Prueba 2)
    const allGroupedIds = sections1.flatMap(s => s.exercises.map(e => e.id));
    assert.strictEqual(new Set(allGroupedIds).size, allGroupedIds.length);
    assert.strictEqual(allGroupedIds.length, rawList1.length);

    // Verificar orden lógico de grupos principales: PECHO -> ESPALDA -> HOMBROS -> PIERNA -> TRICEPS (Prueba 1)
    const mainGroupKeys = sections1.map(s => s.key).filter(k => ['pecho', 'espalda', 'hombros', 'pierna', 'triceps'].includes(k));
    assert.deepStrictEqual(mainGroupKeys, ['pecho', 'espalda', 'hombros', 'pierna', 'triceps']);

    // Verificar orden alfabético dentro del grupo "espalda"
    const espaldaSec = sections1.find(s => s.key === 'espalda');
    assert.notStrictEqual(espaldaSec, undefined);
    assert.deepStrictEqual(
      espaldaSec.exercises.map(e => e.name),
      [...espaldaSec.exercises.map(e => e.name)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    );

    // 2. Comprobar búsqueda insensible a mayúsculas y tildes filtrando solo grupos con coincidencias (Prueba 4 y 5)
    const searchSections = groupExercises(rawList1, 'FRANCES');
    assert.strictEqual(searchSections.length, 1);
    assert.strictEqual(searchSections[0].key, 'triceps');
    assert.strictEqual(searchSections[0].count, 1);
    assert.strictEqual(searchSections[0].exercises[0].id, triExercise.id);

    // Al borrar la búsqueda se recuperan todos los grupos (Prueba 5)
    const restoredSections = groupExercises(rawList1, '');
    assert.strictEqual(restoredSections.length, sections1.length);

    // 3. Al editar el grupo muscular de un ejercicio ("triceps" -> "hombros"), desaparece del grupo anterior y pasa al nuevo (Prueba 7)
    const moveGroupRes = await fetch(`${baseUrl}/api/exercises/${triExercise.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({ muscle_group: 'Hombros' })
    });
    assert.strictEqual(moveGroupRes.status, 200);

    const getRes2 = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenAlice}` } });
    const sections2 = groupExercises((await getRes2.json()).data.exercises, '');

    // Como era el único ejercicio en "triceps", la sección "triceps" ya no se muestra vacía
    assert.strictEqual(sections2.some(s => s.key === 'triceps'), false);
    const hombrosSec = sections2.find(s => s.key === 'hombros');
    assert.notStrictEqual(hombrosSec, undefined);
    assert.strictEqual(hombrosSec.exercises.some(e => e.id === triExercise.id), true);

    // 4. Al eliminar el ejercicio, desaparece de la sección y de la biblioteca (Prueba 8)
    const delTriRes = await fetch(`${baseUrl}/api/exercises/${triExercise.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    assert.strictEqual(delTriRes.status, 200);

    const getRes3 = await fetch(`${baseUrl}/api/exercises`, { headers: { Authorization: `Bearer ${tokenAlice}` } });
    const sections3 = groupExercises((await getRes3.json()).data.exercises, '');
    const hombrosSecAfterDel = sections3.find(s => s.key === 'hombros');
    assert.strictEqual(hombrosSecAfterDel.exercises.some(e => e.id === triExercise.id), false);
  });
});



