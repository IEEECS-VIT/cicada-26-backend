import { Router } from 'express';
import { UserTeamController } from '../../controllers/user/userTeamController.js';

const router = Router();

router.post('/create', UserTeamController.createTeam);
router.post('/join', UserTeamController.joinTeam);
router.post('/update-name', UserTeamController.updateTeamName);
router.post('/leave', UserTeamController.leaveTeam);

export default router;
