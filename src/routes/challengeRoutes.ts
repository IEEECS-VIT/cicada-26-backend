import { Router } from 'express';
import { ChallengeController } from '../controllers/challengeController.js';
import { requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

// Public / Participant Endpoints
router.get('/', ChallengeController.getPublicChallenges);
router.post('/submit', ChallengeController.submitAnswer);
router.get('/progress', ChallengeController.getParticipantProgress);
router.get('/story-fragments', ChallengeController.getUnlockedStoryFragments);
router.get('/:identifier', ChallengeController.getPublicChallenge);

// Admin Protected Endpoints
router.get('/admin/progress', requireAdmin, ChallengeController.getAdminProgressTracking);
router.post('/admin/override', requireAdmin, ChallengeController.adminOverride);
router.post('/admin/reset-team', requireAdmin, ChallengeController.resetTeamProgress);
router.get('/admin/submission-logs', requireAdmin, ChallengeController.getSubmissionLogs);
router.get('/admin/all', requireAdmin, ChallengeController.getAllChallengesAdmin);
router.post('/admin', requireAdmin, ChallengeController.createChallenge);
router.put('/admin/:id', requireAdmin, ChallengeController.updateChallenge);
router.delete('/admin/:id', requireAdmin, ChallengeController.deleteChallenge);

export default router;
