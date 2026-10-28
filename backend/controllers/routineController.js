import pool from '../config/db.js';

// listar rutinas segun el rol del usuario autenticado
export async function listRoutines(req, res, next) {
  try {
    const { role, id: userId } = req.user;

    let sql = `
      SELECT 
        r.id, 
        r.name, 
        r.description, 
        r.trainer_id, 
        r.member_id, 
        r.created_at,
        u_trainer.name AS trainer_name,
        u_member.name AS member_name
      FROM routines r
      LEFT JOIN users u_trainer ON r.trainer_id = u_trainer.id
      LEFT JOIN users u_member ON r.member_id = u_member.id
    `;
    const params = [];

    // un socio solo puede ver las rutinas asignadas a su identificador
    if (role === 'member') {
      sql += ' WHERE r.member_id = ?';
      params.push(userId);
    } else if (role === 'trainer') {
      // un entrenador solo ve sus rutinas creadas
      sql += ' WHERE r.trainer_id = ?';
      params.push(userId);
    }
    // si es admin ve todas

    sql += ' ORDER BY r.created_at DESC';

    const [rows] = await pool.execute(sql, params);

    return res.status(200).json({
      ok: true,
      data: { routines: rows }
    });
  } catch (error) {
    next(error);
  }
}

// obtener detalle de una rutina con sus ejercicios ordenados
export async function getRoutineById(req, res, next) {
  try {
    const { id } = req.params;
    const routineId = Number(id);
    const { role, id: userId } = req.user;

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
        u_trainer.name AS trainer_name,
        u_member.name AS member_name
      FROM routines r
      LEFT JOIN users u_trainer ON r.trainer_id = u_trainer.id
      LEFT JOIN users u_member ON r.member_id = u_member.id
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

    // control de acceso por propiedad y rol
    if (role === 'member' && Number(routine.member_id) !== Number(userId)) {
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para consultar esta rutina', code: 'FORBIDDEN' }
      });
    }

    if (role === 'trainer' && Number(routine.trainer_id) !== Number(userId)) {
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para consultar rutinas de otro entrenador', code: 'FORBIDDEN' }
      });
    }

    // consulta de ejercicios asociados ordenados por position
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
          exercises
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// crear una rutina con sus ejercicios en una transaccion atomica
export async function createRoutine(req, res, next) {
  let connection = null;
  try {
    const { name, description, member_id, exercises } = req.body;
    const { role, id: userId } = req.user;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el nombre de la rutina es obligatorio', code: 'INVALID_NAME' }
      });
    }

    // determinar el entrenador responsable:
    // si el creador es trainer, el trainer_id es su propio id
    // si es admin, puede especificar trainer_id en el body o quedar asignado a si mismo
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

    // validar socio destinatario si se envio member_id
    let finalMemberId = null;
    if (member_id !== undefined && member_id !== null) {
      const parsedMember = Number(member_id);
      if (!Number.isInteger(parsedMember) || parsedMember <= 0) {
        return res.status(400).json({
          ok: false,
          error: { message: 'identificador de socio invalido', code: 'INVALID_MEMBER' }
        });
      }

      // comprobar que el usuario exista y tenga rol member
      const [members] = await pool.execute(
        'SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1',
        [parsedMember]
      );

      if (members.length === 0) {
        return res.status(400).json({
          ok: false,
          error: { message: 'el socio especificado no existe', code: 'MEMBER_NOT_FOUND' }
        });
      }

      if (members[0].role !== 'member') {
        return res.status(400).json({
          ok: false,
          error: { message: 'el usuario asignado debe tener rol de socio (member)', code: 'NOT_A_MEMBER' }
        });
      }

      finalMemberId = parsedMember;
    }

    // validar ejercicios si se enviaron
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

      // verificar que todos los exercise_id existan
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

    // ejecucion atomica con transaccion
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const cleanName = name.trim();
    const cleanDesc = description && typeof description === 'string' ? description.trim() : null;

    const [routineRes] = await connection.execute(
      'INSERT INTO routines (name, description, trainer_id, member_id) VALUES (?, ?, ?, ?)',
      [cleanName, cleanDesc, finalTrainerId, finalMemberId]
    );

    const routineId = routineRes.insertId;

    if (cleanExercises.length > 0) {
      for (const ex of cleanExercises) {
        await connection.execute(
          'INSERT INTO routine_exercises (routine_id, exercise_id, sets_count, reps, position) VALUES (?, ?, ?, ?, ?)',
          [routineId, ex.exercise_id, ex.sets_count, ex.reps, ex.position]
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
          member_id: finalMemberId,
          exercises_count: cleanExercises.length
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

// actualizar campos de rutina (admin y trainer)
export async function updateRoutine(req, res, next) {
  try {
    const { id } = req.params;
    const routineId = Number(id);
    const { role, id: userId } = req.user;

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

    // control de propiedad
    if (role === 'trainer' && Number(current.trainer_id) !== Number(userId)) {
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para modificar rutinas de otro entrenador', code: 'FORBIDDEN' }
      });
    }

    const { name, description, member_id } = req.body;

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

    let newMemberId = current.member_id;
    if (member_id !== undefined) {
      if (member_id === null) {
        newMemberId = null;
      } else {
        const parsedMember = Number(member_id);
        if (!Number.isInteger(parsedMember) || parsedMember <= 0) {
          return res.status(400).json({
            ok: false,
            error: { message: 'identificador de socio invalido', code: 'INVALID_MEMBER' }
          });
        }

        const [members] = await pool.execute(
          'SELECT id, role FROM users WHERE id = ? LIMIT 1',
          [parsedMember]
        );

        if (members.length === 0 || members[0].role !== 'member') {
          return res.status(400).json({
            ok: false,
            error: { message: 'el usuario asignado debe ser un socio existente', code: 'INVALID_MEMBER' }
          });
        }
        newMemberId = parsedMember;
      }
    }

    await pool.execute(
      'UPDATE routines SET name = ?, description = ?, member_id = ? WHERE id = ?',
      [newName, newDesc, newMemberId, routineId]
    );

    return res.status(200).json({
      ok: true,
      message: 'rutina actualizada exitosamente',
      data: {
        routine: {
          id: routineId,
          name: newName,
          description: newDesc,
          trainer_id: current.trainer_id,
          member_id: newMemberId
        }
      }
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

    // eliminar primero los ejercicios vinculados en routine_exercises
    await connection.execute('DELETE FROM routine_exercises WHERE routine_id = ?', [routineId]);

    // eliminar la rutina
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
