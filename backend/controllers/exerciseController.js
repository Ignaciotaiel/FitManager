import pool from '../config/db.js';

// valores permitidos para el enum difficulty en la base de datos
const ALLOWED_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

// listar ejercicios (accesible a admin, trainer y member)
export async function listExercises(req, res, next) {
  try {
    const { muscle_group, difficulty, search } = req.query;

    let sql = 'SELECT id, name, description, muscle_group, difficulty, created_at FROM exercises WHERE 1=1';
    const params = [];

    if (muscle_group && typeof muscle_group === 'string' && muscle_group.trim()) {
      sql += ' AND muscle_group = ?';
      params.push(muscle_group.trim());
    }

    if (difficulty && ALLOWED_DIFFICULTIES.includes(difficulty.trim())) {
      sql += ' AND difficulty = ?';
      params.push(difficulty.trim());
    }

    if (search && typeof search === 'string' && search.trim()) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      const queryPattern = `%${search.trim()}%`;
      params.push(queryPattern, queryPattern);
    }

    sql += ' ORDER BY name ASC';

    const [rows] = await pool.execute(sql, params);

    return res.status(200).json({
      ok: true,
      data: { exercises: rows }
    });
  } catch (error) {
    next(error);
  }
}

// obtener un ejercicio por id (admin, trainer, member)
export async function getExerciseById(req, res, next) {
  try {
    const { id } = req.params;
    const exerciseId = Number(id);

    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el identificador de ejercicio debe ser un entero positivo', code: 'INVALID_ID' }
      });
    }

    const [rows] = await pool.execute(
      'SELECT id, name, description, muscle_group, difficulty, created_at FROM exercises WHERE id = ? LIMIT 1',
      [exerciseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'ejercicio no encontrado', code: 'EXERCISE_NOT_FOUND' }
      });
    }

    return res.status(200).json({
      ok: true,
      data: { exercise: rows[0] }
    });
  } catch (error) {
    next(error);
  }
}

// crear un ejercicio (admin y trainer)
export async function createExercise(req, res, next) {
  try {
    const { name, description, muscle_group, difficulty } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el nombre del ejercicio es obligatorio', code: 'INVALID_NAME' }
      });
    }

    const cleanDifficulty = difficulty ? String(difficulty).trim() : 'beginner';
    if (!ALLOWED_DIFFICULTIES.includes(cleanDifficulty)) {
      return res.status(400).json({
        ok: false,
        error: {
          message: 'la dificultad debe ser beginner, intermediate o advanced',
          code: 'INVALID_DIFFICULTY'
        }
      });
    }

    const cleanName = name.trim();
    const cleanDesc = description && typeof description === 'string' ? description.trim() : null;
    const cleanMuscle = muscle_group && typeof muscle_group === 'string' ? muscle_group.trim() : null;

    const [result] = await pool.execute(
      'INSERT INTO exercises (name, description, muscle_group, difficulty) VALUES (?, ?, ?, ?)',
      [cleanName, cleanDesc, cleanMuscle, cleanDifficulty]
    );

    return res.status(201).json({
      ok: true,
      message: 'ejercicio creado exitosamente',
      data: {
        exercise: {
          id: result.insertId,
          name: cleanName,
          description: cleanDesc,
          muscle_group: cleanMuscle,
          difficulty: cleanDifficulty
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// actualizar campos permitidos de un ejercicio (admin y trainer)
export async function updateExercise(req, res, next) {
  try {
    const { id } = req.params;
    const exerciseId = Number(id);

    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de ejercicio invalido', code: 'INVALID_ID' }
      });
    }

    const [existing] = await pool.execute(
      'SELECT id, name, description, muscle_group, difficulty FROM exercises WHERE id = ? LIMIT 1',
      [exerciseId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'ejercicio no encontrado', code: 'EXERCISE_NOT_FOUND' }
      });
    }

    const current = existing[0];
    const { name, description, muscle_group, difficulty } = req.body;

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

    let newDifficulty = current.difficulty;
    if (difficulty !== undefined) {
      const cleanDiff = String(difficulty).trim();
      if (!ALLOWED_DIFFICULTIES.includes(cleanDiff)) {
        return res.status(400).json({
          ok: false,
          error: { message: 'dificultad invalida', code: 'INVALID_DIFFICULTY' }
        });
      }
      newDifficulty = cleanDiff;
    }

    const newDesc = description !== undefined ? (description ? String(description).trim() : null) : current.description;
    const newMuscle = muscle_group !== undefined ? (muscle_group ? String(muscle_group).trim() : null) : current.muscle_group;

    await pool.execute(
      'UPDATE exercises SET name = ?, description = ?, muscle_group = ?, difficulty = ? WHERE id = ?',
      [newName, newDesc, newMuscle, newDifficulty, exerciseId]
    );

    return res.status(200).json({
      ok: true,
      message: 'ejercicio actualizado exitosamente',
      data: {
        exercise: {
          id: exerciseId,
          name: newName,
          description: newDesc,
          muscle_group: newMuscle,
          difficulty: newDifficulty
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// eliminar ejercicio (solo admin, respetando integridad referencial)
export async function deleteExercise(req, res, next) {
  try {
    const { id } = req.params;
    const exerciseId = Number(id);

    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de ejercicio invalido', code: 'INVALID_ID' }
      });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM exercises WHERE id = ? LIMIT 1',
      [exerciseId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'ejercicio no encontrado', code: 'EXERCISE_NOT_FOUND' }
      });
    }

    // comprobar si esta en uso en alguna rutina
    const [usages] = await pool.execute(
      'SELECT id FROM routine_exercises WHERE exercise_id = ? LIMIT 1',
      [exerciseId]
    );

    if (usages.length > 0) {
      return res.status(409).json({
        ok: false,
        error: {
          message: 'no se puede eliminar el ejercicio porque esta asignado en una o mas rutinas',
          code: 'EXERCISE_IN_USE'
        }
      });
    }

    await pool.execute('DELETE FROM exercises WHERE id = ?', [exerciseId]);

    return res.status(200).json({
      ok: true,
      message: 'ejercicio eliminado exitosamente',
      data: { id: exerciseId }
    });
  } catch (error) {
    next(error);
  }
}
