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

// Hint Management routes pointing to the challenge
router.post('/:id/hints', AdminChallengeController.addHint);
router.put('/:id/hints/:hintId', AdminChallengeController.editHint);
router.delete('/:id/hints/:hintId', AdminChallengeController.deleteHint);
router.patch('/:id/hints/:hintId/toggle', AdminChallengeController.toggleHint);

// Asset Management routes pointing to the challenge
router.post('/:id/assets', AdminChallengeController.addAsset);
router.put('/:id/assets/:assetId', AdminChallengeController.editAsset);
router.delete('/:id/assets/:assetId', AdminChallengeController.deleteAsset);

// IP Tracking / Location Locking Toggle routes
router.get('/ip-tracking', AdminChallengeController.getIpTrackingStatus);
router.get('/ip-blocking', AdminChallengeController.getIpTrackingStatus);
router.post('/ip-tracking/toggle', AdminChallengeController.toggleIpTracking);
router.post('/ip-blocking/toggle', AdminChallengeController.toggleIpTracking);
router.post('/toggle-ip-tracking', AdminChallengeController.toggleIpTracking);
router.post('/toggle-ip-blocking', AdminChallengeController.toggleIpTracking);
router.patch('/ip-tracking', AdminChallengeController.toggleIpTracking);
router.patch('/ip-blocking', AdminChallengeController.toggleIpTracking);
router.post('/ip-tracking', AdminChallengeController.toggleIpTracking);
router.post('/ip-blocking', AdminChallengeController.toggleIpTracking);

export default router;
