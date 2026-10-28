import pool from '../config/db.js';
import { isValidEmail, isValidRole } from '../middlewares/validate.js';

// listar usuarios (admin ve todos; trainer ve socios activos disponibles para asignar)
export async function listUsers(req, res, next) {
  try {
    const { role } = req.user;

    let sql = 'SELECT id, name, email, role, is_active, created_at FROM users';
    const params = [];

    if (role === 'trainer') {
      sql += ' WHERE role = "member" AND is_active = 1';
    }

    sql += ' ORDER BY created_at DESC';

    const [users] = await pool.execute(sql, params);

    return res.status(200).json({
      ok: true,
      data: { users }
    });
  } catch (error) {
    next(error);
  }
}

// obtener usuario por id (admin, entrenador o el mismo usuario)
export async function getUserById(req, res, next) {
  try {
    const { id } = req.params;

    // permisos: solo admin, trainer o el propio usuario pueden ver el detalle
    if (req.user.role === 'member' && String(req.user.id) !== String(id)) {
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permisos para ver este perfil', code: 'FORBIDDEN' }
      });
    }

    const [rows] = await pool.execute(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'usuario no encontrado', code: 'USER_NOT_FOUND' }
      });
    }

    return res.status(200).json({
      ok: true,
      data: { user: rows[0] }
    });
  } catch (error) {
    next(error);
  }
}

// actualizar rol o estado de un usuario (solo admin)
export async function updateUserRoleOrStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { role, is_active } = req.body;

    if (role && !isValidRole(role)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el rol no es valido', code: 'INVALID_ROLE' }
      });
    }

    const [existing] = await pool.execute(
      'SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'usuario no encontrado', code: 'USER_NOT_FOUND' }
      });
    }

    const current = existing[0];
    const newRole = role !== undefined ? role : current.role;
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : current.is_active;

    await pool.execute(
      'UPDATE users SET role = ?, is_active = ? WHERE id = ?',
      [newRole, newStatus, id]
    );

    return res.status(200).json({
      ok: true,
      message: 'usuario actualizado exitosamente',
      data: {
        id: Number(id),
        role: newRole,
        is_active: newStatus
      }
    });
  } catch (error) {
    next(error);
  }
}
