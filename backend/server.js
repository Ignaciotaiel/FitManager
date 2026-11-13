// Configura e inicia el servidor Express, CORS, rutas de la API y verificación de salud.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import exerciseRoutes from './routes/exerciseRoutes.js';
import routineRoutes from './routes/routineRoutes.js';
import workoutRoutes from './routes/workoutRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware.js';

// cargar variables de entorno locales
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// CORS: por defecto se mantiene el comportamiento actual (origin '*', usado por la apk y produccion).
// si se define CORS_ALLOWED_ORIGINS (lista separada por comas) se activa una lista blanca:
// solo esos origenes, los de desarrollo local (localhost / 127.0.0.1) y peticiones sin Origin (apps moviles).
const LOCAL_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOrigin = allowedOrigins.length === 0
  ? '*'
  : (origin, callback) => {
      if (!origin || LOCAL_ORIGIN_REGEX.test(origin) || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    };

// middlewares globales
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// endpoint de salud del sistema y verificacion de base de datos
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();

  if (dbStatus.ok) {
    return res.status(200).json({
      ok: true,
      service: 'fitmanager-backend',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        engine: 'mariadb/mysql',
        port: Number(process.env.DB_PORT) || 3306,
        name: process.env.DB_NAME || 'fitmanager'
      }
    });
  }

  // si falla la base, se responde con 503 sin exponer credenciales ni stack traces
  return res.status(503).json({
    ok: false,
    service: 'fitmanager-backend',
    timestamp: new Date().toISOString(),
    database: {
      status: 'disconnected',
      error: 'no fue posible conectar con el servidor de base de datos'
    }
  });
});

// rutas de la api
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/admin', adminRoutes);

// manejadores de ruta no encontrada y errores
app.use(notFoundHandler);
app.use(errorHandler);

// inicio del servidor si se ejecuta directamente
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`servidor fitmanager iniciado en el puerto ${PORT}`);
  });
}

export default app;
