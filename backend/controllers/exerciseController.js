import pool from '../config/db.js';

// valores permitidos para el enum difficulty en la base de datos
const ALLOWED_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

// Helper para saber si la columna is_active existe físicamente en exercises
let hasExerciseIsActiveCache = null;
async function checkHasExerciseIsActive() {
  if (hasExerciseIsActiveCache !== null) return hasExerciseIsActiveCache;
  try {
    const [rows] = await pool.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises' AND COLUMN_NAME = 'is_active'"
    );
    hasExerciseIsActiveCache = rows.length > 0;
    return hasExerciseIsActiveCache;
  } catch (e) {
    return false;
  }
}

// listar ejercicios (accesible a admin, trainer y member)
export async function listExercises(req, res, next) {
  try {
    const { muscle_group, difficulty, search, include_inactive } = req.query;
    const hasIsActive = await checkHasExerciseIsActive();

    let sql = 'SELECT id, name, description, muscle_group, difficulty, created_at';
    if (hasIsActive) sql += ', is_active';
    sql += ' FROM exercises WHERE 1=1';
    const params = [];

    // Ocultar inactivos por defecto para evitar asignarlos a nuevas rutinas
    if (hasIsActive && include_inactive !== 'true' && include_inactive !== '1') {
      sql += ' AND is_active = 1';
    }

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

// eliminar o archivar ejercicio (admin y trainer, respetando integridad referencial y preservando historiales)
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
      'SELECT id, name FROM exercises WHERE id = ? LIMIT 1',
      [exerciseId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'ejercicio no encontrado', code: 'EXERCISE_NOT_FOUND' }
      });
    }

    // 1. Comprobar si está en uso en alguna rutina
    const [routineUsages] = await pool.execute(
      'SELECT id FROM routine_exercises WHERE exercise_id = ? LIMIT 1',
      [exerciseId]
    );

    // 2. Comprobar si existen series registradas en el historial de entrenamientos
    let hasLoggedSets = false;
    try {
      const [setUsages] = await pool.execute(
        'SELECT id FROM workout_set_logs WHERE exercise_id = ? LIMIT 1',
        [exerciseId]
      );
      hasLoggedSets = setUsages.length > 0;
    } catch (e) {
      // Si la tabla workout_set_logs no existe en la BD actual, ignorar
    }

    const hasIsActive = await checkHasExerciseIsActive();

    // Si está en uso en rutinas activas, no se puede eliminar físicamente para no romper los planes
    if (routineUsages.length > 0) {
      // Si el modelo tiene la columna is_active, permitimos baja lógica (archivado)
      if (hasIsActive) {
        await pool.execute('UPDATE exercises SET is_active = 0 WHERE id = ?', [exerciseId]);
        return res.status(200).json({
          ok: true,
          message: 'el ejercicio fue archivado y ocultado de la biblioteca; sus registros en rutinas e historiales permanecen intactos',
          data: { id: exerciseId, archived: true }
        });
      }

      return res.status(409).json({
        ok: false,
        error: {
          message: 'no se puede eliminar el ejercicio porque está asignado en una o más rutinas activas',
          code: 'EXERCISE_IN_USE'
        }
      });
    }

    // Si tiene series registradas en historiales pasados (pero ya no está en rutinas)
    if (hasLoggedSets) {
      if (hasIsActive) {
        await pool.execute('UPDATE exercises SET is_active = 0 WHERE id = ?', [exerciseId]);
        return res.status(200).json({
          ok: true,
          message: 'el ejercicio fue archivado; su historial de pesos y series previas permanece preservado',
          data: { id: exerciseId, archived: true }
        });
      }

      return res.status(409).json({
        ok: false,
        error: {
          message: 'no se puede eliminar físicamente el ejercicio porque posee registros en el historial de entrenamientos de los socios',
          code: 'EXERCISE_HAS_HISTORY'
        }
      });
    }

    // Eliminación física segura: no tiene rutinas ni historiales vinculados
    await pool.execute('DELETE FROM exercises WHERE id = ?', [exerciseId]);

    return res.status(200).json({
      ok: true,
      message: 'ejercicio eliminado exitosamente de la biblioteca',
      data: { id: exerciseId, archived: false }
    });
  } catch (error) {
    next(error);
  }
}
