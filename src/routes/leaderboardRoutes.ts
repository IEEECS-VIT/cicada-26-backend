import { Router } from 'express';
import userLeaderboardRoutes from './user/leaderboardRoutes.js';
import adminLeaderboardRoutes from './admin/leaderboardRoutes.js';

const router = Router();

// Public / Client Endpoints
router.use('/', userLeaderboardRoutes);

// Admin / System Protected Endpoints
router.use('/', adminLeaderboardRoutes);

export default router;
