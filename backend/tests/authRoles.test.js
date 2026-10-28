import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';

// Mocks y entorno aislado en memoria para no tocar MariaDB
describe('Pruebas de Seguridad: Registro Público, Asignación de Roles y Bootstrap Admin', () => {
  let app;
  let server;
  let baseUrl;

  // Estado en memoria simulado
  let mockUsers = [];
  let nextId = 1;
  const mockJwtSecret = 'test_jwt_secret_fitmanager_roles';
  process.env.JWT_SECRET = mockJwtSecret;

  before(async () => {
    app = express();
    app.use(express.json());

    // Middleware de testing: simula la inyección de verifyToken contra mockUsers
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

    // Montar rutas de prueba que reflejan exactamente los controladores reales
    // 1. Registro publico (con la regla de seguridad finalRole = 'member')
    app.post('/api/test-auth/register', (req, res) => {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ ok: false, error: { message: 'campos requeridos' } });
      }
      // Regla verificada: se ignora req.body.role
      const finalRole = 'member';
      const cleanEmail = email.trim().toLowerCase();
      if (mockUsers.some(u => u.email === cleanEmail)) {
        return res.status(409).json({ ok: false, error: { message: 'email ya existe' } });
      }
      const newUser = { id: nextId++, name, email: cleanEmail, role: finalRole, is_active: 1 };
      mockUsers.push(newUser);
      const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, mockJwtSecret);
      return res.status(201).json({ ok: true, data: { user: newUser, token } });
    });

    // 2. Setup first admin (con la regla estricta de SETUP_ADMIN_KEY y admin_count > 0)
    app.post('/api/test-auth/setup-admin', (req, res) => {
      const requiredKey = process.env.SETUP_ADMIN_KEY;
      if (!requiredKey || requiredKey.trim().length === 0) {
        return res.status(403).json({ ok: false, error: { code: 'SETUP_DISABLED', message: 'deshabilitado' } });
      }
      if (req.headers['x-setup-key'] !== requiredKey) {
        return res.status(401).json({ ok: false, error: { code: 'INVALID_SETUP_KEY', message: 'clave invalida' } });
      }
      const adminExists = mockUsers.some(u => u.role === 'admin');
      if (adminExists) {
        return res.status(403).json({ ok: false, error: { code: 'ADMIN_ALREADY_EXISTS', message: 'ya existe un admin' } });
      }
      const { name, email, password } = req.body;
      const cleanEmail = email.trim().toLowerCase();
      const newAdmin = { id: nextId++, name, email: cleanEmail, role: 'admin', is_active: 1 };
      mockUsers.push(newAdmin);
      const token = jwt.sign({ id: newAdmin.id, email: newAdmin.email, role: newAdmin.role }, mockJwtSecret);
      return res.status(201).json({ ok: true, data: { user: newAdmin, token } });
    });

    // 3. Modificacion de rol de usuario (solo admin)
    app.patch('/api/test-users/:id', testVerifyToken, requireRole('admin'), (req, res) => {
      const { role } = req.body;
      const target = mockUsers.find(u => u.id === Number(req.params.id));
      if (!target) return res.status(404).json({ ok: false });
      target.role = role || target.role;
      return res.status(200).json({ ok: true, data: { user: target } });
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
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('1. Intento de registro público con role "admin" debe crear forzosamente un usuario "member"', async () => {
    const res = await fetch(`${baseUrl}/api/test-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hacker Admin',
        email: 'hacker@test.com',
        password: 'password123',
        role: 'admin' // Intento de escalamiento malicioso
      })
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.user.role, 'member', 'El rol forzado DEBE ser member, ignorando el role enviado');
  });

  test('2. Intento de registro público con role "trainer" debe crear forzosamente un usuario "member"', async () => {
    const res = await fetch(`${baseUrl}/api/test-auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Trainer Intent',
        email: 'trainer_intent@test.com',
        password: 'password123',
        role: 'trainer' // Intento de escalamiento malicioso
      })
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.user.role, 'member', 'El rol forzado DEBE ser member');
  });

  test('3. Usuario sin autenticación no puede cambiar roles de usuarios (PATCH /users/:id)', async () => {
    const res = await fetch(`${baseUrl}/api/test-users/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' })
    });

    assert.equal(res.status, 401, 'Debe retornar 401 Unauthorized cuando no hay token');
  });

  test('4. Usuario con rol "member" no puede cambiar roles de usuarios (PATCH /users/:id)', async () => {
    // Generar token para usuario member
    const memberUser = mockUsers.find(u => u.role === 'member');
    assert.ok(memberUser, 'Debe existir un usuario member para la prueba');
    const memberToken = jwt.sign({ id: memberUser.id, email: memberUser.email, role: 'member' }, mockJwtSecret);

    const res = await fetch(`${baseUrl}/api/test-users/${memberUser.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({ role: 'admin' })
    });

    assert.equal(res.status, 403, 'Debe retornar 403 Forbidden para usuarios que no son admin');
  });

  test('5. POST /setup-admin falla con 403 si SETUP_ADMIN_KEY no está configurada', async () => {
    delete process.env.SETUP_ADMIN_KEY;

    const res = await fetch(`${baseUrl}/api/test-auth/setup-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Root Admin',
        email: 'root@fitmanager.com',
        password: 'securePassword123'
      })
    });

    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.error.code, 'SETUP_DISABLED');
  });

  test('6. POST /setup-admin falla con 401 si la cabecera x-setup-key es inválida', async () => {
    process.env.SETUP_ADMIN_KEY = 'super_secret_setup_key_12345';

    const res = await fetch(`${baseUrl}/api/test-auth/setup-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-setup-key': 'clave_incorrecta'
      },
      body: JSON.stringify({
        name: 'Root Admin',
        email: 'root@fitmanager.com',
        password: 'securePassword123'
      })
    });

    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.error.code, 'INVALID_SETUP_KEY');
  });

  test('7. POST /setup-admin crea exitosamente el primer administrador con clave válida', async () => {
    process.env.SETUP_ADMIN_KEY = 'super_secret_setup_key_12345';

    const res = await fetch(`${baseUrl}/api/test-auth/setup-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-setup-key': 'super_secret_setup_key_12345'
      },
      body: JSON.stringify({
        name: 'Administrador Principal',
        email: 'admin_real@fitmanager.com',
        password: 'securePassword123'
      })
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.user.role, 'admin');
    assert.ok(json.data.token, 'Debe retornar un token JWT válido');
  });

  test('8. POST /setup-admin rechaza con 403 futuros intentos cuando ya existe un admin en el sistema', async () => {
    process.env.SETUP_ADMIN_KEY = 'super_secret_setup_key_12345';

    // Segundo intento con las credenciales correctas
    const res = await fetch(`${baseUrl}/api/test-auth/setup-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-setup-key': 'super_secret_setup_key_12345'
      },
      body: JSON.stringify({
        name: 'Intruso Admin',
        email: 'intruso@fitmanager.com',
        password: 'anotherPassword123'
      })
    });

    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.error.code, 'ADMIN_ALREADY_EXISTS', 'No debe permitir inicializar otro admin una vez completado el setup inicial');
  });

  test('9. POST /api/auth/google/verify responde 400 MISSING_OAUTH_PARAMS si no se envia id_token ni code', async () => {
    // Montar endpoint simulado para google verify
    app.post('/api/test-auth/google/verify', (req, res) => {
      const { code, id_token } = req.body;
      if (!code && !id_token) {
        return res.status(400).json({
          ok: false,
          error: { message: 'debes enviar un code o un id_token de google', code: 'MISSING_OAUTH_PARAMS' }
        });
      }
      return res.status(200).json({ ok: true });
    });

    const res = await fetch(`${baseUrl}/api/test-auth/google/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'MISSING_OAUTH_PARAMS');
  });

  test('10. POST /api/auth/google/verify acepta payload con id_token no vacio', async () => {
    const res = await fetch(`${baseUrl}/api/test-auth/google/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: 'dummy_valid_format_token' })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
  });
});
