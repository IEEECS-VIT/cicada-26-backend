import { Router } from 'express';
import { AdminChallengeController } from '../../controllers/admin/adminChallengeController.js';
import { requireAdmin } from '../../middleware/authMiddleware.js';

const router = Router();

router.use(requireAdmin);

router.get('/', AdminChallengeController.getPublicChallenges);
router.get('/all', AdminChallengeController.getAllChallengesAdmin);
router.post('/', AdminChallengeController.createChallenge);
router.put('/:id', AdminChallengeController.updateChallenge);
router.delete('/:id', AdminChallengeController.deleteChallenge);
router.get('/progress', AdminChallengeController.getAdminProgressTracking);
router.get('/participant-progress', AdminChallengeController.getParticipantProgress);
router.post('/override', AdminChallengeController.adminOverride);
router.post('/reset-team', AdminChallengeController.resetTeamProgress);
router.get('/submission-logs', AdminChallengeController.getSubmissionLogs);

export default router;
