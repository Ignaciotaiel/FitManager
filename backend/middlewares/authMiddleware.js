import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

// middleware para verificar el token jwt y el estado real del usuario en mariadb
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      error: {
        message: 'token de autenticacion no proporcionado',
        code: 'UNAUTHORIZED'
      }
    });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'desarrollo_fitmanager_secreto_local_jwt';

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: {
        message: 'token invalido o expirado',
        code: 'INVALID_TOKEN'
      }
    });
  }

  // consultar la base de datos para verificar que el usuario exista y este activo
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, is_active, token_version FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: {
          message: 'el usuario asociado al token no existe',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    const user = rows[0];

    // comprobar si la cuenta se encuentra activa
    if (user.is_active !== 1 && user.is_active !== true) {
      return res.status(401).json({
        ok: false,
        error: {
          message: 'la cuenta se encuentra desactivada',
          code: 'ACCOUNT_INACTIVE'
        }
      });
    }

    // Validación estricta de token_version (invalidación de sesiones previas)
    // Conversión explícita a números enteros para prevenir falsos rechazos si el driver entrega strings
    const tokenVersionJwt = Number(decoded.token_version);
    const tokenVersionDb = Number(user.token_version);

    if (
      decoded.token_version === undefined ||
      decoded.token_version === null ||
      !Number.isInteger(tokenVersionJwt) ||
      !Number.isInteger(tokenVersionDb) ||
      tokenVersionJwt !== tokenVersionDb
    ) {
      return res.status(401).json({
        ok: false,
        error: {
          message: 'sesion revocada o expirada por cambio de seguridad. por favor inicia sesion nuevamente',
          code: 'SESSION_REVOKED'
        }
      });
    }

    // inyectar req.user con los datos vigentes reales de mariadb (incluyendo el rol actual)
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (dbError) {
    // si ocurre un error de base de datos, no concedemos acceso y devolvemos 500 controlado
    return res.status(500).json({
      ok: false,
      error: {
        message: 'error al verificar el estado del usuario en el servidor',
        code: 'AUTH_VERIFICATION_FAILED'
      }
    });
  }
}

// middleware para autorizar el acceso segun el rol del usuario (leido en tiempo real desde la base)
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: {
          message: 'usuario no autenticado',
          code: 'UNAUTHORIZED'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        ok: false,
        error: {
          message: 'no tienes permisos suficientes para realizar esta accion',
          code: 'FORBIDDEN'
        }
      });
    }

    next();
  };
}
