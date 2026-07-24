import { Router } from 'express';
import { AdminLeaderboardController } from '../../controllers/admin/adminLeaderboardController.js';
import { requireAdmin } from '../../middleware/authMiddleware.js';

const router = Router();

router.use(requireAdmin);

router.get('/stream', AdminLeaderboardController.streamLeaderboard);
router.get('/export', AdminLeaderboardController.exportLeaderboard);
router.get('/export/csv', AdminLeaderboardController.exportLeaderboard);
router.post('/submit', AdminLeaderboardController.submitScore);
router.post('/score', AdminLeaderboardController.submitScore);
router.patch('/:identifier/adjust', AdminLeaderboardController.adjustScore);
router.patch('/:id/increment', AdminLeaderboardController.adjustScore);
router.put('/:id', AdminLeaderboardController.updateScore);
router.delete('/:identifier', AdminLeaderboardController.deleteTeam);
router.post('/reset', AdminLeaderboardController.resetLeaderboard);

export default router;
