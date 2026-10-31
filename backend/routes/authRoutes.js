import { Router } from 'express';
import {
  register,
  login,
  verifyEmail,
  resendVerificationCode,
  setupFirstAdmin,
  getCurrentUser,
  oauthGoogle,
  verifyGoogleAuth,
  oauthGithub,
  oauthGithubCallback,
  oauthDiscord,
  oauthDiscordCallback,
  exchangeOAuthTicket,
  forgotPassword,
  verifyResetCode,
  resetPassword
} from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// rutas publicas de autenticacion local y verificacion de correo
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);

// rutas publicas de recuperacion de contrasena
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);

// inicializacion protegida del primer administrador (requiere SETUP_ADMIN_KEY estricta)
router.post('/setup-admin', setupFirstAdmin);

// ruta protegida para obtener el usuario autenticado
router.get('/me', verifyToken, getCurrentUser);

// rutas arquitectonicas y de verificacion para oauth
router.get('/google', oauthGoogle);
router.post('/google/verify', verifyGoogleAuth);
router.get('/github', oauthGithub);
router.get('/github/callback', oauthGithubCallback);
router.get('/discord', oauthDiscord);
router.get('/discord/callback', oauthDiscordCallback);
router.post('/oauth/exchange-ticket', exchangeOAuthTicket);

export default router;
