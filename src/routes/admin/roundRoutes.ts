import { Router } from 'express';
import { AdminRoundController } from '../../controllers/admin/adminRoundController.js';

const router = Router();

router.get('/', AdminRoundController.getRounds);
router.post('/', AdminRoundController.createRound);
router.put('/:id', AdminRoundController.updateRound);
router.delete('/:id', AdminRoundController.deleteRound);

export default router;
