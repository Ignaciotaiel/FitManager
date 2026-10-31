import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { isValidEmail, isValidPassword, isValidRole } from '../middlewares/validate.js';
import { sendEmail } from '../services/emailService.js';
import {
  generateOAuthState,
  consumeOAuthState,
  createLoginTicket,
  consumeLoginTicket
} from '../services/oauthTicketService.js';

// duracion del salt para hash con bcrypt
const SALT_ROUNDS = 10;
const CODE_EXPIRATION_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60; // Protección contra spam de reenvío

// funcion auxiliar para hashear codigos de verificación (SHA-256)
function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

// funcion auxiliar para generar un codigo aleatorio criptografico de 6 digitos
function generate6DigitCode() {
  const randomNum = crypto.randomInt(100000, 1000000);
  return String(randomNum);
}

// funcion auxiliar para enviar el correo con el codigo de verificacion
async function sendVerificationCodeEmail(email, name, code) {
  const subject = `${code} es tu código de verificación de FitManager`;
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px; }
        .header { text-align: center; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px; margin: 0; }
        .subtitle { font-size: 14px; color: #9ca3af; margin-top: 8px; }
        .code-box { background: linear-gradient(135deg, #1e1e2d 0%, #171b26 100%); border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 28px 0; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #60a5fa; margin: 0; font-family: 'Courier New', Courier, monospace; }
        .info { font-size: 14px; color: #9ca3af; line-height: 1.6; }
        .footer { margin-top: 32px; border-top: 1px solid #1f2937; padding-top: 16px; font-size: 12px; color: #6b7280; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">FitManager</h1>
          <p class="subtitle">Verificación de correo electrónico</p>
        </div>
        <p class="info">Hola <strong>${name}</strong>,</p>
        <p class="info">Gracias por registrarte. Ingresá el siguiente código de 6 dígitos en la aplicación para activar tu cuenta:</p>
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        <p class="info" style="font-size: 13px;">
          • El código vence en <strong>10 minutos</strong>.<br>
          • Tenés un máximo de 5 intentos.<br>
          • Si no solicitaste esta cuenta, podés desestimar este mensaje de forma segura.
        </p>
        <div class="footer">
          FitManager &bull; Sistema de Gestión y Entrenamiento
        </div>
      </div>
    </body>
    </html>
  `;
  const text = `Hola ${name},\n\nTu código de verificación para FitManager es: ${code}\n\nEste código vence en 10 minutos. Tenés un máximo de 5 intentos.\n\nSi no creaste esta cuenta, ignorá este mensaje.`;

  return sendEmail({
    to: email,
    subject,
    html,
    text
  });
}

// funcion auxiliar para enviar el correo con el codigo de recuperacion de contrasena
async function sendPasswordResetCodeEmail(email, name, code) {
  const subject = `${code} es tu código de recuperación de contraseña de FitManager`;
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px; }
        .header { text-align: center; margin-bottom: 24px; }
        .title { font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px; margin: 0; }
        .subtitle { font-size: 14px; color: #9ca3af; margin-top: 8px; }
        .code-box { background: linear-gradient(135deg, #1e1e2d 0%, #171b26 100%); border: 1px solid #ef4444; border-radius: 8px; padding: 20px; text-align: center; margin: 28px 0; }
        .code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #f87171; margin: 0; font-family: 'Courier New', Courier, monospace; }
        .info { font-size: 14px; color: #9ca3af; line-height: 1.6; }
        .footer { margin-top: 32px; border-top: 1px solid #1f2937; padding-top: 16px; font-size: 12px; color: #6b7280; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">FitManager</h1>
          <p class="subtitle">Recuperación de Contraseña</p>
        </div>
        <p class="info">Hola <strong>${name}</strong>,</p>
        <p class="info">Recibimos una solicitud para restablecer tu contraseña. Ingresá el siguiente código de 6 dígitos en la aplicación:</p>
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        <p class="info" style="font-size: 13px;">
          • El código vence en <strong>10 minutos</strong>.<br>
          • Tenés un máximo de 5 intentos.<br>
          • Si no solicitaste este cambio, podés desestimar este mensaje de forma segura. Tu contraseña actual no ha sido modificada.
        </p>
        <div class="footer">
          FitManager &bull; Sistema de Gestión y Entrenamiento
        </div>
      </div>
    </body>
    </html>
  `;
  const text = `Hola ${name},\n\nTu código para restablecer tu contraseña en FitManager es: ${code}\n\nEste código vence en 10 minutos. Tenés un máximo de 5 intentos.\n\nSi no solicitaste este cambio, ignorá este mensaje.`;

  return sendEmail({
    to: email,
    subject,
    html,
    text
  });
}

// funcion auxiliar para generar token jwt con version de sesion
function generateToken(user) {
  const secret = process.env.JWT_SECRET || 'desarrollo_fitmanager_secreto_local_jwt';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      token_version: user.token_version
    },
    secret,
    { expiresIn }
  );
}

// registro de usuario local (con contrasena protegida por bcrypt)
// REGLA DE SEGURIDAD: Todo registro público crea estrictamente usuarios con rol 'member'
// REGLA DE VERIFICACION: La cuenta se crea pendiente de verificacion (email_verified_at = NULL).
// NO se entrega JWT de sesion hasta que verifique su correo.
export async function register(req, res, next) {
  let connection;
  try {
    // Control de Mantenimiento de Registros: Permite pausar altas durante migraciones
    if (process.env.MAINTENANCE_REGISTRATION === 'true') {
      return res.status(503).json({
        ok: false,
        error: {
          message: 'el registro de nuevos usuarios se encuentra temporalmente en mantenimiento. por favor intenta en unos minutos',
          code: 'REGISTRATION_TEMPORARILY_DISABLED'
        }
      });
    }

    const { name, email, password } = req.body;

    // validaciones obligatorias
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el nombre es obligatorio', code: 'INVALID_NAME' }
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el correo electronico no es valido', code: 'INVALID_EMAIL' }
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'la contrasena debe tener al menos 6 caracteres', code: 'INVALID_PASSWORD' }
      });
    }

    // Seguridad: Se ignora cualquier campo role del cliente; siempre es 'member'
    const finalRole = 'member';
    const cleanEmail = email.trim().toLowerCase();

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // comprobar si el correo ya esta registrado (consulta parametrizada)
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [cleanEmail]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        error: { message: 'el correo electronico ya esta registrado', code: 'EMAIL_ALREADY_EXISTS' }
      });
    }

    // hash seguro de contrasena con bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // insercion parametrizada de usuario (email_verified_at inicia en NULL)
    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password_hash, role, is_active, email_verified_at) VALUES (?, ?, ?, ?, 1, NULL)',
      [name.trim(), cleanEmail, passwordHash, finalRole]
    );

    const newUserId = result.insertId;

    // Generar código de verificación criptográfico de 6 dígitos
    const code = generate6DigitCode();
    const codeHash = hashVerificationCode(code);

    // Guardar código en auth_codes con validez de 10 minutos
    await connection.execute(
      `INSERT INTO auth_codes (user_id, code_hash, type, attempts, expires_at, created_at)
       VALUES (?, ?, 'email_verification', 0, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())`,
      [newUserId, codeHash, CODE_EXPIRATION_MINUTES]
    );

    await connection.commit();

    // Enviar el correo con el código de verificación en segundo plano
    // No bloquea la respuesta ni expone el código en el payload
    sendVerificationCodeEmail(cleanEmail, name.trim(), code).catch(err => {
      const details = err.code ? `code=${err.code}` : null;
      console.error(`[emailService] Error al enviar código de verificación en registro: ${err.message}${details ? ` (${details})` : ''}`);
    });

    // Se responde informando que se requiere verificar, SIN entregar JWT
    return res.status(201).json({
      ok: true,
      message: 'cuenta creada exitosamente. enviamos un código de verificación a tu correo',
      data: {
        requires_verification: true,
        email: cleanEmail,
        user: {
          id: newUserId,
          name: name.trim(),
          email: cleanEmail,
          role: finalRole,
          is_active: 1
        }
      }
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// inicio de sesion local con credenciales verificadas
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: { message: 'debes ingresar correo y contrasena', code: 'MISSING_CREDENTIALS' }
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // buscar usuario activo (consulta parametrizada)
    const [rows] = await pool.execute(
      'SELECT id, name, email, password_hash, role, is_active, email_verified_at, token_version FROM users WHERE email = ? LIMIT 1',
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: { message: 'credenciales incorrectas', code: 'INVALID_CREDENTIALS' }
      });
    }

    const user = rows[0];

    // comprobar si el usuario esta activo
    if (!user.is_active) {
      return res.status(403).json({
        ok: false,
        error: { message: 'la cuenta se encuentra desactivada', code: 'ACCOUNT_INACTIVE' }
      });
    }

    // comprobar si tiene contrasena configurada (o si es cuenta solo social)
    if (!user.password_hash) {
      return res.status(400).json({
        ok: false,
        error: {
          message: 'esta cuenta fue creada mediante inicio social, ingresa con tu proveedor',
          code: 'SOCIAL_ACCOUNT_ONLY'
        }
      });
    }

    // comparar contrasena con bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        ok: false,
        error: { message: 'credenciales incorrectas', code: 'INVALID_CREDENTIALS' }
      });
    }

    // REGLA DE SEGURIDAD: No permitir inicio de sesión local si el correo no fue verificado.
    // Usuarios preexistentes tienen email_verified_at seteado por la migración 004, por lo que ingresan normalmente.
    if (user.email_verified_at === null) {
      return res.status(403).json({
        ok: false,
        error: {
          message: 'debes verificar tu correo electronico antes de iniciar sesion',
          code: 'EMAIL_NOT_VERIFIED'
        },
        data: {
          requires_verification: true,
          email: user.email
        }
      });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      token_version: user.token_version
    };

    const token = generateToken(userPayload);

    return res.status(200).json({
      ok: true,
      message: 'inicio de sesion exitoso',
      data: {
        token,
        user: userPayload
      }
    });
  } catch (error) {
    next(error);
  }
}

// verificar codigo de 6 digitos para confirmacion de correo
export async function verifyEmail(req, res, next) {
  let connection;
  try {
    const { email, code } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'debes proporcionar un correo electronico valido', code: 'INVALID_EMAIL' }
      });
    }

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el codigo debe ser de 6 digitos numericos', code: 'INVALID_CODE_FORMAT' }
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Obtener usuario
    const [userRows] = await connection.execute(
      'SELECT id, name, email, role, is_active, email_verified_at FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
      [cleanEmail]
    );

    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        error: { message: 'usuario no encontrado', code: 'USER_NOT_FOUND' }
      });
    }

    const user = userRows[0];

    if (!user.is_active) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        error: { message: 'la cuenta se encuentra desactivada', code: 'ACCOUNT_INACTIVE' }
      });
    }

    // Si ya está verificado, retornar éxito directamente
    if (user.email_verified_at !== null) {
      await connection.rollback();
      return res.status(200).json({
        ok: true,
        message: 'el correo ya se encuentra verificado',
        data: {
          already_verified: true,
          email: user.email
        }
      });
    }

    // 2. Obtener el último código emitido para este usuario de tipo email_verification bloqueando la fila
    const [codeRows] = await connection.execute(
      `SELECT id, code_hash, attempts, expires_at, used_at, NOW() as current_db_time
       FROM auth_codes
       WHERE user_id = ? AND type = 'email_verification'
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [user.id]
    );

    if (codeRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'no hay ningún código de verificación activo para este usuario', code: 'NO_CODE_FOUND' }
      });
    }

    const activeCodeRow = codeRows[0];

    // Comprobar si ya fue utilizado
    if (activeCodeRow.used_at !== null) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'este código ya ha sido utilizado. solicitá uno nuevo', code: 'CODE_ALREADY_USED' }
      });
    }

    // Comprobar si ya alcanzó el límite estricto de intentos permitidos (máx 5)
    if (activeCodeRow.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await connection.execute(
        'UPDATE auth_codes SET used_at = NOW() WHERE id = ?',
        [activeCodeRow.id]
      );
      await connection.commit();
      return res.status(400).json({
        ok: false,
        error: {
          message: 'has superado el límite de 5 intentos permitidos. por favor solicitá un nuevo código',
          code: 'MAX_ATTEMPTS_EXCEEDED'
        }
      });
    }

    // Comprobar expiración (10 minutos)
    const expiresAt = new Date(activeCodeRow.expires_at).getTime();
    const currentDbTime = new Date(activeCodeRow.current_db_time || Date.now()).getTime();

    if (currentDbTime > expiresAt) {
      // Invalida el código vencido
      await connection.execute(
        'UPDATE auth_codes SET used_at = NOW() WHERE id = ?',
        [activeCodeRow.id]
      );
      await connection.commit();
      return res.status(400).json({
        ok: false,
        error: {
          message: 'el código ha expirado (validez de 10 minutos). solicitá un nuevo código',
          code: 'CODE_EXPIRED'
        }
      });
    }

    // Comparar hash del código proporcionado
    const inputHash = hashVerificationCode(cleanCode);
    if (inputHash !== activeCodeRow.code_hash) {
      const newAttempts = activeCodeRow.attempts + 1;
      await connection.execute(
        'UPDATE auth_codes SET attempts = ? WHERE id = ?',
        [newAttempts, activeCodeRow.id]
      );
      await connection.commit();

      const remainingAttempts = Math.max(0, MAX_VERIFICATION_ATTEMPTS - newAttempts);
      return res.status(400).json({
        ok: false,
        error: {
          message: `código incorrecto. te quedan ${remainingAttempts} intento(s)`,
          code: 'INVALID_CODE',
          remaining_attempts: remainingAttempts
        }
      });
    }

    // Código válido: marcar código como utilizado y marcar usuario como verificado
    await connection.execute(
      'UPDATE auth_codes SET used_at = NOW() WHERE id = ?',
      [activeCodeRow.id]
    );

    await connection.execute(
      'UPDATE users SET email_verified_at = NOW() WHERE id = ?',
      [user.id]
    );

    await connection.commit();

    return res.status(200).json({
      ok: true,
      message: 'correo electronico verificado exitosamente. ya podes iniciar sesion',
      data: {
        verified: true,
        email: user.email
      }
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// reenviar codigo de verificacion de 6 digitos
export async function resendVerificationCode(req, res, next) {
  let connection;
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'debes proporcionar un correo electronico valido', code: 'INVALID_EMAIL' }
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Obtener usuario
    const [userRows] = await connection.execute(
      'SELECT id, name, email, role, is_active, email_verified_at FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
      [cleanEmail]
    );

    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        error: { message: 'usuario no encontrado', code: 'USER_NOT_FOUND' }
      });
    }

    const user = userRows[0];

    if (!user.is_active) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        error: { message: 'la cuenta se encuentra desactivada', code: 'ACCOUNT_INACTIVE' }
      });
    }

    if (user.email_verified_at !== null) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'esta cuenta ya tiene el correo verificado', code: 'ALREADY_VERIFIED' }
      });
    }

    // 2. Control de límite de frecuencia (cooldown de 60 segundos entre reenvíos)
    const [recentCodes] = await connection.execute(
      `SELECT created_at, TIMESTAMPDIFF(SECOND, created_at, NOW()) AS seconds_ago
       FROM auth_codes
       WHERE user_id = ? AND type = 'email_verification'
       ORDER BY id DESC LIMIT 1`,
      [user.id]
    );

    if (recentCodes.length > 0 && recentCodes[0].seconds_ago !== null && recentCodes[0].seconds_ago < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = RESEND_COOLDOWN_SECONDS - recentCodes[0].seconds_ago;
      await connection.rollback();
      return res.status(429).json({
        ok: false,
        error: {
          message: `por favor esperá ${waitSeconds} segundos antes de solicitar otro código`,
          code: 'RATE_LIMIT_EXCEEDED',
          retry_after_seconds: waitSeconds
        }
      });
    }

    // 3. Invalidar todos los códigos anteriores no utilizados
    await connection.execute(
      `UPDATE auth_codes
       SET used_at = NOW()
       WHERE user_id = ? AND type = 'email_verification' AND used_at IS NULL`,
      [user.id]
    );

    // 4. Generar nuevo código de 6 dígitos
    const code = generate6DigitCode();
    const codeHash = hashVerificationCode(code);

    await connection.execute(
      `INSERT INTO auth_codes (user_id, code_hash, type, attempts, expires_at, created_at)
       VALUES (?, ?, 'email_verification', 0, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())`,
      [user.id, codeHash, CODE_EXPIRATION_MINUTES]
    );

    await connection.commit();

    // 5. Enviar el nuevo código por correo mediante Google Apps Script
    sendVerificationCodeEmail(user.email, user.name, code).catch(err => {
      const details = err.code ? `code=${err.code}` : null;
      console.error(`[emailService] Error al reenviar código de verificación: ${err.message}${details ? ` (${details})` : ''}`);
    });

    return res.status(200).json({
      ok: true,
      message: 'un nuevo código de verificación ha sido enviado a tu correo',
      data: {
        sent: true,
        email: user.email
      }
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// obtener datos del usuario autenticado actual
export async function getCurrentUser(req, res, next) {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'usuario no encontrado', code: 'USER_NOT_FOUND' }
      });
    }

    return res.status(200).json({
      ok: true,
      data: {
        user: rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
}

// placeholders arquitectonicos seguros para inicio de sesion social
// no simulan exito; informan explicitamente la falta de credenciales oauth configuradas
// inicio o verificacion de estado de configuracion de google
export function oauthGoogle(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(501).json({
      ok: false,
      error: {
        message: 'el inicio de sesion con google no esta configurado en las variables de entorno',
        code: 'OAUTH_NOT_CONFIGURED',
        provider: 'google'
      }
    });
  }

  // redirigir o procesar url de autorizacion de google cuando esten cargadas las credenciales
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'fitmanager://oauth';
  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=openid%20profile%20email`;
  res.redirect(redirectUrl);
}

// canjear codigo de autorizacion o validar token de google de forma segura en el backend
export async function verifyGoogleAuth(req, res, next) {
  let connection;
  try {
    const { code, code_verifier, redirect_uri, id_token } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId) {
      return res.status(501).json({
        ok: false,
        error: {
          message: 'el proveedor google no esta configurado en el servidor',
          code: 'OAUTH_NOT_CONFIGURED'
        }
      });
    }

    let googleUser = null;

    // Caso 1: Se envio un codigo de autorizacion para canjear con PKCE
    if (code) {
      const targetRedirectUri = redirect_uri || process.env.GOOGLE_CALLBACK_URL || 'fitmanager://oauth';
      const tokenParams = new URLSearchParams({
        code,
        client_id: clientId,
        redirect_uri: targetRedirectUri,
        grant_type: 'authorization_code'
      });

      if (clientSecret) {
        tokenParams.append('client_secret', clientSecret);
      }
      if (code_verifier) {
        tokenParams.append('code_verifier', code_verifier);
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString()
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.access_token) {
        return res.status(401).json({
          ok: false,
          error: {
            message: 'no se pudo verificar el codigo de autorizacion con google',
            code: 'INVALID_OAUTH_CODE',
            details: tokenData.error_description || tokenData.error
          }
        });
      }

      // Obtener informacion verificada del usuario desde Google userinfo
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      googleUser = await userInfoResponse.json();

      if (!userInfoResponse.ok || !googleUser.sub) {
        return res.status(401).json({
          ok: false,
          error: { message: 'no se pudo obtener el perfil de google', code: 'OAUTH_PROFILE_ERROR' }
        });
      }
    } else if (id_token) {
      // Caso 2: Se envio id_token para verificar mediante endpoint oficial de Google
      const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`);
      const tokenInfo = await verifyResponse.json();

      if (!verifyResponse.ok) {
        return res.status(401).json({
          ok: false,
          error: { message: 'token de google invalido o rechazado por google', code: 'INVALID_ID_TOKEN' }
        });
      }

      // Validacion estricta 1: Issuer
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (!validIssuers.includes(tokenInfo.iss)) {
        return res.status(401).json({
          ok: false,
          error: { message: 'emisor del token de google invalido', code: 'INVALID_ISSUER' }
        });
      }

      // Validacion estricta 2: Expiracion
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (tokenInfo.exp && Number(tokenInfo.exp) < nowSeconds) {
        return res.status(401).json({
          ok: false,
          error: { message: 'el token de google ha expirado', code: 'EXPIRED_ID_TOKEN' }
        });
      }

      // Validacion estricta 3: Audience (debe coincidir con GOOGLE_CLIENT_ID o GOOGLE_ANDROID_CLIENT_ID)
      const allowedAudiences = [
        clientId,
        process.env.GOOGLE_ANDROID_CLIENT_ID
      ].filter(Boolean);

      if (!allowedAudiences.includes(tokenInfo.aud)) {
        return res.status(401).json({
          ok: false,
          error: { message: 'token de google no destinado a esta aplicacion', code: 'INVALID_AUDIENCE' }
        });
      }

      googleUser = tokenInfo;
    } else {
      return res.status(400).json({
        ok: false,
        error: { message: 'debes enviar un code o un id_token de google', code: 'MISSING_OAUTH_PARAMS' }
      });
    }

    const providerUserId = String(googleUser.sub);
    const email = googleUser.email ? googleUser.email.trim().toLowerCase() : null;
    const emailVerified = googleUser.email_verified === true || googleUser.email_verified === 'true';
    const name = googleUser.name || (email ? email.split('@')[0] : 'Usuario Google');

    if (!providerUserId) {
      return res.status(400).json({
        ok: false,
        error: { message: 'google no devolvio un identificador de usuario valido', code: 'INVALID_GOOGLE_DATA' }
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Verificar si ya existe en social_accounts
    const [socialRows] = await connection.execute(
      `SELECT sa.id AS social_account_id, u.id AS id, u.name, u.email, u.role, u.is_active, u.token_version
       FROM social_accounts sa
       INNER JOIN users u ON sa.user_id = u.id
       WHERE sa.provider = 'google' AND sa.provider_user_id = ?`,
      [providerUserId]
    );

    let authenticatedUser;

    if (socialRows.length > 0) {
      // Cuenta social ya vinculada
      authenticatedUser = socialRows[0];
      if (!authenticatedUser.is_active) {
        await connection.rollback();
        return res.status(403).json({
          ok: false,
          error: { message: 'la cuenta se encuentra desactivada', code: 'ACCOUNT_INACTIVE' }
        });
      }
    } else {
      // 2. Si no esta vinculada, comprobar si existe un usuario con el mismo email verificado
      let existingUser = null;
      if (email && emailVerified) {
        const [userRows] = await connection.execute(
          'SELECT id, name, email, role, is_active, token_version FROM users WHERE email = ?',
          [email]
        );
        if (userRows.length > 0) {
          existingUser = userRows[0];
        }
      }

      if (existingUser) {
        if (!existingUser.is_active) {
          await connection.rollback();
          return res.status(403).json({
            ok: false,
            error: { message: 'la cuenta se encuentra desactivada', code: 'ACCOUNT_INACTIVE' }
          });
        }
        // Vincular la cuenta existente con el social_account verificado
        await connection.execute(
          'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
          [existingUser.id, 'google', providerUserId]
        );
        authenticatedUser = existingUser;
      } else {
        // 3. Crear nuevo usuario con rol estricto 'member' y password_hash = NULL
        const finalEmail = email || `google_${providerUserId}@fitmanager.social`;
        const verifiedAtValue = emailVerified ? new Date() : null;
        const [insertUserRes] = await connection.execute(
          'INSERT INTO users (name, email, password_hash, role, is_active, email_verified_at) VALUES (?, ?, NULL, ?, 1, ?)',
          [name, finalEmail, 'member', verifiedAtValue]
        );
        const newUserId = insertUserRes.insertId;

        // Crear registro en social_accounts
        await connection.execute(
          'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
          [newUserId, 'google', providerUserId]
        );

        authenticatedUser = {
          id: newUserId,
          name,
          email: finalEmail,
          role: 'member',
          is_active: 1,
          token_version: 1
        };
      }
    }

    await connection.commit();

    // Generar JWT de FitManager
    const jwtToken = generateToken(authenticatedUser);

    return res.status(200).json({
      ok: true,
      message: 'inicio de sesion con google exitoso',
      data: {
        token: jwtToken,
        user: {
          id: authenticatedUser.id || authenticatedUser.uid,
          name: authenticatedUser.name,
          email: authenticatedUser.email,
          role: authenticatedUser.role,
          is_active: authenticatedUser.is_active
        }
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

export function oauthGithub(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(501).json({
      ok: false,
      error: {
        message: 'el inicio de sesion con github no esta configurado en las variables de entorno',
        code: 'OAUTH_NOT_CONFIGURED',
        provider: 'github'
      }
    });
  }

  // Generar state criptográfico seguro para prevenir CSRF
  const state = generateOAuthState('github', 'android');

  const callbackUrl = process.env.GITHUB_CALLBACK_URL || 'https://fitmanager-backend-ekfc.onrender.com/api/auth/github/callback';
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=read:user%20user:email&state=${encodeURIComponent(state)}`;
  res.redirect(redirectUrl);
}

export async function oauthGithubCallback(req, res, next) {
  let connection;
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent(oauthError)}`);
    }

    // 1. Validar state de un solo uso
    const stateCheck = consumeOAuthState(state, 'github');
    if (!stateCheck.valid) {
      return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent('INVALID_OR_EXPIRED_STATE')}`);
    }

    if (!code) {
      return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent('MISSING_AUTH_CODE')}`);
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent('OAUTH_NOT_CONFIGURED')}`);
    }

    // 2. Canjear authorization code por access_token de GitHub
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent(tokenData.error || 'GITHUB_TOKEN_EXCHANGE_FAILED')}`);
    }

    const ghAccessToken = tokenData.access_token;

    // 3. Obtener perfil de GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${ghAccessToken}`,
        'User-Agent': 'FitManager-App'
      }
    });

    if (!userRes.ok) {
      return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent('GITHUB_PROFILE_ERROR')}`);
    }

    const ghUser = await userRes.json();
    const providerUserId = String(ghUser.id);

    // 4. Obtener emails de GitHub para encontrar el email primario y verificado
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${ghAccessToken}`,
        'User-Agent': 'FitManager-App'
      }
    });

    let verifiedEmail = null;
    if (emailsRes.ok) {
      const emails = await emailsRes.json();
      if (Array.isArray(emails)) {
        const primaryVerified = emails.find(e => e.primary && e.verified);
        if (primaryVerified) {
          verifiedEmail = primaryVerified.email.trim().toLowerCase();
        } else {
          const anyVerified = emails.find(e => e.verified);
          if (anyVerified) {
            verifiedEmail = anyVerified.email.trim().toLowerCase();
          }
        }
      }
    }

    if (!verifiedEmail && ghUser.email) {
      verifiedEmail = ghUser.email.trim().toLowerCase();
    }

    if (!verifiedEmail) {
      return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent('GITHUB_EMAIL_NOT_VERIFIED')}`);
    }

    const name = ghUser.name || ghUser.login || verifiedEmail.split('@')[0];

    // 5. Vincular o crear usuario en la base de datos
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [socialRows] = await connection.execute(
      `SELECT sa.id AS social_account_id, u.id AS id, u.name, u.email, u.role, u.is_active, u.token_version
       FROM social_accounts sa
       INNER JOIN users u ON sa.user_id = u.id
       WHERE sa.provider = 'github' AND sa.provider_user_id = ?`,
      [providerUserId]
    );

    let authenticatedUser;

    if (socialRows.length > 0) {
      authenticatedUser = socialRows[0];
      if (!authenticatedUser.is_active) {
        await connection.rollback();
        return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent('ACCOUNT_INACTIVE')}`);
      }
    } else {
      // Buscar si ya existe por email verificado
      const [userRows] = await connection.execute(
        'SELECT id, name, email, role, is_active, token_version FROM users WHERE email = ?',
        [verifiedEmail]
      );

      let existingUser = userRows.length > 0 ? userRows[0] : null;

      if (existingUser) {
        if (!existingUser.is_active) {
          await connection.rollback();
          return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent('ACCOUNT_INACTIVE')}`);
        }
        await connection.execute(
          'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
          [existingUser.id, 'github', providerUserId]
        );
        authenticatedUser = existingUser;
      } else {
        // Crear nuevo usuario con rol estricto 'member' y token_version 1
        const [insertUserRes] = await connection.execute(
          'INSERT INTO users (name, email, password_hash, role, is_active, email_verified_at) VALUES (?, ?, NULL, ?, 1, NOW())',
          [name, verifiedEmail, 'member']
        );
        const newUserId = insertUserRes.insertId;

        await connection.execute(
          'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
          [newUserId, 'github', providerUserId]
        );

        authenticatedUser = {
          id: newUserId,
          name,
          email: verifiedEmail,
          role: 'member',
          is_active: 1,
          token_version: 1
        };
      }
    }

    await connection.commit();

    // 6. Generar ticket de un solo uso para redirigir a la APK
    const ticket = createLoginTicket(authenticatedUser, 'github');

    return res.redirect(`fitmanager://oauth/github?ticket=${encodeURIComponent(ticket)}`);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    console.error('[oauthGithubCallback] Error:', error.message);
    return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent('INTERNAL_SERVER_ERROR')}`);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

export function oauthDiscord(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return res.status(501).json({
      ok: false,
      error: {
        message: 'el inicio de sesion con discord no esta configurado en las variables de entorno',
        code: 'OAUTH_NOT_CONFIGURED',
        provider: 'discord'
      }
    });
  }

  // Generar state criptográfico seguro para prevenir CSRF
  const state = generateOAuthState('discord', 'android');

  const callbackUrl = process.env.DISCORD_CALLBACK_URL || 'https://fitmanager-backend-ekfc.onrender.com/api/auth/discord/callback';
  const redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=identify%20email&state=${encodeURIComponent(state)}`;
  res.redirect(redirectUrl);
}

export async function oauthDiscordCallback(req, res, next) {
  let connection;
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent(oauthError)}`);
    }

    // 1. Validar state de un solo uso
    const stateCheck = consumeOAuthState(state, 'discord');
    if (!stateCheck.valid) {
      return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent('INVALID_OR_EXPIRED_STATE')}`);
    }

    if (!code) {
      return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent('MISSING_AUTH_CODE')}`);
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const callbackUrl = process.env.DISCORD_CALLBACK_URL || 'https://fitmanager-backend-ekfc.onrender.com/api/auth/discord/callback';

    if (!clientId || !clientSecret) {
      return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent('OAUTH_NOT_CONFIGURED')}`);
    }

    // 2. Canjear authorization code por token de Discord
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl
    });

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenParams.toString()
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent(tokenData.error || 'DISCORD_TOKEN_EXCHANGE_FAILED')}`);
    }

    const discordAccessToken = tokenData.access_token;

    // 3. Obtener perfil del usuario desde Discord API
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${discordAccessToken}`
      }
    });

    if (!userRes.ok) {
      return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent('DISCORD_PROFILE_ERROR')}`);
    }

    const discordUser = await userRes.json();
    const providerUserId = String(discordUser.id);

    // 4. Verificar email obligatorio y verificado
    if (!discordUser.email || discordUser.verified !== true) {
      return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent('DISCORD_EMAIL_NOT_VERIFIED')}`);
    }

    const verifiedEmail = discordUser.email.trim().toLowerCase();
    const name = discordUser.global_name || discordUser.username || verifiedEmail.split('@')[0];

    // 5. Vincular o crear usuario en MariaDB
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [socialRows] = await connection.execute(
      `SELECT sa.id AS social_account_id, u.id AS id, u.name, u.email, u.role, u.is_active, u.token_version
       FROM social_accounts sa
       INNER JOIN users u ON sa.user_id = u.id
       WHERE sa.provider = 'discord' AND sa.provider_user_id = ?`,
      [providerUserId]
    );

    let authenticatedUser;

    if (socialRows.length > 0) {
      authenticatedUser = socialRows[0];
      if (!authenticatedUser.is_active) {
        await connection.rollback();
        return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent('ACCOUNT_INACTIVE')}`);
      }
    } else {
      // Buscar si ya existe por email verificado
      const [userRows] = await connection.execute(
        'SELECT id, name, email, role, is_active, token_version FROM users WHERE email = ?',
        [verifiedEmail]
      );

      let existingUser = userRows.length > 0 ? userRows[0] : null;

      if (existingUser) {
        if (!existingUser.is_active) {
          await connection.rollback();
          return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent('ACCOUNT_INACTIVE')}`);
        }
        await connection.execute(
          'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
          [existingUser.id, 'discord', providerUserId]
        );
        authenticatedUser = existingUser;
      } else {
        // Crear nuevo usuario con rol estricto 'member' y token_version 1
        const [insertUserRes] = await connection.execute(
          'INSERT INTO users (name, email, password_hash, role, is_active, email_verified_at) VALUES (?, ?, NULL, ?, 1, NOW())',
          [name, verifiedEmail, 'member']
        );
        const newUserId = insertUserRes.insertId;

        await connection.execute(
          'INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
          [newUserId, 'discord', providerUserId]
        );

        authenticatedUser = {
          id: newUserId,
          name,
          email: verifiedEmail,
          role: 'member',
          is_active: 1,
          token_version: 1
        };
      }
    }

    await connection.commit();

    // 6. Generar ticket de un solo uso para redirigir a la APK
    const ticket = createLoginTicket(authenticatedUser, 'discord');

    return res.redirect(`fitmanager://oauth/discord?ticket=${encodeURIComponent(ticket)}`);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    console.error('[oauthDiscordCallback] Error:', error.message);
    return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent('INTERNAL_SERVER_ERROR')}`);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Endpoint de canje de ticket por JWT para la APK (POST /api/auth/oauth/exchange-ticket)
 * Recibe { ticket }, lo valida, lo invalida (un solo uso) y emite el JWT oficial de FitManager.
 */
export async function exchangeOAuthTicket(req, res, next) {
  try {
    const { ticket } = req.body;

    if (!ticket || typeof ticket !== 'string') {
      return res.status(400).json({
        ok: false,
        error: { message: 'debes proporcionar un ticket de intercambio válido', code: 'MISSING_TICKET' }
      });
    }

    const ticketResult = consumeLoginTicket(ticket);
    if (!ticketResult.valid) {
      return res.status(401).json({
        ok: false,
        error: {
          message: 'el ticket de autenticación es inválido, expiró o ya fue utilizado',
          code: ticketResult.error || 'INVALID_TICKET'
        }
      });
    }

    const user = ticketResult.user;

    // Verificar en base de datos el token_version actual
    let tokenVersion = 1;
    try {
      const [uRows] = await pool.execute('SELECT token_version, is_active FROM users WHERE id = ? LIMIT 1', [user.id]);
      if (uRows.length > 0) {
        if (!uRows[0].is_active) {
          return res.status(403).json({
            ok: false,
            error: { message: 'la cuenta se encuentra desactivada', code: 'ACCOUNT_INACTIVE' }
          });
        }
        tokenVersion = uRows[0].token_version || 1;
      }
    } catch {}

    user.token_version = tokenVersion;

    // Generar JWT oficial de FitManager
    const jwtToken = generateToken(user);

    return res.status(200).json({
      ok: true,
      message: `inicio de sesión con ${ticketResult.provider} exitoso`,
      data: {
        token: jwtToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          is_active: user.is_active
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// Inicializacion segura del primer administrador del sistema
// Reglas estrictas:
// 1. Requiere OBLIGATORIAMENTE que SETUP_ADMIN_KEY este configurada en variables de entorno.
// 2. Requiere que la peticion envie la cabecera 'x-setup-key' coincidente con SETUP_ADMIN_KEY.
// 3. Emplea un bloqueo exclusivo a nivel de MariaDB (GET_LOCK) para evitar condiciones de carrera concurrentes.
// 4. Si ya existe un administrador en la base de datos, rechaza con 403 y se sella de forma permanente.
export async function setupFirstAdmin(req, res, next) {
  const requiredSetupKey = process.env.SETUP_ADMIN_KEY;

  // 1. Si no hay clave configurada en el servidor, el endpoint esta estrictamente DESHABILITADO
  if (!requiredSetupKey || typeof requiredSetupKey !== 'string' || requiredSetupKey.trim().length === 0) {
    return res.status(403).json({
      ok: false,
      error: {
        message: 'la inicializacion de administrador esta deshabilitada en este entorno',
        code: 'SETUP_DISABLED'
      }
    });
  }

  // 2. Verificar cabecera x-setup-key
  const clientSetupKey = req.headers['x-setup-key'];
  if (!clientSetupKey || clientSetupKey !== requiredSetupKey) {
    return res.status(401).json({
      ok: false,
      error: {
        message: 'clave de aprovisionamiento no proporcionada o invalida',
        code: 'INVALID_SETUP_KEY'
      }
    });
  }

  const { name, email, password } = req.body;

  // Validaciones
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: { message: 'el nombre es obligatorio', code: 'INVALID_NAME' }
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      ok: false,
      error: { message: 'el correo electronico no es valido', code: 'INVALID_EMAIL' }
    });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({
      ok: false,
      error: { message: 'la contrasena debe tener al menos 6 caracteres', code: 'INVALID_PASSWORD' }
    });
  }

  let connection;
  let lockAcquired = false;

  try {
    connection = await pool.getConnection();

    // 3. Mecanismo de exclusion mutua en MariaDB (GET_LOCK) para prevenir concurrencia
    const [lockResult] = await connection.execute("SELECT GET_LOCK('fitmanager_admin_setup_lock', 10) AS acquired");
    if (!lockResult || lockResult[0]?.acquired !== 1) {
      return res.status(409).json({
        ok: false,
        error: { message: 'operacion de inicializacion en curso, intente nuevamente', code: 'SETUP_LOCKED' }
      });
    }
    lockAcquired = true;

    // 4. Comprobar si ya existe AL MENOS UN administrador en el sistema
    const [adminRows] = await connection.execute(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (adminRows.length > 0) {
      return res.status(403).json({
        ok: false,
        error: {
          message: 'el sistema ya cuenta con un administrador configurado; no es posible inicializar otro por esta via',
          code: 'ADMIN_ALREADY_EXISTS'
        }
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Comprobar si el correo ya existe
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        ok: false,
        error: { message: 'el correo electronico ya esta registrado', code: 'EMAIL_ALREADY_EXISTS' }
      });
    }

    // 5. Hash de contrasena con bcrypt (sin imprimir ni registrar la contrasena)
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await connection.beginTransaction();

    const [insertResult] = await connection.execute(
      "INSERT INTO users (name, email, password_hash, role, is_active, email_verified_at) VALUES (?, ?, ?, 'admin', 1, NOW())",
      [name.trim(), cleanEmail, passwordHash]
    );

    await connection.commit();

    const newAdmin = {
      id: insertResult.insertId,
      name: name.trim(),
      email: cleanEmail,
      role: 'admin',
      is_active: 1,
      token_version: 1
    };

    const token = generateToken(newAdmin);

    return res.status(201).json({
      ok: true,
      message: 'primer administrador inicializado exitosamente',
      data: {
        token,
        user: newAdmin
      }
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    next(error);
  } finally {
    if (connection) {
      if (lockAcquired) {
        try {
          await connection.execute("SELECT RELEASE_LOCK('fitmanager_admin_setup_lock')");
        } catch {}
      }
      connection.release();
    }
  }
}

// ==============================================================================
// RECUPERACIÓN DE CONTRASEÑA (PASSWORD RESET)
// ==============================================================================

const GENERIC_FORGOT_PASSWORD_MSG = 'si el correo está registrado y cuenta con contraseña local, te enviamos un código de recuperación';

/**
 * 1. Solicitar recuperación de contraseña (POST /api/auth/forgot-password)
 * Respuesta genérica garantizada para evitar enumeración de usuarios.
 */
export async function forgotPassword(req, res, next) {
  let connection;
  let newResetId = null;
  let resetCode = null;
  let recipientEmail = null;
  let recipientName = null;

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'debes ingresar un correo electrónico válido', code: 'INVALID_EMAIL' }
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Buscar usuario por email con bloqueo transaccional
    const [users] = await connection.execute(
      'SELECT id, name, email, password_hash, is_active FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
      [cleanEmail]
    );

    // Si no existe, responder 200 genérico para prevenir enumeración de usuarios
    if (users.length === 0) {
      await connection.rollback();
      return res.status(200).json({
        ok: true,
        message: GENERIC_FORGOT_PASSWORD_MSG
      });
    }

    const user = users[0];

    // Si la cuenta está inactiva o es exclusiva de Google (sin password_hash), responder 200 genérico
    if (!user.is_active || !user.password_hash) {
      await connection.rollback();
      return res.status(200).json({
        ok: true,
        message: GENERIC_FORGOT_PASSWORD_MSG
      });
    }

    // 2. Comprobar protección contra spam / cooldown (60 segundos)
    // Solo considera solicitudes activas (used_at IS NULL). Si un envío previo falló y se invalidó, no bloquea al usuario.
    const [recentCodes] = await connection.execute(
      `SELECT id, created_at, TIMESTAMPDIFF(SECOND, created_at, NOW()) AS seconds_ago
       FROM password_resets
       WHERE user_id = ? AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    if (recentCodes.length > 0 && recentCodes[0].seconds_ago !== null && recentCodes[0].seconds_ago < RESEND_COOLDOWN_SECONDS) {
      // Cooldown activo: respuesta genérica equivalente sin emitir nuevo código para evitar spam
      await connection.rollback();
      return res.status(200).json({
        ok: true,
        message: GENERIC_FORGOT_PASSWORD_MSG
      });
    }

    // 3. Generar código criptográfico aleatorio de 6 dígitos
    const code = generate6DigitCode();
    const codeHash = hashVerificationCode(code);

    // Invalidar códigos anteriores no utilizados
    await connection.execute(
      'UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );

    // Guardar nuevo código con expiración a 10 minutos
    const [insertResult] = await connection.execute(
      `INSERT INTO password_resets (user_id, code_hash, attempts, expires_at, created_at)
       VALUES (?, ?, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())`,
      [user.id, codeHash, CODE_EXPIRATION_MINUTES]
    );

    newResetId = insertResult.insertId;
    resetCode = code;
    recipientEmail = user.email;
    recipientName = user.name;

    await connection.commit();
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    return next(error);
  } finally {
    if (connection) {
      connection.release();
      connection = null;
    }
  }

  // 4. Si se generó un código, intentar el envío mediante el servicio de correo (GAS)
  if (newResetId && resetCode && recipientEmail) {
    try {
      await sendPasswordResetCodeEmail(recipientEmail, recipientName, resetCode);
    } catch (err) {
      const details = err.code ? `code=${err.code}` : null;
      console.error(
        `[emailService] No se pudo confirmar la entrega del código de recuperación por GAS (ID ${newResetId}): ${err.message}${details ? ` (${details})` : ''}. El código fue invalidado preventivamente.`
      );

      // Invalida inmediatamente el código creado para que no quede un código activo que el usuario nunca recibió
      try {
        await pool.execute(
          'UPDATE password_resets SET used_at = NOW() WHERE id = ?',
          [newResetId]
        );
      } catch (cleanupErr) {
        console.error(`[emailService] Error al invalidar código huérfano ID ${newResetId}: ${cleanupErr.message}`);
      }
    }
  }

  // Respuesta genérica idéntica para correos existentes, inexistentes o fallos de proveedor externo
  return res.status(200).json({
    ok: true,
    message: GENERIC_FORGOT_PASSWORD_MSG
  });
}

/**
 * 2. Verificar código de recuperación (POST /api/auth/verify-reset-code)
 * Valida el código de 6 dígitos, lo marca como utilizado y genera un reset_token temporal.
 */
export async function verifyResetCode(req, res, next) {
  let connection;
  try {
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

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Bloquear usuario con FOR UPDATE
    const [users] = await connection.execute(
      'SELECT id, name, email, is_active FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
      [cleanEmail]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'el código de recuperación es inválido o ha expirado', code: 'INVALID_RESET_CODE' }
      });
    }

    const user = users[0];

    // Bloquear registro más reciente de password_resets
    const [codes] = await connection.execute(
      `SELECT id, code_hash, attempts, expires_at, used_at,
              TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_to_expire
       FROM password_resets
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [user.id]
    );

    if (codes.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'no hay ninguna solicitud de recuperación activa para esta cuenta', code: 'NO_RESET_REQUEST' }
      });
    }

    const resetRow = codes[0];

    if (resetRow.used_at !== null) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'este código de recuperación ya fue utilizado', code: 'CODE_ALREADY_USED' }
      });
    }

    if (resetRow.seconds_to_expire <= 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'el código de recuperación ha expirado, solicitá uno nuevo', code: 'CODE_EXPIRED' }
      });
    }

    if (resetRow.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'superaste el límite de intentos permitidos, solicitá un nuevo código', code: 'MAX_ATTEMPTS_EXCEEDED' }
      });
    }

    // Comprobar hash del código
    const providedHash = hashVerificationCode(cleanCode);
    if (providedHash !== resetRow.code_hash) {
      const newAttempts = resetRow.attempts + 1;
      await connection.execute(
        'UPDATE password_resets SET attempts = ? WHERE id = ?',
        [newAttempts, resetRow.id]
      );
      await connection.commit();

      const remaining = MAX_VERIFICATION_ATTEMPTS - newAttempts;
      return res.status(400).json({
        ok: false,
        error: {
          message: remaining > 0 
            ? `código incorrecto. te quedan ${remaining} intento${remaining === 1 ? '' : 's'}`
            : 'código incorrecto. has superado el límite de intentos',
          code: 'INVALID_CODE',
          attempts_remaining: Math.max(0, remaining)
        }
      });
    }

    // Código válido: generar reset_token temporal (15 minutos)
    const secret = process.env.JWT_SECRET || 'desarrollo_fitmanager_secreto_local_jwt';
    const jti = crypto.randomUUID();
    const resetToken = jwt.sign(
      {
        userId: user.id,
        purpose: 'password_reset',
        jti
      },
      secret,
      { expiresIn: '15m' }
    );
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Marcar código como usado y almacenar hash del reset_token para control de un solo uso
    await connection.execute(
      `UPDATE password_resets
       SET used_at = NOW(),
           reset_token_hash = ?,
           reset_token_expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
       WHERE id = ?`,
      [resetTokenHash, resetRow.id]
    );

    await connection.commit();

    return res.status(200).json({
      ok: true,
      message: 'código verificado exitosamente',
      data: {
        reset_token: resetToken
      }
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * 3. Restablecer contraseña con reset_token (POST /api/auth/reset-password)
 * Invalida el token tras el cambio (un solo uso garantizado en base de datos).
 */
export async function resetPassword(req, res, next) {
  let connection;
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: { message: 'debes ingresar el token de recuperación y la nueva contraseña', code: 'MISSING_PARAMETERS' }
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'la contrasena debe tener al menos 6 caracteres', code: 'INVALID_PASSWORD' }
      });
    }

    // Verificar firma y expiración del JWT
    const secret = process.env.JWT_SECRET || 'desarrollo_fitmanager_secreto_local_jwt';
    let decoded;
    try {
      decoded = jwt.verify(resetToken, secret);
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

    // 3. OPTIMIZACIÓN DE RENDIMIENTO: Generar nuevo hash bcrypt FUERA de la transacción SQL
    // Esto reduce el tiempo de bloqueo de fila en MariaDB de ~100ms a menos de 2ms
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Bloquear registro de reset_token con FOR UPDATE
    const [rows] = await connection.execute(
      `SELECT id, user_id, reset_token_expires_at, reset_completed_at,
              TIMESTAMPDIFF(SECOND, NOW(), reset_token_expires_at) AS seconds_left
       FROM password_resets
       WHERE reset_token_hash = ? AND user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [resetTokenHash, decoded.userId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(401).json({
        ok: false,
        error: { message: 'el token de restablecimiento no existe o no corresponde a este usuario', code: 'RESET_TOKEN_NOT_FOUND' }
      });
    }

    const resetRecord = rows[0];

    // Control estricto de UN SOLO USO: rechazar si ya fue completado
    if (resetRecord.reset_completed_at !== null) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'este token de restablecimiento ya fue utilizado', code: 'RESET_TOKEN_ALREADY_USED' }
      });
    }

    if (resetRecord.seconds_left <= 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'el token de restablecimiento ha expirado', code: 'RESET_TOKEN_EXPIRED' }
      });
    }

    // Actualizar contraseña e incrementar token_version para invalidar atómicamente todos los JWTs anteriores
    await connection.execute(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      [newPasswordHash, decoded.userId]
    );

    // Marcar el reset_token como completado (invalidación permanente de un solo uso)
    await connection.execute(
      'UPDATE password_resets SET reset_completed_at = NOW() WHERE id = ?',
      [resetRecord.id]
    );

    // Invalidar cualquier otra solicitud pendiente de recuperación para este usuario
    await connection.execute(
      'UPDATE password_resets SET used_at = IFNULL(used_at, NOW()) WHERE user_id = ? AND id != ?',
      [decoded.userId, resetRecord.id]
    );

    // Invalidar cualquier código de recuperación residual en auth_codes si la tabla existe
    try {
      await connection.execute(
        "UPDATE auth_codes SET used_at = IFNULL(used_at, NOW()) WHERE user_id = ? AND type = 'password_reset' AND used_at IS NULL",
        [decoded.userId]
      );
    } catch {}

    await connection.commit();

    return res.status(200).json({
      ok: true,
      message: 'tu contraseña ha sido actualizada exitosamente'
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

