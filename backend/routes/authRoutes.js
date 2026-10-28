import { Router } from 'express';
import {
  register,
  login,
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

// ruta protegida para obtener el usuario autenticado
router.get('/me', verifyToken, getCurrentUser);

// rutas arquitectonicas y de verificacion para oauth
router.get('/google', oauthGoogle);
router.post('/google/verify', verifyGoogleAuth);
router.get('/github', oauthGithub);
router.get('/discord', oauthDiscord);

export default router;
