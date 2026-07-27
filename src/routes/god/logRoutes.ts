import { Router } from 'express';
import { GodLogController } from '../../controllers/god/godLogController.js';
import { requireGod } from '../../middleware/authMiddleware.js';

const router = Router();

// Enforce Super Admin ('GOD') authorization on all log management routes
router.use(requireGod);

router.get('/', GodLogController.getAdminLogs);
router.delete('/', GodLogController.clearAdminLogs);
router.delete('/:id', GodLogController.deleteAdminLog);

export default router;
