import { Router } from 'express';
import { UserLeaderboardController } from '../../controllers/user/userLeaderboardController.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

const router = Router();

// requireAuth: only logged-in participants/admins can view the leaderboard
// This prevents unauthenticated bots or spectators from scraping rankings
router.use(requireAuth);

router.get('/', UserLeaderboardController.getLeaderboard);

export default router;
