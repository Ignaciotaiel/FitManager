import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { isValidEmail, isValidPassword, isValidRole } from '../middlewares/validate.js';

// duracion del salt para hash con bcrypt
const SALT_ROUNDS = 10;

// funcion auxiliar para generar token jwt
function generateToken(user) {
  const secret = process.env.JWT_SECRET || 'desarrollo_fitmanager_secreto_local_jwt';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    secret,
    { expiresIn }
  );
}

// registro de usuario local (con contrasena protegida por bcrypt)
// REGLA DE SEGURIDAD: Todo registro público crea estrictamente usuarios con rol 'member'
export async function register(req, res, next) {
  try {
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

    // comprobar si el correo ya esta registrado (consulta parametrizada)
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        ok: false,
        error: { message: 'el correo electronico ya esta registrado', code: 'EMAIL_ALREADY_EXISTS' }
      });
    }

    // hash seguro de contrasena con bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // insercion parametrizada
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)',
      [name.trim(), cleanEmail, passwordHash, finalRole]
    );

    const newUser = {
      id: result.insertId,
      name: name.trim(),
      email: cleanEmail,
      role: finalRole,
      is_active: 1
    };

    const token = generateToken(newUser);

    // respondemos sin exponer hashes ni contrasenas
    return res.status(201).json({
      ok: true,
      message: 'usuario registrado exitosamente',
      data: {
        token,
        user: newUser
      }
    });
  } catch (error) {
    next(error);
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
      'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1',
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

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active
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
      `SELECT sa.id AS social_account_id, u.id AS id, u.name, u.email, u.role, u.is_active
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
          'SELECT id, name, email, role, is_active FROM users WHERE email = ?',
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
        const [insertUserRes] = await connection.execute(
          'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, NULL, ?, 1)',
          [name, finalEmail, 'member']
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
          is_active: 1
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

  const callbackUrl = process.env.GITHUB_CALLBACK_URL;
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=read:user%20user:email`;
  res.redirect(redirectUrl);
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

  const callbackUrl = process.env.DISCORD_CALLBACK_URL;
  const redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=identify%20email`;
  res.redirect(redirectUrl);
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
      "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'admin', 1)",
      [name.trim(), cleanEmail, passwordHash]
    );

    await connection.commit();

    const newAdmin = {
      id: insertResult.insertId,
      name: name.trim(),
      email: cleanEmail,
      role: 'admin',
      is_active: 1
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
