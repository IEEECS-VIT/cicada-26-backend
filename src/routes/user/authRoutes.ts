import { Router } from 'express';
import { UserAuthController } from '../../controllers/user/userAuthController.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

const router = Router();

router.post('/seed-user', UserAuthController.seedUser);
router.post('/login', UserAuthController.login);
router.post('/verify-login', UserAuthController.verifyLogin);
router.get('/me', requireAuth, UserAuthController.getProfile);

export default router;
