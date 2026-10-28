import pool from '../config/db.js';

// Helper para saber si routine_assignments existe físicamente en MariaDB
let hasAssignmentsTableCache = null;
async function checkHasAssignmentsTable() {
  if (hasAssignmentsTableCache !== null) return hasAssignmentsTableCache;
  try {
    const [rows] = await pool.execute("SHOW TABLES LIKE 'routine_assignments'");
    hasAssignmentsTableCache = rows.length > 0;
    return hasAssignmentsTableCache;
  } catch (e) {
    return false;
  }
}

// listar rutinas segun el rol del usuario autenticado
export async function listRoutines(req, res, next) {
  try {
    const { role, id: userId } = req.user;
    const hasAssignmentsTable = await checkHasAssignmentsTable();

    let sql = `
      SELECT 
        r.id, 
        r.name, 
        r.description, 
        r.trainer_id, 
        r.member_id, 
        r.created_at,
        u_trainer.name AS trainer_name
      FROM routines r
      LEFT JOIN users u_trainer ON r.trainer_id = u_trainer.id
    `;
    const params = [];

    if (role === 'member') {
      if (hasAssignmentsTable) {
        sql += `
          WHERE r.id IN (
            SELECT routine_id FROM routine_assignments WHERE member_id = ?
          ) OR r.member_id = ?
        `;
        params.push(userId, userId);
      } else {
        sql += ' WHERE r.member_id = ?';
        params.push(userId);
      }
    } else if (role === 'trainer') {
      sql += ' WHERE r.trainer_id = ?';
      params.push(userId);
    }
    // si es admin ve todas

    sql += ' ORDER BY r.created_at DESC';

    const [routines] = await pool.execute(sql, params);

    // Obtener asignaciones para cada rutina si la tabla existe
    let assignmentsByRoutine = {};
    if (routines.length > 0) {
      const routineIds = routines.map(r => r.id);
      const placeholders = routineIds.map(() => '?').join(',');

      if (hasAssignmentsTable) {
        const [assignments] = await pool.execute(
          `SELECT ra.routine_id, ra.member_id, ra.assigned_at, u.name AS member_name, u.email AS member_email
           FROM routine_assignments ra
           INNER JOIN users u ON ra.member_id = u.id
           WHERE ra.routine_id IN (${placeholders})`,
          routineIds
        );
        for (const a of assignments) {
          if (!assignmentsByRoutine[a.routine_id]) assignmentsByRoutine[a.routine_id] = [];
          assignmentsByRoutine[a.routine_id].push(a);
        }
      }

      // También preservar compatibilidad con r.member_id legacy si no estuviese en routine_assignments
      const [legacyMembers] = await pool.execute(
        `SELECT r.id AS routine_id, r.member_id, u.name AS member_name, u.email AS member_email
         FROM routines r
         INNER JOIN users u ON r.member_id = u.id
         WHERE r.id IN (${placeholders}) AND r.member_id IS NOT NULL`,
        routineIds
      );
      for (const lm of legacyMembers) {
        if (!assignmentsByRoutine[lm.routine_id]) assignmentsByRoutine[lm.routine_id] = [];
        const exists = assignmentsByRoutine[lm.routine_id].some(a => Number(a.member_id) === Number(lm.member_id));
        if (!exists) {
          assignmentsByRoutine[lm.routine_id].push({
            routine_id: lm.routine_id,
            member_id: lm.member_id,
            assigned_at: null,
            member_name: lm.member_name,
            member_email: lm.member_email
          });
        }
      }
    }

    const formatted = routines.map(r => {
      const assignedUsers = assignmentsByRoutine[r.id] || [];
      return {
        ...r,
        assigned_users: assignedUsers,
        assigned_count: assignedUsers.length,
        // Mantener member_name retrocompatible (primer asignado o legacy)
        member_name: assignedUsers.length > 0 ? assignedUsers.map(u => u.member_name).join(', ') : null
      };
    });

    return res.status(200).json({
      ok: true,
      data: { routines: formatted }
    });
  } catch (error) {
    next(error);
  }
}

// obtener detalle de una rutina con sus ejercicios ordenados y usuarios asignados
export async function getRoutineById(req, res, next) {
  try {
    const { id } = req.params;
    const routineId = Number(id);
    const { role, id: userId } = req.user;
    const hasAssignmentsTable = await checkHasAssignmentsTable();

    if (!Number.isInteger(routineId) || routineId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de rutina invalido', code: 'INVALID_ID' }
      });
    }

    const [routines] = await pool.execute(
      `SELECT 
        r.id, 
        r.name, 
        r.description, 
        r.trainer_id, 
        r.member_id, 
        r.created_at,
        u_trainer.name AS trainer_name
      FROM routines r
      LEFT JOIN users u_trainer ON r.trainer_id = u_trainer.id
      WHERE r.id = ? LIMIT 1`,
      [routineId]
    );

    if (routines.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'rutina no encontrada', code: 'ROUTINE_NOT_FOUND' }
      });
    }

    const routine = routines[0];

    // Cargar usuarios asignados
    let assignedUsers = [];
    if (hasAssignmentsTable) {
      const [assignments] = await pool.execute(
        `SELECT ra.routine_id, ra.member_id, ra.assigned_at, u.name AS member_name, u.email AS member_email
         FROM routine_assignments ra
         INNER JOIN users u ON ra.member_id = u.id
         WHERE ra.routine_id = ?`,
        [routineId]
      );
      assignedUsers = assignments;
    }

    // Compatibilidad legacy con routine.member_id
    if (routine.member_id) {
      const alreadyIn = assignedUsers.some(a => Number(a.member_id) === Number(routine.member_id));
      if (!alreadyIn) {
        const [legRows] = await pool.execute(
          'SELECT id, name, email FROM users WHERE id = ? LIMIT 1',
          [routine.member_id]
        );
        if (legRows.length > 0) {
          assignedUsers.push({
            routine_id: routineId,
            member_id: legRows[0].id,
            assigned_at: routine.created_at,
            member_name: legRows[0].name,
            member_email: legRows[0].email
          });
        }
      }
    }

    // Control de acceso por propiedad y rol
    if (role === 'member') {
      const isAssigned = assignedUsers.some(a => Number(a.member_id) === Number(userId)) || Number(routine.member_id) === Number(userId);
      if (!isAssigned) {
        return res.status(403).json({
          ok: false,
          error: { message: 'no tienes permiso para consultar esta rutina', code: 'FORBIDDEN' }
        });
      }
    }

    if (role === 'trainer' && Number(routine.trainer_id) !== Number(userId)) {
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para consultar rutinas de otro entrenador', code: 'FORBIDDEN' }
      });
    }

    // Consulta de ejercicios asociados ordenados por position
    const [exercises] = await pool.execute(
      `SELECT 
        re.id AS routine_exercise_id,
        re.exercise_id,
        re.sets_count,
        re.reps,
        re.position,
        e.name,
        e.description,
        e.muscle_group,
        e.difficulty
      FROM routine_exercises re
      INNER JOIN exercises e ON re.exercise_id = e.id
      WHERE re.routine_id = ?
      ORDER BY re.position ASC, re.id ASC`,
      [routineId]
    );

    return res.status(200).json({
      ok: true,
      data: {
        routine: {
          ...routine,
          assigned_users: assignedUsers,
          member_name: assignedUsers.length > 0 ? assignedUsers.map(u => u.member_name).join(', ') : null,
          exercises
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// crear una rutina con sus ejercicios y asignaciones multiples en transaccion atomica
export async function createRoutine(req, res, next) {
  let connection = null;
  try {
    const { name, description, member_id, member_ids, exercises } = req.body;
    const { role, id: userId } = req.user;
    const hasAssignmentsTable = await checkHasAssignmentsTable();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el nombre de la rutina es obligatorio', code: 'INVALID_NAME' }
      });
    }

    let finalTrainerId = userId;
    if (role === 'admin' && req.body.trainer_id) {
      const parsedTrainer = Number(req.body.trainer_id);
      if (!Number.isInteger(parsedTrainer) || parsedTrainer <= 0) {
        return res.status(400).json({
          ok: false,
          error: { message: 'identificador de entrenador invalido', code: 'INVALID_TRAINER' }
        });
      }
      finalTrainerId = parsedTrainer;
    }

    // Normalizar lista de socios a asignar (soporta member_ids array o member_id singular)
    const rawMemberIds = [];
    if (Array.isArray(member_ids)) {
      rawMemberIds.push(...member_ids);
    } else if (member_id !== undefined && member_id !== null) {
      rawMemberIds.push(member_id);
    }

    const uniqueMemberIds = [...new Set(rawMemberIds.map(Number))].filter(id => Number.isInteger(id) && id > 0);

    // Validar que todos los usuarios existan, sean 'member' y estén activos (is_active = 1)
    if (uniqueMemberIds.length > 0) {
      const placeholders = uniqueMemberIds.map(() => '?').join(',');
      const [members] = await pool.execute(
        `SELECT id, role, is_active FROM users WHERE id IN (${placeholders})`,
        uniqueMemberIds
      );

      if (members.length !== uniqueMemberIds.length) {
        return res.status(400).json({
          ok: false,
          error: { message: 'uno o mas socios especificados no existen', code: 'MEMBER_NOT_FOUND' }
        });
      }

      for (const m of members) {
        if (m.role !== 'member') {
          return res.status(400).json({
            ok: false,
            error: { message: `el usuario con id ${m.id} debe tener rol de socio (member)`, code: 'NOT_A_MEMBER' }
          });
        }
        if (m.is_active !== 1 && m.is_active !== true) {
          return res.status(400).json({
            ok: false,
            error: { message: `el usuario con id ${m.id} se encuentra inactivo`, code: 'MEMBER_INACTIVE' }
          });
        }
      }
    }

    // Validar ejercicios
    const cleanExercises = [];
    if (exercises !== undefined) {
      if (!Array.isArray(exercises)) {
        return res.status(400).json({
          ok: false,
          error: { message: 'exercises debe ser una lista de ejercicios', code: 'INVALID_EXERCISES' }
        });
      }

      for (let i = 0; i < exercises.length; i++) {
        const item = exercises[i];
        const exId = Number(item.exercise_id);
        if (!Number.isInteger(exId) || exId <= 0) {
          return res.status(400).json({
            ok: false,
            error: { message: `el ejercicio en posicion ${i + 1} no tiene un id valido`, code: 'INVALID_EXERCISE_ID' }
          });
        }

        const sets = item.sets_count !== undefined ? Number(item.sets_count) : 3;
        const reps = item.reps !== undefined && typeof item.reps === 'string' ? item.reps.trim() : '10-12';
        const pos = item.position !== undefined ? Number(item.position) : i + 1;

        cleanExercises.push({
          exercise_id: exId,
          sets_count: Number.isInteger(sets) && sets > 0 ? sets : 3,
          reps: reps.length > 0 ? reps : '10-12',
          position: Number.isInteger(pos) && pos > 0 ? pos : i + 1
        });
      }

      if (cleanExercises.length > 0) {
        const ids = [...new Set(cleanExercises.map((e) => e.exercise_id))];
        const placeholders = ids.map(() => '?').join(',');
        const [found] = await pool.execute(
          `SELECT id FROM exercises WHERE id IN (${placeholders})`,
          ids
        );

        if (found.length !== ids.length) {
          return res.status(400).json({
            ok: false,
            error: { message: 'uno o mas ejercicios indicados no existen en la base de datos', code: 'EXERCISE_NOT_FOUND' }
          });
        }
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const cleanName = name.trim();
    const cleanDesc = description && typeof description === 'string' ? description.trim() : null;
    const legacyMemberId = uniqueMemberIds.length === 1 ? uniqueMemberIds[0] : null;

    const [routineRes] = await connection.execute(
      'INSERT INTO routines (name, description, trainer_id, member_id) VALUES (?, ?, ?, ?)',
      [cleanName, cleanDesc, finalTrainerId, legacyMemberId]
    );

    const routineId = routineRes.insertId;

    // Insertar ejercicios
    if (cleanExercises.length > 0) {
      for (const ex of cleanExercises) {
        await connection.execute(
          'INSERT INTO routine_exercises (routine_id, exercise_id, sets_count, reps, position) VALUES (?, ?, ?, ?, ?)',
          [routineId, ex.exercise_id, ex.sets_count, ex.reps, ex.position]
        );
      }
    }

    // Insertar asignaciones multiples en routine_assignments si la tabla existe
    if (hasAssignmentsTable && uniqueMemberIds.length > 0) {
      for (const mId of uniqueMemberIds) {
        await connection.execute(
          'INSERT INTO routine_assignments (routine_id, member_id) VALUES (?, ?)',
          [routineId, mId]
        );
      }
    }

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: 'rutina creada exitosamente',
      data: {
        routine: {
          id: routineId,
          name: cleanName,
          description: cleanDesc,
          trainer_id: finalTrainerId,
          member_id: legacyMemberId,
          assigned_count: uniqueMemberIds.length,
          exercises_count: cleanExercises.length
        }
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
}

// actualizar campos de rutina y sincronizar asignaciones
export async function updateRoutine(req, res, next) {
  let connection = null;
  try {
    const { id } = req.params;
    const routineId = Number(id);
    const { role, id: userId } = req.user;
    const hasAssignmentsTable = await checkHasAssignmentsTable();

    if (!Number.isInteger(routineId) || routineId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de rutina invalido', code: 'INVALID_ID' }
      });
    }

    const [existing] = await pool.execute(
      'SELECT id, name, description, trainer_id, member_id FROM routines WHERE id = ? LIMIT 1',
      [routineId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'rutina no encontrada', code: 'ROUTINE_NOT_FOUND' }
      });
    }

    const current = existing[0];

    // Control de propiedad
    if (role === 'trainer' && Number(current.trainer_id) !== Number(userId)) {
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para modificar rutinas de otro entrenador', code: 'FORBIDDEN' }
      });
    }

    const { name, description, member_id, member_ids } = req.body;

    let newName = current.name;
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          ok: false,
          error: { message: 'el nombre no puede estar vacio', code: 'INVALID_NAME' }
        });
      }
      newName = name.trim();
    }

    const newDesc = description !== undefined ? (description ? String(description).trim() : null) : current.description;

    // Procesar asignaciones
    let shouldUpdateAssignments = false;
    let targetMemberIds = [];

    if (Array.isArray(member_ids)) {
      shouldUpdateAssignments = true;
      targetMemberIds = [...new Set(member_ids.map(Number))].filter(m => Number.isInteger(m) && m > 0);
    } else if (member_id !== undefined) {
      shouldUpdateAssignments = true;
      if (member_id !== null) {
        const parsed = Number(member_id);
        if (Number.isInteger(parsed) && parsed > 0) {
          targetMemberIds = [parsed];
        }
      }
    }

    // Validar socios si se enviaron
    if (shouldUpdateAssignments && targetMemberIds.length > 0) {
      const placeholders = targetMemberIds.map(() => '?').join(',');
      const [members] = await pool.execute(
        `SELECT id, role, is_active FROM users WHERE id IN (${placeholders})`,
        targetMemberIds
      );

      if (members.length !== targetMemberIds.length) {
        return res.status(400).json({
          ok: false,
          error: { message: 'uno o mas socios especificados no existen', code: 'MEMBER_NOT_FOUND' }
        });
      }

      for (const m of members) {
        if (m.role !== 'member') {
          return res.status(400).json({
            ok: false,
            error: { message: `el usuario con id ${m.id} debe ser socio (member)`, code: 'NOT_A_MEMBER' }
          });
        }
        if (m.is_active !== 1 && m.is_active !== true) {
          return res.status(400).json({
            ok: false,
            error: { message: `el usuario con id ${m.id} se encuentra inactivo`, code: 'MEMBER_INACTIVE' }
          });
        }
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const legacyMemberId = targetMemberIds.length === 1 ? targetMemberIds[0] : (targetMemberIds.length > 1 ? targetMemberIds[0] : (shouldUpdateAssignments ? null : current.member_id));

    await connection.execute(
      'UPDATE routines SET name = ?, description = ?, member_id = ? WHERE id = ?',
      [newName, newDesc, legacyMemberId, routineId]
    );

    if (shouldUpdateAssignments && hasAssignmentsTable) {
      // Reemplazo atómico de asignaciones
      await connection.execute('DELETE FROM routine_assignments WHERE routine_id = ?', [routineId]);
      for (const mId of targetMemberIds) {
        await connection.execute(
          'INSERT INTO routine_assignments (routine_id, member_id) VALUES (?, ?)',
          [routineId, mId]
        );
      }
    }

    await connection.commit();

    return res.status(200).json({
      ok: true,
      message: 'rutina actualizada exitosamente',
      data: {
        routine: {
          id: routineId,
          name: newName,
          description: newDesc,
          trainer_id: current.trainer_id,
          member_id: legacyMemberId,
          assigned_count: targetMemberIds.length
        }
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
}

// asignar socios individual o masivamente (POST /api/routines/:id/assignments)
export async function assignMembersToRoutine(req, res, next) {
  let connection = null;
  try {
    const { id } = req.params;
    const routineId = Number(id);
    const { role, id: userId } = req.user;
    const { member_ids } = req.body;
    const hasAssignmentsTable = await checkHasAssignmentsTable();

    if (!Number.isInteger(routineId) || routineId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de rutina invalido', code: 'INVALID_ID' }
      });
    }

    const [existing] = await pool.execute(
      'SELECT id, trainer_id FROM routines WHERE id = ? LIMIT 1',
      [routineId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'rutina no encontrada', code: 'ROUTINE_NOT_FOUND' }
      });
    }

    if (role === 'trainer' && Number(existing[0].trainer_id) !== Number(userId)) {
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para modificar asignaciones de esta rutina', code: 'FORBIDDEN' }
      });
    }

    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'member_ids debe ser un arreglo con al menos un socio', code: 'INVALID_MEMBER_IDS' }
      });
    }

    const cleanIds = [...new Set(member_ids.map(Number))].filter(m => Number.isInteger(m) && m > 0);
    if (cleanIds.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'no se proporcionaron ids de socios validos', code: 'INVALID_MEMBER_IDS' }
      });
    }

    const placeholders = cleanIds.map(() => '?').join(',');
    const [members] = await pool.execute(
      `SELECT id, role, is_active FROM users WHERE id IN (${placeholders})`,
      cleanIds
    );

    if (members.length !== cleanIds.length) {
      return res.status(400).json({
        ok: false,
        error: { message: 'uno o mas socios especificados no existen', code: 'MEMBER_NOT_FOUND' }
      });
    }

    for (const m of members) {
      if (m.role !== 'member') {
        return res.status(400).json({
          ok: false,
          error: { message: `el usuario ${m.id} no tiene rol de socio`, code: 'NOT_A_MEMBER' }
        });
      }
      if (!m.is_active) {
        return res.status(400).json({
          ok: false,
          error: { message: `el usuario ${m.id} está inactivo`, code: 'MEMBER_INACTIVE' }
        });
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (hasAssignmentsTable) {
      for (const mId of cleanIds) {
        await connection.execute(
          'INSERT IGNORE INTO routine_assignments (routine_id, member_id) VALUES (?, ?)',
          [routineId, mId]
        );
      }
    } else {
      await connection.execute(
        'UPDATE routines SET member_id = ? WHERE id = ?',
        [cleanIds[0], routineId]
      );
    }

    await connection.commit();

    return res.status(200).json({
      ok: true,
      message: 'socios asignados exitosamente',
      data: { routine_id: routineId, assigned_members: cleanIds }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
}

// desasignar un socio puntual de una rutina (DELETE /api/routines/:id/assignments/:memberId)
export async function removeMemberAssignment(req, res, next) {
  try {
    const { id, memberId } = req.params;
    const routineId = Number(id);
    const parsedMemberId = Number(memberId);
    const { role, id: userId } = req.user;
    const hasAssignmentsTable = await checkHasAssignmentsTable();

    if (!Number.isInteger(routineId) || !Number.isInteger(parsedMemberId)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'parametros invalidos', code: 'INVALID_PARAMS' }
      });
    }

    const [existing] = await pool.execute(
      'SELECT id, trainer_id, member_id FROM routines WHERE id = ? LIMIT 1',
      [routineId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'rutina no encontrada', code: 'ROUTINE_NOT_FOUND' }
      });
    }

    if (role === 'trainer' && Number(existing[0].trainer_id) !== Number(userId)) {
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para modificar asignaciones de esta rutina', code: 'FORBIDDEN' }
      });
    }

    if (hasAssignmentsTable) {
      await pool.execute(
        'DELETE FROM routine_assignments WHERE routine_id = ? AND member_id = ?',
        [routineId, parsedMemberId]
      );
    }

    if (Number(existing[0].member_id) === Number(parsedMemberId)) {
      await pool.execute(
        'UPDATE routines SET member_id = NULL WHERE id = ?',
        [routineId]
      );
    }

    return res.status(200).json({
      ok: true,
      message: 'asignacion removida exitosamente',
      data: { routine_id: routineId, member_id: parsedMemberId }
    });
  } catch (error) {
    next(error);
  }
}

// eliminar una rutina y sus ejercicios relacionados en transaccion
export async function deleteRoutine(req, res, next) {
  let connection = null;
  try {
    const { id } = req.params;
    const routineId = Number(id);
    const { role, id: userId } = req.user;
    const hasAssignmentsTable = await checkHasAssignmentsTable();

    if (!Number.isInteger(routineId) || routineId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de rutina invalido', code: 'INVALID_ID' }
      });
    }

    const [existing] = await pool.execute(
      'SELECT id, trainer_id FROM routines WHERE id = ? LIMIT 1',
      [routineId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'rutina no encontrada', code: 'ROUTINE_NOT_FOUND' }
      });
    }

    const current = existing[0];

    // un entrenador solo puede eliminar sus propias rutinas
    if (role === 'trainer' && Number(current.trainer_id) !== Number(userId)) {
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para eliminar rutinas de otro entrenador', code: 'FORBIDDEN' }
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (hasAssignmentsTable) {
      await connection.execute('DELETE FROM routine_assignments WHERE routine_id = ?', [routineId]);
    }

    // eliminar primero los ejercicios vinculados en routine_exercises
    await connection.execute('DELETE FROM routine_exercises WHERE routine_id = ?', [routineId]);

    // eliminar la rutina (las sesiones vinculadas quedarán con routine_id = NULL gracias a SET NULL, protegiendo el historial)
    await connection.execute('DELETE FROM routines WHERE id = ?', [routineId]);

    await connection.commit();

    return res.status(200).json({
      ok: true,
      message: 'rutina eliminada exitosamente',
      data: { id: routineId }
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
