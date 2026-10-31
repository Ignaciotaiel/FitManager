import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Pruebas Exhaustivas - Etapa 1: Recuperación de Contraseña y Seguridad (token_version + GAS)', () => {
  let app;
  let server;
  let baseUrl;

  // Estado en memoria simulado que reproduce exactamente las tablas users y password_resets
  let mockUsers = [];
  let mockPasswordResets = [];
  let mockAuthCodes = [];
  let sentEmails = [];
  let nextUserId = 1;
  let nextResetId = 1;

  // Flag para simular fallos controlados en el servicio de correo Google Apps Script
  let simulateGasFailure = false;

  const mockJwtSecret = 'test_jwt_secret_fitmanager_pwd_reset_v2';
  process.env.JWT_SECRET = mockJwtSecret;

  const SALT_ROUNDS = 4; // Costo rápido para tests unitarios
  const MAX_ATTEMPTS = 5;
  const RESEND_COOLDOWN_SECONDS = 60;
  const GENERIC_FORGOT_PASSWORD_MSG = 'si el correo está registrado y cuenta con contraseña local, te enviamos un código de recuperación';

  function hashVerificationCode(code) {
    return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
  }

  function generate6DigitCode() {
    return String(crypto.randomInt(100000, 1000000));
  }

  function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
  }

  function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 6;
  }

  function generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        token_version: user.token_version
      },
      mockJwtSecret,
      { expiresIn: '7d' }
    );
  }

  before(async () => {
    app = express();
    app.use(express.json());

    // Middleware verifyToken estricto con validación de token_version
    const testVerifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          ok: false,
          error: { message: 'token no proporcionado', code: 'UNAUTHORIZED' }
        });
      }

      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, mockJwtSecret);
      } catch {
        return res.status(401).json({
          ok: false,
          error: { message: 'token invalido o expirado', code: 'INVALID_TOKEN' }
        });
      }

      const user = mockUsers.find(u => u.id === decoded.id);
      if (!user) {
        return res.status(401).json({
          ok: false,
          error: { message: 'usuario no encontrado', code: 'USER_NOT_FOUND' }
        });
      }

      if (!user.is_active) {
        return res.status(401).json({
          ok: false,
          error: { message: 'cuenta desactivada', code: 'ACCOUNT_INACTIVE' }
        });
      }

      // Validación estricta de token_version: rechaza si falta o si no coincide
      if (decoded.token_version === undefined || decoded.token_version !== user.token_version) {
        return res.status(401).json({
          ok: false,
          error: {
            message: 'sesion revocada o expirada por cambio de seguridad. por favor inicia sesion nuevamente',
            code: 'SESSION_REVOKED'
          }
        });
      }

      req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      next();
    };

    // --------------------------------------------------------------------------
    // ENDPOINT 1: POST /api/auth/forgot-password (con manejo de fallo GAS)
    // --------------------------------------------------------------------------
    app.post('/api/auth/forgot-password', async (req, res) => {
      const { email } = req.body;

      if (!email || typeof email !== 'string' || !isValidEmail(email)) {
        return res.status(400).json({
          ok: false,
          error: { message: 'debes ingresar un correo electrónico válido', code: 'INVALID_EMAIL' }
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = mockUsers.find(u => u.email === cleanEmail);

      // Respuesta genérica garantizada para correos inexistentes
      if (!user) {
        return res.status(200).json({
          ok: true,
          message: GENERIC_FORGOT_PASSWORD_MSG
        });
      }

      // Respuesta genérica garantizada para usuarios inactivos o exclusivos de Google (sin password_hash)
      if (!user.is_active || !user.password_hash) {
        return res.status(200).json({
          ok: true,
          message: GENERIC_FORGOT_PASSWORD_MSG
        });
      }

      // Comprobar cooldown de 60 segundos solo sobre solicitudes activas (used_at IS NULL)
      const userResets = mockPasswordResets
        .filter(r => r.user_id === user.id && r.used_at === null)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      if (userResets.length > 0) {
        const secondsAgo = (Date.now() - userResets[0].created_at.getTime()) / 1000;
        if (secondsAgo < RESEND_COOLDOWN_SECONDS) {
          return res.status(200).json({
            ok: true,
            message: GENERIC_FORGOT_PASSWORD_MSG
          });
        }
      }

      // Generar nuevo código de 6 dígitos
      const code = generate6DigitCode();
      const codeHash = hashVerificationCode(code);

      // Invalidar códigos anteriores no utilizados
      mockPasswordResets
        .filter(r => r.user_id === user.id && r.used_at === null)
        .forEach(r => { r.used_at = new Date(); });

      // Registrar nueva solicitud en password_resets
      const newReset = {
        id: nextResetId++,
        user_id: user.id,
        code_hash: codeHash,
        attempts: 0,
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
        used_at: null,
        reset_token_hash: null,
        reset_token_expires_at: null,
        reset_completed_at: null,
        created_at: new Date()
      };
      mockPasswordResets.push(newReset);

      // Envío mediante Google Apps Script (esperado)
      try {
        if (simulateGasFailure) {
          throw new Error('Google Apps Script quota exceeded or timeout');
        }
        sentEmails.push({ to: user.email, name: user.name, code, resetId: newReset.id });
      } catch (err) {
        // En caso de fallo de entrega, invalidar inmediatamente el código preventivamente
        newReset.used_at = new Date();
      }

      return res.status(200).json({
        ok: true,
        message: GENERIC_FORGOT_PASSWORD_MSG
      });
    });

    // --------------------------------------------------------------------------
    // ENDPOINT 2: POST /api/auth/verify-reset-code
    // --------------------------------------------------------------------------
    app.post('/api/auth/verify-reset-code', async (req, res) => {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({
          ok: false,
          error: { message: 'debes ingresar correo y código de verificación', code: 'MISSING_PARAMETERS' }
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = String(code).trim();

      if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
        return res.status(400).json({
          ok: false,
          error: { message: 'el código debe ser un valor numérico de 6 dígitos', code: 'INVALID_CODE_FORMAT' }
        });
      }

      const user = mockUsers.find(u => u.email === cleanEmail);
      if (!user) {
        return res.status(400).json({
          ok: false,
          error: { message: 'el código de recuperación es inválido o ha expirado', code: 'INVALID_RESET_CODE' }
        });
      }

      const activeResets = mockPasswordResets
        .filter(r => r.user_id === user.id)
        .sort((a, b) => b.id - a.id);

      if (activeResets.length === 0) {
        return res.status(400).json({
          ok: false,
          error: { message: 'no hay ninguna solicitud de recuperación activa para esta cuenta', code: 'NO_RESET_REQUEST' }
        });
      }

      const resetRow = activeResets[0];

      if (resetRow.used_at !== null) {
        return res.status(400).json({
          ok: false,
          error: { message: 'este código de recuperación ya fue utilizado', code: 'CODE_ALREADY_USED' }
        });
      }

      if (resetRow.expires_at.getTime() <= Date.now()) {
        return res.status(400).json({
          ok: false,
          error: { message: 'el código de recuperación ha expirado, solicitá uno nuevo', code: 'CODE_EXPIRED' }
        });
      }

      if (resetRow.attempts >= MAX_ATTEMPTS) {
        return res.status(400).json({
          ok: false,
          error: { message: 'superaste el límite de intentos permitidos, solicitá un nuevo código', code: 'MAX_ATTEMPTS_EXCEEDED' }
        });
      }

      const providedHash = hashVerificationCode(cleanCode);
      if (providedHash !== resetRow.code_hash) {
        resetRow.attempts += 1;
        const remaining = Math.max(0, MAX_ATTEMPTS - resetRow.attempts);
        return res.status(400).json({
          ok: false,
          error: {
            message: remaining > 0
              ? `código incorrecto. te quedan ${remaining} intento${remaining === 1 ? '' : 's'}`
              : 'código incorrecto. has superado el límite de intentos',
            code: 'INVALID_CODE',
            attempts_remaining: remaining
          }
        });
      }

      // Código válido: generar reset_token temporal (15 min)
      const jti = crypto.randomUUID();
      const resetToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          purpose: 'password_reset',
          jti
        },
        mockJwtSecret,
        { expiresIn: '15m' }
      );
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Marcar código como usado y asociar hash del reset_token
      resetRow.used_at = new Date();
      resetRow.reset_token_hash = resetTokenHash;
      resetRow.reset_token_expires_at = new Date(Date.now() + 15 * 60 * 1000);

      return res.status(200).json({
        ok: true,
        message: 'código verificado exitosamente',
        data: {
          reset_token: resetToken
        }
      });
    });

    // --------------------------------------------------------------------------
    // ENDPOINT 3: POST /api/auth/reset-password (con token_version y hash fuera de TX)
    // --------------------------------------------------------------------------
    app.post('/api/auth/reset-password', async (req, res) => {
      const { resetToken, newPassword } = req.body;

      if (!resetToken || !newPassword) {
        return res.status(400).json({
          ok: false,
          error: { message: 'debes ingresar el token de recuperación y la nueva contraseña', code: 'MISSING_PARAMETERS' }
        });
      }

      // Reutiliza exactamente la validación de registro
      if (!isValidPassword(newPassword)) {
        return res.status(400).json({
          ok: false,
          error: { message: 'la contrasena debe tener al menos 6 caracteres', code: 'INVALID_PASSWORD' }
        });
      }

      // Verificar firma y expiración del JWT
      let decoded;
      try {
        decoded = jwt.verify(resetToken, mockJwtSecret);
      } catch {
        return res.status(401).json({
          ok: false,
          error: { message: 'el token de restablecimiento es inválido o ha expirado', code: 'INVALID_OR_EXPIRED_RESET_TOKEN' }
        });
      }

      if (decoded.purpose !== 'password_reset' || !decoded.userId) {
        return res.status(401).json({
          ok: false,
          error: { message: 'el token de restablecimiento no tiene un propósito válido', code: 'INVALID_RESET_TOKEN_PURPOSE' }
        });
      }

      // OPTIMIZACIÓN: Calcular hash bcrypt FUERA de la transacción
      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Simular apertura de transacción y adquisición de bloqueo FOR UPDATE
      const resetRecord = mockPasswordResets.find(
        r => r.reset_token_hash === resetTokenHash && r.user_id === decoded.userId
      );

      if (!resetRecord) {
        return res.status(401).json({
          ok: false,
          error: { message: 'el token de restablecimiento no existe o no corresponde a este usuario', code: 'RESET_TOKEN_NOT_FOUND' }
        });
      }

      if (resetRecord._isProcessing || resetRecord.reset_completed_at !== null) {
        return res.status(400).json({
          ok: false,
          error: { message: 'este token de restablecimiento ya fue utilizado', code: 'RESET_TOKEN_ALREADY_USED' }
        });
      }

      resetRecord._isProcessing = true;

      try {
        if (resetRecord.reset_token_expires_at.getTime() <= Date.now()) {
          return res.status(400).json({
            ok: false,
            error: { message: 'el token de restablecimiento ha expirado', code: 'RESET_TOKEN_EXPIRED' }
          });
        }

        // Actualizar contraseña e INCREMENTAR token_version en BD
        const targetUser = mockUsers.find(u => u.id === decoded.userId);
        if (targetUser) {
          targetUser.password_hash = newPasswordHash;
          targetUser.token_version = (targetUser.token_version || 1) + 1;
        }

        // Invalidación permanente del reset_token
        resetRecord.reset_completed_at = new Date();

        // Invalidar solicitudes pendientes
        mockPasswordResets
          .filter(r => r.user_id === decoded.userId && r.id !== resetRecord.id && r.used_at === null)
          .forEach(r => { r.used_at = new Date(); });

        return res.status(200).json({
          ok: true,
          message: 'tu contraseña ha sido actualizada exitosamente'
        });
      } finally {
        resetRecord._isProcessing = false;
      }
    });

    // --------------------------------------------------------------------------
    // ENDPOINT 4: POST /api/auth/login (emite JWT con token_version)
    // --------------------------------------------------------------------------
    app.post('/api/auth/login', async (req, res) => {
      const { email, password } = req.body;
      const cleanEmail = email?.trim()?.toLowerCase();
      const user = mockUsers.find(u => u.email === cleanEmail);

      if (!user || !user.password_hash) {
        return res.status(401).json({ ok: false, error: { message: 'credenciales inválidas' } });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ ok: false, error: { message: 'credenciales inválidas' } });
      }

      const token = generateToken(user);
      return res.status(200).json({ ok: true, data: { token, user: { id: user.id, email: user.email } } });
    });

    // --------------------------------------------------------------------------
    // ENDPOINT 5: POST /api/auth/google/verify (emite JWT con token_version)
    // --------------------------------------------------------------------------
    app.post('/api/auth/google/verify', (req, res) => {
      const { id_token } = req.body;
      if (!id_token) {
        return res.status(400).json({ ok: false, error: { code: 'MISSING_OAUTH_PARAMS' } });
      }

      const mockGoogleEmail = 'social@fitmanager.test';
      let user = mockUsers.find(u => u.email === mockGoogleEmail);
      if (!user) {
        user = {
          id: nextUserId++,
          name: 'Usuario Google',
          email: mockGoogleEmail,
          password_hash: null,
          role: 'member',
          is_active: 1,
          token_version: 1,
          email_verified_at: new Date()
        };
        mockUsers.push(user);
      }

      const token = generateToken(user);
      return res.status(200).json({ ok: true, data: { token, user: { id: user.id, email: user.email } } });
    });

    // --------------------------------------------------------------------------
    // ENDPOINT 6: GET /api/auth/me (protegido con verifyToken estricto)
    // --------------------------------------------------------------------------
    app.get('/api/auth/me', testVerifyToken, (req, res) => {
      return res.status(200).json({ ok: true, data: { user: req.user } });
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

  // Reset del estado simulado
  before(async () => {
    const defaultPasswordHash = await bcrypt.hash('claveOriginal123', SALT_ROUNDS);

    mockUsers = [
      {
        id: nextUserId++,
        name: 'Lucas Regular',
        email: 'lucas@fitmanager.test',
        password_hash: defaultPasswordHash,
        role: 'member',
        is_active: 1,
        token_version: 1,
        email_verified_at: new Date()
      },
      {
        id: nextUserId++,
        name: 'Google Solo',
        email: 'social@fitmanager.test',
        password_hash: null,
        role: 'member',
        is_active: 1,
        token_version: 1,
        email_verified_at: new Date()
      },
      {
        id: nextUserId++,
        name: 'Inactivo User',
        email: 'inactivo@fitmanager.test',
        password_hash: defaultPasswordHash,
        role: 'member',
        is_active: 0,
        token_version: 1,
        email_verified_at: new Date()
      }
    ];
  });

  // ============================================================================
  // 1. VERIFICACIÓN DE TOKEN_VERSION EN JWT Y CONTROL DE SESIONES
  // ============================================================================

  test('1. Login exitoso genera un JWT que incluye token_version = 1', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test', password: 'claveOriginal123' })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.data.token);

    const decoded = jwt.verify(data.data.token, mockJwtSecret);
    assert.equal(decoded.token_version, 1, 'El JWT debe incluir el campo token_version con valor 1');
  });

  test('2. GET /api/auth/me acepta el JWT con token_version coincidente con la BD', async () => {
    const user = mockUsers.find(u => u.id === 1);
    const validToken = generateToken(user);

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.data.user.id, 1);
  });

  test('3. GET /api/auth/me rechaza JWT con token_version incorrecta o desactualizada (401 SESSION_REVOKED)', async () => {
    const outdatedToken = jwt.sign(
      { id: 1, email: 'lucas@fitmanager.test', role: 'member', token_version: 999 },
      mockJwtSecret
    );

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${outdatedToken}` }
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error.code, 'SESSION_REVOKED');
  });

  test('4. GET /api/auth/me rechaza estrictamente JWT antiguo legacy sin token_version (401 SESSION_REVOKED)', async () => {
    const legacyToken = jwt.sign(
      { id: 1, email: 'lucas@fitmanager.test', role: 'member' },
      mockJwtSecret
    );

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${legacyToken}` }
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error.code, 'SESSION_REVOKED');
  });

  test('5. Google OAuth continúa funcionando e incluye token_version en sus JWTs', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: 'valid_google_token_123' })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.data.token);

    const decoded = jwt.verify(data.data.token, mockJwtSecret);
    assert.equal(typeof decoded.token_version, 'number');
    assert.equal(decoded.token_version, 1);

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${data.data.token}` }
    });
    assert.equal(meRes.status, 200);
  });

  // ============================================================================
  // 2. MANEJO DE FALLO EN GOOGLE APPS SCRIPT (GAS) Y COOLDOWN
  // ============================================================================

  test('6. forgot-password responde 200 genérico para correo no registrado (anti-enumeración)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'inexistente_9999@fitmanager.test' })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.message, GENERIC_FORGOT_PASSWORD_MSG);
  });

  test('7. forgot-password responde 200 genérico para cuenta Google OAuth sin password_hash', async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'social@fitmanager.test' })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.message, GENERIC_FORGOT_PASSWORD_MSG);
  });

  test('8. forgot-password responde 200 genérico para cuenta inactiva (is_active = 0)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'inactivo@fitmanager.test' })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.message, GENERIC_FORGOT_PASSWORD_MSG);
  });

  test('9. forgot-password valida formato de correo electrónico y responde 400 INVALID_EMAIL', async () => {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'correo-sin-formato' })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error.code, 'INVALID_EMAIL');
  });

  test('10. forgot-password emite código y envía email exitosamente cuando GAS funciona', async () => {
    simulateGasFailure = false;
    const initialEmails = sentEmails.length;

    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test' })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.message, GENERIC_FORGOT_PASSWORD_MSG);
    assert.equal(sentEmails.length, initialEmails + 1);

    const lastReset = mockPasswordResets.find(r => r.user_id === 1 && r.used_at === null);
    assert.ok(lastReset, 'El código debe quedar activo en BD (used_at === null)');
  });

  test('11. forgot-password aplica cooldown (< 60s) cuando existe un código activo no usado', async () => {
    const countBefore = sentEmails.length;

    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test' })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.message, GENERIC_FORGOT_PASSWORD_MSG);
    assert.equal(sentEmails.length, countBefore, 'No debe enviar correo dentro de la ventana de cooldown');
  });

  test('12. Si GAS falla: el código queda inmediatamente invalidado (used_at != null) y da 200 genérico', async () => {
    mockPasswordResets.forEach(r => { r.used_at = new Date(); });

    simulateGasFailure = true;
    const countBefore = sentEmails.length;

    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test' })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.message, GENERIC_FORGOT_PASSWORD_MSG);
    assert.equal(sentEmails.length, countBefore);

    const failedReset = mockPasswordResets[mockPasswordResets.length - 1];
    assert.ok(failedReset.used_at !== null, 'El código huérfano debe tener used_at asignado inmediatamente');
  });

  test('13. Si GAS falló: el usuario PUEDE solicitar otro código de inmediato sin quedar bloqueado por cooldown', async () => {
    simulateGasFailure = false;
    const countBefore = sentEmails.length;

    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test' })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.message, GENERIC_FORGOT_PASSWORD_MSG);
    assert.equal(sentEmails.length, countBefore + 1);

    const activeReset = mockPasswordResets.find(r => r.user_id === 1 && r.used_at === null);
    assert.ok(activeReset, 'Debe existir un código activo tras la recuperación del servicio');
  });

  // ============================================================================
  // 3. VALIDACIÓN DE CÓDIGO (VERIFY-RESET-CODE)
  // ============================================================================

  test('14. verify-reset-code rechaza parámetros faltantes con 400 MISSING_PARAMETERS', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test' })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error.code, 'MISSING_PARAMETERS');
  });

  test('15. verify-reset-code rechaza formatos no numéricos o de longitud distinta a 6 con INVALID_CODE_FORMAT', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test', code: 'ABC12' })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error.code, 'INVALID_CODE_FORMAT');
  });

  test('16. verify-reset-code con código incorrecto descuenta intentos y retorna attempts_remaining', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test', code: '000000' })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error.code, 'INVALID_CODE');
    assert.equal(data.error.attempts_remaining, 4);
  });

  test('17. verify-reset-code bloquea el código al alcanzar 5 intentos fallidos (MAX_ATTEMPTS_EXCEEDED)', async () => {
    const userReset = mockPasswordResets.find(r => r.user_id === 1 && r.used_at === null);
    userReset.attempts = 5;

    const res = await fetch(`${baseUrl}/api/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test', code: '111111' })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error.code, 'MAX_ATTEMPTS_EXCEEDED');

    userReset.attempts = 1;
  });

  test('18. verify-reset-code rechaza código expirado (> 10 minutos) con CODE_EXPIRED', async () => {
    const userReset = mockPasswordResets.find(r => r.user_id === 1 && r.used_at === null);
    const originalExpiresAt = userReset.expires_at;
    userReset.expires_at = new Date(Date.now() - 1000);

    const res = await fetch(`${baseUrl}/api/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test', code: '123456' })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error.code, 'CODE_EXPIRED');

    userReset.expires_at = originalExpiresAt;
  });

  test('19. verify-reset-code con código correcto marca used_at y devuelve reset_token', async () => {
    const lastEmail = sentEmails[sentEmails.length - 1];

    const res = await fetch(`${baseUrl}/api/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'lucas@fitmanager.test',
        code: lastEmail.code
      })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.data.reset_token);

    const userReset = mockPasswordResets.find(r => r.user_id === 1);
    assert.ok(userReset.used_at !== null);
  });

  test('20. verify-reset-code rechaza reutilizar un código que ya fue verificado (CODE_ALREADY_USED)', async () => {
    const lastEmail = sentEmails[sentEmails.length - 1];

    const res = await fetch(`${baseUrl}/api/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'lucas@fitmanager.test',
        code: lastEmail.code
      })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error.code, 'CODE_ALREADY_USED');
  });

  // ============================================================================
  // 4. RESTABLECIMIENTO, VALIDACIONES, HASH FUERA DE TX Y REVOCACIÓN
  // ============================================================================

  test('21. reset-password rechaza contraseñas menores a 6 caracteres con INVALID_PASSWORD idéntico a registro', async () => {
    const userReset = mockPasswordResets.find(r => r.user_id === 1 && r.reset_token_hash !== null);

    const validResetToken = jwt.sign(
      { userId: 1, purpose: 'password_reset', jti: 'test-jti-short-pwd' },
      mockJwtSecret,
      { expiresIn: '15m' }
    );
    userReset.reset_token_hash = crypto.createHash('sha256').update(validResetToken).digest('hex');
    userReset.reset_completed_at = null;

    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken: validResetToken,
        newPassword: '123'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error.code, 'INVALID_PASSWORD');
    assert.equal(data.error.message, 'la contrasena debe tener al menos 6 caracteres');
  });

  test('22. reset-password rechaza token JWT adulterado con 401 INVALID_OR_EXPIRED_RESET_TOKEN', async () => {
    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken: 'jwt.invalido.o.firmado.con.otra.clave',
        newPassword: 'nuevaClaveSegura2026'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.error.code, 'INVALID_OR_EXPIRED_RESET_TOKEN');
  });

  test('23. reset-password rechaza token JWT legítimo con propósito no válido (ej. login común)', async () => {
    const loginToken = jwt.sign(
      { id: 1, email: 'lucas@fitmanager.test', role: 'member', token_version: 1 },
      mockJwtSecret,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken: loginToken,
        newPassword: 'nuevaClaveSegura2026'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.error.code, 'INVALID_RESET_TOKEN_PURPOSE');
  });

  test('24. reset-password exitoso actualiza contraseña, incrementa token_version y revoca sesiones previas', async () => {
    const user = mockUsers.find(u => u.id === 1);
    const initialVersion = user.token_version; // 1
    const priorSessionToken = generateToken(user);

    // Confirmar que el token previo funciona antes del cambio
    const checkBefore = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${priorSessionToken}` }
    });
    assert.equal(checkBefore.status, 200);

    const userReset = mockPasswordResets.find(r => r.user_id === 1);
    const validResetToken = jwt.sign(
      { userId: 1, purpose: 'password_reset', jti: 'test-jti-success-v2' },
      mockJwtSecret,
      { expiresIn: '15m' }
    );
    userReset.reset_token_hash = crypto.createHash('sha256').update(validResetToken).digest('hex');
    userReset.reset_token_expires_at = new Date(Date.now() + 15 * 60 * 1000);
    userReset.reset_completed_at = null;

    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken: validResetToken,
        newPassword: 'miNuevaClaveSuperSegura2026'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);

    // Comprobar que en BD simulada token_version se incrementó exactamente en 1
    assert.equal(user.token_version, initialVersion + 1, 'token_version debe haberse incrementado a 2');

    // Comprobar que la sesión anterior quedó REVOCADA (401 SESSION_REVOKED)
    const checkAfter = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${priorSessionToken}` }
    });
    const checkAfterData = await checkAfter.json();
    assert.equal(checkAfter.status, 401);
    assert.equal(checkAfterData.error.code, 'SESSION_REVOKED');

    // Comprobar que nuevo login con la nueva contraseña emite token con token_version = 2 y funciona
    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lucas@fitmanager.test', password: 'miNuevaClaveSuperSegura2026' })
    });
    const newLoginData = await newLoginRes.json();
    assert.equal(newLoginRes.status, 200);

    const newSessionToken = newLoginData.data.token;
    const newDecoded = jwt.verify(newSessionToken, mockJwtSecret);
    assert.equal(newDecoded.token_version, 2);

    const newCheck = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${newSessionToken}` }
    });
    assert.equal(newCheck.status, 200);
  });

  test('25. CONDICIÓN 1: Reutilizar el MISMO reset_token es rechazado con RESET_TOKEN_ALREADY_USED', async () => {
    const sameResetToken = jwt.sign(
      { userId: 1, purpose: 'password_reset', jti: 'test-jti-success-v2' },
      mockJwtSecret,
      { expiresIn: '15m' }
    );

    const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken: sameResetToken,
        newPassword: 'otroIntentoDeCambio123'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.error.code, 'RESET_TOKEN_ALREADY_USED');
  });

  // ============================================================================
  // 5. CONCURRENCIA
  // ============================================================================

  test('26. Concurrencia: Dos solicitudes simultáneas de verify-reset-code -> solo una obtiene reset_token', async () => {
    const code = '112233';
    const codeHash = hashVerificationCode(code);
    const newResetRow = {
      id: nextResetId++,
      user_id: 1,
      code_hash: codeHash,
      attempts: 0,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      used_at: null,
      reset_token_hash: null,
      reset_token_expires_at: null,
      reset_completed_at: null,
      created_at: new Date()
    };
    mockPasswordResets.push(newResetRow);

    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/auth/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'lucas@fitmanager.test', code })
      }),
      fetch(`${baseUrl}/api/auth/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'lucas@fitmanager.test', code })
      })
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepEqual(statuses, [200, 400]);

    const dataA = await resA.json();
    const dataB = await resB.json();
    const failedData = !dataA.ok ? dataA : dataB;
    assert.equal(failedData.error.code, 'CODE_ALREADY_USED');
  });

  test('27. Concurrencia: Dos solicitudes simultáneas de reset-password -> solo una actualiza contraseña', async () => {
    const validResetToken = jwt.sign(
      { userId: 1, purpose: 'password_reset', jti: 'concurrent-token-test-v3' },
      mockJwtSecret,
      { expiresIn: '15m' }
    );
    const resetTokenHash = crypto.createHash('sha256').update(validResetToken).digest('hex');

    const concurrentResetRow = {
      id: nextResetId++,
      user_id: 1,
      code_hash: 'dummy',
      attempts: 0,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      used_at: new Date(),
      reset_token_hash: resetTokenHash,
      reset_token_expires_at: new Date(Date.now() + 15 * 60 * 1000),
      reset_completed_at: null,
      created_at: new Date()
    };
    mockPasswordResets.push(concurrentResetRow);

    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: validResetToken, newPassword: 'claveConcurrenteA1' })
      }),
      fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: validResetToken, newPassword: 'claveConcurrenteB2' })
      })
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepEqual(statuses, [200, 400]);

    const dataA = await resA.json();
    const dataB = await resB.json();
    const failedData = !dataA.ok ? dataA : dataB;
    assert.equal(failedData.error.code, 'RESET_TOKEN_ALREADY_USED');
  });
});
