import { Router } from 'express';
import { UserChallengeController } from '../../controllers/user/userChallengeController.js';

const router = Router();

router.get('/', UserChallengeController.getPublicChallenges);
router.post('/submit', UserChallengeController.submitAnswer);
router.get('/progress', UserChallengeController.getParticipantProgress);
router.get('/story-fragments', UserChallengeController.getUnlockedStoryFragments);
router.get('/:identifier', UserChallengeController.getPublicChallenge);

export default router;
