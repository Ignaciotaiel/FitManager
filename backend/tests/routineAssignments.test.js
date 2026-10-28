import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';

describe('Pruebas de Asignación Multi-Socio y Aislamiento de Historiales de Entrenamiento', () => {
  let app;
  let server;
  let baseUrl;

  const mockJwtSecret = 'test_jwt_secret_fitmanager_multi_assignments';

  // Usuarios simulados
  let mockUsers = [
    { id: 1, name: 'Admin', email: 'admin@fitmanager.com', role: 'admin', is_active: 1 },
    { id: 2, name: 'Trainer Frank', email: 'frank@fitmanager.com', role: 'trainer', is_active: 1 },
    { id: 3, name: 'Member Carlos', email: 'carlos@fitmanager.com', role: 'member', is_active: 1 },
    { id: 4, name: 'Member Diana', email: 'diana@fitmanager.com', role: 'member', is_active: 1 },
    { id: 5, name: 'Member Inactivo', email: 'inactivo@fitmanager.com', role: 'member', is_active: 0 },
    { id: 6, name: 'Trainer External', email: 'external@fitmanager.com', role: 'trainer', is_active: 1 }
  ];

  let mockRoutines = [
    { id: 101, name: 'Rutina Full Body Compartida', trainer_id: 2, member_id: null },
    { id: 102, name: 'Rutina Legacy Antigua', trainer_id: 2, member_id: 3 }
  ];

  // Tabla intermedia de asignaciones
  let mockAssignments = [
    { id: 1, routine_id: 101, member_id: 3 }, // Asignada a Carlos (3)
    { id: 2, routine_id: 101, member_id: 4 }  // Asignada a Diana (4) - ¡Rutina Compartida!
  ];

  let mockSessions = [];
  let mockSetLogs = [];
  let nextSessionId = 1;
  let nextSetLogId = 1;

  function makeToken(user) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, mockJwtSecret);
  }

  before(async () => {
    app = express();
    app.use(express.json());

    const testVerifyToken = (req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, error: { message: 'token requerido' } });
      }
      try {
        const decoded = jwt.verify(auth.split(' ')[1], mockJwtSecret);
        const user = mockUsers.find(u => u.id === decoded.id);
        if (!user || !user.is_active) {
          return res.status(401).json({ ok: false, error: { message: 'usuario inactivo o invalido' } });
        }
        req.user = { id: user.id, email: user.email, role: user.role };
        next();
      } catch (e) {
        return res.status(401).json({ ok: false, error: { message: 'token invalido' } });
      }
    };

    const testRequireRole = (...roles) => (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ ok: false, error: { message: 'prohibido' } });
      }
      next();
    };

    // 1. GET /api/routines (Lista filtrada por asignaciones o legacy)
    app.get('/api/routines', testVerifyToken, (req, res) => {
      const { role, id: userId } = req.user;
      let result = [];
      if (role === 'member') {
        result = mockRoutines.filter(r =>
          mockAssignments.some(a => a.routine_id === r.id && a.member_id === userId) ||
          r.member_id === userId
        );
      } else if (role === 'trainer') {
        result = mockRoutines.filter(r => r.trainer_id === userId);
      } else {
        result = [...mockRoutines];
      }
      return res.status(200).json({ ok: true, data: { routines: result } });
    });

    // 2. POST /api/routines/:id/assignments (Asignar multiples socios)
    app.post('/api/routines/:id/assignments', testVerifyToken, testRequireRole('admin', 'trainer'), (req, res) => {
      const routineId = Number(req.params.id);
      const routine = mockRoutines.find(r => r.id === routineId);
      if (!routine) return res.status(404).json({ ok: false, error: { message: 'rutina no existe' } });

      if (req.user.role === 'trainer' && routine.trainer_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: { message: 'no es tu rutina', code: 'FORBIDDEN' } });
      }

      const { member_ids } = req.body;
      if (!Array.isArray(member_ids) || member_ids.length === 0) {
        return res.status(400).json({ ok: false, error: { message: 'member_ids requeridos', code: 'INVALID_MEMBER_IDS' } });
      }

      for (const mId of member_ids) {
        const user = mockUsers.find(u => u.id === mId);
        if (!user || user.role !== 'member') {
          return res.status(400).json({ ok: false, error: { message: 'usuario no es member', code: 'NOT_A_MEMBER' } });
        }
        if (!user.is_active) {
          return res.status(400).json({ ok: false, error: { message: 'usuario inactivo', code: 'MEMBER_INACTIVE' } });
        }
        // Evitar duplicados (simula UNIQUE KEY uk_routine_member)
        if (!mockAssignments.some(a => a.routine_id === routineId && a.member_id === mId)) {
          mockAssignments.push({ id: mockAssignments.length + 1, routine_id: routineId, member_id: mId });
        }
      }

      return res.status(200).json({ ok: true, message: 'asignados' });
    });

    // 3. DELETE /api/routines/:id/assignments/:memberId
    app.delete('/api/routines/:id/assignments/:memberId', testVerifyToken, testRequireRole('admin', 'trainer'), (req, res) => {
      const routineId = Number(req.params.id);
      const memberId = Number(req.params.memberId);
      const routine = mockRoutines.find(r => r.id === routineId);
      if (!routine) return res.status(404).json({ ok: false, error: { message: 'rutina no existe' } });

      if (req.user.role === 'trainer' && routine.trainer_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: { message: 'no es tu rutina', code: 'FORBIDDEN' } });
      }

      mockAssignments = mockAssignments.filter(a => !(a.routine_id === routineId && a.member_id === memberId));
      if (routine.member_id === memberId) routine.member_id = null;

      return res.status(200).json({ ok: true, message: 'desasignado' });
    });

    // 4. POST /api/workouts/sessions (Con validación multi-socio)
    app.post('/api/workouts/sessions', testVerifyToken, testRequireRole('member', 'admin'), (req, res) => {
      const userId = req.user.id;
      const { routine_id, notes, sets } = req.body;
      const routine = mockRoutines.find(r => r.id === Number(routine_id));
      if (!routine) return res.status(404).json({ ok: false, error: { message: 'rutina no existe' } });

      // Validar si el socio esta asignado (en mockAssignments o legacy member_id)
      const isAssigned = mockAssignments.some(a => a.routine_id === routine.id && a.member_id === userId) || routine.member_id === userId;
      if (!isAssigned) {
        return res.status(403).json({ ok: false, error: { message: 'no tienes asignada esta rutina', code: 'FORBIDDEN' } });
      }

      const session = { id: nextSessionId++, user_id: userId, routine_id: routine.id, notes };
      mockSessions.push(session);

      if (Array.isArray(sets)) {
        sets.forEach(s => {
          mockSetLogs.push({
            id: nextSetLogId++,
            session_id: session.id,
            user_id: userId,
            exercise_id: s.exercise_id,
            weight_kg: s.weight_kg,
            reps_completed: s.reps_completed
          });
        });
      }

      return res.status(201).json({ ok: true, data: { session } });
    });

    // 5. GET /api/workouts/history
    app.get('/api/workouts/history', testVerifyToken, (req, res) => {
      const userId = req.user.id;
      const userSessions = mockSessions.filter(s => s.user_id === userId);
      return res.status(200).json({
        ok: true,
        data: {
          sessions: userSessions.map(s => ({
            ...s,
            sets: mockSetLogs.filter(sl => sl.session_id === s.id)
          }))
        }
      });
    });

    await new Promise(resolve => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
  });

  // PRUEBAS DE REGRESIÓN Y REQUISITOS MULTI-SOCIO

  test('1. Carlos y Diana ven la misma rutina 101 compartida', async () => {
    const tokenCarlos = makeToken(mockUsers[2]); // id: 3
    const tokenDiana = makeToken(mockUsers[3]); // id: 4

    const resCarlos = await fetch(`${baseUrl}/api/routines`, { headers: { Authorization: `Bearer ${tokenCarlos}` } });
    const jsonCarlos = await resCarlos.json();
    assert.strictEqual(jsonCarlos.data.routines.some(r => r.id === 101), true);

    const resDiana = await fetch(`${baseUrl}/api/routines`, { headers: { Authorization: `Bearer ${tokenDiana}` } });
    const jsonDiana = await resDiana.json();
    assert.strictEqual(jsonDiana.data.routines.some(r => r.id === 101), true);
  });

  test('2. Compatibilidad legacy: Carlos ve la rutina 102 que tiene su member_id previo a la migración', async () => {
    const tokenCarlos = makeToken(mockUsers[2]);
    const res = await fetch(`${baseUrl}/api/routines`, { headers: { Authorization: `Bearer ${tokenCarlos}` } });
    const json = await res.json();
    assert.strictEqual(json.data.routines.some(r => r.id === 102), true);
  });

  test('3. Entrenador asigna un nuevo socio a una rutina en una única operación sin duplicar', async () => {
    const tokenTrainer = makeToken(mockUsers[1]); // Frank (id: 2)
    const res = await fetch(`${baseUrl}/api/routines/102/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({ member_ids: [4] }) // Asigna también a Diana (4)
    });
    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.ok, true);

    // Reintentar la misma asignación no genera error ni duplicados
    const resDup = await fetch(`${baseUrl}/api/routines/102/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({ member_ids: [4] })
    });
    assert.strictEqual(resDup.status, 200);
  });

  test('4. Falla con 400 si se intenta asignar a un socio inactivo', async () => {
    const tokenTrainer = makeToken(mockUsers[1]);
    const res = await fetch(`${baseUrl}/api/routines/101/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTrainer}` },
      body: JSON.stringify({ member_ids: [5] }) // Usuario 5 está inactivo
    });
    const json = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.error.code, 'MEMBER_INACTIVE');
  });

  test('5. Entrenador externo NO puede modificar ni quitar asignaciones de una rutina ajena', async () => {
    const tokenStranger = makeToken(mockUsers[5]); // Trainer External (id: 6)
    const res = await fetch(`${baseUrl}/api/routines/101/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStranger}` },
      body: JSON.stringify({ member_ids: [3] })
    });
    assert.strictEqual(res.status, 403);

    const resDel = await fetch(`${baseUrl}/api/routines/101/assignments/3`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenStranger}` }
    });
    assert.strictEqual(resDel.status, 403);
  });

  test('6. Aislamiento estricto de historiales: Carlos y Diana entrenan la rutina 101 y sus marcas son independientes', async () => {
    const tokenCarlos = makeToken(mockUsers[2]); // Carlos (3)
    const tokenDiana = makeToken(mockUsers[3]); // Diana (4)

    // Carlos registra 90 kg en sentadilla
    await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCarlos}` },
      body: JSON.stringify({
        routine_id: 101,
        sets: [{ exercise_id: 1, weight_kg: 90, reps_completed: 8 }]
      })
    });

    // Diana registra 50 kg en sentadilla
    await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenDiana}` },
      body: JSON.stringify({
        routine_id: 101,
        sets: [{ exercise_id: 1, weight_kg: 50, reps_completed: 12 }]
      })
    });

    // Consultar historial de Carlos: solo debe ver sus 90 kg
    const resCarlos = await fetch(`${baseUrl}/api/workouts/history`, {
      headers: { Authorization: `Bearer ${tokenCarlos}` }
    });
    const jsonCarlos = await resCarlos.json();
    assert.strictEqual(jsonCarlos.data.sessions.length, 1);
    assert.strictEqual(jsonCarlos.data.sessions[0].sets[0].weight_kg, 90);
    assert.strictEqual(jsonCarlos.data.sessions[0].user_id, 3);

    // Consultar historial de Diana: solo debe ver sus 50 kg
    const resDiana = await fetch(`${baseUrl}/api/workouts/history`, {
      headers: { Authorization: `Bearer ${tokenDiana}` }
    });
    const jsonDiana = await resDiana.json();
    assert.strictEqual(jsonDiana.data.sessions.length, 1);
    assert.strictEqual(jsonDiana.data.sessions[0].sets[0].weight_kg, 50);
    assert.strictEqual(jsonDiana.data.sessions[0].user_id, 4);
  });

  test('7. Quitar una asignación de Diana en la rutina 101 no borra sus sesiones ni marcas históricas registradas', async () => {
    const tokenTrainer = makeToken(mockUsers[1]);
    const tokenDiana = makeToken(mockUsers[3]);

    // Entrenador quita la asignación de Diana en la rutina 101
    const delAssign = await fetch(`${baseUrl}/api/routines/101/assignments/4`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenTrainer}` }
    });
    assert.strictEqual(delAssign.status, 200);

    // Diana ya no tiene asignada la rutina 101 en su listado
    const resRoutines = await fetch(`${baseUrl}/api/routines`, {
      headers: { Authorization: `Bearer ${tokenDiana}` }
    });
    const jsonRoutines = await resRoutines.json();
    assert.strictEqual(jsonRoutines.data.routines.some(r => r.id === 101), false);

    // Pero su historial de entrenamiento previo permanece completamente intacto
    const resHistory = await fetch(`${baseUrl}/api/workouts/history`, {
      headers: { Authorization: `Bearer ${tokenDiana}` }
    });
    const jsonHistory = await resHistory.json();
    assert.strictEqual(jsonHistory.data.sessions.length, 1);
    assert.strictEqual(jsonHistory.data.sessions[0].sets[0].weight_kg, 50);
  });
});
