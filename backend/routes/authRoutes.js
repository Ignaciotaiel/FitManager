import { Router } from 'express';
import {
  register,
  login,
  setupFirstAdmin,
  getCurrentUser,
  oauthGoogle,
  verifyGoogleAuth,
  oauthGithub,
  oauthDiscord
} from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// rutas publicas de autenticacion local
router.post('/register', register);
router.post('/login', login);

// inicializacion protegida del primer administrador (requiere SETUP_ADMIN_KEY estricta)
router.post('/setup-admin', setupFirstAdmin);

// ruta protegida para obtener el usuario autenticado
router.get('/me', verifyToken, getCurrentUser);

// rutas arquitectonicas y de verificacion para oauth
router.get('/google', oauthGoogle);
router.post('/google/verify', verifyGoogleAuth);
router.get('/github', oauthGithub);
router.get('/discord', oauthDiscord);

export default router;
