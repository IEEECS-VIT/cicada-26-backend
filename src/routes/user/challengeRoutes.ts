import { Router } from 'express';
import { UserChallengeController } from '../../controllers/user/userChallengeController.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { submissionRateLimiter } from '../../middleware/rateLimitMiddleware.js';

const router = Router();

// Require user authentication for all challenge operations
router.use(requireAuth);

router.post('/submit', submissionRateLimiter, UserChallengeController.submitAnswer);
router.get('/', UserChallengeController.getPublicChallenges);
router.get('/progress', UserChallengeController.getParticipantProgress);
router.get('/story-fragments', UserChallengeController.getUnlockedStoryFragments);
router.get('/assets/masked', UserChallengeController.viewMaskedAsset);
router.get('/:identifier', UserChallengeController.getPublicChallenge);

export default router;
