import { Router } from 'express';
import { AdminAuthController } from '../../controllers/admin/adminAuthController.js';
import { requireAdmin } from '../../middleware/authMiddleware.js';

const router = Router();

router.use(requireAdmin);

router.post('/toggle-role', AdminAuthController.toggleRole);
router.post('/approve-admin', AdminAuthController.approveAdmin);
router.get('/users', AdminAuthController.listUsers);
router.post('/delete-user', AdminAuthController.deleteUser);
router.post('/bulk-import-admins', AdminAuthController.bulkImportAdmins);
router.post('/import-admins', AdminAuthController.bulkImportAdmins);

export default router;
