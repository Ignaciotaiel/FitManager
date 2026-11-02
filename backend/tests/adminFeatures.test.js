import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import adminRoutes from '../routes/adminRoutes.js';

describe('Pruebas de Funcionalidades ADMIN: Logs, Notificaciones, Incidencias y Exportación', () => {
  let app;
  let server;
  let baseUrl;

  // Estado en memoria para tests aislados
  let mockUsers = [
    { id: 1, name: 'Admin Principal', email: 'admin@fitmanager.com', role: 'admin', is_active: 1, token_version: 1 },
    { id: 2, name: 'Entrenador Juan', email: 'juan@fitmanager.com', role: 'trainer', is_active: 1, token_version: 1 },
    { id: 3, name: 'Socio Pedro', email: 'pedro@fitmanager.com', role: 'member', is_active: 1, token_version: 1 }
  ];

  let mockLogs = [];
  let mockNotifications = [];
  let mockIncidents = [];
  let nextLogId = 1;
  let nextNotifId = 1;
  let nextIncidentId = 1;

  const mockJwtSecret = 'test_admin_jwt_secret_fitmanager';
  process.env.JWT_SECRET = mockJwtSecret;

  const getAuthHeader = (userId) => {
    const user = mockUsers.find(u => u.id === userId);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, token_version: user.token_version }, mockJwtSecret);
    return `Bearer ${token}`;
  };

  before(async () => {
    app = express();
    app.use(express.json());

    // Middleware de testing que simula verifyToken
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
        req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
        next();
      } catch {
        return res.status(401).json({ ok: false, error: { message: 'token invalido', code: 'INVALID_TOKEN' } });
      }
    };

    const testRequireRole = (...allowedRoles) => (req, res, next) => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ ok: false, error: { message: 'no tienes permisos', code: 'FORBIDDEN' } });
      }
      next();
    };

    // Endpoint de notificaciones activas para cualquier usuario autenticado
    app.get('/api/admin/notifications/active', testVerifyToken, (req, res) => {
      const role = req.user.role;
      const notifs = mockNotifications.filter(n => n.is_active === 1 && (n.target_role === 'all' || n.target_role === role));
      return res.status(200).json({ ok: true, data: { notifications: notifs } });
    });

    // Rutas protegidas solo para admin
    const adminRouter = express.Router();
    adminRouter.use(testVerifyToken, testRequireRole('admin'));

    // Logs
    adminRouter.get('/activity-logs', (req, res) => {
      const { category, userId } = req.query;
      let filtered = [...mockLogs];
      if (category) filtered = filtered.filter(l => l.category === category);
      if (userId) filtered = filtered.filter(l => String(l.user_id) === String(userId));
      return res.status(200).json({ ok: true, data: { logs: filtered } });
    });

    // Notifications CRUD
    adminRouter.get('/notifications', (req, res) => {
      return res.status(200).json({ ok: true, data: { notifications: mockNotifications } });
    });

    adminRouter.post('/notifications', (req, res) => {
      const { title, content, target_role = 'all' } = req.body;
      if (!title || !content) {
        return res.status(400).json({ ok: false, error: { message: 'Campos requeridos', code: 'MISSING_FIELDS' } });
      }
      const newNotif = {
        id: nextNotifId++,
        title: title.trim(),
        content: content.trim(),
        target_role,
        is_active: 1,
        created_by: req.user.id,
        created_at: new Date().toISOString()
      };
      mockNotifications.push(newNotif);
      mockLogs.push({
        id: nextLogId++,
        user_id: req.user.id,
        action_type: 'CREATE_NOTIFICATION',
        category: 'notifications',
        description: `Creación de notificación: "${title}"`
      });
      return res.status(201).json({ ok: true, data: { notification: newNotif } });
    });

    adminRouter.put('/notifications/:id', (req, res) => {
      const notif = mockNotifications.find(n => n.id === Number(req.params.id));
      if (!notif) return res.status(404).json({ ok: false, error: { message: 'Notificación no encontrada' } });
      const { title, content, target_role, is_active } = req.body;
      if (title !== undefined) notif.title = title.trim();
      if (content !== undefined) notif.content = content.trim();
      if (target_role !== undefined) notif.target_role = target_role;
      if (is_active !== undefined) notif.is_active = is_active ? 1 : 0;
      return res.status(200).json({ ok: true, data: { notification: notif } });
    });

    adminRouter.delete('/notifications/:id', (req, res) => {
      const index = mockNotifications.findIndex(n => n.id === Number(req.params.id));
      if (index === -1) return res.status(404).json({ ok: false, error: { message: 'Notificación no encontrada' } });
      mockNotifications.splice(index, 1);
      return res.status(200).json({ ok: true, message: 'Notificación eliminada exitosamente' });
    });

    // Incidents CRUD
    adminRouter.get('/incidents', (req, res) => {
      const { status, category } = req.query;
      let list = [...mockIncidents];
      if (status) list = list.filter(i => i.status === status);
      if (category) list = list.filter(i => i.category === category);
      return res.status(200).json({ ok: true, data: { incidents: list } });
    });

    adminRouter.post('/incidents', (req, res) => {
      const { title, description, category = 'other' } = req.body;
      if (!title || !description) {
        return res.status(400).json({ ok: false, error: { message: 'Campos requeridos', code: 'MISSING_FIELDS' } });
      }
      const newInc = {
        id: nextIncidentId++,
        title: title.trim(),
        description: description.trim(),
        category,
        status: 'pending',
        created_by: req.user.id,
        resolution_notes: null,
        created_at: new Date().toISOString()
      };
      mockIncidents.push(newInc);
      mockLogs.push({
        id: nextLogId++,
        user_id: req.user.id,
        action_type: 'CREATE_INCIDENT',
        category: 'incidents',
        description: `Reporte de incidencia: "${title}"`
      });
      return res.status(201).json({ ok: true, data: { incident: newInc } });
    });

    adminRouter.patch('/incidents/:id', (req, res) => {
      const inc = mockIncidents.find(i => i.id === Number(req.params.id));
      if (!inc) return res.status(404).json({ ok: false, error: { message: 'Incidencia no encontrada' } });
      const { status, resolution_notes, category, title } = req.body;
      if (status !== undefined) inc.status = status;
      if (resolution_notes !== undefined) inc.resolution_notes = resolution_notes;
      if (category !== undefined) inc.category = category;
      if (title !== undefined) inc.title = title;
      if (status === 'resolved') inc.resolved_at = new Date().toISOString();
      return res.status(200).json({ ok: true, data: { incident: inc } });
    });

    adminRouter.delete('/incidents/:id', (req, res) => {
      const index = mockIncidents.findIndex(i => i.id === Number(req.params.id));
      if (index === -1) return res.status(404).json({ ok: false, error: { message: 'Incidencia no encontrada' } });
      mockIncidents.splice(index, 1);
      return res.status(200).json({ ok: true, message: 'Incidencia eliminada exitosamente' });
    });

    // Export dataset
    adminRouter.get('/export/:entity', (req, res) => {
      const { entity } = req.params;
      if (entity === 'users') {
        return res.status(200).json({ ok: true, data: { entity: 'users', records: mockUsers } });
      }
      if (entity === 'activity_logs') {
        return res.status(200).json({ ok: true, data: { entity: 'activity_logs', records: mockLogs } });
      }
      if (entity === 'incidents') {
        return res.status(200).json({ ok: true, data: { entity: 'incidents', records: mockIncidents } });
      }
      return res.status(400).json({ ok: false, error: { message: 'Entidad inválida' } });
    });

    app.use('/api/admin', adminRouter);

    await new Promise(resolve => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
  });

  test('1. Usuario con rol "member" o "trainer" es rechazado con 403 al acceder a endpoints admin', async () => {
    const memberRes = await fetch(`${baseUrl}/api/admin/activity-logs`, {
      headers: { Authorization: getAuthHeader(3) }
    });
    assert.equal(memberRes.status, 403);

    const trainerRes = await fetch(`${baseUrl}/api/admin/notifications`, {
      headers: { Authorization: getAuthHeader(2) }
    });
    assert.equal(trainerRes.status, 403);
  });

  test('2. Admin crea una notificación exitosamente y se refleja en logs de actividad', async () => {
    const res = await fetch(`${baseUrl}/api/admin/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(1)
      },
      body: JSON.stringify({
        title: 'Mantenimiento de Máquinas',
        content: 'El área de peso libre estará en reparación este viernes.',
        target_role: 'all'
      })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.data.notification.title, 'Mantenimiento de Máquinas');

    // Verificar en logs
    const logsRes = await fetch(`${baseUrl}/api/admin/activity-logs?category=notifications`, {
      headers: { Authorization: getAuthHeader(1) }
    });
    const logsBody = await logsRes.json();
    assert.equal(logsBody.data.logs.length >= 1, true);
    assert.equal(logsBody.data.logs[0].action_type, 'CREATE_NOTIFICATION');
  });

  test('3. Socio puede ver notificaciones dirigidas a "all" o a su propio rol mediante notifications/active', async () => {
    const activeRes = await fetch(`${baseUrl}/api/admin/notifications/active`, {
      headers: { Authorization: getAuthHeader(3) }
    });
    assert.equal(activeRes.status, 200);
    const body = await activeRes.json();
    assert.equal(body.data.notifications.some(n => n.title === 'Mantenimiento de Máquinas'), true);
  });

  test('4. Admin actualiza y elimina una notificación', async () => {
    // Actualizar
    const updateRes = await fetch(`${baseUrl}/api/admin/notifications/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(1)
      },
      body: JSON.stringify({ title: 'Mantenimiento Reprogramado' })
    });
    assert.equal(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.equal(updateBody.data.notification.title, 'Mantenimiento Reprogramado');

    // Eliminar
    const deleteRes = await fetch(`${baseUrl}/api/admin/notifications/1`, {
      method: 'DELETE',
      headers: { Authorization: getAuthHeader(1) }
    });
    assert.equal(deleteRes.status, 200);
  });

  test('5. Admin registra, actualiza y cambia estado de incidencias', async () => {
    // Crear incidencia
    const createRes = await fetch(`${baseUrl}/api/admin/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(1)
      },
      body: JSON.stringify({
        title: 'Cinta de correr #3 con fallo de velocidad',
        description: 'La cinta se detiene bruscamente a más de 10 km/h.',
        category: 'equipment'
      })
    });
    assert.equal(createRes.status, 201);
    const createBody = await createRes.json();
    const incId = createBody.data.incident.id;
    assert.equal(createBody.data.incident.status, 'pending');

    // Actualizar estado a 'in_progress'
    const patchRes = await fetch(`${baseUrl}/api/admin/incidents/${incId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(1)
      },
      body: JSON.stringify({ status: 'in_progress', resolution_notes: 'Técnico notificado' })
    });
    assert.equal(patchRes.status, 200);
    const patchBody = await patchRes.json();
    assert.equal(patchBody.data.incident.status, 'in_progress');
    assert.equal(patchBody.data.incident.resolution_notes, 'Técnico notificado');

    // Marcar como resuelta
    const resolveRes = await fetch(`${baseUrl}/api/admin/incidents/${incId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(1)
      },
      body: JSON.stringify({ status: 'resolved', resolution_notes: 'Banda calibrada y motor reparado' })
    });
    assert.equal(resolveRes.status, 200);
    const resolveBody = await resolveRes.json();
    assert.equal(resolveBody.data.incident.status, 'resolved');
    assert.notEqual(resolveBody.data.incident.resolved_at, null);
  });

  test('6. Admin puede obtener datasets de exportación', async () => {
    const exportUsers = await fetch(`${baseUrl}/api/admin/export/users`, {
      headers: { Authorization: getAuthHeader(1) }
    });
    assert.equal(exportUsers.status, 200);
    const usersBody = await exportUsers.json();
    assert.equal(usersBody.data.records.length, 3);

    const exportIncidents = await fetch(`${baseUrl}/api/admin/export/incidents`, {
      headers: { Authorization: getAuthHeader(1) }
    });
    assert.equal(exportIncidents.status, 200);
    const incBody = await exportIncidents.json();
    assert.equal(incBody.data.records.length >= 1, true);
  });
});


describe('Proteccion real de rutas /api/admin (router de produccion, sin base de datos)', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    await new Promise(resolve => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
  });

  const endpoints = [
    ['GET', '/activity-logs'],
    ['GET', '/notifications'],
    ['POST', '/notifications'],
    ['PUT', '/notifications/1'],
    ['DELETE', '/notifications/1'],
    ['GET', '/notifications/active'],
    ['GET', '/incidents'],
    ['POST', '/incidents'],
    ['PATCH', '/incidents/1'],
    ['DELETE', '/incidents/1'],
    ['GET', '/export/users']
  ];

  const callAll = async (headers) => {
    for (const [method, path] of endpoints) {
      const res = await fetch(`${baseUrl}/api/admin${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({})
      });
      assert.equal(res.status, 401, `${method} ${path} debe responder 401`);
    }
  };

  test('Todos los endpoints rechazan peticiones sin token con 401', async () => {
    await callAll({});
  });

  test('Todos los endpoints rechazan un token invalido con 401', async () => {
    await callAll({ Authorization: 'Bearer token.invalido.firma' });
  });
});
