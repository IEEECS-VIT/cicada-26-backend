import { Router } from 'express';
import { UserLeaderboardController } from '../../controllers/user/userLeaderboardController.js';

const router = Router();

router.get('/', UserLeaderboardController.getLeaderboard);

export default router;
