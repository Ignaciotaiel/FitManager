import pool from '../config/db.js';

/**
 * Validar que los kilos sean número finito no negativo (0 a 1500 kg)
 */
function isValidWeight(val) {
  if (typeof val !== 'number' && typeof val !== 'string') return false;
  const num = Number(val);
  return Number.isFinite(num) && num >= 0 && num <= 1500;
}

/**
 * Validar que las repeticiones sean entero positivo (1 a 500)
 */
function isValidReps(val) {
  const num = Number(val);
  return Number.isInteger(num) && num > 0 && num <= 500;
}

/**
 * Validar número de serie (1 a 100)
 */
function isValidSetNumber(val) {
  const num = Number(val);
  return Number.isInteger(num) && num > 0 && num <= 100;
}

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

// Helper para saber si workout_sessions existe físicamente en MariaDB
let hasWorkoutTablesCache = null;
async function checkHasWorkoutTables() {
  if (hasWorkoutTablesCache !== null) return hasWorkoutTablesCache;
  try {
    const [rows] = await pool.execute("SHOW TABLES LIKE 'workout_sessions'");
    hasWorkoutTablesCache = rows.length > 0;
    return hasWorkoutTablesCache;
  } catch (e) {
    return false;
  }
}

// Helper para saber si la columna status existe en workout_sessions
let hasSessionStatusCache = null;
async function checkHasSessionStatus() {
  if (hasSessionStatusCache !== null) return hasSessionStatusCache;
  try {
    const [rows] = await pool.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workout_sessions' AND COLUMN_NAME = 'status'"
    );
    hasSessionStatusCache = rows.length > 0;
    return hasSessionStatusCache;
  } catch (e) {
    return false;
  }
}

/**
 * Formatear segundos en HH:MM:SS
 */
function formatDuration(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds) || totalSeconds < 0) {
    return null;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Calcular duración de una sesión:
 * - Si tiene ended_at y created_at: diferencia real (fija).
 * - Si está in_progress y tiene created_at: diferencia con respecto a la hora actual.
 * - Si es histórica y ended_at es null (o created_at no existe): duration_seconds: null, duration_formatted: null.
 */
function calculateSessionDuration(session) {
  const createdAt = session.created_at || session.session_date;
  if (!createdAt) {
    return { duration_seconds: null, duration_formatted: null };
  }

  const startMs = new Date(createdAt).getTime();
  if (isNaN(startMs)) {
    return { duration_seconds: null, duration_formatted: null };
  }

  if (session.ended_at) {
    const endMs = new Date(session.ended_at).getTime();
    if (!isNaN(endMs) && endMs >= startMs) {
      const sec = Math.floor((endMs - startMs) / 1000);
      return { duration_seconds: sec, duration_formatted: formatDuration(sec) };
    }
  } else if (session.status === 'in_progress') {
    const nowMs = Date.now();
    const sec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    return { duration_seconds: sec, duration_formatted: formatDuration(sec) };
  }

  return { duration_seconds: null, duration_formatted: null };
}

/**
 * Comprobar si un entrenador tiene permiso para ver el historial de un socio.
 * Un entrenador solo puede ver el progreso de un socio si:
 * 1. El socio tiene role = 'member' y está activo (is_active = 1).
 * 2. Tiene al menos una rutina asignada a él (en routine_assignments o en routines.member_id).
 */
async function canTrainerAccessMember(trainerId, memberId) {
  const hasAssignmentsTable = await checkHasAssignmentsTable();
  if (hasAssignmentsTable) {
    const [rows] = await pool.execute(
      `SELECT 1 FROM routines r
       LEFT JOIN routine_assignments ra ON r.id = ra.routine_id
       INNER JOIN users u ON (ra.member_id = u.id OR r.member_id = u.id)
       WHERE r.trainer_id = ? 
         AND u.id = ? 
         AND u.role = 'member' 
         AND u.is_active = 1
       LIMIT 1`,
      [trainerId, memberId]
    );
    return rows.length > 0;
  } else {
    const [rows] = await pool.execute(
      `SELECT 1 FROM routines r
       INNER JOIN users u ON r.member_id = u.id
       WHERE r.trainer_id = ? 
         AND u.id = ? 
         AND u.role = 'member' 
         AND u.is_active = 1
       LIMIT 1`,
      [trainerId, memberId]
    );
    return rows.length > 0;
  }
}

// ==============================================================================
// 1. REGISTRAR UNA SESIÓN DE ENTRENAMIENTO (con o sin series iniciales)
// POST /api/workouts/sessions
// ==============================================================================
export async function createSession(req, res, next) {
  let connection = null;
  try {
    const userId = req.user.id;
    const { routine_id, session_date, notes, sets } = req.body;
    const hasAssignmentsTable = await checkHasAssignmentsTable();

    let validatedRoutineId = null;
    if (routine_id !== undefined && routine_id !== null) {
      const parsedRoutine = Number(routine_id);
      if (!Number.isInteger(parsedRoutine) || parsedRoutine <= 0) {
        return res.status(400).json({
          ok: false,
          error: { message: 'identificador de rutina invalido', code: 'INVALID_ROUTINE_ID' }
        });
      }

      // Validar que la rutina exista
      const [routines] = await pool.execute(
        'SELECT id, member_id FROM routines WHERE id = ? LIMIT 1',
        [parsedRoutine]
      );

      if (routines.length === 0) {
        return res.status(404).json({
          ok: false,
          error: { message: 'la rutina especificada no existe', code: 'ROUTINE_NOT_FOUND' }
        });
      }

      // Seguridad: verificar si el socio está asignado a la rutina
      let isAssigned = false;
      if (hasAssignmentsTable) {
        const [assignRows] = await pool.execute(
          'SELECT 1 FROM routine_assignments WHERE routine_id = ? AND member_id = ? LIMIT 1',
          [parsedRoutine, userId]
        );
        isAssigned = assignRows.length > 0;
      }

      // Compatibilidad con campo legacy routines.member_id o plantilla sin asignaciones
      if (!isAssigned && routines[0].member_id !== null) {
        if (Number(routines[0].member_id) === Number(userId)) {
          isAssigned = true;
        } else {
          return res.status(403).json({
            ok: false,
            error: { message: 'no tienes permiso para usar una rutina asignada a otro socio', code: 'FORBIDDEN' }
          });
        }
      }

      validatedRoutineId = parsedRoutine;
    }

    // Fecha de sesión opcional o default now
    let validatedDate = new Date();
    if (session_date) {
      const d = new Date(session_date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({
          ok: false,
          error: { message: 'fecha de sesion invalida', code: 'INVALID_DATE' }
        });
      }
      validatedDate = d;
    }

    const cleanNotes = notes && typeof notes === 'string' ? notes.trim() : null;

    // Validar series si fueron enviadas en el payload inicial
    const cleanSets = [];
    if (sets !== undefined) {
      if (!Array.isArray(sets)) {
        return res.status(400).json({
          ok: false,
          error: { message: 'sets debe ser una lista de series', code: 'INVALID_SETS_PAYLOAD' }
        });
      }

      for (let i = 0; i < sets.length; i++) {
        const item = sets[i];
        const exId = Number(item.exercise_id);
        if (!Number.isInteger(exId) || exId <= 0) {
          return res.status(400).json({
            ok: false,
            error: { message: `el ejercicio en posicion ${i + 1} no tiene un id valido`, code: 'INVALID_EXERCISE_ID' }
          });
        }

        if (!isValidWeight(item.weight_kg)) {
          return res.status(400).json({
            ok: false,
            error: { message: `el peso en posicion ${i + 1} debe ser un numero positivo valido`, code: 'INVALID_WEIGHT' }
          });
        }

        if (!isValidReps(item.reps_completed)) {
          return res.status(400).json({
            ok: false,
            error: { message: `las repeticiones en posicion ${i + 1} deben ser un entero positivo`, code: 'INVALID_REPS' }
          });
        }

        const setNum = item.set_number !== undefined ? Number(item.set_number) : i + 1;
        if (!isValidSetNumber(setNum)) {
          return res.status(400).json({
            ok: false,
            error: { message: `el numero de serie en posicion ${i + 1} es invalido`, code: 'INVALID_SET_NUMBER' }
          });
        }

        cleanSets.push({
          exercise_id: exId,
          routine_exercise_id: item.routine_exercise_id ? Number(item.routine_exercise_id) : null,
          set_number: setNum,
          weight_kg: Number(item.weight_kg),
          reps_completed: Number(item.reps_completed),
          rpe: item.rpe !== undefined && item.rpe !== null ? Number(item.rpe) : null
        });
      }

      // Validar existencia de todos los exercises
      if (cleanSets.length > 0) {
        const uniqueExIds = [...new Set(cleanSets.map(s => s.exercise_id))];
        const placeholders = uniqueExIds.map(() => '?').join(',');
        const [foundEx] = await pool.execute(
          `SELECT id FROM exercises WHERE id IN (${placeholders})`,
          uniqueExIds
        );
        if (foundEx.length !== uniqueExIds.length) {
          return res.status(400).json({
            ok: false,
            error: { message: 'uno o mas ejercicios indicados no existen', code: 'EXERCISE_NOT_FOUND' }
          });
        }
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const hasStatus = await checkHasSessionStatus();

    // Bloqueo de concurrencia a nivel de usuario y rutina con GET_LOCK de MariaDB:
    // Serializa peticiones concurrentes antes de que exista la fila, contemplando routine_id null (sesión libre)
    let lockName = null;
    let lockAcquired = false;

    if (hasStatus) {
      const routineKey = validatedRoutineId !== null ? `r${validatedRoutineId}` : 'free';
      lockName = `workout_lock_u${userId}_${routineKey}`;
      const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 5) AS lock_ok', [lockName]);
      lockAcquired = lockRows.length > 0 && lockRows[0].lock_ok === 1;

      // Si no se pudo adquirir el cerrojo tras 5 segundos (por timeout o error), abortar de forma segura
      if (!lockAcquired) {
        await connection.rollback();
        return res.status(409).json({
          ok: false,
          error: {
            message: 'operación en curso. por favor aguarda un instante y reintenta',
            code: 'CONCURRENT_REQUEST_TIMEOUT'
          }
        });
      }

      // Una vez obtenido el lock exclusivo en MariaDB para este usuario y rutina (o sesión libre):
      let activeQuery = "SELECT id, user_id, routine_id, session_date, status, notes FROM workout_sessions WHERE user_id = ? AND status = 'in_progress'";
      const activeParams = [userId];

      if (validatedRoutineId !== null) {
        activeQuery += ' AND routine_id = ?';
        activeParams.push(validatedRoutineId);
      } else {
        activeQuery += ' AND routine_id IS NULL';
      }

      activeQuery += ' ORDER BY created_at DESC, id DESC LIMIT 1';

      const [existingActive] = await connection.execute(activeQuery, activeParams);

      if (existingActive.length > 0) {
        const active = existingActive[0];

        // Separación estricta de responsabilidades:
        // Si la sesión ya existe (por ejemplo, reintento de red o doble toque al iniciar),
        // NUNCA se vuelven a insertar las series para evitar duplicación.
        // La sesión se devuelve tal como está para que el cliente continúe desde su estado real.
        const [existingSets] = await connection.execute(
          `SELECT 
            sl.id, 
            sl.session_id, 
            sl.exercise_id, 
            sl.routine_exercise_id,
            sl.set_number, 
            sl.weight_kg, 
            sl.reps_completed, 
            sl.rpe, 
            sl.created_at,
            e.name AS exercise_name,
            e.muscle_group
          FROM workout_set_logs sl
          INNER JOIN exercises e ON sl.exercise_id = e.id
          WHERE sl.session_id = ?
          ORDER BY sl.exercise_id ASC, sl.set_number ASC`,
          [active.id]
        );

        await connection.commit();

        return res.status(200).json({
          ok: true,
          message: 'sesion de entrenamiento activa recuperada',
          data: {
            session: {
              ...active,
              sets_count: existingSets.length,
              sets: existingSets
            }
          }
        });
      }
    }

    let sessionRes;
    if (hasStatus) {
      [sessionRes] = await connection.execute(
        "INSERT INTO workout_sessions (user_id, routine_id, session_date, status, notes) VALUES (?, ?, ?, 'in_progress', ?)",
        [userId, validatedRoutineId, validatedDate, cleanNotes]
      );
    } else {
      [sessionRes] = await connection.execute(
        'INSERT INTO workout_sessions (user_id, routine_id, session_date, notes) VALUES (?, ?, ?, ?)',
        [userId, validatedRoutineId, validatedDate, cleanNotes]
      );
    }

    const sessionId = sessionRes.insertId;

    if (cleanSets.length > 0) {
      for (const s of cleanSets) {
        await connection.execute(
          `INSERT INTO workout_set_logs 
            (session_id, user_id, exercise_id, routine_exercise_id, set_number, weight_kg, reps_completed, rpe)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [sessionId, userId, s.exercise_id, s.routine_exercise_id, s.set_number, s.weight_kg, s.reps_completed, s.rpe]
        );
      }
    }

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: 'sesion de entrenamiento registrada exitosamente',
      data: {
        session: {
          id: sessionId,
          user_id: userId,
          routine_id: validatedRoutineId,
          session_date: validatedDate,
          notes: cleanNotes,
          sets_count: cleanSets.length
        }
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) {
      try {
        if (lockAcquired && lockName) {
          await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
        }
      } catch (e) {}
      connection.release();
    }
  }
}

// ==============================================================================
// 2. REGISTRAR UNA SERIE EN UNA SESIÓN EXISTENTE
// POST /api/workouts/sessions/:sessionId/sets
// ==============================================================================
export async function addSetToSession(req, res, next) {
  let connection = null;
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const parsedSessionId = Number(sessionId);

    if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de sesion invalido', code: 'INVALID_SESSION_ID' }
      });
    }

    const { exercise_id, routine_exercise_id, set_number, weight_kg, reps_completed, rpe } = req.body;

    const parsedExId = Number(exercise_id);
    if (!Number.isInteger(parsedExId) || parsedExId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de ejercicio invalido', code: 'INVALID_EXERCISE_ID' }
      });
    }

    // Comprobar existencia del ejercicio antes de abrir la transacción
    const [exRows] = await pool.execute('SELECT id FROM exercises WHERE id = ? LIMIT 1', [parsedExId]);
    if (exRows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'el ejercicio especificado no existe', code: 'EXERCISE_NOT_FOUND' }
      });
    }

    if (!isValidWeight(weight_kg)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'el peso debe ser un numero positivo valido en kg', code: 'INVALID_WEIGHT' }
      });
    }

    if (!isValidReps(reps_completed)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'las repeticiones deben ser un numero entero positivo', code: 'INVALID_REPS' }
      });
    }

    let parsedSetNumber = set_number ? Number(set_number) : null;
    if (parsedSetNumber !== null && !isValidSetNumber(parsedSetNumber)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'numero de serie invalido', code: 'INVALID_SET_NUMBER' }
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const hasStatus = await checkHasSessionStatus();
    let sessionQuery = 'SELECT id, user_id';
    if (hasStatus) sessionQuery += ', status';
    sessionQuery += ' FROM workout_sessions WHERE id = ? FOR UPDATE';

    // Bloqueo coordinado FOR UPDATE sobre la sesión de entrenamiento
    const [sessions] = await connection.execute(sessionQuery, [parsedSessionId]);

    if (sessions.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        error: { message: 'la sesion de entrenamiento no existe', code: 'SESSION_NOT_FOUND' }
      });
    }

    if (Number(sessions[0].user_id) !== Number(userId)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para agregar series a esta sesion', code: 'FORBIDDEN' }
      });
    }

    // Impedir agregar series si la sesion ya fue finalizada
    if (hasStatus && sessions[0].status === 'completed') {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'la sesion ya ha sido finalizada y no puede recibir nuevas series', code: 'SESSION_COMPLETED' }
      });
    }

    // Si no envio set_number, autocalcular la siguiente serie para este ejercicio en la sesion dentro del lock
    if (!parsedSetNumber) {
      const [maxSetRows] = await connection.execute(
        'SELECT COALESCE(MAX(set_number), 0) AS max_set FROM workout_set_logs WHERE session_id = ? AND exercise_id = ?',
        [parsedSessionId, parsedExId]
      );
      parsedSetNumber = Number(maxSetRows[0].max_set) + 1;
    }

    const parsedRoutineExId = routine_exercise_id ? Number(routine_exercise_id) : null;
    const parsedRpe = rpe !== undefined && rpe !== null ? Number(rpe) : null;

    const [insertRes] = await connection.execute(
      `INSERT INTO workout_set_logs 
        (session_id, user_id, exercise_id, routine_exercise_id, set_number, weight_kg, reps_completed, rpe)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [parsedSessionId, userId, parsedExId, parsedRoutineExId, parsedSetNumber, Number(weight_kg), Number(reps_completed), parsedRpe]
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      message: 'serie registrada exitosamente',
      data: {
        set: {
          id: insertRes.insertId,
          session_id: parsedSessionId,
          user_id: userId,
          exercise_id: parsedExId,
          routine_exercise_id: parsedRoutineExId,
          set_number: parsedSetNumber,
          weight_kg: Number(weight_kg),
          reps_completed: Number(reps_completed),
          rpe: parsedRpe
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

// ==============================================================================
// 3. CONSULTAR HISTORIAL DE SESIONES
// GET /api/workouts/history?member_id=X&limit=20
// - socio: ve su propio historial (req.user.id)
// - trainer: ve el de sus alumnos si tiene rutina vinculada
// - admin: ve cualquiera
// ==============================================================================
export async function getWorkoutHistory(req, res, next) {
  try {
    const { role, id: authUserId } = req.user;
    let targetUserId = authUserId;

    if (req.query.member_id) {
      const queryMemberId = Number(req.query.member_id);
      if (!Number.isInteger(queryMemberId) || queryMemberId <= 0) {
        return res.status(400).json({
          ok: false,
          error: { message: 'identificador de socio invalido', code: 'INVALID_MEMBER_ID' }
        });
      }

      if (role === 'member' && queryMemberId !== authUserId) {
        return res.status(403).json({
          ok: false,
          error: { message: 'no tienes permiso para consultar entrenamientos de otros usuarios', code: 'FORBIDDEN' }
        });
      }

      if (role === 'trainer') {
        const hasAccess = await canTrainerAccessMember(authUserId, queryMemberId);
        if (!hasAccess) {
          return res.status(403).json({
            ok: false,
            error: { message: 'no tienes permiso para ver el historial de este socio (no tienes rutinas asignadas a él)', code: 'FORBIDDEN' }
          });
        }
      }

      targetUserId = queryMemberId;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const hasWorkoutTables = await checkHasWorkoutTables();
    if (!hasWorkoutTables) {
      return res.status(200).json({
        ok: true,
        data: { sessions: [] }
      });
    }

    const hasStatus = await checkHasSessionStatus();
    let sessionSelect = `
      SELECT 
        s.id, 
        s.user_id, 
        s.routine_id, 
        s.session_date, 
        s.notes, 
        s.created_at,
        r.name AS routine_name,
        u.name AS user_name`;
    if (hasStatus) {
      sessionSelect += `, s.status, s.ended_at`;
    }
    sessionSelect += `
      FROM workout_sessions s
      LEFT JOIN routines r ON s.routine_id = r.id
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ?
      ORDER BY s.session_date DESC, s.id DESC
      LIMIT ?`;

    const [sessions] = await pool.execute(sessionSelect, [targetUserId, limit]);

    // Obtener total de sesiones para este usuario para facilitar métricas de historial
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) AS total FROM workout_sessions WHERE user_id = ?',
      [targetUserId]
    );
    const totalCount = Number(countRows[0]?.total || 0);

    if (sessions.length === 0) {
      return res.status(200).json({
        ok: true,
        data: {
          sessions: [],
          total: totalCount
        }
      });
    }

    const sessionIds = sessions.map(s => s.id);
    const placeholders = sessionIds.map(() => '?').join(',');

    const [sets] = await pool.execute(
      `SELECT 
        sl.id, 
        sl.session_id, 
        sl.exercise_id, 
        sl.routine_exercise_id,
        sl.set_number, 
        sl.weight_kg, 
        sl.reps_completed, 
        sl.rpe, 
        sl.created_at,
        e.name AS exercise_name,
        e.muscle_group
      FROM workout_set_logs sl
      INNER JOIN exercises e ON sl.exercise_id = e.id
      WHERE sl.session_id IN (${placeholders})
      ORDER BY sl.session_id DESC, sl.exercise_id ASC, sl.set_number ASC`,
      sessionIds
    );

    const setsBySession = {};
    for (const s of sets) {
      if (!setsBySession[s.session_id]) setsBySession[s.session_id] = [];
      setsBySession[s.session_id].push(s);
    }

    const formattedSessions = sessions.map(s => {
      const dur = calculateSessionDuration(s);
      return {
        ...s,
        duration_seconds: dur.duration_seconds,
        duration_formatted: dur.duration_formatted,
        sets: setsBySession[s.id] || []
      };
    });

    return res.status(200).json({
      ok: true,
      data: {
        sessions: formattedSessions,
        total: totalCount
      }
    });
  } catch (error) {
    next(error);
  }
}

// ==============================================================================
// 3.1 CONSULTAR DETALLE DE UNA SESIÓN PUNTUAL POR ID
// GET /api/workouts/sessions/:sessionId
// Permite al socio o entrenador autorizado consultar el detalle y todas las series de una sesión finalizada
// ==============================================================================
export async function getSessionById(req, res, next) {
  try {
    const { role, id: authUserId } = req.user;
    const { sessionId } = req.params;
    const parsedSessionId = Number(sessionId);

    if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de sesion invalido', code: 'INVALID_SESSION_ID' }
      });
    }

    const hasWorkoutTables = await checkHasWorkoutTables();
    if (!hasWorkoutTables) {
      return res.status(404).json({
        ok: false,
        error: { message: 'la sesion de entrenamiento no existe', code: 'SESSION_NOT_FOUND' }
      });
    }

    const hasStatus = await checkHasSessionStatus();
    let sessionSelect = `
      SELECT 
        s.id, 
        s.user_id, 
        s.routine_id, 
        s.session_date, 
        s.notes, 
        s.created_at,
        r.name AS routine_name,
        u.name AS user_name`;
    if (hasStatus) {
      sessionSelect += `, s.status, s.ended_at`;
    }
    sessionSelect += `
      FROM workout_sessions s
      LEFT JOIN routines r ON s.routine_id = r.id
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
      LIMIT 1`;

    const [sessions] = await pool.execute(sessionSelect, [parsedSessionId]);

    if (sessions.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'la sesion de entrenamiento no existe', code: 'SESSION_NOT_FOUND' }
      });
    }

    const session = sessions[0];

    // Control de acceso y aislamiento estricto
    if (role === 'member' && Number(session.user_id) !== Number(authUserId)) {
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para consultar el detalle de esta sesion', code: 'FORBIDDEN' }
      });
    }

    if (role === 'trainer' && Number(session.user_id) !== Number(authUserId)) {
      const hasAccess = await canTrainerAccessMember(authUserId, session.user_id);
      if (!hasAccess) {
        return res.status(403).json({
          ok: false,
          error: { message: 'no tienes permiso para ver las sesiones de este socio', code: 'FORBIDDEN' }
        });
      }
    }

    // Traer todas las series registradas en esta sesion
    const [sets] = await pool.execute(
      `SELECT 
        sl.id, 
        sl.session_id, 
        sl.exercise_id, 
        sl.routine_exercise_id,
        sl.set_number, 
        sl.weight_kg, 
        sl.reps_completed, 
        sl.rpe, 
        sl.created_at,
        e.name AS exercise_name,
        e.muscle_group
      FROM workout_set_logs sl
      INNER JOIN exercises e ON sl.exercise_id = e.id
      WHERE sl.session_id = ?
      ORDER BY sl.exercise_id ASC, sl.set_number ASC`,
      [parsedSessionId]
    );

    const dur = calculateSessionDuration(session);

    return res.status(200).json({
      ok: true,
      data: {
        session: {
          ...session,
          duration_seconds: dur.duration_seconds,
          duration_formatted: dur.duration_formatted,
          sets: sets || []
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// ==============================================================================
// 4. CONSULTAR ÚLTIMO REGISTRO DE UN EJERCICIO
// GET /api/workouts/exercises/:exerciseId/last
// Devuelve el último peso y repeticiones registradas para un ejercicio puntual
// ==============================================================================
export async function getLastExerciseLog(req, res, next) {
  try {
    const userId = req.user.id;
    const { exerciseId } = req.params;
    const parsedExId = Number(exerciseId);

    if (!Number.isInteger(parsedExId) || parsedExId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de ejercicio invalido', code: 'INVALID_EXERCISE_ID' }
      });
    }

    const hasWorkoutTables = await checkHasWorkoutTables();
    if (!hasWorkoutTables) {
      return res.status(200).json({
        ok: true,
        data: { last_log: null }
      });
    }

    const [rows] = await pool.execute(
      `SELECT 
        sl.id, 
        sl.session_id, 
        sl.exercise_id, 
        sl.set_number, 
        sl.weight_kg, 
        sl.reps_completed, 
        sl.rpe, 
        sl.created_at,
        e.name AS exercise_name,
        ws.session_date
      FROM workout_set_logs sl
      INNER JOIN exercises e ON sl.exercise_id = e.id
      INNER JOIN workout_sessions ws ON sl.session_id = ws.id
      WHERE sl.user_id = ? AND sl.exercise_id = ?
      ORDER BY ws.session_date DESC, sl.created_at DESC, sl.set_number DESC
      LIMIT 1`,
      [userId, parsedExId]
    );

    return res.status(200).json({
      ok: true,
      data: {
        last_log: rows.length > 0 ? rows[0] : null
      }
    });
  } catch (error) {
    next(error);
  }
}

// ==============================================================================
// 5. CONSULTAR HISTORIAL COMPLETO DE UN EJERCICIO
// GET /api/workouts/exercises/:exerciseId/history?member_id=X
// ==============================================================================
export async function getExerciseHistory(req, res, next) {
  try {
    const { role, id: authUserId } = req.user;
    const { exerciseId } = req.params;
    const parsedExId = Number(exerciseId);

    if (!Number.isInteger(parsedExId) || parsedExId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de ejercicio invalido', code: 'INVALID_EXERCISE_ID' }
      });
    }

    let targetUserId = authUserId;
    if (req.query.member_id) {
      const queryMemberId = Number(req.query.member_id);
      if (!Number.isInteger(queryMemberId) || queryMemberId <= 0) {
        return res.status(400).json({
          ok: false,
          error: { message: 'identificador de socio invalido', code: 'INVALID_MEMBER_ID' }
        });
      }

      if (role === 'member' && queryMemberId !== authUserId) {
        return res.status(403).json({
          ok: false,
          error: { message: 'no tienes permiso para ver registros ajenos', code: 'FORBIDDEN' }
        });
      }

      if (role === 'trainer') {
        const hasAccess = await canTrainerAccessMember(authUserId, queryMemberId);
        if (!hasAccess) {
          return res.status(403).json({
            ok: false,
            error: { message: 'no tienes permiso para ver el historial de este socio', code: 'FORBIDDEN' }
          });
        }
      }

      targetUserId = queryMemberId;
    }

    const hasWorkoutTables = await checkHasWorkoutTables();
    if (!hasWorkoutTables) {
      return res.status(200).json({
        ok: true,
        data: { history: [] }
      });
    }

    const [rows] = await pool.execute(
      `SELECT 
        sl.id, 
        sl.session_id, 
        sl.exercise_id, 
        sl.set_number, 
        sl.weight_kg, 
        sl.reps_completed, 
        sl.rpe, 
        sl.created_at,
        ws.session_date,
        e.name AS exercise_name,
        e.muscle_group
      FROM workout_set_logs sl
      INNER JOIN exercises e ON sl.exercise_id = e.id
      INNER JOIN workout_sessions ws ON sl.session_id = ws.id
      WHERE sl.user_id = ? AND sl.exercise_id = ?
      ORDER BY ws.session_date DESC, sl.set_number ASC
      LIMIT 100`,
      [targetUserId, parsedExId]
    );

    return res.status(200).json({
      ok: true,
      data: {
        history: rows
      }
    });
  } catch (error) {
    next(error);
  }
}

// ==============================================================================
// 6. ACTUALIZAR / CORREGIR UNA SERIE PROPIA
// PATCH /api/workouts/sets/:id
// Solo el socio dueño del registro puede corregir sus kilos o repeticiones
// ==============================================================================
export async function updateSet(req, res, next) {
  let connection = null;
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const setId = Number(id);

    if (!Number.isInteger(setId) || setId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de serie invalido', code: 'INVALID_ID' }
      });
    }

    const { weight_kg, reps_completed, rpe, set_number } = req.body;

    if (weight_kg !== undefined && !isValidWeight(weight_kg)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'peso invalido', code: 'INVALID_WEIGHT' }
      });
    }

    if (reps_completed !== undefined && !isValidReps(reps_completed)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'repeticiones invalidas', code: 'INVALID_REPS' }
      });
    }

    if (set_number !== undefined && !isValidSetNumber(set_number)) {
      return res.status(400).json({
        ok: false,
        error: { message: 'numero de serie invalido', code: 'INVALID_SET_NUMBER' }
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Bloqueo FOR UPDATE de la serie
    const [existing] = await connection.execute(
      'SELECT id, session_id, user_id, weight_kg, reps_completed, rpe, set_number FROM workout_set_logs WHERE id = ? FOR UPDATE',
      [setId]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        error: { message: 'la serie no existe', code: 'SET_NOT_FOUND' }
      });
    }

    // Seguridad estricta: solo el creador puede modificar sus marcas
    if (Number(existing[0].user_id) !== Number(userId)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para modificar series de otro usuario', code: 'FORBIDDEN' }
      });
    }

    // Bloqueo coordinado FOR UPDATE de la sesión padre
    const [parentSession] = await connection.execute(
      'SELECT id, status FROM workout_sessions WHERE id = ? FOR UPDATE',
      [existing[0].session_id]
    );
    if (parentSession.length > 0 && parentSession[0].status === 'completed') {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'no se pueden modificar series de una sesion finalizada', code: 'SESSION_COMPLETED' }
      });
    }

    const current = existing[0];
    const newWeight = weight_kg !== undefined ? Number(weight_kg) : current.weight_kg;
    const newReps = reps_completed !== undefined ? Number(reps_completed) : current.reps_completed;
    const newSetNum = set_number !== undefined ? Number(set_number) : current.set_number;
    const newRpe = rpe !== undefined ? (rpe !== null ? Number(rpe) : null) : current.rpe;

    await connection.execute(
      'UPDATE workout_set_logs SET weight_kg = ?, reps_completed = ?, set_number = ?, rpe = ? WHERE id = ?',
      [newWeight, newReps, newSetNum, newRpe, setId]
    );

    await connection.commit();

    return res.status(200).json({
      ok: true,
      message: 'serie actualizada exitosamente',
      data: {
        set: {
          id: setId,
          weight_kg: newWeight,
          reps_completed: newReps,
          set_number: newSetNum,
          rpe: newRpe
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

// ==============================================================================
// 7. ELIMINAR UNA SERIE PROPIA
// DELETE /api/workouts/sets/:id
// Solo el socio dueño del registro puede eliminarlo
// ==============================================================================
export async function deleteSet(req, res, next) {
  let connection = null;
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const setId = Number(id);

    if (!Number.isInteger(setId) || setId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de serie invalido', code: 'INVALID_ID' }
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Bloqueo de fila exclusivo FOR UPDATE para evitar colisiones en borrados concurrentes
    const [existing] = await connection.execute(
      'SELECT id, user_id, session_id, exercise_id FROM workout_set_logs WHERE id = ? FOR UPDATE',
      [setId]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        error: { message: 'la serie no existe', code: 'SET_NOT_FOUND' }
      });
    }

    const { session_id, exercise_id } = existing[0];

    if (Number(existing[0].user_id) !== Number(userId)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para eliminar series de otro usuario', code: 'FORBIDDEN' }
      });
    }

    // Impedir eliminar series si la sesion ya fue finalizada
    const [parentSession] = await connection.execute(
      'SELECT s.status FROM workout_sessions s INNER JOIN workout_set_logs l ON l.session_id = s.id WHERE l.id = ? LIMIT 1',
      [setId]
    );
    if (parentSession.length > 0 && parentSession[0].status === 'completed') {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        error: { message: 'no se pueden eliminar series de una sesion finalizada', code: 'SESSION_COMPLETED' }
      });
    }

    // Eliminación atómica dentro de la transacción
    await connection.execute('DELETE FROM workout_set_logs WHERE id = ?', [setId]);

    // Renumerar atómicamente las series restantes del mismo ejercicio en esta sesión
    if (session_id && exercise_id) {
      const [remainingSets] = await connection.execute(
        'SELECT id FROM workout_set_logs WHERE session_id = ? AND exercise_id = ? ORDER BY set_number ASC, created_at ASC, id ASC FOR UPDATE',
        [session_id, exercise_id]
      );

      for (let i = 0; i < remainingSets.length; i++) {
        const nextSetNum = i + 1;
        await connection.execute(
          'UPDATE workout_set_logs SET set_number = ? WHERE id = ?',
          [nextSetNum, remainingSets[i].id]
        );
      }
    }

    await connection.commit();

    return res.status(200).json({
      ok: true,
      message: 'serie eliminada exitosamente',
      data: { id: setId }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
}

// ==============================================================================
// 8. FINALIZAR UNA SESIÓN DE ENTRENAMIENTO
// PATCH /api/workouts/sessions/:sessionId/finish
// ==============================================================================
export async function finishSession(req, res, next) {
  let connection = null;
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const parsedSessionId = Number(sessionId);

    if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'identificador de sesion invalido', code: 'INVALID_SESSION_ID' }
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Bloqueo coordinado FOR UPDATE sobre la sesión de entrenamiento
    const [sessions] = await connection.execute(
      'SELECT id, user_id, status FROM workout_sessions WHERE id = ? FOR UPDATE',
      [parsedSessionId]
    );

    if (sessions.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        error: { message: 'la sesion de entrenamiento no existe', code: 'SESSION_NOT_FOUND' }
      });
    }

    if (Number(sessions[0].user_id) !== Number(userId)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        error: { message: 'no tienes permiso para finalizar esta sesion', code: 'FORBIDDEN' }
      });
    }

    const hasStatus = await checkHasSessionStatus();
    if (hasStatus) {
      if (sessions[0].status === 'completed') {
        await connection.commit();
        return res.status(200).json({
          ok: true,
          message: 'la sesion ya se encontraba finalizada',
          data: { session: sessions[0] }
        });
      }

      await connection.execute(
        "UPDATE workout_sessions SET status = 'completed', ended_at = NOW() WHERE id = ?",
        [parsedSessionId]
      );
    }

    const [updated] = await connection.execute(
      'SELECT id, user_id, routine_id, session_date, status, ended_at, notes FROM workout_sessions WHERE id = ? LIMIT 1',
      [parsedSessionId]
    );

    await connection.commit();

    const dur = calculateSessionDuration(updated[0] || { id: parsedSessionId, status: 'completed' });

    return res.status(200).json({
      ok: true,
      message: 'sesion de entrenamiento finalizada con exito',
      data: {
        session: {
          ...(updated[0] || { id: parsedSessionId, status: 'completed' }),
          duration_seconds: dur.duration_seconds,
          duration_formatted: dur.duration_formatted
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

// ==============================================================================
// 9. OBTENER SESIÓN ACTIVA EN CURSO DE UNA RUTINA
// GET /api/workouts/sessions/active?routine_id=X
// ==============================================================================
export async function getActiveSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { routine_id } = req.query;

    const hasWorkoutTables = await checkHasWorkoutTables();
    if (!hasWorkoutTables) {
      return res.status(200).json({
        ok: true,
        data: { active_session: null }
      });
    }

    const hasStatus = await checkHasSessionStatus();
    if (!hasStatus) {
      return res.status(200).json({
        ok: true,
        data: { active_session: null }
      });
    }

    // Recuperar la sesión in_progress activa cronológicamente más reciente:
    // Se toma siempre la última sesión que el socio inició para esta rutina (o entrenamiento libre).
    let query = `
      SELECT 
        ws.id, 
        ws.user_id, 
        ws.routine_id, 
        ws.session_date, 
        ws.status, 
        ws.notes, 
        ws.created_at
      FROM workout_sessions ws
      WHERE ws.user_id = ? AND ws.status = 'in_progress'
    `;
    const params = [userId];

    if (routine_id) {
      const parsedRoutine = Number(routine_id);
      if (Number.isInteger(parsedRoutine) && parsedRoutine > 0) {
        query += ' AND ws.routine_id = ?';
        params.push(parsedRoutine);
      }
    } else {
      query += ' AND ws.routine_id IS NULL';
    }

    query += ' ORDER BY ws.created_at DESC, ws.id DESC LIMIT 1';

    const [sessions] = await pool.execute(query, params);

    if (sessions.length === 0) {
      return res.status(200).json({
        ok: true,
        data: { active_session: null }
      });
    }

    const activeSession = sessions[0];
    const dur = calculateSessionDuration(activeSession);

    // Traer las series registradas en esta sesion activa
    const [sets] = await pool.execute(
      `SELECT 
        sl.id, 
        sl.session_id, 
        sl.exercise_id, 
        sl.routine_exercise_id,
        sl.set_number, 
        sl.weight_kg, 
        sl.reps_completed, 
        sl.rpe, 
        sl.created_at,
        e.name AS exercise_name,
        e.muscle_group
      FROM workout_set_logs sl
      INNER JOIN exercises e ON sl.exercise_id = e.id
      WHERE sl.session_id = ?
      ORDER BY sl.exercise_id ASC, sl.set_number ASC`,
      [activeSession.id]
    );

    return res.status(200).json({
      ok: true,
      data: {
        active_session: {
          ...activeSession,
          duration_seconds: dur.duration_seconds,
          duration_formatted: dur.duration_formatted,
          sets: sets || []
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

// ==============================================================================
// 10. OBTENER LISTA DE ALUMNOS ASIGNADOS A UN ENTRENADOR
// GET /api/workouts/trainer/members
// ==============================================================================
export async function getTrainerAssignedMembers(req, res, next) {
  try {
    const trainerId = req.user.id;
    const hasAssignmentsTable = await checkHasAssignmentsTable();

    let query;
    let params;

    if (hasAssignmentsTable) {
      query = `
        SELECT DISTINCT 
          u.id, 
          u.name, 
          u.email, 
          u.is_active
        FROM users u
        INNER JOIN (
          SELECT ra.member_id 
          FROM routine_assignments ra
          INNER JOIN routines r ON ra.routine_id = r.id
          WHERE r.trainer_id = ?
          UNION
          SELECT r2.member_id
          FROM routines r2
          WHERE r2.trainer_id = ? AND r2.member_id IS NOT NULL
        ) assigned ON u.id = assigned.member_id
        WHERE u.role = 'member' AND u.is_active = 1
        ORDER BY u.name ASC`;
      params = [trainerId, trainerId];
    } else {
      query = `
        SELECT DISTINCT 
          u.id, 
          u.name, 
          u.email, 
          u.is_active
        FROM users u
        INNER JOIN routines r ON u.id = r.member_id
        WHERE r.trainer_id = ? AND u.role = 'member' AND u.is_active = 1
        ORDER BY u.name ASC`;
      params = [trainerId];
    }

    const [members] = await pool.execute(query, params);

    return res.status(200).json({
      ok: true,
      data: {
        members: members || []
      }
    });
  } catch (error) {
    next(error);
  }
}
