import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../services/emailService.js';

describe('Pruebas Exhaustivas: Verificación de Correo Electrónico en Registro', () => {
  let app;
  let server;
  let baseUrl;

  // Estado en memoria simulado que reproduce exactamente las tablas MariaDB
  let mockUsers = [];
  let mockAuthCodes = [];
  let sentEmails = [];
  let nextUserId = 1;
  let nextCodeId = 1;

  const mockJwtSecret = 'test_jwt_secret_email_verification';
  const SALT_ROUNDS = 4; // Rápido para tests
  const MAX_ATTEMPTS = 5;

  function hashVerificationCode(code) {
    return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
  }

  function generate6DigitCode() {
    return String(crypto.randomInt(100000, 1000000));
  }

  before(async () => {
    app = express();
    app.use(express.json());

    // 1. Endpoint simulado: Registro con verificación
    app.post('/api/auth/register', async (req, res) => {
      if (process.env.MAINTENANCE_REGISTRATION === 'true') {
        return res.status(503).json({
          ok: false,
          error: {
            message: 'el registro de nuevos usuarios se encuentra temporalmente en mantenimiento',
            code: 'REGISTRATION_TEMPORARILY_DISABLED'
          }
        });
      }

      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ ok: false, error: { message: 'datos incompletos' } });
      }

      const cleanEmail = email.trim().toLowerCase();
      if (mockUsers.some(u => u.email === cleanEmail)) {
        return res.status(409).json({ ok: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'correo ya registrado' } });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const newUser = {
        id: nextUserId++,
        name: name.trim(),
        email: cleanEmail,
        password_hash: passwordHash,
        role: 'member',
        is_active: 1,
        email_verified_at: null // Pendiente de verificación
      };
      mockUsers.push(newUser);

      // Generar código de 6 dígitos
      const code = generate6DigitCode();
      const codeHash = hashVerificationCode(code);
      const codeRow = {
        id: nextCodeId++,
        user_id: newUser.id,
        code_hash: codeHash,
        type: 'email_verification',
        attempts: 0,
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 min
        used_at: null,
        created_at: new Date()
      };
      mockAuthCodes.push(codeRow);

      // Registro de email enviado (sin exponer en respuesta)
      sentEmails.push({ to: cleanEmail, code });

      return res.status(201).json({
        ok: true,
        message: 'cuenta creada exitosamente. enviamos un código de verificación a tu correo',
        data: {
          requires_verification: true,
          email: cleanEmail,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            is_active: newUser.is_active
          }
        }
      });
    });

    // 2. Endpoint simulado: Login con comprobación de email_verified_at
    app.post('/api/auth/login', async (req, res) => {
      const { email, password } = req.body;
      const cleanEmail = email?.trim().toLowerCase();
      const user = mockUsers.find(u => u.email === cleanEmail);

      if (!user) {
        return res.status(401).json({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'credenciales incorrectas' } });
      }

      if (!user.is_active) {
        return res.status(403).json({ ok: false, error: { code: 'ACCOUNT_INACTIVE', message: 'la cuenta se encuentra desactivada' } });
      }

      if (!user.password_hash) {
        return res.status(400).json({ ok: false, error: { code: 'SOCIAL_ACCOUNT_ONLY', message: 'cuenta solo social' } });
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'credenciales incorrectas' } });
      }

      // Regla de verificación
      if (user.email_verified_at === null) {
        return res.status(403).json({
          ok: false,
          error: { code: 'EMAIL_NOT_VERIFIED', message: 'debes verificar tu correo electronico antes de iniciar sesion' },
          data: { requires_verification: true, email: user.email }
        });
      }

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, mockJwtSecret, { expiresIn: '7d' });
      return res.status(200).json({
        ok: true,
        data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }
      });
    });

    // 3. Endpoint simulado: Verificar código
    app.post('/api/auth/verify-email', (req, res) => {
      const { email, code } = req.body;
      if (!email || !code || !/^\d{6}$/.test(String(code).trim())) {
        return res.status(400).json({ ok: false, error: { code: 'INVALID_CODE_FORMAT', message: 'codigo invalido' } });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = mockUsers.find(u => u.email === cleanEmail);
      if (!user) {
        return res.status(404).json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'usuario no encontrado' } });
      }

      if (!user.is_active) {
        return res.status(403).json({ ok: false, error: { code: 'ACCOUNT_INACTIVE', message: 'cuenta desactivada' } });
      }

      if (user.email_verified_at !== null) {
        return res.status(200).json({ ok: true, data: { already_verified: true, email: user.email } });
      }

      // Buscar último código
      const codes = mockAuthCodes
        .filter(c => c.user_id === user.id && c.type === 'email_verification')
        .sort((a, b) => b.id - a.id);

      if (codes.length === 0) {
        return res.status(400).json({ ok: false, error: { code: 'NO_CODE_FOUND', message: 'no hay codigo activo' } });
      }

      const activeCode = codes[0];

      if (activeCode.used_at !== null) {
        return res.status(400).json({ ok: false, error: { code: 'CODE_ALREADY_USED', message: 'codigo ya utilizado' } });
      }

      if (activeCode.attempts >= MAX_ATTEMPTS) {
        activeCode.used_at = new Date();
        return res.status(400).json({ ok: false, error: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'maximo intentos superado' } });
      }

      if (Date.now() > new Date(activeCode.expires_at).getTime()) {
        activeCode.used_at = new Date();
        return res.status(400).json({ ok: false, error: { code: 'CODE_EXPIRED', message: 'codigo expirado' } });
      }

      const inputHash = hashVerificationCode(code);
      if (inputHash !== activeCode.code_hash) {
        activeCode.attempts += 1;
        const remaining = Math.max(0, MAX_ATTEMPTS - activeCode.attempts);
        return res.status(400).json({
          ok: false,
          error: { code: 'INVALID_CODE', message: `codigo incorrecto`, remaining_attempts: remaining }
        });
      }

      // Código correcto
      activeCode.used_at = new Date();
      user.email_verified_at = new Date();

      return res.status(200).json({
        ok: true,
        message: 'correo electronico verificado exitosamente',
        data: { verified: true, email: user.email }
      });
    });

    // 4. Endpoint simulado: Reenviar código
    app.post('/api/auth/resend-verification', (req, res) => {
      const { email } = req.body;
      const cleanEmail = email?.trim().toLowerCase();
      const user = mockUsers.find(u => u.email === cleanEmail);

      if (!user) {
        return res.status(404).json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'usuario no encontrado' } });
      }

      if (!user.is_active) {
        return res.status(403).json({ ok: false, error: { code: 'ACCOUNT_INACTIVE', message: 'cuenta desactivada' } });
      }

      if (user.email_verified_at !== null) {
        return res.status(400).json({ ok: false, error: { code: 'ALREADY_VERIFIED', message: 'ya verificado' } });
      }

      // Invalidar anteriores
      mockAuthCodes
        .filter(c => c.user_id === user.id && c.type === 'email_verification' && c.used_at === null)
        .forEach(c => { c.used_at = new Date(); });

      // Generar nuevo
      const code = generate6DigitCode();
      const codeHash = hashVerificationCode(code);
      mockAuthCodes.push({
        id: nextCodeId++,
        user_id: user.id,
        code_hash: codeHash,
        type: 'email_verification',
        attempts: 0,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        used_at: null,
        created_at: new Date()
      });

      sentEmails.push({ to: user.email, code });

      return res.status(200).json({
        ok: true,
        message: 'nuevo codigo enviado',
        data: { sent: true, email: user.email }
      });
    });

    // 5. Endpoint simulado: Google OAuth
    app.post('/api/auth/google/verify', (req, res) => {
      const { id_token } = req.body;
      if (!id_token) {
        return res.status(400).json({ ok: false, error: { code: 'MISSING_OAUTH_PARAMS', message: 'falta token' } });
      }

      // Simula verificación con Google
      const mockGoogleEmail = 'google_user@fitmanager.test';
      let user = mockUsers.find(u => u.email === mockGoogleEmail);
      if (!user) {
        user = {
          id: nextUserId++,
          name: 'Usuario Google',
          email: mockGoogleEmail,
          password_hash: null, // Cuenta social sin contraseña
          role: 'member',
          is_active: 1,
          email_verified_at: new Date() // Verificado directamente por Google
        };
        mockUsers.push(user);
      }

      if (!user.is_active) {
        return res.status(403).json({ ok: false, error: { code: 'ACCOUNT_INACTIVE', message: 'cuenta desactivada' } });
      }

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, mockJwtSecret);
      return res.status(200).json({ ok: true, data: { token, user } });
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

  // Test 1: Registro correcto
  test('1. Registro correcto crea cuenta pendiente de verificación y NO entrega JWT de sesión', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Martín Palermo',
        email: 'palermo@fitmanager.test',
        password: 'password123'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.ok, true);
    assert.equal(data.data.requires_verification, true);
    assert.equal(data.data.token, undefined, 'No debe entregar JWT antes de verificar el correo');
    assert.equal(data.data.code, undefined, 'No debe devolver el código en la respuesta');

    // Comprobar que en memoria está con email_verified_at = null
    const user = mockUsers.find(u => u.email === 'palermo@fitmanager.test');
    assert.ok(user);
    assert.equal(user.email_verified_at, null);

    // Comprobar que se generó un código en la tabla
    const codeRow = mockAuthCodes.find(c => c.user_id === user.id);
    assert.ok(codeRow);
    assert.equal(codeRow.code_hash.length, 64, 'El hash SHA-256 debe tener 64 caracteres');
    assert.notEqual(codeRow.code_hash, '123456', 'No debe estar en texto plano');
  });

  // Test 2: Inicio de sesión antes de verificar
  test('2. Intento de inicio de sesión antes de verificar el correo es rechazado con 403 EMAIL_NOT_VERIFIED', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'palermo@fitmanager.test',
        password: 'password123'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(data.data?.requires_verification, true);
  });

  // Test 3: Código incorrecto
  test('3. Código de verificación incorrecto es rechazado y descuenta intentos', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'palermo@fitmanager.test',
        code: '999999' // Código erróneo
      })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.ok, false);
    assert.equal(data.error.code, 'INVALID_CODE');
    assert.equal(data.error.remaining_attempts, 4);

    const user = mockUsers.find(u => u.email === 'palermo@fitmanager.test');
    assert.equal(user.email_verified_at, null, 'El usuario debe seguir sin verificar');
  });

  // Test 4: Código válido
  test('4. Código de verificación válido marca email_verified_at y permite posterior inicio de sesión', async () => {
    const user = mockUsers.find(u => u.email === 'palermo@fitmanager.test');
    const sent = sentEmails.find(e => e.to === 'palermo@fitmanager.test');
    assert.ok(sent, 'Se debe haber emitido un código');

    const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'palermo@fitmanager.test',
        code: sent.code
      })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.data.verified, true);
    assert.ok(user.email_verified_at !== null, 'email_verified_at debe tener fecha');

    // Ahora el login debe ser 200 exitoso con token JWT
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'palermo@fitmanager.test',
        password: 'password123'
      })
    });

    const loginData = await loginRes.json();
    assert.equal(loginRes.status, 200);
    assert.equal(loginData.ok, true);
    assert.ok(loginData.data.token, 'Debe devolver el JWT tras estar verificado');
  });

  // Test 5: Código reutilizado
  test('5. Un código ya utilizado no puede ser reutilizado para verificar nuevamente', async () => {
    // Creamos otro usuario para probar reutilización
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Guillermo Barros Schelotto',
        email: 'guillermo@fitmanager.test',
        password: 'password123'
      })
    });

    const user = mockUsers.find(u => u.email === 'guillermo@fitmanager.test');
    const sent = sentEmails.find(e => e.to === 'guillermo@fitmanager.test');

    // Primera vez: válida
    await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'guillermo@fitmanager.test', code: sent.code })
    });

    // Simulamos que por alguna razón vuelve a intentar usar el mismo código
    user.email_verified_at = null; // forzamos desverificación temporal para probar código gastado
    const reuseRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'guillermo@fitmanager.test', code: sent.code })
    });

    const reuseData = await reuseRes.json();
    assert.equal(reuseRes.status, 400);
    assert.equal(reuseData.error.code, 'CODE_ALREADY_USED');
  });

  // Test 6: Código vencido
  test('6. Código vencido (>10 minutos) es rechazado con CODE_EXPIRED', async () => {
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Carlos Tevez',
        email: 'tevez@fitmanager.test',
        password: 'password123'
      })
    });

    const user = mockUsers.find(u => u.email === 'tevez@fitmanager.test');
    const codeRow = mockAuthCodes.find(c => c.user_id === user.id);
    const sent = sentEmails.find(e => e.to === 'tevez@fitmanager.test');

    // Forzar fecha de expiración en el pasado
    codeRow.expires_at = new Date(Date.now() - 1000);

    const res = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tevez@fitmanager.test', code: sent.code })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error.code, 'CODE_EXPIRED');
    assert.equal(user.email_verified_at, null);
  });

  // Test 7: Reenvío e invalidación del código anterior
  test('7. Reenviar código invalida el código anterior e introduce uno nuevo', async () => {
    const user = mockUsers.find(u => u.email === 'tevez@fitmanager.test');
    const oldCode = mockAuthCodes.find(c => c.user_id === user.id);

    // Reenviar
    const resendRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tevez@fitmanager.test' })
    });

    const resendData = await resendRes.json();
    assert.equal(resendRes.status, 200);
    assert.equal(resendData.ok, true);

    // Comprobar que el código anterior quedó marcado como usado
    assert.ok(oldCode.used_at !== null, 'El código viejo debe haber sido invalidado');

    // Obtener el nuevo código enviado
    const allSentTevez = sentEmails.filter(e => e.to === 'tevez@fitmanager.test');
    assert.equal(allSentTevez.length, 2);
    const newCode = allSentTevez[1].code;

    // Verificar con el nuevo código
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tevez@fitmanager.test', code: newCode })
    });

    const verifyData = await verifyRes.json();
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyData.ok, true);
    assert.ok(user.email_verified_at !== null);
  });

  // Test 8: Compatibilidad con usuarios y administradores preexistentes
  test('8. Compatibilidad total: Usuarios y admin preexistentes con email_verified_at inician sesión normalmente', async () => {
    // Insertamos directamente usuarios como quedaron tras la migración 004
    const adminUser = {
      id: nextUserId++,
      name: 'Admin FitManager',
      email: 'admin@fitmanager.com',
      password_hash: await bcrypt.hash('adminSecret123', SALT_ROUNDS),
      role: 'admin',
      is_active: 1,
      email_verified_at: new Date('2025-01-01T00:00:00Z') // Existente verificado por migración
    };
    mockUsers.push(adminUser);

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@fitmanager.com',
        password: 'adminSecret123'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.ok(data.data.token);
    assert.equal(data.data.user.role, 'admin');
  });

  // Test 9: Compatibilidad con Google OAuth
  test('9. Compatibilidad con Google OAuth: el acceso y creación social no se bloquea por verificación local', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: 'mock_valid_google_id_token' })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.ok(data.data.token);
    assert.equal(data.data.user.email, 'google_user@fitmanager.test');

    const createdSocialUser = mockUsers.find(u => u.email === 'google_user@fitmanager.test');
    assert.ok(createdSocialUser.email_verified_at !== null);
  });

  // Test 10: Cuentas desactivadas
  test('10. Cuentas desactivadas son rechazadas con 403 ACCOUNT_INACTIVE independientemente de su verificación', async () => {
    const inactiveUser = {
      id: nextUserId++,
      name: 'Usuario Bloqueado',
      email: 'bloqueado@fitmanager.test',
      password_hash: await bcrypt.hash('pass123', SALT_ROUNDS),
      role: 'member',
      is_active: 0, // Desactivado
      email_verified_at: new Date()
    };
    mockUsers.push(inactiveUser);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bloqueado@fitmanager.test', password: 'pass123' })
    });

    const loginData = await loginRes.json();
    assert.equal(loginRes.status, 403);
    assert.equal(loginData.error.code, 'ACCOUNT_INACTIVE');

    // Tampoco permite verificar si estuviese desactivada
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bloqueado@fitmanager.test', code: '123456' })
    });

    const verifyData = await verifyRes.json();
    assert.equal(verifyRes.status, 403);
    assert.equal(verifyData.error.code, 'ACCOUNT_INACTIVE');
  });

  // Test 11: Simulación de migración repetida (Idempotencia y protección de pendientes)
  test('11. Ejecución repetida de la migración 004 NO marca como verificados a usuarios nuevos pendientes', async () => {
    // 1. Creamos un nuevo usuario pendiente vía registro
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Nuevo Pendiente',
        email: 'pendiente@fitmanager.test',
        password: 'password123'
      })
    });
    assert.equal(regRes.status, 201);

    const pendingUser = mockUsers.find(u => u.email === 'pendiente@fitmanager.test');
    assert.equal(pendingUser.email_verified_at, null);

    // 2. Simulamos la lógica exacta de la migración 004 corregida:
    // UPDATE users u LEFT JOIN auth_codes ac ON ac.user_id = u.id AND ac.type = 'email_verification'
    // SET u.email_verified_at = NOW() WHERE u.email_verified_at IS NULL AND ac.id IS NULL
    mockUsers.forEach(u => {
      if (u.email_verified_at === null) {
        const hasAuthCodes = mockAuthCodes.some(ac => ac.user_id === u.id && ac.type === 'email_verification');
        if (!hasAuthCodes) {
          // Solo si NO tiene auth_codes (usuario preexistente antiguo)
          u.email_verified_at = new Date();
        }
      }
    });

    // 3. Comprobar que el usuario pendiente SIGUE sin verificar
    assert.equal(pendingUser.email_verified_at, null, 'El usuario nuevo pendiente NO debe ser auto-verificado por la migración');

    // 4. Comprobar que su login sigue siendo bloqueado con EMAIL_NOT_VERIFIED
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pendiente@fitmanager.test', password: 'password123' })
    });
    const loginData = await loginRes.json();
    assert.equal(loginRes.status, 403);
    assert.equal(loginData.error.code, 'EMAIL_NOT_VERIFIED');
  });

  // Test 12: Concurrencia de intentos y límite estricto de 5 intentos
  test('12. Concurrencia de peticiones simultáneas no permite superar el límite de 5 intentos fallidos', async () => {
    // Registramos usuario para test de concurrencia
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Concurrente Test',
        email: 'concurrente@fitmanager.test',
        password: 'password123'
      })
    });

    // Enviamos 8 peticiones con código incorrecto de manera simultánea
    const requests = Array.from({ length: 8 }, () =>
      fetch(`${baseUrl}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'concurrente@fitmanager.test', code: '000000' })
      })
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);

    // Todas deben ser 400
    assert.ok(statuses.every(s => s === 400));

    const user = mockUsers.find(u => u.email === 'concurrente@fitmanager.test');
    assert.equal(user.email_verified_at, null, 'No debe verificarse');

    // El código debe quedar bloqueado tras 5 intentos
    const userCodes = mockAuthCodes.filter(c => c.user_id === user.id);
    const activeCode = userCodes[userCodes.length - 1];
    assert.ok(activeCode.attempts >= 5 || activeCode.used_at !== null, 'El código debe estar invalidado por agotar intentos');

    // Intentar ahora con el código real debe fallar por intentos superados
    const sent = sentEmails.find(e => e.to === 'concurrente@fitmanager.test');
    const retryReal = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'concurrente@fitmanager.test', code: sent.code })
    });
    const retryData = await retryReal.json();
    assert.equal(retryReal.status, 400);
    assert.ok(['MAX_ATTEMPTS_EXCEEDED', 'CODE_ALREADY_USED'].includes(retryData.error.code));
  });

  // Test 13: Resend permite recuperar cuenta si el primer email no llegó o falló
  test('13. Reenvío permite al usuario solicitar otro código y verificar exitosamente su cuenta', async () => {
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Recuperable Test',
        email: 'recuperable@fitmanager.test',
        password: 'password123'
      })
    });

    // Simulamos que solicita reenvío
    const resendRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'recuperable@fitmanager.test' })
    });
    assert.equal(resendRes.status, 200);

    const emails = sentEmails.filter(e => e.to === 'recuperable@fitmanager.test');
    assert.ok(emails.length >= 2);
    const latestCode = emails[emails.length - 1].code;

    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'recuperable@fitmanager.test', code: latestCode })
    });
    assert.equal(verifyRes.status, 200);
  });

  // Test 14: Cuenta huérfana de ventana de transición (sin auth_codes) recuperable vía resend
  test('14. Cuenta creada durante transición sin auth_codes puede solicitar código vía resend y verificarse', async () => {
    // Simula cuenta creada en el backend viejo que no creó fila en auth_codes y quedó con email_verified_at = null
    const orphanUser = {
      id: nextUserId++,
      name: 'Usuario Transición',
      email: 'transicion@fitmanager.test',
      password_hash: await bcrypt.hash('pass123', SALT_ROUNDS),
      role: 'member',
      is_active: 1,
      email_verified_at: null // Pendiente
    };
    mockUsers.push(orphanUser);

    // 1. Intento de login rechazado
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'transicion@fitmanager.test', password: 'pass123' })
    });
    assert.equal(loginRes.status, 403);
    const loginData = await loginRes.json();
    assert.equal(loginData.error.code, 'EMAIL_NOT_VERIFIED');

    // 2. Solicita código mediante resend-verification (no tenía códigos previos)
    const resendRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'transicion@fitmanager.test' })
    });
    assert.equal(resendRes.status, 200);

    // 3. Comprobar que NO se verificó automáticamente (debe seguir en null)
    assert.equal(orphanUser.email_verified_at, null);

    // 4. Se generó su primer código en auth_codes
    const code = sentEmails.find(e => e.to === 'transicion@fitmanager.test').code;
    assert.ok(code);

    // 5. Verifica su cuenta exitosamente
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'transicion@fitmanager.test', code })
    });
    assert.equal(verifyRes.status, 200);
    assert.ok(orphanUser.email_verified_at !== null);
  });

  // Test 15: MAINTENANCE_REGISTRATION = true pausa registros con 503 sin afectar login ni Google OAuth
  test('15. MAINTENANCE_REGISTRATION en true rechaza registros con 503 sin bloquear login ni Google OAuth', async () => {
    process.env.MAINTENANCE_REGISTRATION = 'true';

    // 1. Intento de registro rechazado con 503
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Intento en Mantenimiento',
        email: 'mantenimiento@fitmanager.test',
        password: 'password123'
      })
    });
    assert.equal(regRes.status, 503);
    const regData = await regRes.json();
    assert.equal(regData.error.code, 'REGISTRATION_TEMPORARILY_DISABLED');

    // 2. Login tradicional de usuario verificado existente continúa funcionando 200 OK
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@fitmanager.com',
        password: 'adminSecret123'
      })
    });
    assert.equal(loginRes.status, 200);

    // 3. Google OAuth continúa funcionando 200 OK
    const googleRes = await fetch(`${baseUrl}/api/auth/google/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: 'mock_valid_google_id_token' })
    });
    assert.equal(googleRes.status, 200);
  });

  // Test 16: MAINTENANCE_REGISTRATION = false (o no definida) reactiva registros normales
  test('16. Desactivar MAINTENANCE_REGISTRATION reanuda los registros normales inmediatamente', async () => {
    process.env.MAINTENANCE_REGISTRATION = 'false';

    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Registro Reactivado',
        email: 'reactivado@fitmanager.test',
        password: 'password123'
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.data.requires_verification, true);

    // Limpieza de variable de entorno para tests posteriores
    delete process.env.MAINTENANCE_REGISTRATION;
  });

  // Helper para ejecutar tests de sendEmail con entorno y fetch interceptado de forma segura
  async function runSendEmailTest({ env = {}, mockFetch, testFn }) {
    const originalFetch = globalThis.fetch;
    const originalEnvUrl = process.env.GAS_EMAIL_URL;
    const originalEnvKey = process.env.GAS_SECRET_KEY;

    try {
      process.env.GAS_EMAIL_URL = env.GAS_EMAIL_URL ?? 'https://script.google.com/macros/s/mock_deployment_id/exec';
      process.env.GAS_SECRET_KEY = env.GAS_SECRET_KEY ?? 'mock_secret_key_123';

      if (mockFetch) {
        globalThis.fetch = mockFetch;
      }

      await testFn();
    } finally {
      globalThis.fetch = originalFetch;

      if (originalEnvUrl !== undefined) {
        process.env.GAS_EMAIL_URL = originalEnvUrl;
      } else {
        delete process.env.GAS_EMAIL_URL;
      }

      if (originalEnvKey !== undefined) {
        process.env.GAS_SECRET_KEY = originalEnvKey;
      } else {
        delete process.env.GAS_SECRET_KEY;
      }
    }
  }

  // Test 17: sendEmail realiza POST con URL, headers, redirect: 'follow', payload y devuelve { ok: true, id }
  test('17. sendEmail() realiza POST correcto con URL, payload y redirect a Google Apps Script', async () => {
    let capturedUrl = null;
    let capturedOptions = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, id: 'gas_msg_valid_12345' })
      };
    };

    await runSendEmailTest({
      mockFetch,
      testFn: async () => {
        const result = await sendEmail({
          to: 'socio@fitmanager.test',
          subject: '123456 es tu código',
          html: '<p>123456</p>'
        });

        assert.equal(capturedUrl, 'https://script.google.com/macros/s/mock_deployment_id/exec');
        assert.equal(capturedOptions.method, 'POST');
        assert.equal(capturedOptions.redirect, 'follow');
        assert.equal(capturedOptions.headers['Content-Type'], 'text/plain;charset=utf-8');

        const parsedPayload = JSON.parse(capturedOptions.body);
        assert.equal(parsedPayload.secretKey, 'mock_secret_key_123');
        assert.equal(parsedPayload.to, 'socio@fitmanager.test');
        assert.equal(parsedPayload.subject, '123456 es tu código');
        assert.equal(parsedPayload.html, '<p>123456</p>');

        assert.equal(result.ok, true);
        assert.equal(result.id, 'gas_msg_valid_12345');
      }
    });
  });

  // Test 18: Rechazo explícito de destinatarios en formato array
  test('18. sendEmail() rechaza arrays de destinatarios con EMAIL_INVALID_RECIPIENT_FORMAT', async () => {
    await runSendEmailTest({
      mockFetch: async () => assert.fail('fetch no debe invocarse cuando el destinatario es inválido'),
      testFn: async () => {
        let caughtError = null;
        try {
          await sendEmail({
            to: ['socio1@fitmanager.test', 'socio2@fitmanager.test'],
            subject: 'Asunto',
            html: '<p>HTML</p>'
          });
        } catch (err) {
          caughtError = err;
        }

        assert.ok(caughtError);
        assert.equal(caughtError.code, 'EMAIL_INVALID_RECIPIENT_FORMAT');
        assert.equal(caughtError.message, 'el destinatario debe ser una unica direccion de correo en formato string');
      }
    });
  });

  // Test 19: Manejo de respuesta HTTP con error (ej: 502 / 500)
  test('19. sendEmail() detecta respuesta HTTP con error y arroja HTTP_STATUS', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 502,
      json: async () => ({})
    });

    await runSendEmailTest({
      mockFetch,
      testFn: async () => {
        let caughtError = null;
        try {
          await sendEmail({
            to: 'socio@fitmanager.test',
            subject: 'Asunto',
            html: '<p>HTML</p>'
          });
        } catch (err) {
          caughtError = err;
        }

        assert.ok(caughtError);
        assert.equal(caughtError.code, 'HTTP_502');
      }
    });
  });

  // Test 20: Manejo de respuesta con JSON inválido o página HTML de error de Google
  test('20. sendEmail() maneja respuesta no-JSON y arroja EMAIL_GAS_INVALID_JSON', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      }
    });

    await runSendEmailTest({
      mockFetch,
      testFn: async () => {
        let caughtError = null;
        try {
          await sendEmail({
            to: 'socio@fitmanager.test',
            subject: 'Asunto',
            html: '<p>HTML</p>'
          });
        } catch (err) {
          caughtError = err;
        }

        assert.ok(caughtError);
        assert.equal(caughtError.code, 'EMAIL_GAS_INVALID_JSON');
      }
    });
  });

  // Test 21: Manejo de respuesta con error de autorización UNAUTHORIZED
  test('21. sendEmail() ante error UNAUTHORIZED de Google Apps Script arroja EMAIL_GAS_UNAUTHORIZED', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: 'UNAUTHORIZED' })
    });

    await runSendEmailTest({
      mockFetch,
      testFn: async () => {
        let caughtError = null;
        try {
          await sendEmail({
            to: 'socio@fitmanager.test',
            subject: 'Asunto',
            html: '<p>HTML</p>'
          });
        } catch (err) {
          caughtError = err;
        }

        assert.ok(caughtError);
        assert.equal(caughtError.code, 'EMAIL_GAS_UNAUTHORIZED');
      }
    });
  });

  // Test 22: Manejo de respuesta con cuota agotada QUOTA_EXCEEDED
  test('22. sendEmail() ante error QUOTA_EXCEEDED de Google Apps Script arroja EMAIL_GAS_QUOTA_EXCEEDED', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: 'QUOTA_EXCEEDED' })
    });

    await runSendEmailTest({
      mockFetch,
      testFn: async () => {
        let caughtError = null;
        try {
          await sendEmail({
            to: 'socio@fitmanager.test',
            subject: 'Asunto',
            html: '<p>HTML</p>'
          });
        } catch (err) {
          caughtError = err;
        }

        assert.ok(caughtError);
        assert.equal(caughtError.code, 'EMAIL_GAS_QUOTA_EXCEEDED');
      }
    });
  });

  // Test 23: Manejo de timeout al conectar con Google Apps Script
  test('23. sendEmail() ante TimeoutError arroja EMAIL_TIMEOUT', async () => {
    const mockFetch = async () => {
      const timeoutError = new Error('The operation was aborted due to timeout');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    };

    await runSendEmailTest({
      mockFetch,
      testFn: async () => {
        let caughtError = null;
        try {
          await sendEmail({
            to: 'socio@fitmanager.test',
            subject: 'Asunto',
            html: '<p>HTML</p>'
          });
        } catch (err) {
          caughtError = err;
        }

        assert.ok(caughtError);
        assert.equal(caughtError.code, 'EMAIL_TIMEOUT');
      }
    });
  });

  // Test 24: Manejo de respuesta ok: true pero sin identificador id
  test('24. sendEmail() ante respuesta ok: true sin id arroja EMAIL_SEND_NO_MESSAGE_ID', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, id: null })
    });

    await runSendEmailTest({
      mockFetch,
      testFn: async () => {
        let caughtError = null;
        try {
          await sendEmail({
            to: 'socio@fitmanager.test',
            subject: 'Asunto',
            html: '<p>HTML</p>'
          });
        } catch (err) {
          caughtError = err;
        }

        assert.ok(caughtError);
        assert.equal(caughtError.code, 'EMAIL_SEND_NO_MESSAGE_ID');
      }
    });
  });
});
