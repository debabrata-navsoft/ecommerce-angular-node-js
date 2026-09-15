import { Router } from 'express';
import { body } from 'express-validator';

import {
  addAddress,
  deleteAddress,
  deleteUser,
  getUser,
  listAddresses,
  listUsers,
  setUserRole,
  updateAddress,
  updateUser,
} from '../controllers/user.controller.js';
import { requireAdmin, requireAuth, requireSelfOrAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { addressRules, objectIdParam } from './validators.js';

const router = Router();

router.use(requireAuth);

router.get('/', requireAdmin, listUsers);

router.get('/:id', objectIdParam('id'), validate, requireSelfOrAdmin('id'), getUser);
router.patch('/:id', objectIdParam('id'), validate, requireSelfOrAdmin('id'), updateUser);
router.delete('/:id', requireAdmin, objectIdParam('id'), validate, deleteUser);

// Role changes are admin-only and kept off the profile-edit route on purpose.
router.patch(
  '/:id/role',
  requireAdmin,
  [objectIdParam('id'), body('role').isIn(['user', 'admin'])],
  validate,
  setUserRole,
);

router
  .route('/:id/addresses')
  .all(objectIdParam('id'), validate, requireSelfOrAdmin('id'))
  .get(listAddresses)
  .post(addressRules(), validate, addAddress);

router
  .route('/:id/addresses/:addressId')
  .all(objectIdParam('id'), objectIdParam('addressId'), validate, requireSelfOrAdmin('id'))
  .patch(addressRules(), validate, updateAddress)
  .delete(deleteAddress);

export default router;
