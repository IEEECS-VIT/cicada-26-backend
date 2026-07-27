import { Router } from 'express';
import { GodAuthController } from '../../controllers/god/godAuthController.js';
import { requireGod } from '../../middleware/authMiddleware.js';

const router = Router();

// Public Super Admin verification route
router.post('/verify-login', GodAuthController.verifyLogin);

// Protected Super Admin role escalation route
router.post('/grant-god-role', requireGod, GodAuthController.grantGodRole);

export default router;
