import { Router } from 'express';
import { body } from 'express-validator';

import {
  addAddress,
  deleteAddress,
  deleteUser,
  getAvatarUploadSignature,
  getUser,
  listAddresses,
  listUsers,
  removeAvatar,
  saveAvatar,
  setUserRole,
  updateAddress,
  updatePaymentPrefs,
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

// Avatar: the browser uploads to Cloudinary with the signature, then posts the URL back.
router
  .route('/:id/avatar')
  .all(objectIdParam('id'), validate, requireSelfOrAdmin('id'))
  .get(getAvatarUploadSignature)
  .post(body('url').isString().notEmpty(), validate, saveAvatar)
  .delete(removeAvatar);

router.patch(
  '/:id/payment-prefs',
  [
    objectIdParam('id'),
    body('defaultMethod').optional().isIn(['cod', 'upi', 'card', 'emi', 'netbanking']),
    body('upiIds').optional().isArray({ max: 5 }),
    // A UPI id is `handle@psp`; the PSP suffix has no dots, unlike an email domain.
    body('upiIds.*').optional().isString().trim().matches(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/),
  ],
  validate,
  requireSelfOrAdmin('id'),
  updatePaymentPrefs,
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
