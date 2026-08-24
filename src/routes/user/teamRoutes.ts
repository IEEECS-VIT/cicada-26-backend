import { Router } from 'express';
import { UserTeamController } from '../../controllers/user/userTeamController.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

const router = Router();

// CHANGE 5: All team routes require authentication
router.use(requireAuth);

router.get('/me/members', UserTeamController.getMyTeamMembers);
router.post('/create', UserTeamController.createTeam);
router.post('/join', UserTeamController.joinTeam);
router.post('/update-name', UserTeamController.updateTeamName);
router.post('/leave', UserTeamController.leaveTeam);

export default router;
