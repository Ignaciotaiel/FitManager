import pool from '../config/db.js';
import { logActivity } from '../services/activityLogService.js';

// ==============================================================================
// 1. REGISTRO DE ACTIVIDAD (Activity Logs)
// ==============================================================================

function safeParseMetadata(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getActivityLogs(req, res, next) {
  try {
    const { userId, category, startDate, endDate, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT 
        l.id,
        l.user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        l.action_type,
        l.category,
        l.description,
        l.metadata,
        l.created_at
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      sql += ' AND l.user_id = ?';
      params.push(userId);
    }

    if (category) {
      sql += ' AND l.category = ?';
      params.push(category);
    }

    if (startDate) {
      sql += ' AND l.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND l.created_at <= ?';
      params.push(endDate);
    }

    // limit y offset se sanean como enteros y se insertan directamente (evita errores de LIMIT con placeholders)
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
    sql += ` ORDER BY l.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

    const [rows] = await pool.execute(sql, params);

    return res.status(200).json({
      ok: true,
      data: {
        logs: rows.map(r => ({
          ...r,
          metadata: safeParseMetadata(r.metadata)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

// ==============================================================================
// 2. CENTRO DE NOTIFICACIONES (Admin Notifications)
// ==============================================================================

export async function listNotifications(req, res, next) {
  try {
    const { target_role, is_active } = req.query;
    let sql = `
      SELECT 
        n.id,
        n.title,
        n.content,
        n.target_role,
        n.is_active,
        n.created_by,
        u.name AS created_by_name,
        n.created_at,
        n.updated_at
      FROM admin_notifications n
      LEFT JOIN users u ON n.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (target_role) {
      sql += ' AND n.target_role = ?';
      params.push(target_role);
    }

    if (is_active !== undefined) {
      sql += ' AND n.is_active = ?';
      params.push(Number(is_active));
    }

    sql += ' ORDER BY n.created_at DESC';

    const [rows] = await pool.execute(sql, params);

    return res.status(200).json({
      ok: true,
      data: { notifications: rows }
    });
  } catch (error) {
    next(error);
  }
}

export async function createNotification(req, res, next) {
  try {
    const { title, content, target_role = 'all' } = req.body;

    if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        ok: false,
        error: { message: 'El título y el contenido son obligatorios', code: 'MISSING_FIELDS' }
      });
    }

    const validRoles = ['all', 'trainer', 'member'];
    if (!validRoles.includes(target_role)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'El rol destinatario es inválido (all, trainer, member)', code: 'INVALID_TARGET_ROLE' }
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO admin_notifications (title, content, target_role, is_active, created_by) VALUES (?, ?, ?, 1, ?)',
      [title.trim(), content.trim(), target_role, req.user.id]
    );

    const newNotificationId = result.insertId;

    await logActivity({
      userId: req.user.id,
      actionType: 'CREATE_NOTIFICATION',
      category: 'notifications',
      description: `Creación de notificación: "${title.trim()}" destinada a ${target_role}`,
      metadata: { notificationId: newNotificationId, target_role }
    });

    return res.status(201).json({
      ok: true,
      message: 'Notificación creada exitosamente',
      data: {
        notification: {
          id: newNotificationId,
          title: title.trim(),
          content: content.trim(),
          target_role,
          is_active: 1,
          created_by: req.user.id
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateNotification(req, res, next) {
  try {
    const { id } = req.params;
    const { title, content, target_role, is_active } = req.body;

    const [existing] = await pool.execute(
      'SELECT id, title, content, target_role, is_active FROM admin_notifications WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Notificación no encontrada', code: 'NOT_FOUND' }
      });
    }

    if (target_role !== undefined && !['all', 'trainer', 'member'].includes(target_role)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'El rol destinatario es inválido (all, trainer, member)', code: 'INVALID_TARGET_ROLE' }
      });
    }
    if ((title !== undefined && (typeof title !== 'string' || !title.trim())) ||
        (content !== undefined && (typeof content !== 'string' || !content.trim()))) {
      return res.status(400).json({
        ok: false,
        error: { message: 'El título y el contenido no pueden estar vacíos', code: 'MISSING_FIELDS' }
      });
    }

    const current = existing[0];
    const newTitle = title !== undefined ? title.trim() : current.title;
    const newContent = content !== undefined ? content.trim() : current.content;
    const newTargetRole = target_role !== undefined ? target_role : current.target_role;
    const newIsActive = is_active !== undefined ? (is_active ? 1 : 0) : current.is_active;

    await pool.execute(
      'UPDATE admin_notifications SET title = ?, content = ?, target_role = ?, is_active = ? WHERE id = ?',
      [newTitle, newContent, newTargetRole, newIsActive, id]
    );

    await logActivity({
      userId: req.user.id,
      actionType: 'UPDATE_NOTIFICATION',
      category: 'notifications',
      description: `Actualización de notificación ID ${id}: "${newTitle}"`,
      metadata: { id: Number(id), is_active: newIsActive }
    });

    return res.status(200).json({
      ok: true,
      message: 'Notificación actualizada exitosamente',
      data: {
        notification: {
          id: Number(id),
          title: newTitle,
          content: newContent,
          target_role: newTargetRole,
          is_active: newIsActive
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute(
      'SELECT id, title FROM admin_notifications WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Notificación no encontrada', code: 'NOT_FOUND' }
      });
    }

    await pool.execute('DELETE FROM admin_notifications WHERE id = ?', [id]);

    await logActivity({
      userId: req.user.id,
      actionType: 'DELETE_NOTIFICATION',
      category: 'notifications',
      description: `Eliminación de notificación ID ${id}: "${existing[0].title}"`,
      metadata: { id: Number(id) }
    });

    return res.status(200).json({
      ok: true,
      message: 'Notificación eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
}

// Endpoint público/autenticado para que cualquier usuario vea notificaciones dirigidas a su rol
export async function getActiveNotificationsForUser(req, res, next) {
  try {
    const userRole = req.user?.role || 'member';

    const [notifications] = await pool.execute(
      `SELECT id, title, content, target_role, created_at 
       FROM admin_notifications 
       WHERE is_active = 1 AND (target_role = 'all' OR target_role = ?)
       ORDER BY created_at DESC`,
      [userRole]
    );

    return res.status(200).json({
      ok: true,
      data: { notifications }
    });
  } catch (error) {
    next(error);
  }
}

// ==============================================================================
// 3. GESTIÓN DE INCIDENCIAS (Incidents Management)
// ==============================================================================

export async function listIncidents(req, res, next) {
  try {
    const { status, category } = req.query;

    let sql = `
      SELECT 
        i.id,
        i.title,
        i.description,
        i.category,
        i.status,
        i.created_by,
        u.name AS created_by_name,
        u.email AS created_by_email,
        i.resolution_notes,
        i.resolved_at,
        i.created_at,
        i.updated_at
      FROM incidents i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }

    if (category) {
      sql += ' AND i.category = ?';
      params.push(category);
    }

    sql += ' ORDER BY i.created_at DESC';

    const [rows] = await pool.execute(sql, params);

    return res.status(200).json({
      ok: true,
      data: { incidents: rows }
    });
  } catch (error) {
    next(error);
  }
}

export async function createIncident(req, res, next) {
  try {
    const { title, description, category = 'other' } = req.body;

    if (typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        ok: false,
        error: { message: 'El título y la descripción son obligatorios', code: 'MISSING_FIELDS' }
      });
    }

    const validCategories = ['equipment', 'facility', 'safety', 'cleanliness', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'Categoría de incidencia no válida', code: 'INVALID_CATEGORY' }
      });
    }

    const [result] = await pool.execute(
      "INSERT INTO incidents (title, description, category, status, created_by) VALUES (?, ?, ?, 'pending', ?)",
      [title.trim(), description.trim(), category, req.user.id]
    );

    const incidentId = result.insertId;

    await logActivity({
      userId: req.user.id,
      actionType: 'CREATE_INCIDENT',
      category: 'incidents',
      description: `Reporte de incidencia: "${title.trim()}" en categoría ${category}`,
      metadata: { incidentId, category }
    });

    return res.status(201).json({
      ok: true,
      message: 'Incidencia registrada exitosamente',
      data: {
        incident: {
          id: incidentId,
          title: title.trim(),
          description: description.trim(),
          category,
          status: 'pending',
          created_by: req.user.id
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateIncident(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, category, status, resolution_notes } = req.body;

    const [existing] = await pool.execute(
      'SELECT id, title, description, category, status, resolution_notes, resolved_at FROM incidents WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Incidencia no encontrada', code: 'NOT_FOUND' }
      });
    }

    if (category !== undefined && !['equipment', 'facility', 'safety', 'cleanliness', 'other'].includes(category)) {
      return res.status(400).json({ ok: false, error: { message: 'Categoría de incidencia no válida', code: 'INVALID_CATEGORY' } });
    }
    if (status !== undefined && !['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ ok: false, error: { message: 'Estado de incidencia no válido', code: 'INVALID_STATUS' } });
    }
    if ((title !== undefined && (typeof title !== 'string' || !title.trim())) ||
        (description !== undefined && (typeof description !== 'string' || !description.trim()))) {
      return res.status(400).json({ ok: false, error: { message: 'El título y la descripción no pueden estar vacíos', code: 'MISSING_FIELDS' } });
    }

    const current = existing[0];
    const newTitle = title !== undefined ? title.trim() : current.title;
    const newDescription = description !== undefined ? description.trim() : current.description;
    const newCategory = category !== undefined ? category : current.category;
    const newStatus = status !== undefined ? status : current.status;
    const newResolutionNotes = resolution_notes !== undefined ? resolution_notes : current.resolution_notes;
    const resolvedAt = newStatus === 'resolved' ? (current.status === 'resolved' ? current.resolved_at : new Date()) : null;

    await pool.execute(
      `UPDATE incidents 
       SET title = ?, description = ?, category = ?, status = ?, resolution_notes = ?, resolved_at = ?
       WHERE id = ?`,
      [newTitle, newDescription, newCategory, newStatus, newResolutionNotes, resolvedAt, id]
    );

    await logActivity({
      userId: req.user.id,
      actionType: 'UPDATE_INCIDENT',
      category: 'incidents',
      description: `Actualización de incidencia ID ${id}: Estado ${newStatus}`,
      metadata: { id: Number(id), status: newStatus }
    });

    return res.status(200).json({
      ok: true,
      message: 'Incidencia actualizada exitosamente',
      data: {
        incident: {
          id: Number(id),
          title: newTitle,
          description: newDescription,
          category: newCategory,
          status: newStatus,
          resolution_notes: newResolutionNotes,
          resolved_at: resolvedAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteIncident(req, res, next) {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT id, title FROM incidents WHERE id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Incidencia no encontrada', code: 'NOT_FOUND' }
      });
    }

    await pool.execute('DELETE FROM incidents WHERE id = ?', [id]);

    await logActivity({
      userId: req.user.id,
      actionType: 'DELETE_INCIDENT',
      category: 'incidents',
      description: `Eliminación de incidencia ID ${id}: "${existing[0].title}"`,
      metadata: { id: Number(id) }
    });

    return res.status(200).json({
      ok: true,
      message: 'Incidencia eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
}

// ==============================================================================
// 4. EXPORTACIÓN DE INFORMES (Dataset para generación CSV en local)
// ==============================================================================

export async function getExportData(req, res, next) {
  try {
    const { entity } = req.params;

    switch (entity) {
      case 'users': {
        const [users] = await pool.execute(
          'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY id ASC'
        );
        return res.status(200).json({ ok: true, data: { entity: 'users', records: users } });
      }
      case 'trainers': {
        const [trainers] = await pool.execute(
          "SELECT id, name, email, role, is_active, created_at FROM users WHERE role = 'trainer' ORDER BY id ASC"
        );
        return res.status(200).json({ ok: true, data: { entity: 'trainers', records: trainers } });
      }
      case 'members': {
        const [members] = await pool.execute(
          "SELECT id, name, email, role, is_active, created_at FROM users WHERE role = 'member' ORDER BY id ASC"
        );
        return res.status(200).json({ ok: true, data: { entity: 'members', records: members } });
      }
      case 'exercises': {
        const [exercises] = await pool.execute(
          'SELECT id, name, muscle_group, difficulty, description, created_at FROM exercises ORDER BY id ASC'
        );
        return res.status(200).json({ ok: true, data: { entity: 'exercises', records: exercises } });
      }
      case 'routines': {
        const [routines] = await pool.execute(
          `SELECT r.id, r.name, r.description, r.trainer_id, u.name AS trainer_name, r.created_at 
           FROM routines r 
           LEFT JOIN users u ON r.trainer_id = u.id 
           ORDER BY r.id ASC`
        );
        return res.status(200).json({ ok: true, data: { entity: 'routines', records: routines } });
      }
      case 'activity_logs': {
        const [logs] = await pool.execute(
          `SELECT l.id, l.user_id, u.name AS user_name, u.role AS user_role, l.action_type, l.category, l.description, l.created_at 
           FROM activity_logs l 
           LEFT JOIN users u ON l.user_id = u.id 
           ORDER BY l.created_at DESC LIMIT 500`
        );
        return res.status(200).json({ ok: true, data: { entity: 'activity_logs', records: logs } });
      }
      case 'incidents': {
        const [incidents] = await pool.execute(
          `SELECT i.id, i.title, i.category, i.status, u.name AS reporter_name, i.resolution_notes, i.resolved_at, i.created_at 
           FROM incidents i 
           LEFT JOIN users u ON i.created_by = u.id 
           ORDER BY i.created_at DESC`
        );
        return res.status(200).json({ ok: true, data: { entity: 'incidents', records: incidents } });
      }
      default:
        return res.status(400).json({
          ok: false,
          error: {
            message: 'Entidad de exportación no soportada. Permitidas: users, trainers, members, exercises, routines, activity_logs, incidents',
            code: 'INVALID_EXPORT_ENTITY'
          }
        });
    }
  } catch (error) {
    next(error);
  }
}

