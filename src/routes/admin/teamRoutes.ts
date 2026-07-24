import { Router } from 'express';
import { AdminTeamController } from '../../controllers/admin/adminTeamController.js';
import { requireAdmin } from '../../middleware/authMiddleware.js';

const router = Router();

router.use(requireAdmin);

router.post('/remove-member', AdminTeamController.removeMember);
router.post('/delete-team', AdminTeamController.deleteTeam);

export default router;
