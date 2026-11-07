import { Router } from 'express';
import {
  getAdminUsers,
  updateUserRole,
  deleteUser,
} from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// All admin routes are strictly guarded by ADMIN role
router.use(authenticate, requireRole([Role.ADMIN]));

router.get('/users', getAdminUsers);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

export default router;
