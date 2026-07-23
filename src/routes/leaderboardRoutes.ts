import { Router } from 'express';
import { LeaderboardController } from '../controllers/leaderboardController.js';
import { requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

// Public / Client Endpoints
router.get('/', LeaderboardController.getLeaderboard);
router.get('/stream', LeaderboardController.streamLeaderboard);

// Admin / System Protected Endpoints
router.get('/export', requireAdmin, LeaderboardController.exportLeaderboard);
router.get('/export/csv', requireAdmin, LeaderboardController.exportLeaderboard);
// Set ANY score to ANY extent by team name (creates or updates directly)
router.post('/submit', requireAdmin, LeaderboardController.submitScore);
router.post('/score', requireAdmin, LeaderboardController.submitScore);

// Adjust score by adding/subtracting any amount (delta) by team name or ID
router.patch('/:identifier/adjust', requireAdmin, LeaderboardController.adjustScore);
router.patch('/:id/increment', requireAdmin, LeaderboardController.adjustScore);

// Full update of team fields by ID
router.put('/:id', requireAdmin, LeaderboardController.updateScore);

// Delete team by name or ID
router.delete('/:identifier', requireAdmin, LeaderboardController.deleteTeam);

// Reset entire leaderboard
router.post('/reset', requireAdmin, LeaderboardController.resetLeaderboard);

export default router;
