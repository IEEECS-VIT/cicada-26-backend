import { Router } from 'express';
import { UserAuthController } from '../../controllers/user/userAuthController.js';

const router = Router();

router.post('/seed-user', UserAuthController.seedUser);
router.post('/verify-login', UserAuthController.verifyLogin);

export default router;
