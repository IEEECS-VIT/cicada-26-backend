import { Router } from 'express';
import userChallengeRoutes from './user/challengeRoutes.js';
import adminChallengeRoutes from './admin/challengeRoutes.js';

const router = Router();

// Mount admin challenge routes under /admin
router.use('/admin', adminChallengeRoutes);

// Mount user challenge routes
router.use('/', userChallengeRoutes);

export default router;
