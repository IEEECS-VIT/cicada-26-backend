import { Router } from 'express';
import { UserAuthController } from '../../controllers/user/userAuthController.js';
import { requireAuth, requireAdmin } from '../../middleware/authMiddleware.js';

const router = Router();

// Public routes (no auth required — these ARE the login/verify endpoints)
router.post('/login', UserAuthController.login);
router.post('/verify-login', UserAuthController.verifyLogin);

// Protected routes
router.get('/me', requireAuth, UserAuthController.getProfile);
router.post('/logout', UserAuthController.logout);

// Admin-only: whitelist a participant email (NOT public — prevents self-registration)
router.post('/seed-user', requireAdmin, UserAuthController.seedUser);

export default router;
