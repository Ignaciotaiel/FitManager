import { Router } from 'express';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import {
  getActivityLogs,
  listNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
  getActiveNotificationsForUser,
  listIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
  getExportData
} from '../controllers/adminController.js';

const router = Router();

// Endpoint para que cualquier usuario autenticado vea notificaciones relevantes a su rol
router.get('/notifications/active', verifyToken, getActiveNotificationsForUser);

// Todos los demás endpoints requieren verificación estricta de token y rol 'admin'
router.use(verifyToken, requireRole('admin'));

// 1. Registro de actividad
router.get('/activity-logs', getActivityLogs);

// 2. Centro de notificaciones (Admin CRUD)
router.get('/notifications', listNotifications);
router.post('/notifications', createNotification);
router.put('/notifications/:id', updateNotification);
router.delete('/notifications/:id', deleteNotification);

// 3. Gestión de incidencias (Admin CRUD)
router.get('/incidents', listIncidents);
router.post('/incidents', createIncident);
router.patch('/incidents/:id', updateIncident);
router.delete('/incidents/:id', deleteIncident);

// 4. Exportación de informes
router.get('/export/:entity', getExportData);

export default router;

