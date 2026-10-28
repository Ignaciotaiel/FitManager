import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import exerciseRoutes from './routes/exerciseRoutes.js';
import routineRoutes from './routes/routineRoutes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware.js';

// cargar variables de entorno locales
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// middlewares globales
app.use(cors({
  origin: '*',
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
