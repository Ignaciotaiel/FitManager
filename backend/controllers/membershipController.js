import pool from '../config/db.js';

// funcion utilitaria para validar formato de fecha YYYY-MM-DD
function isValidDate(dateString) {
  if (typeof dateString !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  const timestamp = date.getTime();
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) return false;
  return date.toISOString().startsWith(dateString);
}

// funcion utilitaria para formatear objetos Date a 'YYYY-MM-DD'
function formatDateString(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    return val.substring(0, 10);
  }
  if (val instanceof Date) {
    return val.toISOString().substring(0, 10);
  }
  return val;
}

// computa el estado efectivo: si end_date < hoy y estaba 'active', se computa como 'expired'
// si estaba 'cancelled', se mantiene 'cancelled'
function computeMembershipStatus(row) {
  const today = new Date().toISOString().substring(0, 10);
  const endDateStr = formatDateString(row.end_date);
  const startDateStr = formatDateString(row.start_date);

  let effectiveStatus = row.status;
  if (row.status === 'active' && endDateStr && endDateStr < today) {
    effectiveStatus = 'expired';
  }

  return {
    ...row,
    start_date: startDateStr,
    end_date: endDateStr,
    status: effectiveStatus,
    db_status: row.status
  };
}

// listar membresias con filtros opcionales (solo admin)
export async function listMemberships(req, res, next) {
  try {
    const { status, user_id } = req.query;

    let sql = `
      SELECT 
        m.id,
        m.user_id,
        m.start_date,
        m.end_date,
        m.status,
        m.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM memberships m
      INNER JOIN users u ON m.user_id = u.id
    `;
    const params = [];
    const whereClauses = [];

    if (user_id) {
      const parsedUserId = Number(user_id);
      if (Number.isInteger(parsedUserId) && parsedUserId > 0) {
        whereClauses.push('m.user_id = ?');
        params.push(parsedUserId);
      }
    }

    if (status && ['active', 'expired', 'cancelled'].includes(status)) {
      whereClauses.push('m.status = ?');
      params.push(status);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' ORDER BY m.created_at DESC, m.id DESC';

    const [rows] = await pool.execute(sql, params);

    // mapear estado calculado de vencimiento
    const formatted = rows.map(computeMembershipStatus);

    return res.status(200).json({
      ok: true,
      data: { memberships: formatted }
    });
  } catch (error) {
    next(error);
  }
}

// consulta de la membresia propia del socio autenticado (member o admin)
export async function getMyMembership(req, res, next) {
  try {
    const userId = req.user.id;

    // obtenemos la membresia mas reciente del usuario
    const sql = `
      SELECT 
        m.id,
        m.user_id,
        m.start_date,
        m.end_date,
        m.status,
        m.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM memberships m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.user_id = ?
      ORDER BY 
        CASE WHEN m.status = 'active' THEN 1 ELSE 2 END,
        m.end_date DESC,
        m.id DESC
      LIMIT 1
    `;

    const [rows] = await pool.execute(sql, [userId]);

    if (rows.length === 0) {
      return res.status(200).json({
        ok: true,
        data: { membership: null }
      });
    }

    const membership = computeMembershipStatus(rows[0]);

    return res.status(200).json({
      ok: true,
      data: { membership }
    });
  } catch (error) {
    next(error);
  }
}

// obtener detalle de una membresia por ID (solo admin)
export async function getMembershipById(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de membresia invalido', code: 'INVALID_ID' }
      });
    }

    const sql = `
      SELECT 
        m.id,
        m.user_id,
        m.start_date,
        m.end_date,
        m.status,
        m.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM memberships m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `;

    const [rows] = await pool.execute(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'membresia no encontrada', code: 'MEMBERSHIP_NOT_FOUND' }
      });
    }

    const membership = computeMembershipStatus(rows[0]);

    return res.status(200).json({
      ok: true,
      data: { membership }
    });
  } catch (error) {
    next(error);
  }
}

// crear una membresia para un usuario existente con rol member (solo admin)
export async function createMembership(req, res, next) {
  let connection;
  try {
    const { user_id, start_date, end_date, status = 'active' } = req.body;

    // validacion de user_id
    const parsedUserId = Number(user_id);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el identificador del socio es obligatorio y debe ser valido', code: 'INVALID_USER_ID' }
      });
    }

    // validacion de fechas
    if (!start_date || !isValidDate(start_date)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'la fecha de inicio (start_date) es obligatoria y debe tener formato YYYY-MM-DD', code: 'INVALID_START_DATE' }
      });
    }

    if (end_date !== null && end_date !== undefined) {
      if (!isValidDate(end_date)) {
        return res.status(400).json({
          ok: false,
          error: { message: 'la fecha de fin (end_date) debe tener formato YYYY-MM-DD valido', code: 'INVALID_END_DATE' }
        });
      }

      if (end_date < start_date) {
        return res.status(400).json({
          ok: false,
          error: { message: 'la fecha de fin no puede ser anterior a la fecha de inicio', code: 'INVALID_DATE_RANGE' }
        });
      }
    }

    // validacion de status
    const allowedStatuses = ['active', 'expired', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el estado debe ser active, expired o cancelled', code: 'INVALID_STATUS' }
      });
    }

    // verificacion del socio en MariaDB
    const [userRows] = await pool.execute(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [parsedUserId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'el socio destinatario no existe en el sistema', code: 'USER_NOT_FOUND' }
      });
    }

    const targetUser = userRows[0];
    if (targetUser.role !== 'member') {
      return res.status(400).json({
        ok: false,
        error: { message: 'solo los usuarios con rol member pueden tener una membresia asignada', code: 'INVALID_USER_ROLE' }
      });
    }

    // transaccion para insercion segura
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // regla de negocio documentada: si se crea una membresia 'active', cualquier membresia
    // previa del socio que estuviera en 'active' se pasa a 'cancelled' (o 'expired' si ya paso su fecha)
    // para mantener una sola membresia activa vigente por socio
    if (status === 'active') {
      const today = new Date().toISOString().substring(0, 10);
      await connection.execute(
        `UPDATE memberships 
         SET status = CASE 
           WHEN end_date IS NOT NULL AND end_date < ? THEN 'expired' 
           ELSE 'cancelled' 
         END 
         WHERE user_id = ? AND status = 'active'`,
        [today, parsedUserId]
      );
    }

    const insertSql = `
      INSERT INTO memberships (user_id, start_date, end_date, status)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await connection.execute(insertSql, [
      parsedUserId,
      start_date,
      end_date || null,
      status
    ]);

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: 'membresia creada exitosamente',
      data: {
        membership: computeMembershipStatus({
          id: result.insertId,
          user_id: parsedUserId,
          user_name: targetUser.name,
          user_email: targetUser.email,
          start_date,
          end_date: end_date || null,
          status,
          created_at: new Date().toISOString()
        })
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

// actualizar una membresia existente (fechas o estado) (solo admin)
export async function updateMembership(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { start_date, end_date, status } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de membresia invalido', code: 'INVALID_ID' }
      });
    }

    // buscar membresia actual
    const [existingRows] = await pool.execute(
      'SELECT id, user_id, start_date, end_date, status FROM memberships WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'membresia no encontrada', code: 'MEMBERSHIP_NOT_FOUND' }
      });
    }

    const current = existingRows[0];
    const updates = [];
    const params = [];

    let newStartDate = current.start_date ? formatDateString(current.start_date) : null;
    let newEndDate = current.end_date ? formatDateString(current.end_date) : null;

    if (start_date !== undefined) {
      if (!isValidDate(start_date)) {
        return res.status(400).json({
          ok: false,
          error: { message: 'la fecha de inicio debe tener formato YYYY-MM-DD valido', code: 'INVALID_START_DATE' }
        });
      }
      newStartDate = start_date;
      updates.push('start_date = ?');
      params.push(start_date);
    }

    if (end_date !== undefined) {
      if (end_date !== null) {
        if (!isValidDate(end_date)) {
          return res.status(400).json({
            ok: false,
            error: { message: 'la fecha de fin debe tener formato YYYY-MM-DD valido', code: 'INVALID_END_DATE' }
          });
        }
      }
      newEndDate = end_date;
      updates.push('end_date = ?');
      params.push(end_date || null);
    }

    if (newEndDate && newStartDate && newEndDate < newStartDate) {
      return res.status(400).json({
        ok: false,
        error: { message: 'la fecha de fin no puede ser anterior a la fecha de inicio', code: 'INVALID_DATE_RANGE' }
      });
    }

    if (status !== undefined) {
      const allowedStatuses = ['active', 'expired', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          ok: false,
          error: { message: 'el estado debe ser active, expired o cancelled', code: 'INVALID_STATUS' }
        });
      }
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'no se proporcionaron campos para actualizar', code: 'NO_FIELDS_PROVIDED' }
      });
    }

    params.push(id);
    const updateSql = `UPDATE memberships SET ${updates.join(', ')} WHERE id = ?`;
    await pool.execute(updateSql, params);

    // obtener registro actualizado
    const [updatedRows] = await pool.execute(`
      SELECT 
        m.id,
        m.user_id,
        m.start_date,
        m.end_date,
        m.status,
        m.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM memberships m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `, [id]);

    return res.status(200).json({
      ok: true,
      message: 'membresia actualizada exitosamente',
      data: { membership: computeMembershipStatus(updatedRows[0]) }
    });
  } catch (error) {
    next(error);
  }
}
